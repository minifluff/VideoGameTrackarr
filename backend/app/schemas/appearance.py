from pydantic import Field

from app.schemas.base import CamelModel


class AppearanceSettingsResponse(CamelModel):
    accent_color: str
    app_title: str
    app_icon: str
    card_size: float
    hide_hardware_menu: bool


class AppearanceSettingsUpdate(CamelModel):
    accent_color: str | None = Field(default=None, pattern=r"^#[0-9a-fA-F]{6}$")
    app_title: str | None = Field(default=None, max_length=64)
    app_icon: str | None = Field(default=None, max_length=700000)
    card_size: float | None = Field(default=None, ge=0.5, le=2.0)
    hide_hardware_menu: bool | None = None
