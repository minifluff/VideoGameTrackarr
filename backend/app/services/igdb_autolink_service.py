
"""Auto-link manually-added games to IGDB by name matching.

Finds games in the library that have no IGDB link, searches IGDB for each by
name, and links them automatically when there's a confident exact match.
"""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.catalog import Game
from app.repositories import game_repository
from app.services import game_service
from app.services.exceptions import ConflictError
from app.services.igdb_client import IGDBClient


def list_unlinked_games(db: Session) -> list[Game]:
    """All games in the library that aren't linked to IGDB yet."""
    return list(
        db.scalars(select(Game).where(Game.igdb_id.is_(None)).order_by(Game.name))
    )


def _normalize_name(name: str) -> str:
    """Normalize a game name for fuzzy matching: lowercase, remove punctuation,
    articles, edition suffixes, and extra whitespace."""
    import re
    import unicodedata

    # Unicode normalize (é -> e, etc.)
    nfkd = unicodedata.normalize("NFKD", name)
    ascii_name = "".join(c for c in nfkd if not unicodedata.combining(c))

    lowered = ascii_name.lower().strip()

    # Remove common edition suffixes in parentheses/brackets
    pattern = (
        r"\\s*[\\(\\[].*?(edition|goty|remaster|remake|deluxe|ultimate|"
        r"complete|definitive|enhanced|directors? cut)[\\]\\)]"
    )
    lowered = re.sub(pattern, "", lowered)
    # Remove trailing year in parentheses
    lowered = re.sub(r"\s*\(\d{4}\)\s*$", "", lowered)

    # Remove punctuation
    lowered = re.sub(r"[^a-z0-9\s]", "", lowered)

    # Remove leading articles
    lowered = re.sub(r"^(the|a|an)\s+", "", lowered)

    # Collapse whitespace
    lowered = re.sub(r"\s+", " ", lowered).strip()

    return lowered


def _find_exact_match(game_name: str, results: list[dict]) -> dict | None:
    """Returns the IGDB result whose name exactly matches (case-insensitive),
    or None if no match."""
    target = game_name.strip().lower()
    for result in results:
        name = str(result.get("name", "")).strip().lower()
        if name == target:
            return result
    return None


def _find_normalized_match(game_name: str, results: list[dict]) -> dict | None:
    """Fallback: returns the IGDB result whose normalized name matches the
    normalized game name, or None if no match."""
    target = _normalize_name(game_name)
    if not target:
        return None
    for result in results:
        name = _normalize_name(str(result.get("name", "")))
        if name == target and name:
            return result
    return None


async def autolink_games(
    db: Session, igdb_client: IGDBClient, game_ids: list[int]
) -> dict:
    """Attempts to auto-link each game to IGDB by exact name match.

    Returns {"linked": [...], "no_match": [...], "failed": [...]} with game
    names in each bucket. One bad game never aborts the batch.
    """
    linked: list[str] = []
    no_match: list[str] = []
    failed: list[dict] = []

    for game_id in game_ids:
        game = db.get(Game, game_id)
        if game is None:
            failed.append({"gameId": game_id, "error": "Game not found"})
            continue
        if game.igdb_id is not None:
            continue  # Already linked — harmless no-op

        try:
            results = await igdb_client.search_games(game.name, limit=10)
            match = _find_exact_match(game.name, results)
            if match is None:
                # Fallback to normalized matching for names with
                # punctuation/edition differences
                match = _find_normalized_match(game.name, results)
            if match is None:
                no_match.append(game.name)
                continue
            try:
                await game_service.link_game_to_igdb(db, igdb_client, game.id, match["id"])
            except ConflictError:
                # IGDB game already in library — merge the duplicate instead of failing.
                # Re-fetch game (link may have partially modified it before the conflict).
                db.rollback()
                game = db.get(Game, game_id)
                if game is None or game.igdb_id is not None:
                    continue
                # Verify the IGDB target still exists
                target = game_repository.get_game_by_igdb_id(db, match["id"])
                if target is None:
                    # Target was deleted between check and merge — try direct link again
                    await game_service.link_game_to_igdb(db, igdb_client, game.id, match["id"])
                else:
                    game_service.merge_duplicate_game(db, game.id, match["id"])
            linked.append(game.name)
        except Exception as exc:  # noqa: BLE001 - one bad game must not abort the batch
            db.rollback()
            failed.append({"gameId": game_id, "error": str(exc)})

    return {"linked": linked, "no_match": no_match, "failed": failed}
