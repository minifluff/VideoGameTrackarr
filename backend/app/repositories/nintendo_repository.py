from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.models.catalog import Game, Platform
from app.models.library import LibraryItem, LibraryStatus, MediaFormat
from app.models.nintendo import NintendoPriceCache
from app.services.nintendo_client import NINTENDO_SHOP_NAME, NintendoGamePrice

# Must stay in sync with nintendo_service.NINTENDO_ELIGIBLE_PLATFORM_SLUGS — kept as a
# separate local constant rather than importing it, since this repository doesn't otherwise
# depend on the service layer.
_ELIGIBLE_PLATFORM_SLUGS = {"switch", "switch-2"}


def get_cache(db: Session, game_id: int) -> NintendoPriceCache | None:
    return db.scalars(select(NintendoPriceCache).where(NintendoPriceCache.game_id == game_id)).first()


def get_or_create_cache(db: Session, game_id: int) -> NintendoPriceCache:
    cache = get_cache(db, game_id)
    if cache is None:
        cache = NintendoPriceCache(game_id=game_id)
        db.add(cache)
        db.flush()
    return cache


def list_distinct_wishlisted_games(db: Session) -> list[Game]:
    """Every game with at least one WISHLIST, track_for_sales-opted-in LibraryItem that's
    actually Nintendo-eligible (digital format, Switch/Switch 2 platform) — deduplicated.
    Pre-filtered like platprices_repository's equivalent (unlike itad_repository's, which
    matches every opted-in wishlisted game regardless of platform), so matching spend
    stays proportional to actual Switch wishlist size, not total wishlist size."""
    stmt = (
        select(Game)
        .join(LibraryItem, LibraryItem.game_id == Game.id)
        .join(Platform, Platform.id == LibraryItem.platform_id)
        .where(
            LibraryItem.status == LibraryStatus.WISHLIST,
            LibraryItem.track_for_sales.is_(True),
            LibraryItem.format == MediaFormat.DIGITAL,
            Platform.slug.in_(_ELIGIBLE_PLATFORM_SLUGS),
        )
        .distinct()
    )
    return list(db.scalars(stmt))


def set_nsuid(db: Session, cache: NintendoPriceCache, nsuid: str | None) -> NintendoPriceCache:
    # A None result means this attempt found no exact title match — mark it ignored so future
    # job runs stop re-searching it forever; a real nsuid always clears any prior ignored flag
    # (covers the case where a manual Retry now finds a match on a re-attempt).
    cache.nsuid = nsuid
    cache.ignored = nsuid is None
    cache.checked_at = datetime.now(UTC)
    db.flush()
    return cache


def set_ignored(db: Session, cache: NintendoPriceCache, ignored: bool) -> NintendoPriceCache:
    cache.ignored = ignored
    db.flush()
    return cache


def list_ignored(db: Session) -> list[NintendoPriceCache]:
    stmt = (
        select(NintendoPriceCache)
        .options(joinedload(NintendoPriceCache.game))
        .where(NintendoPriceCache.ignored.is_(True))
    )
    return list(db.scalars(stmt))


def delete_cache(db: Session, cache: NintendoPriceCache) -> None:
    db.delete(cache)
    db.flush()


def update_price_data(
    db: Session,
    cache: NintendoPriceCache,
    price: NintendoGamePrice | None,
    region: str | None = None,
) -> NintendoPriceCache:
    # A None price (no data for this title this run — delisted, or a failed batch that the
    # caller is clearing) drops the current price but keeps the self-built historical low:
    # unlike ITAD/PlatPrices, Nintendo publishes no history, so the low is this app's own
    # observation log, not provider data that goes stale with the fetch.
    if price is None:
        cache.current_price_amount = None
        cache.current_price_currency = None
        cache.current_shop_name = None
        cache.current_cut = None
        cache.region = None
        cache.checked_at = datetime.now(UTC)
        db.flush()
        return cache
    deal = price.current_deal
    cache.region = region
    cache.current_price_amount = deal.price_amount if deal else None
    cache.current_price_currency = deal.price_currency if deal else None
    cache.current_shop_name = deal.shop_name if deal else None
    cache.current_cut = deal.cut if deal else None
    # Self-built historical low: the lowest price this app has ever observed for the game
    # — the sale price when on sale, otherwise the regular price. Only ever goes down.
    observed_amount = deal.price_amount if deal else price.regular_price_amount
    observed_currency = deal.price_currency if deal else price.regular_price_currency
    if observed_amount is not None and (
        cache.historical_low_amount is None or observed_amount < cache.historical_low_amount
    ):
        cache.historical_low_amount = observed_amount
        cache.historical_low_currency = observed_currency
        cache.historical_low_shop_name = NINTENDO_SHOP_NAME
        cache.historical_low_at = datetime.now(UTC)
    cache.checked_at = datetime.now(UTC)
    db.flush()
    return cache


def clear_prices_not_from_region(db: Session, region: str) -> int:
    """Clears cached prices fetched for any other region (or before regions were recorded),
    so changing NINTENDO_COUNTRY never leaves the old region's prices showing as current
    until the next successful refresh. Unlike update_price_data(None), this also clears the
    self-built historical low — it was observed in the old region's currency/prices, so it
    doesn't apply to the new one. Matches (nsuid) and Ignored state are kept. Returns how
    many rows were cleared."""
    stale = db.scalars(
        select(NintendoPriceCache).where(
            (
                NintendoPriceCache.current_price_amount.is_not(None)
                | NintendoPriceCache.historical_low_amount.is_not(None)
            )
            & (NintendoPriceCache.region.is_(None) | (NintendoPriceCache.region != region))
        )
    ).all()
    for cache in stale:
        update_price_data(db, cache, None)
        cache.historical_low_amount = None
        cache.historical_low_currency = None
        cache.historical_low_shop_name = None
        cache.historical_low_at = None
        db.flush()
    return len(stale)
