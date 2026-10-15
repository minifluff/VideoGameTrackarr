from typing import Any

from sqlalchemy.orm import Session

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
    """All library items with game name, release date, platform name, tags, and date added.
    Returns dicts for the Games List page table (one row per owned copy)."""
    from sqlalchemy.orm import joinedload

    from app.models.catalog import Game, Platform
    from app.models.library import GameTag, LibraryItem, Tag

    # Eager-load platform to avoid N+1 queries
    items = (
        db.query(LibraryItem)
        .options(joinedload(LibraryItem.platform))
        .join(Game, LibraryItem.game_id == Game.id)
        .order_by(Game.name.asc())
        .all()
    )
    if not items:
        return []

    # Bulk-fetch all tags for all games in two queries (no N+1)
    game_ids = list({item.game_id for item in items})
    tag_rows = (
        db.query(GameTag.game_id, Tag.name)
        .join(Tag, GameTag.tag_id == Tag.id)
        .filter(GameTag.game_id.in_(game_ids))
        .all()
    )
    tags_by_game: dict[int, list[str]] = {}
    for game_id, tag_name in tag_rows:
        tags_by_game.setdefault(game_id, []).append(tag_name)

    # Bulk-fetch game data
    games = db.query(Game).filter(Game.id.in_(game_ids)).all()
    game_by_id = {g.id: g for g in games}

    result = []
    for item in items:
        try:
            game = game_by_id.get(item.game_id)
            if not game:
                continue
            # Defensive: any single bad field skips just that row, not the whole list
            platform_name = None
            try:
                if item.platform:
                    platform_name = item.platform.name
            except Exception:
                pass
            format_value = None
            try:
                if item.format:
                    format_value = item.format.value if hasattr(item.format, "value") else str(item.format)
            except Exception:
                pass
            result.append({
                "id": item.id,
                "game_id": game.id,
                "game_name": game.name or "Unknown",
                "game_uuid": game.uuid or "",
                "platform_name": platform_name,
                "edition": item.edition,
                "format": format_value,
                "first_release_date": game.first_release_date,
                "date_added": item.created_at,
                "tag_names": tags_by_game.get(game.id, []),
            })
        except Exception:
            # Skip rows that fail for any reason — don't break the whole list
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
