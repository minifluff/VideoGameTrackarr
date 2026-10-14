from sqlalchemy.orm import Session

from app.models.app_settings import AppSetting

DEFAULT_ACCENT_COLOR = "#7C4DFF"
DEFAULT_APP_TITLE = "VideoGameTrackarr"
DEFAULT_APP_ICON = "🎮"

ACCENT_KEY = "appearance.accent_color"
TITLE_KEY = "appearance.app_title"
ICON_KEY = "appearance.app_icon"


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


def get_appearance(db: Session) -> dict[str, str]:
    return {
        "accent_color": _get_value(db, ACCENT_KEY, DEFAULT_ACCENT_COLOR),
        "app_title": _get_value(db, TITLE_KEY, DEFAULT_APP_TITLE),
        "app_icon": _get_value(db, ICON_KEY, DEFAULT_APP_ICON),
    }


def update_appearance(
    db: Session,
    accent_color: str | None = None,
    app_title: str | None = None,
    app_icon: str | None = None,
) -> dict[str, str]:
    if accent_color is not None:
        _set_value(db, ACCENT_KEY, accent_color)
    if app_title is not None:
        _set_value(db, TITLE_KEY, app_title.strip() or DEFAULT_APP_TITLE)
    if app_icon is not None:
        _set_value(db, ICON_KEY, app_icon)
    return get_appearance(db)
