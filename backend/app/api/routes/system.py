from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.system import User
from app.services import database_reset_service

router = APIRouter(tags=["system"], dependencies=[Depends(get_current_user)])


class ResetDatabaseRequest(BaseModel):
    confirmation: str


class ResetDatabaseResponse(BaseModel):
    games_deleted: int
    library_items_deleted: int


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
