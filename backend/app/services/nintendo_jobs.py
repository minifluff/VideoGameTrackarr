import asyncio
from collections.abc import Callable
from typing import Any

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.repositories import nintendo_repository
from app.services.job_registry import JobDefinition
from app.services.nintendo_client import NintendoClient

JOB_NINTENDO_REFRESH = "nintendo_refresh"

# Same reasoning as platprices_jobs.py's _PACE_DELAY_SECONDS: NintendoClient doesn't
# self-throttle across many sequential calls. Only the per-game title-search step is
# inherently per-item (no batch search endpoint) — the price refresh is one batched call
# per 50 ids for everything matched.
_PACE_DELAY_SECONDS = 0.5


def run(
    session_factory: Callable[[], Session],
    report_progress: Callable[[int, int], None] | None = None,
) -> dict[str, Any]:
    db = session_factory()
    try:
        return asyncio.run(_refresh(db, report_progress or (lambda current, total: None)))
    finally:
        db.close()


async def _refresh(db: Session, report_progress: Callable[[int, int], None]) -> dict[str, Any]:
    """Fetches + caches Nintendo eShop price data for every Nintendo-eligible wishlisted
    game (Switch/Switch 2 + digital — see nintendo_repository.list_distinct_wishlisted_games,
    deliberately pre-filtered like platprices_jobs.py's equivalent, so matching spend stays
    proportional to actual Switch wishlist size). Purely informational, same as
    itad_jobs.py — no confirm-before-applying concern, since this only ever writes to the
    read-only NintendoPriceCache. Unlike ITAD/PlatPrices there is no API key to configure:
    Nintendo's price API and catalog search are public, so this job always runs. A failed
    batched price fetch fails the whole job but never clears the cache — a transient
    Nintendo outage must not wipe the last good prices off the On Sale page (there is no
    region-plan error here to clear for, unlike PlatPrices)."""
    settings = get_settings()
    client = NintendoClient()
    try:
        games = nintendo_repository.list_distinct_wishlisted_games(db)

        succeeded = 0
        failures: list[dict[str, Any]] = []
        for index, game in enumerate(games):
            if index > 0:
                await asyncio.sleep(_PACE_DELAY_SECONDS)
            try:
                cache = nintendo_repository.get_or_create_cache(db, game.id)
                if cache.nsuid is None and not cache.ignored:
                    nsuid = await client.search_game(game.name, settings.nintendo_country)
                    nintendo_repository.set_nsuid(db, cache, nsuid)
                db.commit()
                succeeded += 1
            except Exception as exc:  # noqa: BLE001 - one bad title lookup must not abort the batch
                db.rollback()
                failures.append({"gameId": game.id, "gameName": game.name, "error": str(exc)})
            report_progress(index + 1, len(games))

        # One batched price call per 50 ids for everything matched this run. A failure
        # here fails the whole job (not per-item isolated, since it genuinely is a small
        # number of requests) — whatever matching already committed above stays saved
        # either way.
        matched: dict[str, int] = {}
        for game in games:
            cache = nintendo_repository.get_cache(db, game.id)
            if cache and cache.nsuid:
                matched[cache.nsuid] = game.id

        if matched:
            price_data = await client.get_prices(list(matched.keys()), settings.nintendo_country)
            for nsuid, game_id in matched.items():
                cache = nintendo_repository.get_cache(db, game_id)
                if cache:
                    nintendo_repository.update_price_data(
                        db,
                        cache,
                        price_data.get(nsuid),
                        region=settings.nintendo_country.strip().upper(),
                    )
            db.commit()

        return {
            "total": len(games),
            "succeeded": succeeded,
            "failed": len(failures),
            "failures": failures,
        }
    finally:
        await client.aclose()


DEFINITION_NINTENDO_REFRESH = JobDefinition(id=JOB_NINTENDO_REFRESH, run=run)
