import enum
import json
import re
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models.catalog import GameCategory
from app.models.library import LibraryStatus, MediaFormat, Tag
from app.models.playnite import PlayniteLibraryEntry
from app.models.system import User
from app.repositories import (
    game_repository,
    library_item_repository,
    platform_repository,
    playnite_repository,
    tag_repository,
)
from app.services import library_service, progress_service
from app.services.exceptions import NotFoundError


class PlayniteError(Exception):
    """Raised for Playnite configuration or SMB access problems — surfaced to the user
    with a clear message about what to check (path, credentials, network)."""


# Playnite tags that map to the library item's edition field (matched case-insensitively).
EDITION_TAGS = {
    "counterfeit",
    "freetoplay",
    "gamepass",
    "games with gold",
    "japanese",
    "c64 mini",
    "playstation classic",
    "playstation+",
    "stadia pro",
    "snes classic",
    "nes classic",
    "quest+",
    "vr",
    "wii u roms",
    "3ds roms",
    "sega genesis mini",
    "sega genesis mini 2",
}


def _tags_to_edition(playnite_tags: str | None) -> str | None:
    """Extract edition tags from a comma-separated Playnite tag string. Returns the
    matched tags joined by ", ", or None when none match."""
    if not playnite_tags:
        return None
    matched = [
        tag.strip()
        for tag in playnite_tags.split(",")
        if tag.strip().lower() in EDITION_TAGS
    ]
    return ", ".join(matched) if matched else None


def test_connection(smb_path: str, username: str | None, password: str | None) -> None:
    """Tries to connect to the SMB server and access the share — raises PlayniteError
    with a clear message if anything fails. Does not read any library files."""
    try:
        from smbprotocol.connection import Connection
        from smbprotocol.session import Session
        from smbprotocol.tree import TreeConnect
    except ImportError as exc:
        raise PlayniteError(
            "The 'smbprotocol' package is required for Playnite sync — install it with "
            "'pip install smbprotocol' and restart."
        ) from exc

    if not smb_path or not smb_path.strip():
        raise PlayniteError("Enter the Playnite folder location first.")

    server, share, _subpath = _parse_smb_path(smb_path)

    connection = Connection(uuid.uuid4(), server, 445)
    try:
        connection.connect(timeout=15)
    except Exception as exc:
        raise PlayniteError(f"Could not connect to SMB server {server!r}: {exc}") from exc

    try:
        session = Session(connection, username or "", password or "")
        try:
            session.connect()
        except Exception as exc:
            raise PlayniteError(f"SMB authentication failed for {server!r}: {exc}") from exc

        tree = TreeConnect(session, f"\\\\{server}\\{share}")
        try:
            tree.connect()
        except Exception as exc:
            raise PlayniteError(f"Could not access SMB share {share!r} on {server!r}: {exc}") from exc
    finally:
        connection.disconnect()


class PlayniteEntryStatus(enum.StrEnum):
    NO_MATCH = "no_match"
    NEW = "new"
    UP_TO_DATE = "up_to_date"
    IGNORED = "ignored"


@dataclass
class PlayniteEntryWithStatus:
    entry: PlayniteLibraryEntry
    status: PlayniteEntryStatus
    vgt_playtime_minutes: int | None


def list_entries(db: Session) -> list[PlayniteEntryWithStatus]:
    """Every cached Playnite entry with a computed status — the table the Playnite Sync
    page renders. NO_MATCH and ignored entries stay visible too, so the user has the
    complete picture of what Playnite has versus what VGT knows."""
    entries = playnite_repository.list_all_entries(db)
    return [_with_status(db, entry) for entry in entries]


def get_config(user: User) -> dict[str, Any]:
    """The Playnite SMB config for API responses — the password itself is never
    returned, only whether one is set."""
    return {
        "smb_path": user.playnite_smb_path,
        "smb_username": user.playnite_smb_username,
        "has_password": bool(user.playnite_smb_password),
    }


