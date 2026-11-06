from app.schemas.base import CamelModel


class RetroAchievementsStatusResponse(CamelModel):
    configured: bool
    username: str | None
    api_key_configured: bool
    # Steam is a second source on the same page — the status carries whether it's
    # connected too, so the page knows which summaries to fetch.
    steam_configured: bool = False


class UpdateRetroAchievementsRequest(CamelModel):
    username: str | None
    # None leaves the saved key alone (so changing just the username doesn't wipe
    # it); "" clears it; anything else replaces it.
    api_key: str | None = None


class RAProfileResponse(CamelModel):
    username: str
    user_pic_url: str | None
    motto: str | None
    member_since: str | None
    rich_presence: str | None
    total_points: int
    total_softcore_points: int
    total_true_points: int


class RARecentlyPlayedGameResponse(CamelModel):
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


class RARecentAchievementResponse(CamelModel):
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


class RetroAchievementsSummaryResponse(CamelModel):
    profile: RAProfileResponse
    recently_played: list[RARecentlyPlayedGameResponse]
    recent_achievements: list[RARecentAchievementResponse]


class SteamRecentlyPlayedGameResponse(CamelModel):
    appid: int
    name: str
    icon_url: str | None
    last_played: str | None
    playtime_forever_minutes: int
    playtime_2weeks_minutes: int
    unlocked_count: int
    total_count: int


class SteamRecentAchievementResponse(CamelModel):
    apiname: str
    display_name: str
    description: str | None
    icon_url: str | None
    unlocked_at: str | None
    game_name: str
    appid: int


class SteamAchievementsSummaryResponse(CamelModel):
    configured: bool
    games: list[SteamRecentlyPlayedGameResponse]
    recent_achievements: list[SteamRecentAchievementResponse]
