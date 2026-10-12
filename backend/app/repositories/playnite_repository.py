from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.models.playnite import PlayniteLibraryEntry


def get_entry(db: Session, playnite_id: str) -> PlayniteLibraryEntry | None:
    return db.scalars(
        select(PlayniteLibraryEntry).where(PlayniteLibraryEntry.playnite_id == playnite_id)
    ).first()


def get_entry_by_game_id(db: Session, game_id: int) -> PlayniteLibraryEntry | None:
    return db.scalars(select(PlayniteLibraryEntry).where(PlayniteLibraryEntry.game_id == game_id)).first()


def upsert_entry(
    db: Session,
    playnite_id: str,
    playnite_name: str,
    playnite_platform: str | None,
    playnite_playtime_minutes: int,
    playnite_last_played_at: datetime | None,
    playnite_tags: str | None = None,
) -> PlayniteLibraryEntry:
    entry = get_entry(db, playnite_id)
    if entry is None:
        entry = PlayniteLibraryEntry(playnite_id=playnite_id)
        db.add(entry)

    entry.playnite_name = playnite_name
    entry.playnite_platform = playnite_platform
    entry.playnite_playtime_minutes = playnite_playtime_minutes
    entry.playnite_last_played_at = playnite_last_played_at
    entry.playnite_tags = playnite_tags
    db.flush()
    return entry


def set_game_id(db: Session, entry: PlayniteLibraryEntry, game_id: int | None) -> PlayniteLibraryEntry:
    entry.game_id = game_id
    db.flush()
    return entry


def set_ignored(db: Session, entry: PlayniteLibraryEntry, ignored: bool) -> PlayniteLibraryEntry:
    entry.dismissed = ignored
    db.flush()
    return entry


def list_all_entries(db: Session) -> list[PlayniteLibraryEntry]:
    """Every cached Playnite entry, matched or not, ignored or not — the Playnite Sync page
    shows the full picture (including "no catalog match" and ignored rows). Status/
    actionability is computed by the service layer, not filtered here."""
    stmt = (
        select(PlayniteLibraryEntry)
        .options(joinedload(PlayniteLibraryEntry.game))
        .order_by(PlayniteLibraryEntry.playnite_name)
    )
    return list(db.scalars(stmt))


def delete_all_entries(db: Session) -> int:
    """Clears the Playnite scan cache — used before a fresh full scan so removed games
    disappear from the sync page. Returns the number of rows deleted."""
    entries = db.scalars(select(PlayniteLibraryEntry)).all()
    count = len(entries)
    for entry in entries:
        db.delete(entry)
    db.flush()
    return count
