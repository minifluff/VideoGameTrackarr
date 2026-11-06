import asyncio
import json

from app.core.config import get_settings
from app.models.system import User
from app.services.cache import get_cache
from app.services.exceptions import ConflictError
from app.services.retroachievements_service import SUMMARY_CACHE_TTL_SECONDS
from app.services.steam_achievements_client import (
    SteamAchievementsClient,
    SteamAchievementsError,
    SteamSchemaAchievement,
    steam_achievement_icon_url,
    steam_game_icon_url,
)

# Steam has no cross-game "recent achievements" endpoint and no achievement points,
# so the summary is built from recently played games (max 10): per-game player
# achievements plus the game schema for display names/icons, merged into one
# recent-unlocks feed sorted by unlock time. Same 15-minute cache as RA.
RECENT_GAMES_COUNT = 10


class SteamAchievementsNotConfiguredError(ConflictError):
    """No STEAM_API_KEY or SteamID64 yet — the page shows its setup hint instead of
    calling Steam. The key is env-only (like Steam sync); the ID lives on the
    Integrations page."""


def _credentials(user: User) -> tuple[str, str]:
    api_key = get_settings().steam_api_key
    steam_id_64 = user.steam_id_64
    if not api_key or not steam_id_64:
        raise SteamAchievementsNotConfiguredError(
            "Steam isn't connected yet — set STEAM_API_KEY and add a SteamID64 on the Integrations page"
        )
    return api_key, steam_id_64


def _cache_key(steam_id_64: str) -> str:
    return f"steam:achievements:summary:{steam_id_64}"


async def _game_summary(
    client: SteamAchievementsClient, steam_id_64: str, app_id: int, name: str,
    icon_url: str | None, last_played: str | None,
    playtime_forever_minutes: int, playtime_2weeks_minutes: int,
) -> tuple[dict[str, object], list[dict[str, object]]]:
    """One recently played game: its unlocked/total counts plus its unlocked
    achievements (enriched with the schema's display name, description and icon).
    A game whose stats can't be read is best-effort — it still shows in the
    recently played list with 0/0 and contributes no unlocks, never failing the
    whole summary."""
    try:
        player_achievements = await client.get_player_achievements(steam_id_64, app_id)
    except SteamAchievementsError:
        player_achievements = None
    if player_achievements is None:
        return (
            {
                "appid": app_id,
                "name": name,
                "icon_url": icon_url,
                "last_played": last_played,
                "playtime_forever_minutes": playtime_forever_minutes,
                "playtime_2weeks_minutes": playtime_2weeks_minutes,
                "unlocked_count": 0,
                "total_count": 0,
            },
            [],
        )

    unlocked = [a for a in player_achievements if a.achieved]
    schema: dict[str, SteamSchemaAchievement] = {}
    if unlocked:
        try:
            schema = await client.get_game_schema(app_id)
        except SteamAchievementsError:
            schema = {}

    recent: list[dict[str, object]] = []
    for achievement in unlocked:
        meta = schema.get(achievement.apiname)
        display_name = meta.display_name if meta is not None else achievement.apiname
        description = meta.description if meta is not None else None
        icon = meta.icon if meta is not None else None
        recent.append(
            {
                "apiname": achievement.apiname,
                "display_name": display_name,
                "description": description,
                "icon_url": steam_achievement_icon_url(app_id, icon),
                "unlocked_at": achievement.unlocktime,
                "game_name": name,
                "appid": app_id,
            }
        )

    return (
        {
            "appid": app_id,
            "name": name,
            "icon_url": icon_url,
            "last_played": last_played,
            "playtime_forever_minutes": playtime_forever_minutes,
            "playtime_2weeks_minutes": playtime_2weeks_minutes,
            "unlocked_count": len(unlocked),
            "total_count": len(player_achievements),
        },
        recent,
    )


async def get_summary(user: User, refresh: bool = False) -> dict[str, object]:
    """Recently played Steam games + merged recent unlocks, as plain dicts ready
    for the response schema. The per-game calls run concurrently."""
    api_key, steam_id_64 = _credentials(user)
    cache = get_cache()
    key = _cache_key(steam_id_64)
    if not refresh:
        cached = await cache.get(key)
        if cached is not None:
            return json.loads(cached)

    async with SteamAchievementsClient(api_key) as steam:
        games = await steam.get_recently_played_games(steam_id_64, count=RECENT_GAMES_COUNT)
        per_game = await asyncio.gather(
            *[
                _game_summary(
                    steam,
                    steam_id_64,
                    game.app_id,
                    game.name,
                    steam_game_icon_url(game.app_id, game.img_icon_url),
                    game.last_played,
                    game.playtime_forever_minutes,
                    game.playtime_2weeks_minutes,
                )
                for game in games
            ]
        )

    game_dicts = [game for game, _ in per_game]
    recent = [achievement for _, achievements in per_game for achievement in achievements]
    # ISO-8601 UTC strings sort chronologically; unlocks without a timestamp
    # sort as "" and land last under reverse.
    recent.sort(key=lambda a: str(a["unlocked_at"] or ""), reverse=True)

    summary = {"configured": True, "games": game_dicts, "recent_achievements": recent}
    await cache.set(key, json.dumps(summary), SUMMARY_CACHE_TTL_SECONDS)
    return summary
