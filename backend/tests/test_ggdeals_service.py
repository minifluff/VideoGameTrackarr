import pytest

from app.models.catalog import Game, GameCategory, Platform
from app.models.library import LibraryItem, LibraryStatus, MediaFormat
from app.repositories import ggdeals_repository
from app.services import ggdeals_service
from app.services.exceptions import NotFoundError


@pytest.fixture()
def seed_steam_platform(db_session):
    platform = Platform(name="Steam", slug="steam")
    db_session.add(platform)
    db_session.commit()
    return platform


def _seed_wishlisted_game(db_session, platform, name="Test Game", slug="test-game", **item_kwargs):
    game = Game(name=name, slug=slug, category=GameCategory.MAIN_GAME)
    db_session.add(game)
    db_session.commit()
    kwargs = {"game_id": game.id, "platform_id": platform.id, "status": LibraryStatus.WISHLIST,
              "track_for_sales": True, "format": MediaFormat.DIGITAL}
    kwargs.update(item_kwargs)
    db_session.add(LibraryItem(**kwargs))
    db_session.commit()
    return game


def _seed_cache(db_session, game, **kwargs):
    cache = ggdeals_repository.get_or_create_cache(db_session, game.id)
    defaults = {
        "steam_app_id": 10,
        "current_price_amount": 19.99,
        "current_price_currency": "USD",
        "current_shop_name": "GG.deals",
        "current_cut": None,
        "historical_low_amount": 19.99,
        "historical_low_currency": "USD",
        "historical_low_shop_name": "GG.deals",
        "ignored": False,
    }
    defaults.update(kwargs)
    for key, value in defaults.items():
        setattr(cache, key, value)
    db_session.commit()
    return cache


def test_steam_digital_row_is_eligible(db_session, seed_steam_platform):
    game = _seed_wishlisted_game(db_session, seed_steam_platform)
    item = db_session.query(LibraryItem).filter_by(game_id=game.id).one()
    assert ggdeals_service.is_library_item_ggdeals_eligible(item) is True


def test_non_steam_platform_is_not_eligible(db_session, seed_platform):
    game = _seed_wishlisted_game(db_session, seed_platform)
    item = db_session.query(LibraryItem).filter_by(game_id=game.id).one()
    assert ggdeals_service.is_library_item_ggdeals_eligible(item) is False


def test_physical_format_is_not_eligible(db_session, seed_steam_platform):
    game = _seed_wishlisted_game(db_session, seed_steam_platform, format=MediaFormat.PHYSICAL)
    item = db_session.query(LibraryItem).filter_by(game_id=game.id).one()
    assert ggdeals_service.is_library_item_ggdeals_eligible(item) is False


def test_row_at_historical_low_is_on_sale(db_session, seed_steam_platform):
    game = _seed_wishlisted_game(db_session, seed_steam_platform)
    _seed_cache(db_session, game, current_price_amount=19.99, historical_low_amount=19.99)

    items = ggdeals_service.list_on_sale_items(db_session)

    assert len(items) == 1
    assert items[0].library_item.game_id == game.id
    assert items[0].cache.current_shop_name == "GG.deals"
    assert items[0].cache.current_cut is None
    assert items[0].is_target_hit is False


def test_row_below_historical_low_is_on_sale(db_session, seed_steam_platform):
    game = _seed_wishlisted_game(db_session, seed_steam_platform)
    _seed_cache(db_session, game, current_price_amount=9.99, historical_low_amount=19.99)

    assert len(ggdeals_service.list_on_sale_items(db_session)) == 1


def test_row_above_historical_low_is_not_on_sale(db_session, seed_steam_platform):
    # No discount % exists to gate on — a current price above the recorded historical low
    # is just the normal price, not a sale.
    game = _seed_wishlisted_game(db_session, seed_steam_platform)
    _seed_cache(db_session, game, current_price_amount=59.99, historical_low_amount=19.99)

    assert ggdeals_service.list_on_sale_items(db_session) == []


def test_row_with_no_historical_low_yet_is_on_sale(db_session, seed_steam_platform):
    # Nothing to compare against — hiding the row would punish newly-tracked games.
    game = _seed_wishlisted_game(db_session, seed_steam_platform)
    _seed_cache(db_session, game, current_price_amount=19.99, historical_low_amount=None)

    assert len(ggdeals_service.list_on_sale_items(db_session)) == 1


def test_ineligible_platform_row_is_excluded(db_session, seed_platform):
    game = _seed_wishlisted_game(db_session, seed_platform)
    _seed_cache(db_session, game, current_price_amount=9.99, historical_low_amount=19.99)

    assert ggdeals_service.list_on_sale_items(db_session) == []


def test_target_hit_is_flagged(db_session, seed_steam_platform):
    game = _seed_wishlisted_game(db_session, seed_steam_platform, target_price=25.00)
    _seed_cache(db_session, game, current_price_amount=19.99, historical_low_amount=19.99)

    items = ggdeals_service.list_on_sale_items(db_session)

    assert len(items) == 1
    assert items[0].is_target_hit is True


def test_target_hit_sorts_first(db_session, seed_steam_platform):
    plain = _seed_wishlisted_game(db_session, seed_steam_platform, name="Plain", slug="plain")
    _seed_cache(db_session, plain, current_price_amount=5.00, historical_low_amount=5.00)
    target = _seed_wishlisted_game(db_session, seed_steam_platform, name="Target", slug="target",
                                   target_price=25.00)
    _seed_cache(db_session, target, current_price_amount=19.99, historical_low_amount=19.99)

    items = ggdeals_service.list_on_sale_items(db_session)

    assert [i.library_item.game_id for i in items] == [target.id, plain.id]


def test_list_ignored_items(db_session, seed_steam_platform):
    game = _seed_wishlisted_game(db_session, seed_steam_platform)
    cache = ggdeals_repository.get_or_create_cache(db_session, game.id)
    ggdeals_repository.set_steam_app_id(db_session, cache, None)  # sets ignored=True
    db_session.commit()

    ignored = ggdeals_service.list_ignored_items(db_session)

    assert len(ignored) == 1
    assert ignored[0].game.id == game.id


def test_retry_ignored_item(db_session, seed_steam_platform):
    game = _seed_wishlisted_game(db_session, seed_steam_platform)
    cache = ggdeals_repository.get_or_create_cache(db_session, game.id)
    ggdeals_repository.set_steam_app_id(db_session, cache, None)
    db_session.commit()

    ggdeals_service.retry_ignored_item(db_session, game.id)

    assert ggdeals_repository.get_cache(db_session, game.id).ignored is False


def test_retry_ignored_item_raises_when_not_ignored(db_session, seed_steam_platform):
    game = _seed_wishlisted_game(db_session, seed_steam_platform)
    ggdeals_repository.get_or_create_cache(db_session, game.id)
    db_session.commit()

    with pytest.raises(NotFoundError):
        ggdeals_service.retry_ignored_item(db_session, game.id)


def test_remove_ignored_item_untracks_and_deletes(db_session, seed_steam_platform):
    game = _seed_wishlisted_game(db_session, seed_steam_platform)
    cache = ggdeals_repository.get_or_create_cache(db_session, game.id)
    ggdeals_repository.set_steam_app_id(db_session, cache, None)
    db_session.commit()

    ggdeals_service.remove_ignored_item(db_session, game.id)

    assert ggdeals_repository.get_cache(db_session, game.id) is None
    item = db_session.query(LibraryItem).filter_by(game_id=game.id).one()
    assert item.track_for_sales is False
