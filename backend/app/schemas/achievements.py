from app.schemas.base import CamelModel


class RetroAchievementsStatusResponse(CamelModel):
    configured: bool
    username: str | None
    api_key_configured: bool


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