def set_config(
    db: Session,
    user: User,
    smb_path: str | None,
    smb_username: str | None,
    smb_password: str | None,
) -> User:
    """Updates the Playnite SMB config — any field passed as None is cleared. An empty
    path disables Playnite sync entirely."""
    user.playnite_smb_path = smb_path.strip() if smb_path and smb_path.strip() else None
    user.playnite_smb_username = smb_username.strip() if smb_username and smb_username.strip() else None
    # An empty string clears the stored password; None leaves it untouched so the
    # frontend can update path/username without re-sending the password every time.
    if smb_password is not None:
        user.playnite_smb_password = smb_password if smb_password else None
    db.commit()
    db.refresh(user)
    return user


def scan_library(db: Session, user: User) -> dict[str, Any]:
    """Reads the Playnite library from the configured SMB share and rebuilds the local
    entry cache from scratch — every previous entry is deleted first, so the cache
    always mirrors the current Playnite library exactly (games removed from Playnite
    disappear here too). Each entry is then matched against VGT's games table by
    case-insensitive name; matches link the entry (game_id), non-matches stay NO_MATCH
    until the user syncs them (which creates the game) or dismisses them."""
    if not user.playnite_smb_path:
        raise PlayniteError(
            "Playnite isn't configured yet — set the SMB path to your Playnite data folder "
            "in Settings → Integrations."
        )

    try:
        games_data, platforms = _read_playnite_library(
            user.playnite_smb_path, user.playnite_smb_username, user.playnite_smb_password
        )
    except PlayniteError:
        raise
    except Exception as exc:  # noqa: BLE001 - surface any SMB failure as a clear user message
        raise PlayniteError(f"Could not read the Playnite library: {exc}") from exc

    # Preserve existing entry -> game links across the rebuild, keyed by Playnite's
    # own ID — each Playnite entry gets its own VGT game, even when names match
    # (the user may own multiple copies of the same game on different platforms).
    existing_links = {
        entry.playnite_id: entry.game_id
        for entry in db.scalars(select(PlayniteLibraryEntry)).all()
        if entry.game_id is not None
    }
    dismissed_ids = {
        entry.playnite_id
        for entry in db.scalars(select(PlayniteLibraryEntry)).all()
        if entry.dismissed
    }

    # Start fresh: clear all previously scanned entries (only after the library read
    # succeeded, so a failed scan never wipes a good cache).
    db.execute(delete(PlayniteLibraryEntry))

    scanned = 0
    new_matches = 0
    for game_data in games_data:
        normalized = _normalize_game_data(game_data, platforms)
        if normalized is None:
            continue
        playnite_id, name, platform_name, playtime_minutes, last_played, tags = normalized

        entry = playnite_repository.upsert_entry(
            db, playnite_id, name, platform_name, playtime_minutes, last_played, tags
        )
        scanned += 1

        # Restore the previous game link for this Playnite ID, if any — no name
        # matching, so duplicate names across platforms stay as separate games.
        if playnite_id in existing_links:
            playnite_repository.set_game_id(db, entry, existing_links[playnite_id])
            new_matches += 1
        elif playnite_id in dismissed_ids:
            playnite_repository.set_ignored(db, entry, True)

    db.commit()
    return {"scanned": scanned, "new_count": new_matches}


def sync_entries(db: Session, playnite_ids: list[str]) -> dict[str, Any]:
    """Explicit, user-confirmed apply of Playnite's data to VGT — never called
    automatically. A NO_MATCH id syncs by creating the game first (manual game with the
    Playnite name); an already-UP_TO_DATE id is a harmless no-op, not an error, so a
    bulk selection that happens to include a non-actionable row doesn't fail the batch."""
    synced = 0
    failures: list[dict[str, Any]] = []
    for playnite_id in playnite_ids:
        try:
            entry = playnite_repository.get_entry(db, playnite_id)
            if entry is None:
                raise NotFoundError(f"Playnite entry {playnite_id} not found")
            _sync_one(db, entry)
            synced += 1
        except Exception as exc:  # noqa: BLE001 - one bad id must not abort the batch
            db.rollback()
            failures.append({"playniteId": playnite_id, "error": str(exc)})

    return {"synced": synced, "failed": len(failures), "failures": failures}


def ignore_entry(db: Session, playnite_id: str) -> PlayniteEntryWithStatus:
    entry = _require_entry(db, playnite_id)
    playnite_repository.set_ignored(db, entry, True)
    db.commit()
    return _with_status(db, entry)


