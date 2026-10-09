import asyncio
import re
import threading
from collections.abc import Callable
from dataclasses import dataclass, replace
from datetime import UTC, datetime
from enum import StrEnum

from sqlalchemy.orm import Session

from app.models.catalog import Game
from app.repositories import game_repository
from app.services import game_service
from app.services.exceptions import ConflictError
from app.services.igdb_client import IGDBClient

# search_games makes 1 IGDB HTTP call per game (plus link_game_to_igdb's own resync calls
# on a match) and nothing in IGDBClient self-throttles across many sequential calls —
# same pacing constant and reasoning as app/services/catalog_resync_job.py's own copy.
_PACE_DELAY_SECONDS = 0.5
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
class IgdbLinkReviewItem:
    game_id: int
    name: str
    reason: IgdbLinkReviewReason


@dataclass(frozen=True)
class IgdbLinkFailure:
    game_id: int
    name: str
    error: str


@dataclass(frozen=True)
class IgdbLinkResult:
    total_candidates: int
    linked: int
    skipped: int
    no_match: int
    ambiguous: int
    failed: int
    needs_review: list[IgdbLinkReviewItem]
    failures: list[IgdbLinkFailure]


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
# progress, but this does NOT survive the server process restarting). A fixed-id
# job_registry.py entry doesn't fit here since this is a one-shot manual action, and this
# shouldn't appear in the Settings > Jobs list alongside the scheduled/bulk jobs.
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
        result = asyncio.run(_link_all_unlinked(db))
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
    """Lowercases and strips everything but alphanumerics so "DOOM 3: BFG Edition"
    matches "doom 3 bfg edition" — punctuation and capitalization are noise for the
    exact-match check, not signal."""
    return re.sub(r"[^a-z0-9]", "", name.lower())


async def _link_all_unlinked(db: Session) -> IgdbLinkResult:
    # A fresh, short-lived IGDBClient rather than reusing app.state.igdb_client — see
    # app/services/catalog_resync_job.py for why (its httpx.AsyncClient is bound to
    # uvicorn's own event loop; this job runs on a plain threading.Thread with no event
    # loop of its own until asyncio.run() creates one here).
    client = IGDBClient()
    try:
        candidates = game_repository.list_unlinked_games(db)
        total = len(candidates)

        linked = 0
        needs_review: list[IgdbLinkReviewItem] = []
        failures: list[IgdbLinkFailure] = []

        for index, game in enumerate(candidates):
            if index > 0:
                await asyncio.sleep(_PACE_DELAY_SECONDS)
            try:
                outcome = await _try_link_one(db, client, game)
                if outcome == "linked":
                    linked += 1
                elif outcome is not None:
                    needs_review.append(IgdbLinkReviewItem(game_id=game.id, name=game.name, reason=outcome))
            except Exception as exc:  # noqa: BLE001 - one bad game must not abort the
                # batch, same isolation as app/services/catalog_resync_job.py.
                db.rollback()
                failures.append(IgdbLinkFailure(game_id=game.id, name=game.name, error=str(exc)))
            _set_progress(index + 1, total)

        no_match = sum(1 for item in needs_review if item.reason == IgdbLinkReviewReason.NO_MATCH)
        ambiguous = sum(
            1
            for item in needs_review
            if item.reason in (IgdbLinkReviewReason.AMBIGUOUS, IgdbLinkReviewReason.ALREADY_IN_LIBRARY)
        )
        return IgdbLinkResult(
            total_candidates=total,
            linked=linked,
            skipped=0,
            no_match=no_match,
            ambiguous=ambiguous,
            failed=len(failures),
            needs_review=needs_review,
            failures=failures,
        )
    finally:
        await client.aclose()


async def _try_link_one(db: Session, client: IGDBClient, game: Game) -> str | IgdbLinkReviewReason | None:
    """Tries to link one unlinked game. Returns "linked" on success, a review reason when
    the match isn't certain enough to auto-link, or None if the game was skipped."""
    # Child/add-on rows live in IGDB's addon game types; top-level games in the main
    # browsable types — searching the wrong scope would surface (or miss) the wrong
    # candidates, same distinction as the manual Link-to-IGDB dialog.
    scope = "addon" if game.parent_game_id is not None else "game"
    results = await client.search_games(game.name, limit=_SEARCH_LIMIT, category_scope=scope)

    normalized = _normalize_name(game.name)
    exact_matches = [r for r in results if _normalize_name(r.get("name", "")) == normalized]

    if not exact_matches:
        return IgdbLinkReviewReason.NO_MATCH
    if len(exact_matches) > 1:
        # Two IGDB entries with the same normalized name (e.g. a remaster and the
        # original) — picking one automatically would be a guess.
        return IgdbLinkReviewReason.AMBIGUOUS

    igdb_id = exact_matches[0]["id"]
    if game_repository.get_game_by_igdb_id(db, igdb_id) is not None:
        # Already in the library under a different row — linking would create a
        # duplicate; the user should merge or pick manually.
        return IgdbLinkReviewReason.ALREADY_IN_LIBRARY

    await game_service.link_game_to_igdb(db, client, game.id, igdb_id)
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


# Re-exported for the test suite's convenience.
__all__ = [
    "IgdbLinkReviewReason",
    "IgdbLinkStatus",
    "acknowledge",
    "get_state",
    "reset_for_tests",
    "start_link_all",
]
