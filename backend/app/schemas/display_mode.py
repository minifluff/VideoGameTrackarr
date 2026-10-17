from pydantic import Field

from app.schemas.base import CamelModel


class DisplayModeSlide(CamelModel):
    """One cover-art slide for Display Mode: an owned, non-hidden game with cover art."""

    id: int
    name: str
    cover_url: str


class DisplayModeSettingsResponse(CamelModel):
    slide_interval_seconds: int
    show_title: bool
    show_hidden: bool
    show_wishlisted: bool


class DisplayModeSettingsUpdate(CamelModel):
    slide_interval_seconds: int | None = Field(default=None, ge=3, le=120)
    show_title: bool | None = None
    show_hidden: bool | None = None
    show_wishlisted: bool | None = None
