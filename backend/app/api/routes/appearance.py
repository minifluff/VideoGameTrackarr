from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.schemas.appearance import AppearanceSettingsResponse, AppearanceSettingsUpdate
from app.services import appearance_service

router = APIRouter(
    prefix="/api/settings/appearance",
    tags=["settings"],
    dependencies=[Depends(get_current_user)],
)


@router.get("", response_model=AppearanceSettingsResponse)
def get_appearance(db: Session = Depends(get_db)) -> AppearanceSettingsResponse:
    settings = appearance_service.get_appearance(db)
    return AppearanceSettingsResponse(**settings)


@router.put("", response_model=AppearanceSettingsResponse)
def update_appearance(
    body: AppearanceSettingsUpdate, db: Session = Depends(get_db)
) -> AppearanceSettingsResponse:
    settings = appearance_service.update_appearance(
        db,
        accent_color=body.accent_color,
        app_title=body.app_title,
        app_icon=body.app_icon,
    )
    return AppearanceSettingsResponse(**settings)
