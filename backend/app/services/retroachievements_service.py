import asyncio
import json
from dataclasses import asdict

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import decrypt_smb_password, encrypt_smb_password
from app.models.system import User
from app.services.cache import get_cache
from app.services.exceptions import ConflictError
from app.services.retroachievements_client import (
    RARecentAchievement,
    RARecentlyPlayedGame,
    RAUserProfile,
    RetroAchievementsClient,
)

# The Achievements page is a read of someone else's profile, not live game state —
# 15 minutes of staleness is invisible and keeps a page load to zero RA calls when
# the user is just clicking around. A username or key change clears it (see below).
SUMMARY_CACHE_TTL_SECONDS = 900


class RetroAchievementsNotConfiguredError(ConflictError):
    """No RetroAchievements username or API key saved yet — the page shows its
    setup state instead of calling RA."""


def get_status(user: User) -> dict[str, object]:
    return {
        "configured": bool(user.retroachievements_username and user.retroachievements_api_key),
        "username": user.retroachievements_username,
        "api_key_configured": bool(user.retroachievements_api_key),
        # Steam is the page's second source — same shape as the Integrations page's
        # steam_api_key_configured + a saved SteamID64.
        "steam_configured": bool(get_settings().steam_api_key and user.steam_id_64),
    }


def save_settings(
    db: Session, user: User, username: str | None, api_key: str | None
) -> User:
    """username: the RA profile to show (None clears it). api_key: None means
    "leave the saved key alone" (so changing just the username doesn't wipe it),
    "" clears it, anything else replaces it. The key reuses the SMB Fernet
    helpers — encrypted when a key is configured, plaintext otherwise, same as
    the SMB passwords. The cached summary is keyed by username, so a new
    username starts fresh; a key change needs no purge (same data)."""
    user.retroachievements_username = username
    if api_key is not None:
        user.retroachievements_api_key = encrypt_smb_password(api_key) if api_key else None
    db.commit()
    db.refresh(user)
    return user


def _credentials(user: User) -> tuple[str, str]:
    username = user.retroachievements_username
    api_key = decrypt_smb_password(user.retroachievements_api_key)
    if not username or not api_key:
        raise RetroAchievementsNotConfiguredError(
            "RetroAchievements isn't connected yet — add a username and API key on the Integrations page"
        )
    return username, api_key


def _cache_key(username: str) -> str:
    return f"retroachievements:summary:{username.lower()}"


async def get_summary(user: User, refresh: bool = False) -> dict[str, object]:
    """Profile + recently played games + recent achievements, as plain dicts ready
    for the response schema. The three RA calls run concurrently; the merged
    result is cached per username."""
    username, api_key = _credentials(user)
    cache = get_cache()
    key = _cache_key(username)
    if not refresh:
        cached = await cache.get(key)
        if cached is not None:
            return json.loads(cached)

    async with RetroAchievementsClient(api_key) as ra:
        profile, games, achievements = await asyncio.gather(
            ra.get_user_profile(username),
            ra.get_user_recently_played_games(username),
            ra.get_user_recent_achievements(username),
        )

    summary = {
        "profile": _profile_dict(profile),
        "recently_played": [_game_dict(game) for game in games],
        "recent_achievements": [_achievement_dict(achievement) for achievement in achievements],
    }
    await cache.set(key, json.dumps(summary), SUMMARY_CACHE_TTL_SECONDS)
    return summary


def _profile_dict(profile: RAUserProfile) -> dict[str, object]:
    return asdict(profile)


def _game_dict(game: RARecentlyPlayedGame) -> dict[str, object]:
    return asdict(game)


def _achievement_dict(achievement: RARecentAchievement) -> dict[str, object]:
    return asdict(achievement)
