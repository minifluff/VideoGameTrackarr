import asyncio
import re
import threading
from collections.abc import Callable
from dataclasses import dataclass, replace
from datetime import UTC, datetime
from enum import StrEnum
from typing import Any

from sqlalchemy.orm import Session

from app.models.catalog import Game
from app.repositories import game_repository
from app.services import game_service
from app.services.exceptions import ConflictError
from app.services.igdb_client import IGDBClient

# link_game_to_igdb makes 2-3 IGDB HTTP calls per game (search + import) and nothing in
# IGDBClient self-throttles across many sequential calls — same pacing constant and
# reasoning as app/services/catalog_resync_job.py's own copy.
_PACE_DELAY_SECONDS = 0.5

# How many IGDB search hits to consider per game — enough to find an exact name match
# without churning through pages of irrelevant results for every library entry.
_SEARCH_LIMIT = 10


class IgdbLinkStatus(StrEnum):
    IDLE = "idle"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class IgdbLinkReviewReason(StrEnum):
    NO_MATCH = "no_match"
    AMBIGUOUS = "ambiguous"
    ALREADY_IN_LIBRARY = "already_in_library"


@dataclass(frozen=True)
class IgdbLinkProgress:
    current: int
    total: int


@dataclass(frozen=True)
class IgdbLinkResult:
    total_candidates: int
    linked: int
    skipped: int
    no_match: int
    ambiguous: int
    failed: int
    # Games that need a manual look in the per-game "Link to IGDB" dialog: no exact
    # name match, several exact matches, or the matched IGDB id is already linked to
    # a different game in the library.
    needs_review: list[dict[str, Any]]
    failures: list[dict[str, Any]]


@dataclass(frozen=True)
class IgdbLinkState:
    status: IgdbLinkStatus = IgdbLinkStatus.IDLE
    started_at: datetime | None = None
    finished_at: datetime | None = None
    progress: IgdbLinkProgress | None = None
    result: IgdbLinkResult | None = None
    error: str | None = None


# Process-global, in-memory, single-slot — same shape and tradeoff as
# app/services/catalog_resync_job.py (a page refresh/navigation still sees a run in
# progress, but this does NOT survive the server process restarting). This shouldn't
# appear in the Settings > Jobs list alongside the scheduled/bulk jobs.
_lock = threading.Lock()
_state = IgdbLinkState()


def get_state() -> IgdbLinkState:
    with _lock:
        return _state


def start_link_all(session_factory: Callable[[], Session]) -> IgdbLinkState:
    global _state
    with _lock:
        if _state.status == IgdbLinkStatus.RUNNING:
            raise ConflictError("An IGDB link-all job is already in progress.")
        _state = IgdbLinkState(status=IgdbLinkStatus.RUNNING, started_at=datetime.now(UTC))
        snapshot = _state

    thread = threading.Thread(target=_run_link_all, args=(session_factory,), daemon=True)
    thread.start()
    return snapshot


def _set_progress(current: int, total: int) -> None:
    global _state
    with _lock:
        if _state.status == IgdbLinkStatus.RUNNING:
            _state = replace(_state, progress=IgdbLinkProgress(current=current, total=total))


def _run_link_all(session_factory: Callable[[], Session]) -> None:
    global _state
    db: Session | None = None
    try:
        db = session_factory()
        result = asyncio.run(_link_all_games(db))
        with _lock:
            _state = replace(_state, status=IgdbLinkStatus.COMPLETED, result=result, finished_at=datetime.now(UTC))
    except Exception as exc:  # noqa: BLE001 - any failure here must flip status to FAILED
        # rather than leaving the job stuck RUNNING forever with nothing observing it.
        if db is not None:
            db.rollback()
        with _lock:
            _state = replace(_state, status=IgdbLinkStatus.FAILED, error=str(exc), finished_at=datetime.now(UTC))
    finally:
        if db is not None:
            db.close()


