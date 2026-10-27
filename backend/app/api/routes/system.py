from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import delete
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.library import GameProgress, PlaySession
from app.models.system import User
from app.schemas.base import CamelModel
from app.services import database_reset_service, game_service

router = APIRouter(tags=["system"], dependencies=[Depends(get_current_user)])


class ResetDatabaseRequest(BaseModel):
    confirmation: str


class ResetDatabaseResponse(BaseModel):
    games_deleted: int
    library_items_deleted: int


class ClearPlaytimeResponse(BaseModel):
    progress_deleted: int
    sessions_deleted: int


class ClearMissingGamesResponse(CamelModel):
    games_deleted: int


@router.post("/api/system/clear-playtime", response_model=ClearPlaytimeResponse)
def clear_playtime(
    payload: ResetDatabaseRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ClearPlaytimeResponse:
    """Delete all playtime progress (GameProgress + PlaySession) without touching
    the library itself. The confirmation field must be exactly "confirm"."""
    if payload.confirmation != "confirm":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='Type "confirm" to clear playtime.',
        )
    sessions_deleted = db.execute(delete(PlaySession)).rowcount
    progress_deleted = db.execute(delete(GameProgress)).rowcount
    db.commit()
    return ClearPlaytimeResponse(
        progress_deleted=progress_deleted,
        sessions_deleted=sessions_deleted,
    )


@router.post("/api/system/clear-missing-games", response_model=ClearMissingGamesResponse)
def clear_missing_games(
    payload: ResetDatabaseRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ClearMissingGamesResponse:
    """Delete every unclaimed missing game (see game_service.clear_missing_games).
    The confirmation field must be exactly "confirm"."""
    if payload.confirmation != "confirm":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='Type "confirm" to clear missing games.',
        )
    deleted = game_service.clear_missing_games(db)
    return ClearMissingGamesResponse(games_deleted=deleted)


@router.post("/api/system/reset-database", response_model=ResetDatabaseResponse)
def reset_database(
    payload: ResetDatabaseRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ResetDatabaseResponse:
    """Delete every game (library + catalog + attached data) and clear the sync-tool
    caches so Playnite/Steam/CSV can reimport from scratch. The confirmation field must
    be exactly "confirm" — this is the last line of defense against accidents."""
    if payload.confirmation != "confirm":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='Type "confirm" to reset the database.',
        )
    result = database_reset_service.reset_database(db)
    return ResetDatabaseResponse(**result)
