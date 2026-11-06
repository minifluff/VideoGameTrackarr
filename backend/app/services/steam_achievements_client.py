from dataclasses import dataclass
from datetime import UTC, datetime

import httpx
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

from app.services.steam_client import STEAM_API_BASE

STEAM_IMAGE_BASE = "https://media.steampowered.com/steamcommunity/public/images/apps"
STEAM_ACHIEVEMENT_IMAGE_BASE = "https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps"

# Same reasoning as retroachievements_client.py: transient network/5xx failures are
# worth retrying, a 4xx never gets better on retry — and for the per-game calls a
# 400/404 just means "this game has no stats", which the service turns into a skip.
_retryable = retry(
    retry=retry_if_exception_type((httpx.TransportError, httpx.HTTPStatusError)),
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=0.5, max=4),
    reraise=True,
)


class SteamAchievementsError(Exception):
    """Any failure talking to Steam's achievement endpoints that isn't auth."""


class SteamAchievementsAuthError(SteamAchievementsError):
    """The Steam API key was rejected — 401/403."""


class SteamGameStatsUnavailableError(SteamAchievementsError):
    """This game has no stats/achievements on Steam's side (400/404 on the per-game
    endpoints) — the service skips the game instead of failing the summary."""


def steam_game_icon_url(app_id: int, img_icon_url: str | None) -> str | None:
    if not img_icon_url:
        return None
    return f"{STEAM_IMAGE_BASE}/{app_id}/{img_icon_url}.jpg"


def steam_achievement_icon_url(app_id: int, icon: str | None) -> str | None:
    if not icon:
        return None
    return f"{STEAM_ACHIEVEMENT_IMAGE_BASE}/{app_id}/{icon}.jpg"


def _iso_from_unix(value: object) -> str | None:
    if not isinstance(value, int) or value <= 0:
        return None
    return datetime.fromtimestamp(value, tz=UTC).isoformat().replace("+00:00", "Z")


@dataclass
class SteamRecentlyPlayedGame:
    app_id: int
    name: str
    playtime_2weeks_minutes: int
    playtime_forever_minutes: int
    img_icon_url: str | None
    last_played: str | None


@dataclass
class SteamPlayerAchievement:
    apiname: str
    achieved: bool
    unlocktime: str | None


@dataclass
class SteamSchemaAchievement:
    apiname: str
    display_name: str
    description: str | None
    icon: str | None


