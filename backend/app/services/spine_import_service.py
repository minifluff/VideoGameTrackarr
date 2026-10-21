"""Bulk spine-art import for Bookshelf mode.

The client uploads image files whose filenames carry their folder path (the
browser's folder picker sends webkitRelativePath as the filename), laid out the
way LaunchBox stores downloaded art:

    .../<Platform Name>/Box - Spine/<Game Name>.<ext>

Each file is matched to a local game by normalized title + platform: the game
must be catalogued for that platform (game_platforms) or owned on it
(library_items). A file whose title+platform matches more than one game is
reported ambiguous rather than guessed. Matched images are stored via
upload_service.save_spine_image and set as the game's spine_url, replacing
(and cleaning up) any previous local spine upload.
"""

import re
from dataclasses import dataclass, field

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.catalog import Game, GamePlatform, Platform
from app.models.library import LibraryItem
from app.services import upload_service

_SPINE_DIR_MARKER = "box - spine"
_IMAGE_SUFFIXES = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp"}


def _normalize(value: str) -> str:
    """Loose matching key: lowercase alphanumerics only, so 'The Legend of
    Zelda: Breath of the Wild' and 'the legend of zelda breath of the wild'
    (and a LaunchBox filename's lost punctuation) compare equal."""
    return re.sub(r"[^a-z0-9]+", " ", value.lower()).strip()


@dataclass
class SpineImportResult:
    matched: list[dict] = field(default_factory=list)
    unmatched: list[str] = field(default_factory=list)
    ambiguous: list[str] = field(default_factory=list)
    invalid: list[str] = field(default_factory=list)


def _parse_launchbox_path(raw_path: str) -> tuple[str, str] | None:
    """(platform folder name, title) from a '.../<Platform>/Box - Spine/<Title>.png'
    path, or None when the layout doesn't fit (flat uploads, missing marker)."""
    parts = [part for part in re.split(r"[/\\]", raw_path) if part]
    if len(parts) < 3:
        return None
    marker_index = next(
        (i for i, part in enumerate(parts) if part.strip().lower() == _SPINE_DIR_MARKER), None
    )
    if marker_index is None or marker_index == 0 or marker_index != len(parts) - 2:
        return None
    filename = parts[-1]
    stem, dot, suffix = filename.rpartition(".")
    if not dot or f".{suffix.lower()}" not in _IMAGE_SUFFIXES:
        return None
    return parts[marker_index - 1], stem


def import_spine_files(db: Session, files: list[tuple[str, bytes]]) -> SpineImportResult:
    """files: (path-carrying filename, raw bytes) pairs, one batch per call —
    the client chunks large folder uploads so each request stays small."""
    result = SpineImportResult()

    platforms_by_key: dict[str, Platform] = {}
    for platform in db.execute(select(Platform)).scalars():
        platforms_by_key.setdefault(_normalize(platform.name), platform)
        platforms_by_key.setdefault(_normalize(platform.slug.replace("-", " ")), platform)

    for raw_path, raw in files:
        parsed = _parse_launchbox_path(raw_path)
        if parsed is None:
            result.unmatched.append(raw_path)
            continue
        platform_name, title = parsed
        platform = platforms_by_key.get(_normalize(platform_name))
        if platform is None:
            result.unmatched.append(raw_path)
            continue

        title_key = _normalize(title)
        candidate_ids = set(
            db.execute(
                select(GamePlatform.game_id).where(GamePlatform.platform_id == platform.id)
            ).scalars()
        ) | set(
            db.execute(
                select(LibraryItem.game_id).where(LibraryItem.platform_id == platform.id)
            ).scalars()
        )
        matches = [
            game
            for game in db.execute(
                select(Game).where(Game.id.in_(candidate_ids or {-1}))
            ).scalars()
            if _normalize(game.name) == title_key
        ]
        if not matches:
            result.unmatched.append(raw_path)
            continue
        if len(matches) > 1:
            result.ambiguous.append(raw_path)
            continue

        game = matches[0]
        try:
            url = upload_service.save_spine_image(raw)
        except ValueError:
            result.invalid.append(raw_path)
            continue
        old_spine_url = game.spine_url
        game.spine_url = url
        db.commit()
        upload_service.delete_spine_if_local(old_spine_url)
        result.matched.append({"gameId": game.id, "name": game.name, "path": raw_path})

    return result
