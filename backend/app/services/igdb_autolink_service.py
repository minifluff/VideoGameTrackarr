
"""Auto-link manually-added games to IGDB by name matching.

Finds games in the library that have no IGDB link, searches IGDB for each by
name, and links them automatically when there's a confident exact match.
"""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.catalog import Game
from app.services import game_service
from app.services.igdb_client import IGDBClient


def list_unlinked_games(db: Session) -> list[Game]:
    """All games in the library that aren't linked to IGDB yet."""
    return list(
        db.scalars(select(Game).where(Game.igdb_id.is_(None)).order_by(Game.name))
    )


def _find_exact_match(game_name: str, results: list[dict]) -> dict | None:
    """Returns the IGDB result whose name exactly matches (case-insensitive),
    or None if no match."""
    target = game_name.strip().lower()
    for result in results:
        name = str(result.get("name", "")).strip().lower()
        if name == target:
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
                no_match.append(game.name)
                continue
            await game_service.link_game_to_igdb(db, igdb_client, game.id, match["id"])
            linked.append(game.name)
        except Exception as exc:  # noqa: BLE001 - one bad game must not abort the batch
            db.rollback()
            failed.append({"gameId": game_id, "error": str(exc)})

    return {"linked": linked, "no_match": no_match, "failed": failed}
