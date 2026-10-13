from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.system import User

router = APIRouter(tags=["appearance"], dependencies=[Depends(get_current_user)])


class AppearanceResponse(BaseModel):
    accent_color: str | None = Field(default=None)
    app_title: str | None = Field(default=None)


class AppearanceUpdateRequest(BaseModel):
    accent_color: str | None = Field(default=None, pattern=r"^#[0-9a-fA-F]{6}$")
    app_title: str | None = Field(default=None, max_length=255)


@router.get("/api/appearance", response_model=AppearanceResponse)
def get_appearance(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AppearanceResponse:
    """Get the current user's appearance settings."""
    db.refresh(current_user)
    return AppearanceResponse(
        accent_color=current_user.accent_color,
        app_title=current_user.app_title,
    )


@router.put("/api/appearance", response_model=AppearanceResponse)
def update_appearance(
    payload: AppearanceUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AppearanceResponse:
    """Update the current user's appearance settings."""
    current_user.accent_color = payload.accent_color
    current_user.app_title = payload.app_title.strip() if payload.app_title else None
    db.commit()
    db.refresh(current_user)
    return AppearanceResponse(
        accent_color=current_user.accent_color,
        app_title=current_user.app_title,
    )
