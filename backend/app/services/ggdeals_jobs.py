import asyncio
from collections.abc import Callable
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.steam import SteamLibraryEntry, SteamWishlistEntry
from app.repositories import ggdeals_repository
from app.services.ggdeals_client import GGDEALS_MAX_IDS_PER_REQUEST, GgDealsClient
from app.services.job_registry import JobDefinition

JOB_GGDEALS_REFRESH = "ggdeals_refresh"

# GG.deals' Prices API allows 100 records/minute (each Steam AppID counts as one record).
# The client already chunks requests to 100 ids; pacing one chunk per 60 seconds here keeps
# a whole refresh run under the per-minute limit no matter the wishlist size, instead of
# retry-bursting into 429s (which GgDealsClient deliberately does not retry).
_CHUNK_PACE_SECONDS = 60


class GgDealsNotConfiguredError(Exception):
    """Raised when GGDEALS_API_KEY isn't set yet."""


def run(
    session_factory: Callable[[], Session],
    report_progress: Callable[[int, int], None] | None = None,
) -> dict[str, Any]:
    db = session_factory()
    try:
        return asyncio.run(_refresh(db, report_progress or (lambda current, total: None)))
    finally:
        db.close()


def _resolve_steam_app_id(db: Session, game_id: int) -> int | None:
    """Steam AppID for a game, from the user's own Steam data — wishlist entries first
    (the refresh job only considers wishlisted games, so this is the common hit), then
    owned-library entries. Purely local DB reads, no API cost."""
    entry = db.scalars(select(SteamWishlistEntry).where(SteamWishlistEntry.game_id == game_id)).first()
    if entry is not None:
        return entry.steam_app_id
    entry = db.scalars(select(SteamLibraryEntry).where(SteamLibraryEntry.game_id == game_id)).first()
    return entry.steam_app_id if entry is not None else None


async def _refresh(db: Session, report_progress: Callable[[int, int], None]) -> dict[str, Any]:
    """Fetches + caches GG.deals price data for every wishlisted game — resolves the Steam
    AppID from the user's Steam wishlist/library entries if not already resolved, then
    batch-fetches prices in 100-id chunks paced to the rate limit. Purely informational
    (never writes to anything the user typed, only the read-only GgDealsPriceCache), so
    like the ITAD/PlatPrices jobs this can run fully automatically."""
    settings = get_settings()
    if not settings.ggdeals_api_key:
        raise GgDealsNotConfiguredError(
            "GG.deals isn't configured yet — set GGDEALS_API_KEY in .env and restart VideoGameTrackarr."
        )

    client = GgDealsClient(api_key=settings.ggdeals_api_key)
    try:
        games = ggdeals_repository.list_distinct_wishlisted_games(db)

        succeeded = 0
        failures: list[dict[str, Any]] = []
        for index, game in enumerate(games):
            try:
                cache = ggdeals_repository.get_or_create_cache(db, game.id)
                if cache.steam_app_id is None and not cache.ignored:
                    steam_app_id = _resolve_steam_app_id(db, game.id)
                    ggdeals_repository.set_steam_app_id(db, cache, steam_app_id)
                db.commit()
                succeeded += 1
            except Exception as exc:  # noqa: BLE001 - one bad game must not abort the batch
                db.rollback()
                failures.append({"gameId": game.id, "gameName": game.name, "error": str(exc)})
            report_progress(index + 1, len(games))

        # Batched price fetch for everything resolved this run — one request per 100 ids,
        # paced to the rate limit. A failed chunk records a per-game failure for the games
        # in that chunk and moves on, so one bad chunk never aborts the remaining chunks —
        # whatever already committed above stays saved either way.
        matched: dict[int, int] = {}
        for game in games:
            cache = ggdeals_repository.get_cache(db, game.id)
            if cache and cache.steam_app_id and not cache.ignored:
                matched[cache.steam_app_id] = game.id

        if matched:
            app_ids = list(matched.keys())
            chunks = [
                app_ids[i : i + GGDEALS_MAX_IDS_PER_REQUEST]
                for i in range(0, len(app_ids), GGDEALS_MAX_IDS_PER_REQUEST)
            ]
            for chunk_index, chunk in enumerate(chunks):
                try:
                    prices = await client.get_prices_by_steam_app_id(chunk, settings.ggdeals_region)
                    for app_id in chunk:
                        cache = ggdeals_repository.get_cache(db, matched[app_id])
                        if cache:
                            ggdeals_repository.update_price_data(db, cache, app_id, prices.get(app_id))
                    db.commit()
                except Exception as exc:  # noqa: BLE001 - one bad chunk must not abort the batch
                    db.rollback()
                    for app_id in chunk:
                        game_id = matched[app_id]
                        game = next((g for g in games if g.id == game_id), None)
                        failures.append(
                            {
                                "gameId": game_id,
                                "gameName": game.name if game else f"Steam App {app_id}",
                                "error": str(exc),
                            }
                        )
                if chunk_index < len(chunks) - 1:
                    await asyncio.sleep(_CHUNK_PACE_SECONDS)

        return {
            "total": len(games),
            "succeeded": succeeded,
            "failed": len(failures),
            "failures": failures,
        }
    finally:
        await client.aclose()


DEFINITION_GGDEALS_REFRESH = JobDefinition(id=JOB_GGDEALS_REFRESH, run=run)