def unignore_entry(db: Session, playnite_id: str) -> PlayniteEntryWithStatus:
    entry = _require_entry(db, playnite_id)
    playnite_repository.set_ignored(db, entry, False)
    db.commit()
    return _with_status(db, entry)


def _existing_playnite_formats(db: Session, game_id: int, platform_id: int | None) -> set[MediaFormat]:
    """Formats of OWNED library items for this game+platform — used to avoid creating
    duplicates when re-syncing."""
    return {
        item.format
        for item in library_item_repository.list_library_items(db, game_id, status=LibraryStatus.OWNED)
        if item.platform_id == platform_id and item.format in (MediaFormat.PHYSICAL, MediaFormat.DIGITAL)
    }


def _sync_one(db: Session, entry: PlayniteLibraryEntry) -> None:
    # A NO_MATCH entry has no VGT game yet — always create a new manual game, even
    # if another game shares the name (the user may own multiple copies across
    # platforms). Each Playnite entry gets its own VGT game.
    if entry.game_id is None:
        game = game_repository.create_manual_game(db, name=entry.playnite_name, category=GameCategory.MAIN_GAME)
        playnite_repository.set_game_id(db, entry, game.id)
        db.flush()

    # Resolve the platform from the Playnite platform name when we have one —
    # get-or-create by name, same lenient pattern as CSV import. Falls back to no
    # platform (platform_id stays None) when Playnite didn't record one.
    platform_id = None
    if entry.playnite_platform:
        platform_id = platform_repository.get_or_create_by_name(db, entry.playnite_platform).id

    # Determine which formats to create: "Physical and Digital" (as a single tag
    # or as separate tags) means the user owns both — create one library item
    # per format. "Physical" alone → physical only; otherwise digital.
    tags = [t.strip().lower() for t in (entry.playnite_tags or "").split(",")]
    has_physical = any("physical" in t for t in tags)
    has_digital = any("digital" in t for t in tags)
    if has_physical and has_digital:
        wanted_formats = [MediaFormat.PHYSICAL, MediaFormat.DIGITAL]
    elif has_physical:
        wanted_formats = [MediaFormat.PHYSICAL]
    else:
        wanted_formats = [MediaFormat.DIGITAL]

    # Only create formats that don't already have an OWNED item for this
    # game+platform — re-syncing must not duplicate.
    existing_formats = _existing_playnite_formats(db, entry.game_id, platform_id)
    edition = _tags_to_edition(entry.playnite_tags)
    for fmt in wanted_formats:
        if fmt not in existing_formats:
            library_service.add_library_item(
                db,
                entry.game_id,
                platform_id=platform_id,
                status=LibraryStatus.OWNED,
                format=fmt,
                edition=edition,
                notes=entry.playnite_tags,
            )
    sync_platform_id = platform_id

    # A "Z-Adult" Playnite tag marks the game as adult-only.
    tags_lower = [t.strip().lower() for t in (entry.playnite_tags or "").split(",")]
    if "z-adult" in tags_lower:
        adult_tag = tag_repository.get_tag_by_name(db, "Adult-Only")
        if adult_tag is None:
            adult_tag = Tag(name="Adult-Only")
            db.add(adult_tag)
            db.flush()
        tag_repository.attach_tag(db, entry.game_id, adult_tag.id)

    # A straight set to Playnite's numbers, not a merge — Sync is an explicit, confirmed
    # action so it's allowed to overwrite, including downward. play_status is deliberately
    # left alone — playtime alone can't tell VGT whether the user considers this
    # backlog/playing/completed/abandoned.
    if sync_platform_id is not None:
        progress_service.upsert_progress_for_platform(
            db,
            entry.game_id,
            sync_platform_id,
            playtime_minutes=entry.playnite_playtime_minutes,
            last_played_at=entry.playnite_last_played_at.date() if entry.playnite_last_played_at else None,
        )


