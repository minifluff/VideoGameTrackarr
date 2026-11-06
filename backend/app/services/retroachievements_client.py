from dataclasses import dataclass

import httpx
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

RA_API_BASE = "https://retroachievements.org/API"
RA_MEDIA_BASE = "https://media.retroachievements.org"

# Same reasoning as steam_client.py's _retryable: transient network/5xx failures are
# worth retrying, a 4xx (bad key, unknown user) never gets better on retry.
_retryable = retry(
    retry=retry_if_exception_type((httpx.TransportError, httpx.HTTPStatusError)),
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=0.5, max=4),
    reraise=True,
)


class RetroAchievementsError(Exception):
    """Any failure talking to retroachievements.org that isn't auth."""


class RetroAchievementsAuthError(RetroAchievementsError):
    """The API key was rejected (or the user doesn't exist) — 401/403/404."""


def ra_media_url(path: str | None) -> str | None:
    """User pics, game art and badge images come back as site-relative paths
    ("/Images/060249.png", "/Badge/108302.png"); they live on RA's media host."""
    if not path:
        return None
    return f"{RA_MEDIA_BASE}{path}"


@dataclass
class RAUserProfile:
    username: str
    user_pic_url: str | None
    motto: str | None
    member_since: str | None
    rich_presence: str | None
    total_points: int
    total_softcore_points: int
    total_true_points: int


@dataclass
class RARecentlyPlayedGame:
    game_id: int
    console_name: str
    title: str
    image_icon_url: str | None
    image_box_art_url: str | None
    last_played: str | None
    num_possible_achievements: int
    num_achieved: int
    num_achieved_hardcore: int
    possible_score: int
    score_achieved: int


@dataclass
class RAGameAchievement:
    achievement_id: int
    title: str
    description: str | None
    badge_url: str | None
    points: int
    true_ratio: int
    display_order: int
    num_awarded: int
    date_earned: str | None
    date_earned_hardcore: str | None


@dataclass
class RAGameUserProgress:
    game_id: int
    title: str
    console_name: str
    image_icon_url: str | None
    image_box_art_url: str | None
    num_achieved: int
    num_possible_achievements: int
    score_achieved: int
    possible_score: int
    achievements: list[RAGameAchievement]


@dataclass
class RARecentAchievement:
    achievement_id: int
    title: str
    description: str | None
    badge_url: str | None
    points: int
    true_ratio: int
    hardcore: bool
    date_earned: str | None
    game_id: int
    game_title: str
    game_icon_url: str | None
    console_name: str


