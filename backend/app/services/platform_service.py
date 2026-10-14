from typing import Any

from sqlalchemy.orm import Session

from sqlalchemy import delete, update

from app.models.catalog import GamePlatform, Platform
from app.models.library import GameProgress, LibraryItem, PlaySession
from app.repositories import platform_repository
from app.repositories.game_repository import GameWithStatus
from app.services.exceptions import ConflictError, NotFoundError


def get_platform_with_games(db: Session, slug: str) -> tuple[Platform, list[GameWithStatus], list[GameWithStatus]]:
    platform = platform_repository.get_by_slug(db, slug)
    if platform is None:
        raise NotFoundError(f"Platform {slug} not found")
    return (
        platform,
        platform_repository.list_games_for_platform(db, platform.id),
        platform_repository.list_addons_for_platform(db, platform.id),
    )


def list_platforms(db: Session) -> list[tuple[Platform, int]]:
    return platform_repository.list_platforms_with_counts(db)


def list_platform_addons(db: Session, slug: str, **filters: Any) -> list[GameWithStatus]:
    platform = platform_repository.get_by_slug(db, slug)
    if platform is None:
        raise NotFoundError(f"Platform {slug} not found")
    return platform_repository.list_addons_for_platform(db, platform.id, **filters)


def create_platform(db: Session, name: str, abbreviation: str | None) -> Platform:
    existing = platform_repository.get_by_name(db, name)
    if existing is not None:
        raise ConflictError(f"A platform named {name!r} already exists")

    platform = platform_repository.create_platform(db, name, abbreviation)
    db.commit()
    db.refresh(platform)
    return platform


def update_platform(db: Session, platform_id: int, name: str, abbreviation: str | None) -> Platform:
    platform = _require_platform(db, platform_id)
    existing = platform_repository.get_by_name(db, name)
    if existing is not None and existing.id != platform_id:
        raise ConflictError(f"A platform named {name!r} already exists")

    platform = platform_repository.update_platform(db, platform, name, abbreviation)
    db.commit()
    db.refresh(platform)
    return platform


def delete_platform(db: Session, platform_id: int) -> None:
    platform = _require_platform(db, platform_id)
    platform_repository.delete_platform(db, platform)
    db.commit()


def mass_move_games(db: Session, source_platform_id: int, target_platform_id: int) -> int:
    """Move all library items from one platform to another.

    Updates LibraryItem, GameProgress, PlaySession, and GamePlatform rows.
    Returns the number of library items moved.
    """
    source = _require_platform(db, source_platform_id)
    target = _require_platform(db, target_platform_id)
    if source.id == target.id:
        raise ConflictError("Source and target platforms must be different")

    # Count items being moved for the response
    moved_count = db.query(LibraryItem).filter(LibraryItem.platform_id == source.id).count()

    # Move library items
    db.execute(
        update(LibraryItem).where(LibraryItem.platform_id == source.id).values(platform_id=target.id)
    )
    # Move progress records
    db.execute(
        update(GameProgress).where(GameProgress.platform_id == source.id).values(platform_id=target.id)
    )
    # Move play sessions
    db.execute(
        update(PlaySession).where(PlaySession.platform_id == source.id).values(platform_id=target.id)
    )
    # Move IGDB release-platform links (avoid duplicates if target already has the link)
    existing_target_links = {
        gp.game_id
        for gp in db.query(GamePlatform).filter(GamePlatform.platform_id == target.id).all()
    }
    source_links = db.query(GamePlatform).filter(GamePlatform.platform_id == source.id).all()
    for link in source_links:
        if link.game_id in existing_target_links:
            db.delete(link)
        else:
            link.platform_id = target.id
    db.commit()
    return moved_count


def _require_platform(db: Session, platform_id: int) -> Platform:
    platform = db.get(Platform, platform_id)
    if platform is None:
        raise NotFoundError(f"Platform {platform_id} not found")
    return platform
