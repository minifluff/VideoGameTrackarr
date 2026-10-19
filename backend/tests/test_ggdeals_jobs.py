import pytest

from app.core.config import get_settings
from app.models.catalog import Game, GameCategory, Platform
from app.models.library import LibraryItem, LibraryStatus, MediaFormat
from app.models.steam import SteamLibraryEntry, SteamWishlistEntry
from app.repositories import ggdeals_repository
from app.services import ggdeals_jobs
from app.services.ggdeals_client import GgDealsClient, GgDealsPrices


def _configure_ggdeals(monkeypatch):
    # The repo-root .env may have real GGDEALS_API_KEY/GGDEALS_REGION values for local dev
    # use — pin both explicitly so this test's behavior doesn't depend on whatever's in
    # .env. Zero the chunk pacing so multi-chunk tests don't actually sleep 60s.
    monkeypatch.setattr(get_settings(), "ggdeals_api_key", "test-ggdeals-key")
    monkeypatch.setattr(get_settings(), "ggdeals_region", "us")
    monkeypatch.setattr(ggdeals_jobs, "_CHUNK_PACE_SECONDS", 0)


@pytest.fixture()
def seed_steam_platform(db_session):
    platform = Platform(name="Steam", slug="steam")
    db_session.add(platform)
    db_session.commit()
    return platform


def _seed_wishlisted_game(db_session, platform, name, slug, steam_app_id=None, via_library=False):
    game = Game(name=name, slug=slug, category=GameCategory.MAIN_GAME)
    db_session.add(game)
    db_session.commit()
    db_session.add(
        LibraryItem(
            game_id=game.id,
            platform_id=platform.id,
            status=LibraryStatus.WISHLIST,
            track_for_sales=True,
            format=MediaFormat.DIGITAL,
        )
    )
    if steam_app_id is not None:
        entry_cls = SteamLibraryEntry if via_library else SteamWishlistEntry
        db_session.add(entry_cls(steam_app_id=steam_app_id, steam_name=name, game_id=game.id))
    db_session.commit()
    return game


def _prices(app_id: int) -> GgDealsPrices:
    return GgDealsPrices(
        title=f"Game {app_id}",
        url=f"https://gg.deals/game/game-{app_id}/",
        current_retail=19.99,
        current_keyshops=9.99,
        historical_retail=19.99,
        historical_keyshops=9.99,
        currency="USD",
    )


def test_run_requires_ggdeals_configuration(db_session, monkeypatch):
    monkeypatch.setattr(get_settings(), "ggdeals_api_key", None)

    with pytest.raises(ggdeals_jobs.GgDealsNotConfiguredError):
        ggdeals_jobs.run(lambda: db_session)


def test_run_resolves_app_id_from_wishlist_entry_and_caches_prices(
    db_session, seed_steam_platform, monkeypatch
):
    game = _seed_wishlisted_game(
        db_session, seed_steam_platform, name="Half-Life 2", slug="half-life-2", steam_app_id=220
    )
    game_id = game.id
    _configure_ggdeals(monkeypatch)

    async def fake_get_prices(self, steam_app_ids, region):
        assert steam_app_ids == [220]
        assert region == "us"
        return {220: _prices(220)}

    monkeypatch.setattr(GgDealsClient, "get_prices_by_steam_app_id", fake_get_prices)

    result = ggdeals_jobs.run(lambda: db_session)

    assert result == {"total": 1, "succeeded": 1, "failed": 0, "failures": []}
    cache = ggdeals_repository.get_cache(db_session, game_id)
    assert cache.steam_app_id == 220
    assert cache.ignored is False
    assert cache.current_price_amount == 19.99
    assert cache.current_price_currency == "USD"
    assert cache.current_shop_name == "GG.deals"
    assert cache.current_cut is None
    assert cache.current_keyshops_amount == 9.99
    assert cache.historical_low_amount == 19.99
    assert cache.ggdeals_url == "https://gg.deals/game/game-220/"


def test_run_falls_back_to_library_entry(db_session, seed_steam_platform, monkeypatch):
    game = _seed_wishlisted_game(
        db_session, seed_steam_platform, name="Portal", slug="portal", steam_app_id=400, via_library=True
    )
    _configure_ggdeals(monkeypatch)

    async def fake_get_prices(self, steam_app_ids, region):
        return {400: _prices(400)}

    monkeypatch.setattr(GgDealsClient, "get_prices_by_steam_app_id", fake_get_prices)

    ggdeals_jobs.run(lambda: db_session)

    assert ggdeals_repository.get_cache(db_session, game.id).steam_app_id == 400


