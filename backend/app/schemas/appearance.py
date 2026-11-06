from pydantic import Field

from app.schemas.base import CamelModel


class AppearanceSettingsResponse(CamelModel):
    accent_color: str
    app_title: str
    app_icon: str
    card_size: float
    hide_hardware_menu: bool
    hide_dashboard_menu: bool
    hide_games_menu: bool
    hide_events_menu: bool
    hide_achievements_menu: bool
    hide_insights_menu: bool
    start_page: str


class AppearanceSettingsUpdate(CamelModel):
    accent_color: str | None = Field(default=None, pattern=r"^#[0-9a-fA-F]{6}$")
    app_title: str | None = Field(default=None, max_length=64)
    app_icon: str | None = Field(default=None, max_length=700000)
    card_size: float | None = Field(default=None, ge=0.5, le=2.0)
    hide_hardware_menu: bool | None = None
    hide_dashboard_menu: bool | None = None
    hide_games_menu: bool | None = None
    hide_events_menu: bool | None = None
    hide_achievements_menu: bool | None = None
    hide_insights_menu: bool | None = None
    start_page: str | None = Field(default=None, max_length=64)