class SteamAchievementsClient:
    """Thin wrapper over the Steam Web API achievement endpoints. Unlike SteamClient
    (which retries every HTTPStatusError), this one converts 401/403 to an auth error
    and 400/404 to "no stats for this game" before tenacity ever sees them, so a
    stat-less game is a cheap skip, not three retries. Responses are the raw Steam
    shapes; this client maps them onto the dataclasses above."""

    def __init__(self, api_key: str, http_client: httpx.AsyncClient | None = None) -> None:
        self._api_key = api_key
        self._http = http_client or httpx.AsyncClient(timeout=10.0)

    async def aclose(self) -> None:
        await self._http.aclose()

    async def __aenter__(self) -> "SteamAchievementsClient":
        return self

    async def __aexit__(self, *exc_info: object) -> None:
        await self.aclose()

    @_retryable
    async def _get(self, path: str, **params: object) -> object:
        try:
            response = await self._http.get(
                f"{STEAM_API_BASE}/{path}",
                params={"key": self._api_key, "format": "json", **params},
            )
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            if exc.response.status_code in (401, 403):
                raise SteamAchievementsAuthError(
                    "Steam rejected the API key — check STEAM_API_KEY"
                ) from exc
            if exc.response.status_code in (400, 404):
                raise SteamGameStatsUnavailableError(
                    "Steam has no stats for this game"
                ) from exc
            raise
        return response.json()

    @staticmethod
    def _as_int(value: object) -> int:
        return int(value) if value is not None else 0

    @staticmethod
    def _as_str(value: object) -> str | None:
        return value if isinstance(value, str) else None

    async def _call(self, path: str, **params: object) -> object:
        # Runs after tenacity has exhausted its retries in _get, so whatever is
        # left is a genuine failure, not a transient one.
        try:
            return await self._get(path, **params)
        except (httpx.TransportError, httpx.HTTPStatusError) as exc:
            raise SteamAchievementsError(f"Could not reach Steam: {exc}") from exc

    async def get_recently_played_games(
        self, steam_id_64: str, count: int = 10
    ) -> list[SteamRecentlyPlayedGame]:
        # A private profile omits "games" entirely — that's an empty list here,
        # not an error (mirrors SteamClient.get_owned_games returning None).
        try:
            payload = await self._call(
                "IPlayerService/GetRecentlyPlayedGames/v1/", steamid=steam_id_64, count=count
            )
        except SteamGameStatsUnavailableError as exc:
            raise SteamAchievementsError(f"Could not load recently played Steam games: {exc}") from exc
        games: list[SteamRecentlyPlayedGame] = []
        if isinstance(payload, dict):
            entries = payload.get("response", {}).get("games", [])
            if isinstance(entries, list):
                for entry in entries:
                    if not isinstance(entry, dict):
                        continue
                    games.append(
                        SteamRecentlyPlayedGame(
                            app_id=self._as_int(entry.get("appid")),
                            name=str(entry.get("name") or ""),
                            playtime_2weeks_minutes=self._as_int(entry.get("playtime_2weeks")),
                            playtime_forever_minutes=self._as_int(entry.get("playtime_forever")),
                            img_icon_url=self._as_str(entry.get("img_icon_url")),
                            last_played=_iso_from_unix(entry.get("rtime_last_played")),
                        )
                    )
        return games

    async def get_player_achievements(
        self, steam_id_64: str, app_id: int
    ) -> list[SteamPlayerAchievement] | None:
        """None means this game has no stats — Steam answers 400, or
        playerstats.success is false — and the caller skips the game."""
        try:
            payload = await self._call(
                "ISteamUserStats/GetPlayerAchievements/v0001/", steamid=steam_id_64, appid=app_id
            )
        except SteamGameStatsUnavailableError:
            return None
        if not isinstance(payload, dict):
            return None
        playerstats = payload.get("playerstats", {})
        if not isinstance(playerstats, dict) or playerstats.get("success") is not True:
            return None
        achievements: list[SteamPlayerAchievement] = []
        entries = playerstats.get("achievements", [])
        if isinstance(entries, list):
            for entry in entries:
                if not isinstance(entry, dict):
                    continue
                achievements.append(
                    SteamPlayerAchievement(
                        apiname=str(entry.get("apiname") or ""),
                        achieved=bool(entry.get("achieved")),
                        unlocktime=_iso_from_unix(entry.get("unlocktime")),
                    )
                )
        return achievements

    async def get_game_schema(self, app_id: int) -> dict[str, SteamSchemaAchievement]:
        """Keyed by apiname. An empty dict means the game exposes no achievement
        metadata — the caller falls back to the raw apiname for display."""
        try:
            payload = await self._call("ISteamUserStats/GetSchemaForGame/v2/", appid=app_id)
        except SteamGameStatsUnavailableError:
            return {}
        schema: dict[str, SteamSchemaAchievement] = {}
        if not isinstance(payload, dict):
            return schema
        stats = payload.get("game", {}).get("availableGameStats", {}).get("achievements", [])
        if isinstance(stats, list):
            for entry in stats:
                if not isinstance(entry, dict):
                    continue
                apiname = str(entry.get("name") or "")
                if not apiname:
                    continue
                schema[apiname] = SteamSchemaAchievement(
                    apiname=apiname,
                    display_name=str(entry.get("displayName") or apiname),
                    description=self._as_str(entry.get("description")),
                    icon=self._as_str(entry.get("icon")),
                )
        return schema
