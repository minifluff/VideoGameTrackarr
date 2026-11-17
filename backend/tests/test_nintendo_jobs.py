from app.core.config import get_settings
from app.models.catalog import Game, GameCategory, Platform
from app.models.library import LibraryItem, LibraryStatus, MediaFormat
from app.models.nintendo import NintendoPriceCache
from app.repositories import nintendo_repository
from app.services import nintendo_jobs
from app.services.nintendo_client import NintendoClient, NintendoDeal, NintendoGamePrice


def _configure_nintendo(monkeypatch):
    # The repo-root .env may have a real NINTENDO_COUNTRY value for local dev use — pin it
    # explicitly, same reasoning as test_platprices_jobs.py's equivalent.
    monkeypatch.setattr(get_settings(), "nintendo_country", "CA")
    monkeypatch.setattr(nintendo_jobs, "_PACE_DELAY_SECONDS", 0)


def _seed_switch_platform(db_session) -> Platform:
    platform = Platform(name="Nintendo Switch", slug="switch")
    db_session.add(platform)
    db_session.commit()
    return platform


def _seed_wishlisted_switch_game(db_session, igdb_id: int, name: str, switch_platform, track: bool = True) -> Game:
    game = Game(igdb_id=igdb_id, name=name, slug=name.lower().replace(" ", "-"), category=GameCategory.MAIN_GAME)
    db_session.add(game)
    db_session.commit()
    db_session.add(
        LibraryItem(
            game_id=game.id,
            platform_id=switch_platform.id,
            format=MediaFormat.DIGITAL,
            status=LibraryStatus.WISHLIST,
            track_for_sales=track,
        )
    )
    db_session.commit()
    return game


def test_run_skips_a_wishlisted_game_on_a_non_switch_platform(db_session, seed_pc_platform, monkeypatch):
    """seed_pc_platform (slug "win") isn't Switch/Switch 2 — Nintendo doesn't cover it — so
    the job must never even attempt a lookup for a game only wishlisted there."""
    game = Game(igdb_id=1, name="PC Only Game", slug="pc-only-game", category=GameCategory.MAIN_GAME)
    db_session.add(game)
    db_session.commit()
    db_session.add(
        LibraryItem(
            game_id=game.id,
            platform_id=seed_pc_platform.id,
            format=MediaFormat.DIGITAL,
            status=LibraryStatus.WISHLIST,
            track_for_sales=True,
        )
    )
    db_session.commit()
    _configure_nintendo(monkeypatch)

    search_calls = []

    async def fake_search(self, title, country):
        search_calls.append(title)
        return None

    monkeypatch.setattr(NintendoClient, "search_game", fake_search)

    result = nintendo_jobs.run(lambda: db_session)

    assert result["total"] == 0
    assert search_calls == []


def test_run_skips_a_wishlisted_switch_game_with_tracking_off(db_session, monkeypatch):
    switch = _seed_switch_platform(db_session)
    _seed_wishlisted_switch_game(db_session, 1, "Untracked Game", switch, track=False)
    _configure_nintendo(monkeypatch)

    search_calls = []

    async def fake_search(self, title, country):
        search_calls.append(title)
        return None

    monkeypatch.setattr(NintendoClient, "search_game", fake_search)

    result = nintendo_jobs.run(lambda: db_session)

    assert result["total"] == 0
    assert search_calls == []


def test_run_matches_and_refreshes_a_switch_game(db_session, monkeypatch):
    switch = _seed_switch_platform(db_session)
    game = _seed_wishlisted_switch_game(db_session, 1, "Mario Kart 8 Deluxe", switch)
    _configure_nintendo(monkeypatch)

    async def fake_search(self, title, country):
        assert country == "CA"
        return "70010000000153"

    async def fake_get_prices(self, nsuids, country):
        assert nsuids == ["70010000000153"]
        return {
            "70010000000153": NintendoGamePrice(
                current_deal=NintendoDeal(
                    shop_name="Nintendo eShop", price_amount=56.99, price_currency="CAD", cut=33
                ),
                regular_price_amount=84.99,
                regular_price_currency="CAD",
            )
        }

    monkeypatch.setattr(NintendoClient, "search_game", fake_search)
    monkeypatch.setattr(NintendoClient, "get_prices", fake_get_prices)

    game_id = game.id  # the job closes the session, detaching the ORM instance
    result = nintendo_jobs.run(lambda: db_session)

    assert result == {"total": 1, "succeeded": 1, "failed": 0, "failures": []}
    cache = nintendo_repository.get_cache(db_session, game_id)
    assert cache is not None
    assert cache.nsuid == "70010000000153"
    assert cache.ignored is False
    assert cache.current_price_amount == 56.99
    assert cache.current_price_currency == "CAD"
    assert cache.current_shop_name == "Nintendo eShop"
    assert cache.current_cut == 33
    assert cache.region == "CA"
    # Historical low is self-built: first observation at the sale price seeds it.
    assert cache.historical_low_amount == 56.99
    assert cache.historical_low_currency == "CAD"
    assert cache.historical_low_shop_name == "Nintendo eShop"
    assert cache.historical_low_at is not None