def _with_status(db: Session, entry: PlayniteLibraryEntry) -> PlayniteEntryWithStatus:
    if entry.dismissed:
        return PlayniteEntryWithStatus(entry, PlayniteEntryStatus.IGNORED, None)

    if entry.game_id is None:
        return PlayniteEntryWithStatus(entry, PlayniteEntryStatus.NO_MATCH, None)

    # Status is based on whether any OWNED library item exists for the game —
    # with multi-format support there may be several.
    owned_items = [
        item
        for item in library_item_repository.list_library_items(
            db, entry.game_id, status=LibraryStatus.OWNED
        )
    ]
    if not owned_items:
        return PlayniteEntryWithStatus(entry, PlayniteEntryStatus.NEW, None)

    platform_id = owned_items[0].platform_id
    if platform_id is None:
        return PlayniteEntryWithStatus(entry, PlayniteEntryStatus.NEW, None)

    progress = progress_service.get_progress_for_platform(db, entry.game_id, platform_id)
    vgt_minutes = progress.playtime_minutes if progress else 0
    if vgt_minutes == entry.playnite_playtime_minutes:
        status = PlayniteEntryStatus.UP_TO_DATE
    else:
        status = PlayniteEntryStatus.NEW
    return PlayniteEntryWithStatus(entry, status, vgt_minutes)


def _require_entry(db: Session, playnite_id: str) -> PlayniteLibraryEntry:
    entry = playnite_repository.get_entry(db, playnite_id)
    if entry is None:
        raise NotFoundError(f"Playnite entry {playnite_id} not found")
    return entry


def _parse_smb_path(smb_path: str) -> tuple[str, str, str]:
    """Parses an SMB path into (server, share, subpath). Accepts Windows UNC
    (\\\\server\\share\\path) and smb:// URLs (smb://server/share/path)."""
    path = smb_path.strip()
    if path.lower().startswith("smb://"):
        path = path[6:]
        parts = [p for p in path.split("/") if p]
    else:
        path = path.lstrip("\\")
        parts = [p for p in re.split(r"[\\/]", path) if p]

    if len(parts) < 2:
        raise PlayniteError(
            f"Invalid SMB path {smb_path!r} — expected \\\\server\\share\\path or smb://server/share/path."
        )
    server, share = parts[0], parts[1]
    subpath = "\\".join(parts[2:])
    return server, share, subpath


def _read_playnite_library(
    smb_path: str, username: str | None, password: str | None
) -> tuple[list[dict[str, Any]], dict[str, str]]:
    """Reads library/games.json and library/platforms.json from the Playnite data folder
    over SMB. Returns (games_list, {platform_id: platform_name})."""
    # Imported lazily so the app still boots (and every non-Playnite feature still works)
    # on systems where smbprotocol isn't installed.
    try:
        from smbprotocol.connection import Connection
        from smbprotocol.session import Session
        from smbprotocol.tree import TreeConnect
    except ImportError as exc:
        raise PlayniteError(
            "The 'smbprotocol' package is required for Playnite sync — install it with "
            "'pip install smbprotocol' and restart."
        ) from exc

    server, share, subpath = _parse_smb_path(smb_path)
    base = f"{subpath}\\library" if subpath else "library"

    connection = Connection(uuid.uuid4(), server, 445)
    try:
        connection.connect(timeout=15)
    except Exception as exc:
        raise PlayniteError(f"Could not connect to SMB server {server!r}: {exc}") from exc

    try:
        session = Session(connection, username or "", password or "")
        try:
            session.connect()
        except Exception as exc:
            raise PlayniteError(f"SMB authentication failed for {server!r}: {exc}") from exc

        tree = TreeConnect(session, f"\\\\{server}\\{share}")
        try:
            tree.connect()
        except Exception as exc:
            raise PlayniteError(f"Could not access SMB share {share!r} on {server!r}: {exc}") from exc

        games_data = _read_smb_json(tree, f"{base}\\games.json")
        try:
            platforms_data = _read_smb_json(tree, f"{base}\\platforms.json")
        except PlayniteError:
            # platforms.json is optional — without it, platform names are just unknown.
            platforms_data = []
    finally:
        connection.disconnect()

    if not isinstance(games_data, list):
        # Playnite Library Exporter format wraps the list: { games: [...], ... }
        if isinstance(games_data, dict) and isinstance(games_data.get("games"), list):
            games_data = games_data["games"]
        else:
            raise PlayniteError("Unexpected games.json format — expected a JSON list of games.")
    platforms = {str(p.get("Id")): str(p.get("Name") or "") for p in platforms_data if isinstance(p, dict)}
    return games_data, platforms