def _normalize_name(name: str) -> str:
    """Lowercase alphanumeric only — "The Legend of Zelda: Breath of the Wild" and
    "the legend of zelda breath of the wild" compare equal; empty stays empty so a
    blank game name never counts as an exact match."""
    return re.sub(r"[^a-z0-9]", "", name.lower())


async def _link_all_games(db: Session) -> IgdbLinkResult:
    # A fresh, short-lived IGDBClient rather than reusing app.state.igdb_client — see
    # app/services/catalog_resync_job.py for why (its httpx.AsyncClient is bound to
    # uvicorn's own event loop; this job runs on a plain threading.Thread with no event
    # loop of its own until asyncio.run() creates one here).
    client = IGDBClient()
    try:
        candidates = game_repository.list_unlinked_games(db)

        linked = 0
        skipped = 0
        no_match = 0
        ambiguous = 0
        failed = 0
        needs_review: list[dict[str, Any]] = []
        failures: list[dict[str, Any]] = []

        for index, game in enumerate(candidates):
            if index > 0:
                await asyncio.sleep(_PACE_DELAY_SECONDS)
            try:
                outcome = await _link_one_game(db, client, game)
                if outcome == "linked":
                    linked += 1
                elif outcome == "skipped":
                    skipped += 1
                elif outcome == "no_match":
                    no_match += 1
                    needs_review.append(
                        {"game_id": game.id, "name": game.name, "reason": IgdbLinkReviewReason.NO_MATCH.value}
                    )
                else:  # "ambiguous"
                    ambiguous += 1
                    needs_review.append(
                        {"game_id": game.id, "name": game.name, "reason": IgdbLinkReviewReason.AMBIGUOUS.value}
                    )
            except ConflictError:
                # The matched IGDB id is already linked to a different game in the
                # library — leave both alone for the user to sort out manually.
                db.rollback()
                skipped += 1
                needs_review.append(
                    {
                        "game_id": game.id,
                        "name": game.name,
                        "reason": IgdbLinkReviewReason.ALREADY_IN_LIBRARY.value,
                    }
                )
            except Exception as exc:  # noqa: BLE001 - one bad game must not abort the batch,
                # same isolation as app/services/catalog_resync_job.py.
                db.rollback()
                failed += 1
                failures.append({"game_id": game.id, "name": game.name, "error": str(exc)})
            _set_progress(index + 1, len(candidates))

        return IgdbLinkResult(
            total_candidates=len(candidates),
            linked=linked,
            skipped=skipped,
            no_match=no_match,
            ambiguous=ambiguous,
            failed=failed,
            needs_review=needs_review,
            failures=failures,
        )
    finally:
        await client.aclose()


async def _link_one_game(db: Session, client: IGDBClient, game: Game) -> str:
    """Returns "linked", "skipped", "no_match", or "ambiguous". Only links on a single
    exact (normalized) name match — anything less certain goes to manual review rather
    than risking a wrong link at scale."""
    normalized = _normalize_name(game.name)
    if not normalized:
        return "no_match"
    scope = "addon" if game.parent_game_id is not None else "game"
    hits = await client.search_games(game.name, limit=_SEARCH_LIMIT, category_scope=scope)
    matches = [hit for hit in hits if _normalize_name(str(hit.get("name", ""))) == normalized]
    if len(matches) != 1:
        return "no_match" if not matches else "ambiguous"
    await game_service.link_game_to_igdb(db, client, game.id, int(matches[0]["id"]))
    return "linked"


def acknowledge() -> None:
    """Clears a COMPLETED or FAILED job back to IDLE. A no-op while RUNNING."""
    global _state
    with _lock:
        if _state.status in (IgdbLinkStatus.COMPLETED, IgdbLinkStatus.FAILED):
            _state = IgdbLinkState()


def reset_for_tests() -> None:
    global _state
    with _lock:
        _state = IgdbLinkState()
