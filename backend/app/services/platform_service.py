from typing import Any

from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.models.catalog import GamePlatform, Platform
from app.models.library import GameProgress, LibraryItem, MediaFormat, PlaySession
from app.repositories import platform_repository
from app.repositories.game_repository import GameWithStatus
from app.repositories.platform_repository import LibraryPlatformCount
from app.services.exceptions import ConflictError, NotFoundError


def list_library_platforms(db: Session) -> list[LibraryPlatformCount]:
    """Every platform with library copies, with owned/wishlisted counts — split by format
    and storefront for PC (see platform_repository.STOREFRONT_SPLIT_IGDB_PLATFORM_IDS)."""
    return platform_repository.list_library_platforms_with_counts(db)


def get_platform_with_games(
    db: Session, slug_or_id: str
) -> tuple[Platform, list[GameWithStatus], list[GameWithStatus]]:
    platform = platform_repository.get_by_slug_or_id(db, slug_or_id)
    if platform is None:
        raise NotFoundError(f"Platform {slug_or_id} not found")
    return (
        platform,
        platform_repository.list_games_for_platform(db, platform.id),
        platform_repository.list_addons_for_platform(db, platform.id),
    )


def list_platforms(db: Session) -> list[tuple[Platform, int]]:
    return platform_repository.list_platforms_with_counts(db)


def list_platform_addons(
    db: Session,
    slug_or_id: str,
    media_format: MediaFormat | None = None,
    storefront: str | None = None,
    **filters: Any,
) -> list[GameWithStatus]:
    platform = platform_repository.get_by_slug_or_id(db, slug_or_id)
    if platform is None:
        raise NotFoundError(f"Platform {slug_or_id} not found")
    return platform_repository.list_addons_for_platform(
        db, platform.id, media_format=media_format, storefront=storefront, **filters
    )


def create_platform(
    db: Session, name: str, abbreviation: str | None, slug: str | None = None, igdb_id: int | None = None
) -> Platform:
    existing = platform_repository.get_by_name(db, name)
    if existing is not None:
        raise ConflictError(f"A platform named {name!r} already exists")

    platform = platform_repository.create_platform(db, name, abbreviation, slug, igdb_id)
    db.commit()
    db.refresh(platform)
    return platform


def update_platform(
    db: Session,
    platform_id: int,
    name: str,
    abbreviation: str | None,
    slug: str | None = None,
    igdb_id: int | None = None,
) -> Platform:
    platform = _require_platform(db, platform_id)
    existing = platform_repository.get_by_name(db, name)
    if existing is not None and existing.id != platform_id:
        raise ConflictError(f"A platform named {name!r} already exists")

    platform = platform_repository.update_platform(db, platform, name, abbreviation, slug, igdb_id)
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
    moved_count = db.scalar(
        select(func.count()).select_from(LibraryItem).where(LibraryItem.platform_id == source.id)
    ) or 0

    # Move library items
    db.execute(
        update(LibraryItem).where(LibraryItem.platform_id == source.id).values(platform_id=target.id)
    )
    # Move progress records — GameProgress has a unique (game_id, platform_id) constraint,
    # so a bulk update would violate it if the target already has progress for the same
    # game. Handle those conflicts per-row: keep the greater playtime, then delete the
    # losing source row instead of moving it.
    source_progress = db.scalars(
        select(GameProgress).where(GameProgress.platform_id == source.id)
    ).all()
    target_progress_by_game = {
        gp.game_id: gp
        for gp in db.scalars(
            select(GameProgress).where(GameProgress.platform_id == target.id)
        ).all()
    }
    for progress in source_progress:
        existing = target_progress_by_game.get(progress.game_id)
        if existing is None:
            progress.platform_id = target.id
        else:
            # Merge: keep the greater playtime on the target row, then drop the source.
            if (progress.playtime_minutes or 0) > (existing.playtime_minutes or 0):
                existing.playtime_minutes = progress.playtime_minutes
            # Keep the latest last_played_at
            if progress.last_played_at and (
                not existing.last_played_at or progress.last_played_at > existing.last_played_at
            ):
                existing.last_played_at = progress.last_played_at
            db.delete(progress)
    db.flush()
    # Move play sessions
    db.execute(
        update(PlaySession).where(PlaySession.platform_id == source.id).values(platform_id=target.id)
    )
    # Move IGDB release-platform links (avoid duplicates if target already has the link)
    existing_target_links = {
        gp.game_id
        for gp in db.scalars(
            select(GamePlatform).where(GamePlatform.platform_id == target.id)
        ).all()
    }
    source_links = db.scalars(
        select(GamePlatform).where(GamePlatform.platform_id == source.id)
    ).all()
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
