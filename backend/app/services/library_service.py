from typing import Any

from sqlalchemy.orm import Session

from app.models.catalog import Platform, Region
from app.models.library import LibraryItem, LibraryStatus
from app.repositories import game_repository, library_item_repository
from app.services import rom_service
from app.services.exceptions import NotFoundError


def list_library_items(db: Session, game_id: int, status: LibraryStatus | None = None) -> list[LibraryItem]:
    _require_game(db, game_id)
    return library_item_repository.list_library_items(db, game_id, status=status)


def list_tracked_items(db: Session) -> list[LibraryItem]:
    return library_item_repository.list_tracked_items(db)


def list_all_library_items(db: Session) -> list[dict]:
    """All library items with game name, platform name, edition, and format.
    Returns dicts for the Games List page table (one row per owned copy)."""
    from sqlalchemy.orm import joinedload

    from app.models.catalog import Game
    from app.models.library import LibraryItem

    # Eager-load platform to avoid N+1 queries; join game for name ordering
    rows = (
        db.query(LibraryItem, Game)
        .options(joinedload(LibraryItem.platform))
        .join(Game, LibraryItem.game_id == Game.id)
        .order_by(Game.name.asc())
        .all()
    )

    result = []
    for item, game in rows:
        try:
            platform_name = item.platform.name if item.platform else None
            if item.format:
                format_value = item.format.value if hasattr(item.format, "value") else str(item.format)
            else:
                format_value = None
            result.append({
                "id": item.id,
                "game_id": game.id,
                "game_name": game.name or "Unknown",
                "game_uuid": game.uuid or "",
                "platform_name": platform_name,
                "edition": item.edition,
                "format": format_value,
                "first_release_date": None,
                "date_added": None,
                "tag_names": [],
                "notes": item.notes,
            })
        except Exception:
            continue
    return result


def list_distinct_storefronts(db: Session) -> list[str]:
    return library_item_repository.list_distinct_storefronts(db)


def add_library_item(db: Session, game_id: int, **fields: Any) -> LibraryItem:
    _require_game(db, game_id)
    item = library_item_repository.create_library_item(db, game_id=game_id, **fields)
    db.commit()
    db.refresh(item)
    return item


def update_library_item(db: Session, item_id: int, **fields: Any) -> LibraryItem:
    item = _require_library_item(db, item_id)
    item = library_item_repository.update_library_item(db, item, **fields)
    # A copy that's no longer an owned ROM/Abandonware/ISO copy can't hold a ROM — the
    # frontend warns before saving a change like this (LibraryItemDialog/GameLibrarySection).
    orphaned_files: list[str] = []
    if not rom_service.can_hold_rom(item.status, item.format):
        orphaned_files = rom_service.detach_roms(db, item)
    db.commit()
    rom_service.delete_files(orphaned_files)
    db.refresh(item)
    return item


# Fields the List page's bulk edit may set on many items at once — exactly one
# field per call, applied through update_library_item so its invariants (ROM
# detach when a copy stops being ROM-capable, etc.) hold for bulk edits too.
BULK_UPDATE_FIELDS = ("format", "platform", "region", "status", "edition", "notes")


def bulk_update_library_items(
    db: Session, item_ids: list[int], field: str, value: Any
) -> int:
    """Set one field on many library items; returns how many were updated.

    Every id (and the platform/region target, when relevant) is validated
    BEFORE anything is written, so a bad id fails the whole call instead of
    leaving a half-applied bulk edit behind.
    """
    if field == "format":
        fields: dict[str, Any] = {"format": value}
    elif field == "platform":
        if db.get(Platform, value) is None:
            raise NotFoundError(f"Platform {value} not found")
        fields = {"platform_id": value}
    elif field == "region":
        if db.get(Region, value) is None:
            raise NotFoundError(f"Region {value} not found")
        fields = {"region_id": value}
    elif field == "status":
        fields = {"status": value}
    elif field in ("edition", "notes"):
        text = str(value).strip() if value is not None else None
        fields = {field: text or None}
    elif field == "game":
        # Moving copies to another game doesn't fit the set-a-column loop below
        # (it reassigns game_id), and an item already in the target game is a
        # no-op, not an error — so a bulk move over a mixed selection still moves
        # everything that needs moving. Targets and ids are still validated
        # before anything is written, like every other field.
        _require_game(db, value)
        unique_ids = list(dict.fromkeys(item_ids))
        items = [_require_library_item(db, item_id) for item_id in unique_ids]
        moved = 0
        for item in items:
            if item.game_id != value:
                move_library_item(db, item.id, value)
                moved += 1
        return moved
    else:  # pragma: no cover - the route's Literal type already restricts this
        raise ValueError(f"Unsupported bulk-update field: {field}")

    unique_ids = list(dict.fromkeys(item_ids))
    for item_id in unique_ids:
        _require_library_item(db, item_id)
    for item_id in unique_ids:
        update_library_item(db, item_id, **fields)
    return len(unique_ids)


def bulk_delete_library_items(db: Session, item_ids: list[int]) -> int:
    """Delete many library items at once; returns how many were deleted.

    Every id is validated BEFORE anything is deleted, so a bad id fails the
    whole call instead of leaving a half-deleted selection behind. Each item
    goes through delete_library_item, so ROM files are detached and removed
    exactly as for a single delete.
    """
    unique_ids = list(dict.fromkeys(item_ids))
    for item_id in unique_ids:
        _require_library_item(db, item_id)
    for item_id in unique_ids:
        delete_library_item(db, item_id)
    return len(unique_ids)


def delete_library_item(db: Session, item_id: int) -> None:
    item = _require_library_item(db, item_id)
    orphaned_files = rom_service.detach_roms(db, item)
    library_item_repository.delete_library_item(db, item)
    db.commit()
    rom_service.delete_files(orphaned_files)




def move_library_item(db: Session, item_id: int, target_game_id: int) -> LibraryItem:
    """Move a library item to a different game."""
    item = _require_library_item(db, item_id)
    _require_game(db, target_game_id)
    if item.game_id == target_game_id:
        raise ValueError("Item is already in the target game")
    item.game_id = target_game_id
    db.commit()
    db.refresh(item)
    return item


def split_library_item_to_new_game(db: Session, item_id: int, new_game_name: str) -> tuple[Any, LibraryItem]:
    """Create a new manual game and move the library item to it.
    
    Returns (new_game, moved_item).
    """
    from app.models.catalog import Game
    
    item = _require_library_item(db, item_id)
    if not new_game_name.strip():
        raise ValueError("New game name is required")
    
    # Create a minimal new game entry
    new_game = Game(
        name=new_game_name.strip(),
        slug=new_game_name.strip().lower().replace(" ", "-")[:255],
    )
    db.add(new_game)
    db.flush()  # Get the ID
    
    # Move the item to the new game
    item.game_id = new_game.id
    db.commit()
    db.refresh(item)
    db.refresh(new_game)
    return new_game, item

def _require_game(db: Session, game_id: int) -> None:
    if game_repository.get_game(db, game_id) is None:
        raise NotFoundError(f"Game {game_id} not found")


def _require_library_item(db: Session, item_id: int) -> LibraryItem:
    item = library_item_repository.get_library_item(db, item_id)
    if item is None:
        raise NotFoundError(f"Library item {item_id} not found")
    return item
