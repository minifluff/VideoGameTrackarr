from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.repositories import game_repository
from app.schemas.display_mode import (
    DisplayModeSettingsResponse,
    DisplayModeSettingsUpdate,
    DisplayModeSlide,
)
from app.services import display_mode_service

router = APIRouter(
    prefix="/api/display-mode",
    tags=["display-mode"],
    dependencies=[Depends(get_current_user)],
)

settings_router = APIRouter(
    prefix="/api/settings/display-mode",
    tags=["settings"],
    dependencies=[Depends(get_current_user)],
)


@router.get("/slides", response_model=list[DisplayModeSlide])
def get_slides(
    limit: int = Query(default=200, ge=1, le=500),
    db: Session = Depends(get_db),
) -> list[DisplayModeSlide]:
    """Random sample of cover-art slides for Display Mode: owned, non-hidden games
    with cover art, freshly shuffled on every fetch."""
    slides = game_repository.list_display_mode_slides(db, limit=limit)
    return [DisplayModeSlide(id=slide[0], name=slide[1], cover_url=slide[2]) for slide in slides]


@settings_router.get("", response_model=DisplayModeSettingsResponse)
def get_display_mode_settings(db: Session = Depends(get_db)) -> DisplayModeSettingsResponse:
    settings = display_mode_service.get_settings(db)
    return DisplayModeSettingsResponse(**settings)


@settings_router.put("", response_model=DisplayModeSettingsResponse)
def update_display_mode_settings(
    body: DisplayModeSettingsUpdate, db: Session = Depends(get_db)
) -> DisplayModeSettingsResponse:
    settings = display_mode_service.update_settings(
        db,
        slide_interval_seconds=body.slide_interval_seconds,
        show_title=body.show_title,
    )
    return DisplayModeSettingsResponse(**settings)