def test_run_builds_the_historical_low_from_observed_prices(db_session, monkeypatch):
    switch = _seed_switch_platform(db_session)
    game = _seed_wishlisted_switch_game(db_session, 1, "Mario Kart 8 Deluxe", switch)
    _configure_nintendo(monkeypatch)

    async def fake_search(self, title, country):
        return "70010000000153"

    monkeypatch.setattr(NintendoClient, "search_game", fake_search)
    prices_by_run = [
        # Run 1: not on sale — the regular price seeds the low.
        {
            "70010000000153": NintendoGamePrice(
                current_deal=None, regular_price_amount=84.99, regular_price_currency="CAD"
            )
        },
        # Run 2: on sale — the low drops to the sale price.
        {
            "70010000000153": NintendoGamePrice(
                current_deal=NintendoDeal(shop_name="Nintendo eShop", price_amount=56.99, price_currency="CAD", cut=33),
                regular_price_amount=84.99,
                regular_price_currency="CAD",
            )
        },
        # Run 3: back to regular — the low stays at the sale price.
        {
            "70010000000153": NintendoGamePrice(
                current_deal=None, regular_price_amount=84.99, regular_price_currency="CAD"
            )
        },
    ]
    calls = {"n": 0}

    async def fake_get_prices(self, nsuids, country):
        result = prices_by_run[calls["n"]]
        calls["n"] += 1
        return result

    monkeypatch.setattr(NintendoClient, "get_prices", fake_get_prices)

    game_id = game.id  # the job closes the session, detaching the ORM instance
    nintendo_jobs.run(lambda: db_session)
    assert nintendo_repository.get_cache(db_session, game_id).historical_low_amount == 84.99
    nintendo_jobs.run(lambda: db_session)
    assert nintendo_repository.get_cache(db_session, game_id).historical_low_amount == 56.99
    nintendo_jobs.run(lambda: db_session)
    cache = nintendo_repository.get_cache(db_session, game_id)
    assert cache.historical_low_amount == 56.99
    assert cache.current_price_amount is None  # no longer on sale


def test_run_does_not_research_an_ignored_game(db_session, monkeypatch):
    switch = _seed_switch_platform(db_session)
    game = _seed_wishlisted_switch_game(db_session, 1, "Unmatched Game", switch)
    db_session.add(NintendoPriceCache(game_id=game.id, nsuid=None, ignored=True))
    db_session.commit()
    _configure_nintendo(monkeypatch)

    search_calls = []

    async def fake_search(self, title, country):
        search_calls.append(title)
        return "70010000000999"

    monkeypatch.setattr(NintendoClient, "search_game", fake_search)

    result = nintendo_jobs.run(lambda: db_session)

    assert result["total"] == 1
    assert search_calls == []
    assert nintendo_repository.get_cache(db_session, game.id).nsuid is None


def test_run_isolates_a_per_game_search_failure(db_session, monkeypatch):
    switch = _seed_switch_platform(db_session)
    bad = _seed_wishlisted_switch_game(db_session, 1, "Bad Game", switch)
    good = _seed_wishlisted_switch_game(db_session, 2, "Good Game", switch)
    _configure_nintendo(monkeypatch)

    async def fake_search(self, title, country):
        if title == "Bad Game":
            raise RuntimeError("Algolia hiccup")
        return "70010000000002"

    async def fake_get_prices(self, nsuids, country):
        return {
            "70010000000002": NintendoGamePrice(
                current_deal=None, regular_price_amount=79.99, regular_price_currency="CAD"
            )
        }

    monkeypatch.setattr(NintendoClient, "search_game", fake_search)
    monkeypatch.setattr(NintendoClient, "get_prices", fake_get_prices)

    bad_id = bad.id  # the job closes the session, detaching the ORM instances
    good_id = good.id
    result = nintendo_jobs.run(lambda: db_session)

    assert result["total"] == 2
    assert result["succeeded"] == 1
    assert result["failed"] == 1
    assert result["failures"][0]["gameId"] == bad_id
    assert nintendo_repository.get_cache(db_session, good_id).nsuid == "70010000000002"
