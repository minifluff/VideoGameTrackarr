from collections.abc import Callable

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_session_factory
from app.schemas.igdb_link import (
    IgdbLinkFailureResponse,
    IgdbLinkProgressResponse,
    IgdbLinkResultResponse,
    IgdbLinkReviewItemResponse,
    IgdbLinkStatusResponse,
)
from app.services import igdb_link_job

router = APIRouter(tags=["igdb-link"], dependencies=[Depends(get_current_user)])


def _to_response(state: igdb_link_job.IgdbLinkState) -> IgdbLinkStatusResponse:
    return IgdbLinkStatusResponse(
        status=state.status.value,
        started_at=state.started_at.isoformat() if state.started_at else None,
        finished_at=state.finished_at.isoformat() if state.finished_at else None,
        progress=IgdbLinkProgressResponse(current=state.progress.current, total=state.progress.total)
        if state.progress
        else None,
        result=IgdbLinkResultResponse(
            total_candidates=state.result.total_candidates,
            linked=state.result.linked,
            skipped=state.result.skipped,
            no_match=state.result.no_match,
            ambiguous=state.result.ambiguous,
            failed=state.result.failed,
            needs_review=[
                IgdbLinkReviewItemResponse(game_id=item.game_id, name=item.name, reason=item.reason.value)
                for item in state.result.needs_review
            ],
            failures=[
                IgdbLinkFailureResponse(game_id=failure.game_id, name=failure.name, error=failure.error)
                for failure in state.result.failures
            ],
        )
        if state.result
        else None,
        error=state.error,
    )


@router.post("/api/igdb-link/start", response_model=IgdbLinkStatusResponse, status_code=status.HTTP_202_ACCEPTED)
def start_igdb_link(
    session_factory: Callable[[], Session] = Depends(get_session_factory),
) -> IgdbLinkStatusResponse:
    """Kicks off the mass "Link all games to IGDB" job as a background task — see
    app/services/igdb_link_job.py. Only games with exactly one exact normalized-name
    IGDB match are linked automatically; the rest are reported for manual review.
    Callers poll GET /api/igdb-link/status for progress; a second start while one is
    already running raises ConflictError, surfaced as 409 by the app-wide handler."""
    state = igdb_link_job.start_link_all(session_factory)
    return _to_response(state)


@router.get("/api/igdb-link/status", response_model=IgdbLinkStatusResponse)
def igdb_link_status() -> IgdbLinkStatusResponse:
    return _to_response(igdb_link_job.get_state())


@router.post("/api/igdb-link/status/acknowledge", status_code=status.HTTP_204_NO_CONTENT)
def acknowledge_igdb_link_status() -> None:
    igdb_link_job.acknowledge()
