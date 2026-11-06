from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.system import User
from app.schemas.achievements import (
    RAGameUserProgressResponse,
    RetroAchievementsStatusResponse,
    RetroAchievementsSummaryResponse,
    UpdateRetroAchievementsRequest,
)
from app.services import retroachievements_service
from app.services.retroachievements_client import (
    RetroAchievementsAuthError,
    RetroAchievementsError,
)

router = APIRouter(prefix="/api/achievements", tags=["achievements"], dependencies=[Depends(get_current_user)])


@router.get("/status", response_model=RetroAchievementsStatusResponse)
def get_status(current_user: User = Depends(get_current_user)) -> RetroAchievementsStatusResponse:
    return RetroAchievementsStatusResponse.model_validate(retroachievements_service.get_status(current_user))


@router.put("/settings", response_model=RetroAchievementsStatusResponse)
def update_settings(
    payload: UpdateRetroAchievementsRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> RetroAchievementsStatusResponse:
    username = payload.username.strip() if payload.username else None
    api_key = payload.api_key.strip() if payload.api_key else payload.api_key
    updated_user = retroachievements_service.save_settings(db, current_user, username, api_key)
    return RetroAchievementsStatusResponse.model_validate(retroachievements_service.get_status(updated_user))


@router.get("/summary", response_model=RetroAchievementsSummaryResponse)
async def get_summary(
    refresh: bool = False,
    current_user: User = Depends(get_current_user),
) -> RetroAchievementsSummaryResponse:
    # Not-configured surfaces as 409 via the app-wide ConflictError handler; RA
    # itself being down or rejecting the key is a 502 — the page shows the detail.
    try:
        summary = await retroachievements_service.get_summary(current_user, refresh=refresh)
    except RetroAchievementsAuthError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
    except RetroAchievementsError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
    return RetroAchievementsSummaryResponse.model_validate(summary)


@router.get("/game/{game_id}", response_model=RAGameUserProgressResponse)
async def get_game_progress(
    game_id: int,
    refresh: bool = False,
    current_user: User = Depends(get_current_user),
) -> RAGameUserProgressResponse:
    # Same error mapping as the summary: not-configured is a 409, RA rejecting
    # the key or being unreachable is a 502.
    try:
        progress = await retroachievements_service.get_game_progress(
            current_user, game_id, refresh=refresh
        )
    except RetroAchievementsAuthError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
    except RetroAchievementsError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
    return RAGameUserProgressResponse.model_validate(progress)