class RetroAchievementsClient:
    """Thin wrapper over the RAWeb API (api-docs.retroachievements.org). Every call
    needs the user's Web API key (Settings → Keys on retroachievements.org) plus the
    target username. Responses are PascalCase; this client maps them onto the
    dataclasses above so callers never touch RA's raw field names."""

    def __init__(self, api_key: str, http_client: httpx.AsyncClient | None = None) -> None:
        self._api_key = api_key
        self._http = http_client or httpx.AsyncClient(timeout=10.0)

    async def aclose(self) -> None:
        await self._http.aclose()

    async def __aenter__(self) -> "RetroAchievementsClient":
        return self

    async def __aexit__(self, *exc_info: object) -> None:
        await self.aclose()

    @_retryable
    async def _get(self, path: str, **params: object) -> object:
        # Only auth failures are converted here: 401/403/404 raise
        # RetroAchievementsAuthError, which tenacity does NOT retry. Transport errors
        # and 5xx propagate as-is so tenacity retries them, and the public methods
        # below turn whatever survives into RetroAchievementsError.
        try:
            response = await self._http.get(
                f"{RA_API_BASE}/{path}", params={"y": self._api_key, **params}
            )
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            if exc.response.status_code in (401, 403, 404):
                raise RetroAchievementsAuthError(
                    "RetroAchievements rejected the request — check the API key and username"
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
            raise RetroAchievementsError(f"Could not reach retroachievements.org: {exc}") from exc

    async def get_user_profile(self, username: str) -> RAUserProfile:
        payload = await self._call("API_GetUserProfile.php", u=username)
        assert isinstance(payload, dict)
        return RAUserProfile(
            username=str(payload.get("User") or username),
            user_pic_url=ra_media_url(self._as_str(payload.get("UserPic"))),
            motto=self._as_str(payload.get("Motto")),
            member_since=self._as_str(payload.get("MemberSince")),
            rich_presence=self._as_str(payload.get("RichPresenceMsg")),
            total_points=self._as_int(payload.get("TotalPoints")),
            total_softcore_points=self._as_int(payload.get("TotalSoftcorePoints")),
            total_true_points=self._as_int(payload.get("TotalTruePoints")),
        )

    # API_GetUserRecentlyPlayedGames.php caps c at 50.
    MAX_RECENTLY_PLAYED_GAMES = 50

    async def get_user_recently_played_games(
        self, username: str, count: int = MAX_RECENTLY_PLAYED_GAMES
    ) -> list[RARecentlyPlayedGame]:
        payload = await self._call("API_GetUserRecentlyPlayedGames.php", u=username, c=count)
        games: list[RARecentlyPlayedGame] = []
        if isinstance(payload, list):
            for entry in payload:
                if not isinstance(entry, dict):
                    continue
                games.append(
                    RARecentlyPlayedGame(
                        game_id=self._as_int(entry.get("GameID")),
                        console_name=str(entry.get("ConsoleName") or ""),
                        title=str(entry.get("Title") or ""),
                        image_icon_url=ra_media_url(self._as_str(entry.get("ImageIcon"))),
                        image_box_art_url=ra_media_url(self._as_str(entry.get("ImageBoxArt"))),
                        last_played=self._as_str(entry.get("LastPlayed")),
                        num_possible_achievements=self._as_int(entry.get("NumPossibleAchievements")),
                        num_achieved=self._as_int(entry.get("NumAchieved")),
                        num_achieved_hardcore=self._as_int(entry.get("NumAchievedHardcore")),
                        possible_score=self._as_int(entry.get("PossibleScore")),
                        score_achieved=self._as_int(entry.get("ScoreAchieved")),
                    )
                )
        return games

    async def get_user_recent_achievements(
        self, username: str, minutes: int = 10080
    ) -> list[RARecentAchievement]:
        # RA's default lookback is 60 minutes, which leaves the feed empty most of the
        # time — a week back is what "recently earned" means on a profile page.
        payload = await self._call("API_GetUserRecentAchievements.php", u=username, m=minutes)
        achievements: list[RARecentAchievement] = []
        if isinstance(payload, list):
            for entry in payload:
                if not isinstance(entry, dict):
                    continue
                achievements.append(
                    RARecentAchievement(
                        achievement_id=self._as_int(entry.get("AchievementID")),
                        title=str(entry.get("Title") or ""),
                        description=self._as_str(entry.get("Description")),
                        badge_url=ra_media_url(self._as_str(entry.get("BadgeURL"))),
                        points=self._as_int(entry.get("Points")),
                        true_ratio=self._as_int(entry.get("TrueRatio")),
                        hardcore=bool(entry.get("HardcoreMode")),
                        date_earned=self._as_str(entry.get("Date")),
                        game_id=self._as_int(entry.get("GameID")),
                        game_title=str(entry.get("GameTitle") or ""),
                        game_icon_url=ra_media_url(self._as_str(entry.get("GameIcon"))),
                        console_name=str(entry.get("ConsoleName") or ""),
                    )
                )
        return achievements

    async def get_game_info_and_user_progress(self, username: str, game_id: int) -> RAGameUserProgress:
        # One call returns the game plus ALL its achievements with the user's
        # unlock state. The Achievements object is keyed by achievement id, and
        # DateEarned / DateEarnedHardcore are only present when earned — their
        # absence is what "locked" means.
        payload = await self._call("API_GetGameInfoAndUserProgress.php", u=username, g=game_id)
        assert isinstance(payload, dict)
        raw_achievements = payload.get("Achievements")
        achievements: list[RAGameAchievement] = []
        if isinstance(raw_achievements, dict):
            for entry in raw_achievements.values():
                if not isinstance(entry, dict):
                    continue
                badge_name = self._as_str(entry.get("BadgeName"))
                achievements.append(
                    RAGameAchievement(
                        achievement_id=self._as_int(entry.get("ID")),
                        title=str(entry.get("Title") or ""),
                        description=self._as_str(entry.get("Description")),
                        badge_url=ra_media_url(f"/Badge/{badge_name}.png") if badge_name else None,
                        points=self._as_int(entry.get("Points")),
                        true_ratio=self._as_int(entry.get("TrueRatio")),
                        display_order=self._as_int(entry.get("DisplayOrder")),
                        num_awarded=self._as_int(entry.get("NumAwarded")),
                        date_earned=self._as_str(entry.get("DateEarned")) or None,
                        date_earned_hardcore=self._as_str(entry.get("DateEarnedHardcore")) or None,
                    )
                )
        num_possible = self._as_int(payload.get("NumAchievements")) or len(achievements)
        num_achieved = self._as_int(payload.get("NumAwardedToUser")) or sum(
            1 for a in achievements if a.date_earned
        )
        return RAGameUserProgress(
            game_id=self._as_int(payload.get("ID")) or game_id,
            title=str(payload.get("Title") or ""),
            console_name=str(payload.get("ConsoleName") or ""),
            image_icon_url=ra_media_url(self._as_str(payload.get("ImageIcon"))),
            image_box_art_url=ra_media_url(self._as_str(payload.get("ImageBoxArt"))),
            num_achieved=num_achieved,
            num_possible_achievements=num_possible,
            score_achieved=sum(a.points for a in achievements if a.date_earned),
            possible_score=sum(a.points for a in achievements),
            achievements=achievements,
        )
