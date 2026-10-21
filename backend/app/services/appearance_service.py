from sqlalchemy.orm import Session

from app.models.app_settings import AppSetting

DEFAULT_ACCENT_COLOR = "#7C4DFF"
DEFAULT_APP_TITLE = "VideoGameTrackarr"
DEFAULT_APP_ICON = "🎮"
DEFAULT_CARD_SIZE = 1.0

ACCENT_KEY = "appearance.accent_color"
TITLE_KEY = "appearance.app_title"
ICON_KEY = "appearance.app_icon"
CARD_SIZE_KEY = "appearance.card_size"
HIDE_HARDWARE_KEY = "appearance.hide_hardware_menu"


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


def get_appearance(db: Session) -> dict[str, str | float | bool]:
    card_size_raw = _get_value(db, CARD_SIZE_KEY, str(DEFAULT_CARD_SIZE))
    try:
        card_size = float(card_size_raw)
    except ValueError:
        card_size = DEFAULT_CARD_SIZE
    card_size = max(0.5, min(2.0, card_size))
    return {
        "accent_color": _get_value(db, ACCENT_KEY, DEFAULT_ACCENT_COLOR),
        "app_title": _get_value(db, TITLE_KEY, DEFAULT_APP_TITLE),
        "app_icon": _get_value(db, ICON_KEY, DEFAULT_APP_ICON),
        "card_size": card_size,
        "hide_hardware_menu": _get_value(db, HIDE_HARDWARE_KEY, "false") == "true",
    }


def update_appearance(
    db: Session,
    accent_color: str | None = None,
    app_title: str | None = None,
    app_icon: str | None = None,
    card_size: float | None = None,
    hide_hardware_menu: bool | None = None,
) -> dict[str, str | float | bool]:
    if accent_color is not None:
        _set_value(db, ACCENT_KEY, accent_color)
    if app_title is not None:
        _set_value(db, TITLE_KEY, app_title.strip() or DEFAULT_APP_TITLE)
    if app_icon is not None:
        _set_value(db, ICON_KEY, app_icon)
    if card_size is not None:
        clamped = max(0.5, min(2.0, card_size))
        _set_value(db, CARD_SIZE_KEY, str(clamped))
    if hide_hardware_menu is not None:
        _set_value(db, HIDE_HARDWARE_KEY, "true" if hide_hardware_menu else "false")
    return get_appearance(db)