def test_run_marks_game_ignored_when_no_app_id_resolves(db_session, seed_steam_platform, monkeypatch):
    game = _seed_wishlisted_game(db_session, seed_steam_platform, name="Obscure", slug="obscure")
    game_id = game.id
    _configure_ggdeals(monkeypatch)

    price_calls = []

    async def fake_get_prices(self, steam_app_ids, region):
        price_calls.append(steam_app_ids)
        return {}

    monkeypatch.setattr(GgDealsClient, "get_prices_by_steam_app_id", fake_get_prices)

    ggdeals_jobs.run(lambda: db_session)

    cache = ggdeals_repository.get_cache(db_session, game_id)
    assert cache.steam_app_id is None
    assert cache.ignored is True
    assert price_calls == []  # nothing resolved, nothing fetched


def test_run_never_reresolves_an_ignored_game(db_session, seed_steam_platform, monkeypatch):
    game = _seed_wishlisted_game(db_session, seed_steam_platform, name="Obscure", slug="obscure")
    cache = ggdeals_repository.get_or_create_cache(db_session, game.id)
    ggdeals_repository.set_steam_app_id(db_session, cache, None)  # sets ignored=True
    db_session.commit()
    _configure_ggdeals(monkeypatch)

    price_calls = []

    async def fake_get_prices(self, steam_app_ids, region):
        price_calls.append(steam_app_ids)
        return {}

    monkeypatch.setattr(GgDealsClient, "get_prices_by_steam_app_id", fake_get_prices)

    result = ggdeals_jobs.run(lambda: db_session)

    assert result["total"] == 1
    assert result["succeeded"] == 1
    assert price_calls == []


def test_run_batches_in_chunks_of_100(db_session, seed_steam_platform, monkeypatch):
    for i in range(101):
        _seed_wishlisted_game(
            db_session, seed_steam_platform, name=f"Game {i}", slug=f"game-{i}", steam_app_id=1000 + i
        )
    _configure_ggdeals(monkeypatch)

    chunk_sizes = []

    async def fake_get_prices(self, steam_app_ids, region):
        chunk_sizes.append(len(steam_app_ids))
        return {app_id: _prices(app_id) for app_id in steam_app_ids}

    monkeypatch.setattr(GgDealsClient, "get_prices_by_steam_app_id", fake_get_prices)

    result = ggdeals_jobs.run(lambda: db_session)

    assert chunk_sizes == [100, 1]
    assert result["total"] == 101
    assert result["failed"] == 0


def test_run_isolates_a_failed_chunk(db_session, seed_steam_platform, monkeypatch):
    for i in range(101):
        _seed_wishlisted_game(
            db_session, seed_steam_platform, name=f"Game {i}", slug=f"game-{i}", steam_app_id=2000 + i
        )
    _configure_ggdeals(monkeypatch)

    async def fake_get_prices(self, steam_app_ids, region):
        if len(steam_app_ids) == 100:
            raise RuntimeError("chunk exploded")
        return {app_id: _prices(app_id) for app_id in steam_app_ids}

    monkeypatch.setattr(GgDealsClient, "get_prices_by_steam_app_id", fake_get_prices)

    result = ggdeals_jobs.run(lambda: db_session)

    # The 100-id chunk failed (100 per-game failures recorded), the 1-id chunk succeeded.
    assert result["total"] == 101
    assert result["succeeded"] == 101
    assert result["failed"] == 100
    assert all(f["error"] == "chunk exploded" for f in result["failures"])


def test_run_handles_ggdeals_null_entry(db_session, seed_steam_platform, monkeypatch):
    game = _seed_wishlisted_game(
        db_session, seed_steam_platform, name="Unknown", slug="unknown", steam_app_id=999999
    )
    _configure_ggdeals(monkeypatch)

    async def fake_get_prices(self, steam_app_ids, region):
        return {999999: None}  # GG.deals knows nothing about this AppID

    monkeypatch.setattr(GgDealsClient, "get_prices_by_steam_app_id", fake_get_prices)

    ggdeals_jobs.run(lambda: db_session)

    cache = ggdeals_repository.get_cache(db_session, game.id)
    assert cache.steam_app_id == 999999
    assert cache.current_price_amount is None
    assert cache.ignored is False