def _normalize_game_data(
    game_data: dict[str, Any], platforms: dict[str, str]
) -> tuple[str, str, str | None, int, datetime | None, str | None] | None:
    """Extracts (playnite_id, name, platform_name, playtime_minutes, last_played, tags)
    from a raw game dict, handling both the native Playnite library format
    (Id/Name/Platforms as GUIDs/Playtime in seconds) and the Playnite Library Exporter
    format (playniteId/name/platforms as names/playtimeSeconds). Returns None if the
    row has no usable id or name. Tags are joined into a comma-separated string."""
    # Exporter format uses camelCase keys; native uses PascalCase.
    playnite_id = str(game_data.get("playniteId") or game_data.get("Id") or "").strip()
    name = str(game_data.get("name") or game_data.get("Name") or "").strip()
    if not playnite_id or not name:
        return None

    # Exporter format: platforms is already a list of names.
    raw_platforms = game_data.get("platforms")
    if isinstance(raw_platforms, list) and raw_platforms and isinstance(raw_platforms[0], str):
        platform_name = str(raw_platforms[0]).strip() or None
    else:
        # Native format: Platforms is a list of GUIDs resolved via platforms.json.
        platform_names = [
            platforms.get(str(pid), "")
            for pid in (game_data.get("Platforms") or [])
            if platforms.get(str(pid))
        ]
        platform_name = platform_names[0] if platform_names else None

    playtime_seconds = game_data.get("playtimeSeconds")
    if playtime_seconds is None:
        playtime_seconds = game_data.get("Playtime") or 0
    try:
        playtime_minutes = int(playtime_seconds // 60)
    except (TypeError, ValueError):
        playtime_minutes = 0

    last_played = _parse_playnite_datetime(
        game_data.get("lastActivity") or game_data.get("LastActivity")
    )

    raw_tags = game_data.get("tags") or game_data.get("Tags") or []
    tags = ", ".join(str(t).strip() for t in raw_tags if str(t).strip()) or None

    return playnite_id, name, platform_name, playtime_minutes, last_played, tags


def _read_smb_json(tree: Any, path: str) -> Any:
    """Reads and JSON-parses a single file from an SMB tree connection."""
    from smbprotocol.open import (
        CreateDisposition,
        CreateOptions,
        FileAttributes,
        FilePipePrinterAccessMask,
        ImpersonationLevel,
        Open,
        ShareAccess,
    )

    try:
        file = Open(tree, path)
        file.create(
            ImpersonationLevel.Impersonation,
            FilePipePrinterAccessMask.FILE_READ_DATA,
            FileAttributes.FILE_ATTRIBUTE_NORMAL,
            ShareAccess.FILE_SHARE_READ,
            CreateDisposition.FILE_OPEN,
            CreateOptions.FILE_NON_DIRECTORY_FILE,
        )
    except Exception as exc:
        raise PlayniteError(f"Could not open {path!r} on the SMB share: {exc}") from exc

    try:
        # No query_info on Open in this smbprotocol version — read in 1MB chunks
        # until a short read signals EOF.
        chunks = []
        offset = 0
        while True:
            chunk = file.read(offset, 1024 * 1024)
            if not chunk:
                break
            chunks.append(chunk)
            offset += len(chunk)
            if len(chunk) < 1024 * 1024:
                break
        raw = b"".join(chunks)
    except Exception as exc:
        raise PlayniteError(f"Could not read {path!r} from the SMB share: {exc}") from exc
    finally:
        file.close()

    try:
        # utf-8-sig tolerates the BOM some Windows editors leave behind.
        return json.loads(raw.decode("utf-8-sig"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise PlayniteError(f"Could not parse {path!r} as JSON: {exc}") from exc


def _parse_playnite_datetime(value: Any) -> datetime | None:
    """Playnite stores datetimes as ISO-ish strings ("2024-01-15T10:30:00") — parse
    leniently, return None for anything unparseable rather than failing the scan."""
    if not value or not isinstance(value, str):
        return None
    try:
        parsed = datetime.fromisoformat(value.strip())
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=UTC)
        return parsed
    except (ValueError, TypeError):
        return None
