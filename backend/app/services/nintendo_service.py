from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.core.config import get_settings
from app.models.catalog import Game
from app.models.library import LibraryItem, LibraryStatus, MediaFormat
from app.models.nintendo import NintendoPriceCache
from app.repositories import library_item_repository, nintendo_repository
from app.services.exceptions import NotFoundError

# Nintendo's eShop only sells Switch games (the price API is per-title, not per-shop) —
# a wishlist row for any other platform, or a non-digital format, can't actually be bought
# through a deal it reports. Must stay in sync with
# nintendo_repository._ELIGIBLE_PLATFORM_SLUGS.
NINTENDO_ELIGIBLE_PLATFORM_SLUGS = {"switch", "switch-2"}


def is_library_item_nintendo_eligible(item: LibraryItem) -> bool:
    return (
        item.format == MediaFormat.DIGITAL
        and item.platform is not None
        and item.platform.slug in NINTENDO_ELIGIBLE_PLATFORM_SLUGS
    )


@dataclass
class NintendoOnSaleItem:
    library_item: LibraryItem
    cache: NintendoPriceCache
    is_target_hit: bool


def list_on_sale_items(db: Session) -> list[NintendoOnSaleItem]:
    """Same shape as platprices_service.list_on_sale_items — every wishlisted,
    track_for_sales-opted-in, Nintendo-eligible row with a current discount, target-hit
    rows first then discount % descending. Gating on track_for_sales here too (not just
    the refresh job's candidate list) means turning tracking off hides a stale cached
    discount immediately."""
    stmt = (
        select(LibraryItem, NintendoPriceCache)
        .join(NintendoPriceCache, NintendoPriceCache.game_id == LibraryItem.game_id)
        .options(joinedload(LibraryItem.game), joinedload(LibraryItem.platform))
        .where(
            LibraryItem.status == LibraryStatus.WISHLIST,
            LibraryItem.track_for_sales.is_(True),
            NintendoPriceCache.current_price_amount.is_not(None),
        )
    )
    rows = db.execute(stmt).all()

    items = [
        NintendoOnSaleItem(
            library_item=item,
            cache=cache,
            is_target_hit=item.target_price is not None and cache.current_price_amount <= item.target_price,
        )
        for item, cache in rows
        if is_library_item_nintendo_eligible(item) and cache.current_cut
    ]
    items.sort(key=lambda entry: (not entry.is_target_hit, -(entry.cache.current_cut or 0)))
    return items


@dataclass
class IgnoredSalesTitle:
    game: Game
    checked_at: datetime | None


def list_ignored_items(db: Session) -> list[IgnoredSalesTitle]:
    return [
        IgnoredSalesTitle(game=cache.game, checked_at=cache.checked_at)
        for cache in nintendo_repository.list_ignored(db)
    ]


def retry_ignored_item(db: Session, game_id: int) -> None:
    cache = nintendo_repository.get_cache(db, game_id)
    if cache is None or not cache.ignored:
        raise NotFoundError(f"No ignored Nintendo entry for game {game_id}")
    nintendo_repository.set_ignored(db, cache, False)
    db.commit()


def remove_ignored_item(db: Session, game_id: int) -> None:
    """Unlike retry_ignored_item, this is meant to stick: turns off track_for_sales on every
    wishlist row for this game (the same op the Sale - Tracked page's Untrack button does) so
    the refresh job never reconsiders it, then drops the ignored cache row so it disappears
    from this list immediately rather than lingering until the next job run notices it's no
    longer a tracked candidate."""
    cache = nintendo_repository.get_cache(db, game_id)
    if cache is None or not cache.ignored:
        raise NotFoundError(f"No ignored Nintendo entry for game {game_id}")
    for item in library_item_repository.list_library_items(db, game_id, status=LibraryStatus.WISHLIST):
        if item.track_for_sales:
            library_item_repository.update_library_item(db, item, track_for_sales=False)
    nintendo_repository.delete_cache(db, cache)
    db.commit()


def clear_prices_from_other_regions(db: Session) -> int:
    """Run at startup: NINTENDO_COUNTRY only changes with a restart, so this is where a
    region change takes effect — the previous region's cached prices disappear straight away
    instead of showing as current until the refresh job next succeeds."""
    settings = get_settings()
    cleared = nintendo_repository.clear_prices_not_from_region(db, settings.nintendo_country.strip().upper())
    db.commit()
    return cleared
