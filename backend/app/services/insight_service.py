import time
from typing import Any

from sqlalchemy.orm import Session

from app.models.catalog import Game
from app.models.hardware import Accessory
from app.models.library import LibraryItem
from app.repositories import insight_repository
from app.services import itad_service, platprices_service


def find_duplicate_library_items(db: Session) -> list[list[LibraryItem]]:
    return insight_repository.find_duplicate_library_items(db)


def find_missing_addons(db: Session, **filters: Any) -> list[tuple[Game, list[tuple[Game, bool]]]]:
    return insight_repository.find_missing_addons(db, **filters)


def find_accessories_without_owned_hardware(db: Session) -> list[Accessory]:
    return insight_repository.find_accessories_without_owned_hardware(db)


# Sale data only changes when prices sync, but get_on_sale_game_ids is called on
# nearly every page load (games list, collections, series, dashboard) and runs two
# provider queries each time — cache the id set briefly per process. A stale badge
# for under a minute after a price sync is an acceptable trade. The cache is keyed
# to the session's engine so a different database never sees another one's ids.
_ON_SALE_CACHE_TTL_SECONDS = 60.0
_on_sale_cache: tuple[object, float, frozenset[int]] | None = None


def get_on_sale_game_ids(db: Session) -> frozenset[int]:
    """Every game with at least one wishlisted, provider-eligible item currently on sale —
    feeds the On Sale badge shown on game cards everywhere (list, details, collections,
    series, dashboard), not just the dedicated Insights -> On Sale page."""
    global _on_sale_cache
    now = time.monotonic()
    if (
        _on_sale_cache is not None
        and _on_sale_cache[0] is db.bind
        and now - _on_sale_cache[1] < _ON_SALE_CACHE_TTL_SECONDS
    ):
        return _on_sale_cache[2]
    itad_ids = {item.library_item.game_id for item in itad_service.list_on_sale_items(db)}
    platprices_ids = {item.library_item.game_id for item in platprices_service.list_on_sale_items(db)}
    result = frozenset(itad_ids | platprices_ids)
    _on_sale_cache = (db.bind, now, result)
    return result
