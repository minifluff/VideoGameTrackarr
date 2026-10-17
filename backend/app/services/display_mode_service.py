from sqlalchemy.orm import Session

from app.models.app_settings import AppSetting

DEFAULT_SLIDE_INTERVAL_SECONDS = 10
DEFAULT_SHOW_TITLE = False
DEFAULT_SHOW_HIDDEN = False
DEFAULT_SHOW_WISHLISTED = False

INTERVAL_KEY = "display_mode.slide_interval_seconds"
SHOW_TITLE_KEY = "display_mode.show_title"
SHOW_HIDDEN_KEY = "display_mode.show_hidden"
SHOW_WISHLISTED_KEY = "display_mode.show_wishlisted"


def _get_value(db: Session, key: str, default: str) -> str:
    setting = db.get(AppSetting, key)
    return setting.value if setting else default


def _set_value(db: Session, key: str, value: str) -> None:
    setting = db.get(AppSetting, key)
    if setting:
        setting.value = value
    else:
        db.add(AppSetting(key=key, value=value))
    db.commit()


def get_settings(db: Session) -> dict[str, int | bool]:
    try:
        interval = int(_get_value(db, INTERVAL_KEY, str(DEFAULT_SLIDE_INTERVAL_SECONDS)))
    except ValueError:
        interval = DEFAULT_SLIDE_INTERVAL_SECONDS
    interval = max(3, min(120, interval))
    return {
        "slide_interval_seconds": interval,
        "show_title": _get_value(db, SHOW_TITLE_KEY, "false").lower() == "true",
        "show_hidden": _get_value(db, SHOW_HIDDEN_KEY, "false").lower() == "true",
        "show_wishlisted": _get_value(db, SHOW_WISHLISTED_KEY, "false").lower() == "true",
    }


def update_settings(
    db: Session,
    slide_interval_seconds: int | None = None,
    show_title: bool | None = None,
    show_hidden: bool | None = None,
    show_wishlisted: bool | None = None,
) -> dict[str, int | bool]:
    if slide_interval_seconds is not None:
        _set_value(db, INTERVAL_KEY, str(max(3, min(120, slide_interval_seconds))))
    if show_title is not None:
        _set_value(db, SHOW_TITLE_KEY, "true" if show_title else "false")
    if show_hidden is not None:
        _set_value(db, SHOW_HIDDEN_KEY, "true" if show_hidden else "false")
    if show_wishlisted is not None:
        _set_value(db, SHOW_WISHLISTED_KEY, "true" if show_wishlisted else "false")
    return get_settings(db)
