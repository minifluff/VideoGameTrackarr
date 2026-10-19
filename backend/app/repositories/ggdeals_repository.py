from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.models.catalog import Game
from app.models.ggdeals import GgDealsPriceCache
from app.models.library import LibraryItem, LibraryStatus
from app.services.ggdeals_client import GgDealsPrices


def get_cache(db: Session, game_id: int) -> GgDealsPriceCache | None:
    return db.scalars(select(GgDealsPriceCache).where(GgDealsPriceCache.game_id == game_id)).first()


def get_or_create_cache(db: Session, game_id: int) -> GgDealsPriceCache:
    cache = get_cache(db, game_id)
    if cache is None:
        cache = GgDealsPriceCache(game_id=game_id)
        db.add(cache)
        db.flush()
    return cache


def list_distinct_wishlisted_games(db: Session) -> list[Game]:
    """Every game with at least one WISHLIST, track_for_sales-opted-in LibraryItem —
    deduplicated, since the same game can be wishlisted via more than one row (different
    platforms/regions), but price only needs fetching once per game. Same shape as
    itad_repository's equivalent (no platform pre-filter — GG.deals' quota is generous
    enough that matching spend doesn't need gating, unlike PlatPrices')."""
    stmt = (
        select(Game)
        .join(LibraryItem, LibraryItem.game_id == Game.id)
        .where(LibraryItem.status == LibraryStatus.WISHLIST, LibraryItem.track_for_sales.is_(True))
        .distinct()
    )
    return list(db.scalars(stmt))


def set_steam_app_id(db: Session, cache: GgDealsPriceCache, steam_app_id: int | None) -> GgDealsPriceCache:
    # A None result means no Steam AppID could be resolved for this game — mark it ignored
    # so future job runs stop re-resolving it forever; a real id always clears any prior
    # ignored flag (covers the case where a manual Retry now resolves on a re-attempt).
    cache.steam_app_id = steam_app_id
    cache.ignored = steam_app_id is None
    cache.checked_at = datetime.now(UTC)
    db.flush()
    return cache


def set_ignored(db: Session, cache: GgDealsPriceCache, ignored: bool) -> GgDealsPriceCache:
    cache.ignored = ignored
    db.flush()
    return cache


def list_ignored(db: Session) -> list[GgDealsPriceCache]:
    stmt = (
        select(GgDealsPriceCache)
        .options(joinedload(GgDealsPriceCache.game))
        .where(GgDealsPriceCache.ignored.is_(True))
    )
    return list(db.scalars(stmt))


def delete_cache(db: Session, cache: GgDealsPriceCache) -> None:
    db.delete(cache)
    db.flush()


def update_price_data(
    db: Session, cache: GgDealsPriceCache, steam_app_id: int, prices: GgDealsPrices | None
) -> GgDealsPriceCache:
    # current_price_amount is the *retail* price — the all-time-low gate in
    # ggdeals_service.list_on_sale_items compares retail against the historical retail
    # low. current_cut stays null (GG.deals reports no discount %) and current_shop_name
    # stays the literal "GG.deals" (the data source, and the visible attribution the API
    # terms require). Keyshop figures are cached for reference only.
    cache.steam_app_id = steam_app_id
    cache.ggdeals_url = prices.url if prices else None
    cache.current_price_amount = prices.current_retail if prices else None
    cache.current_price_currency = prices.currency if prices else None
    cache.current_shop_name = "GG.deals" if prices and prices.current_retail is not None else None
    cache.current_cut = None
    cache.current_keyshops_amount = prices.current_keyshops if prices else None
    cache.historical_low_amount = prices.historical_retail if prices else None
    cache.historical_low_currency = prices.currency if prices else None
    cache.historical_low_shop_name = "GG.deals" if prices and prices.historical_retail is not None else None
    cache.historical_low_at = None  # GG.deals' Prices API doesn't report when the low was hit
    cache.historical_retail_amount = prices.historical_retail if prices else None
    cache.historical_keyshops_amount = prices.historical_keyshops if prices else None
    cache.checked_at = datetime.now(UTC)
    db.flush()
    return cache
