from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.models.catalog import Game
from app.models.ggdeals import GgDealsPriceCache
from app.models.library import LibraryItem, LibraryStatus, MediaFormat
from app.repositories import ggdeals_repository, library_item_repository
from app.services.exceptions import NotFoundError

# GG.deals' Prices API is keyed by Steam AppID — a wishlist row for any other platform, or
# a non-digital format, can't actually be bought through a price GG.deals reports, so it
# must never be flagged "on sale" even if the same game happens to be cheap on Steam.
GGDEALS_ELIGIBLE_PLATFORM_SLUGS = {"steam"}


def is_library_item_ggdeals_eligible(item: LibraryItem) -> bool:
    return (
        item.format == MediaFormat.DIGITAL
        and item.platform is not None
        and item.platform.slug in GGDEALS_ELIGIBLE_PLATFORM_SLUGS
    )


@dataclass
class GgDealsOnSaleItem:
    # The cache ORM object is passed through directly (like PlatPricesOnSaleItem) — its
    # field names deliberately match ItadPriceCache/PlatPricesCache so
    # on_sale_item_from_orm needs no provider-specific branch.
    library_item: LibraryItem
    cache: GgDealsPriceCache
    is_target_hit: bool


def list_on_sale_items(db: Session) -> list[GgDealsOnSaleItem]:
    """Every wishlisted, track_for_sales-opted-in, GG.deals-eligible row whose current
    *retail* price sits at or below its *historical retail low*.

    GG.deals reports no discount percentage, so there is no "cut > 0" signal to gate on —
    the honest sale flag is the all-time-low gate: current_price_amount <=
    historical_low_amount. A row with no historical low recorded yet still shows (there's
    nothing to compare against, and hiding it would punish newly-tracked games), but a row
    whose current price is *above* its recorded low is just the normal price, not a sale.
    Target-hit rows sort first (same as the other providers); with no discount % to sort
    by, the rest order by current price ascending. Gating on track_for_sales here too (not
    just the refresh job's candidate list) means turning tracking off hides a stale cached
    price immediately."""
    stmt = (
        select(LibraryItem, GgDealsPriceCache)
        .join(GgDealsPriceCache, GgDealsPriceCache.game_id == LibraryItem.game_id)
        .options(joinedload(LibraryItem.game), joinedload(LibraryItem.platform))
        .where(
            LibraryItem.status == LibraryStatus.WISHLIST,
            LibraryItem.track_for_sales.is_(True),
            GgDealsPriceCache.current_price_amount.is_not(None),
            GgDealsPriceCache.ignored.is_(False),
        )
    )
    rows = db.execute(stmt).all()

    items: list[GgDealsOnSaleItem] = []
    for item, cache in rows:
        if not is_library_item_ggdeals_eligible(item):
            continue
        if (
            cache.historical_low_amount is not None
            and cache.current_price_amount is not None
            and cache.current_price_amount > cache.historical_low_amount
        ):
            continue
        items.append(
            GgDealsOnSaleItem(
                library_item=item,
                cache=cache,
                is_target_hit=item.target_price is not None
                and cache.current_price_amount is not None
                and cache.current_price_amount <= item.target_price,
            )
        )
    items.sort(key=lambda entry: (not entry.is_target_hit, entry.cache.current_price_amount or 0))
    return items


@dataclass
class IgnoredSalesTitle:
    game: Game
    checked_at: datetime | None


def list_ignored_items(db: Session) -> list[IgnoredSalesTitle]:
    return [
        IgnoredSalesTitle(game=cache.game, checked_at=cache.checked_at)
        for cache in ggdeals_repository.list_ignored(db)
    ]


def retry_ignored_item(db: Session, game_id: int) -> None:
    cache = ggdeals_repository.get_cache(db, game_id)
    if cache is None or not cache.ignored:
        raise NotFoundError(f"No ignored GG.deals entry for game {game_id}")
    ggdeals_repository.set_ignored(db, cache, False)
    db.commit()


def remove_ignored_item(db: Session, game_id: int) -> None:
    """Unlike retry_ignored_item, this is meant to stick: turns off track_for_sales on every
    wishlist row for this game (the same op the Sale - Tracked page's Untrack button does) so
    the refresh job never reconsiders it, then drops the ignored cache row so it disappears
    from this list immediately rather than lingering until the next job run notices it's no
    longer a tracked candidate."""
    cache = ggdeals_repository.get_cache(db, game_id)
    if cache is None or not cache.ignored:
        raise NotFoundError(f"No ignored GG.deals entry for game {game_id}")
    for item in library_item_repository.list_library_items(db, game_id, status=LibraryStatus.WISHLIST):
        if item.track_for_sales:
            library_item_repository.update_library_item(db, item, track_for_sales=False)
    ggdeals_repository.delete_cache(db, cache)
    db.commit()
