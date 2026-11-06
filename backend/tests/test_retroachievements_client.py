import httpx
import pytest
import respx

from app.services.retroachievements_client import (
    RA_API_BASE,
    RetroAchievementsAuthError,
    RetroAchievementsClient,
    RetroAchievementsError,
    ra_media_url,
)

PROFILE_RESPONSE = {
    "User": "Flyingfox",
    "ULID": "00003EMFWR7XB8SDPEHB3K56ZQ",
    "UserPic": "/UserPic/Flyingfox.png",
    "MemberSince": "2016-01-02 00:43:04",
    "RichPresenceMsg": "Playing Super Mario World",
    "LastGameID": 19504,
    "ContribCount": 0,
    "ContribYield": 0,
    "TotalPoints": 399597,
    "TotalSoftcorePoints": 12,
    "TotalTruePoints": 1599212,
    "Permissions": 1,
    "Untracked": 0,
    "ID": 16446,
    "UserWallActive": 1,
    "Motto": "Join me on Twitch!",
}

RECENTLY_PLAYED_RESPONSE = [
    {
        "GameID": 11332,
        "ConsoleID": 12,
        "ConsoleName": "PlayStation",
        "Title": "Final Fantasy Origins",
        "ImageIcon": "/Images/060249.png",
        "ImageTitle": "/Images/026707.png",
        "ImageIngame": "/Images/026708.png",
        "ImageBoxArt": "/Images/046257.png",
        "LastPlayed": "2023-10-27 00:30:04",
        "AchievementsTotal": 119,
        "NumPossibleAchievements": 119,
        "PossibleScore": 945,
        "NumAchieved": 38,
        "ScoreAchieved": 382,
        "NumAchievedHardcore": 38,
        "ScoreAchievedHardcore": 382,
    }
]

RECENT_ACHIEVEMENTS_RESPONSE = [
    {
        "Date": "2023-12-27 16:04:50",
        "HardcoreMode": 1,
        "AchievementID": 98012,
        "Title": "Beginner I",
        "Description": "Clear stages 01 - 05 in Quest.",
        "BadgeName": "108302",
        "Points": 5,
        "TrueRatio": 25,
        "Type": None,
        "Author": "jos",
        "AuthorULID": "00003EMFWR7XB8SDPEHB3K56ZQ",
        "GameTitle": "Pokemon Pinball mini",
        "GameIcon": "/Images/028399.png",
        "GameID": 14715,
        "ConsoleName": "Pokemon Mini",
        "BadgeURL": "/Badge/108302.png",
        "GameURL": "/game/14715",
    }
]


def make_client() -> RetroAchievementsClient:
    return RetroAchievementsClient(api_key="test-ra-key")


@respx.mock
async def test_get_user_profile_maps_pascal_case_fields():
    respx.get(f"{RA_API_BASE}/API_GetUserProfile.php").mock(
        return_value=httpx.Response(200, json=PROFILE_RESPONSE)
    )

    profile = await make_client().get_user_profile("Flyingfox")

    assert profile.username == "Flyingfox"
    assert profile.user_pic_url == "https://media.retroachievements.org/UserPic/Flyingfox.png"
    assert profile.motto == "Join me on Twitch!"
    assert profile.member_since == "2016-01-02 00:43:04"
    assert profile.rich_presence == "Playing Super Mario World"
    assert profile.total_points == 399597
    assert profile.total_softcore_points == 12
    assert profile.total_true_points == 1599212


@respx.mock
async def test_get_user_recently_played_games_maps_progress_fields():
    respx.get(f"{RA_API_BASE}/API_GetUserRecentlyPlayedGames.php").mock(
        return_value=httpx.Response(200, json=RECENTLY_PLAYED_RESPONSE)
    )

    games = await make_client().get_user_recently_played_games("Flyingfox")

    assert len(games) == 1
    game = games[0]
    assert game.game_id == 11332
    assert game.console_name == "PlayStation"
    assert game.title == "Final Fantasy Origins"
    assert game.image_box_art_url == "https://media.retroachievements.org/Images/046257.png"
    assert game.num_possible_achievements == 119
    assert game.num_achieved == 38
    assert game.num_achieved_hardcore == 38
    assert game.score_achieved == 382


@respx.mock
async def test_get_user_recent_achievements_maps_badge_and_game():
    respx.get(f"{RA_API_BASE}/API_GetUserRecentAchievements.php").mock(
        return_value=httpx.Response(200, json=RECENT_ACHIEVEMENTS_RESPONSE)
    )

    achievements = await make_client().get_user_recent_achievements("Flyingfox")

    assert len(achievements) == 1
    achievement = achievements[0]
    assert achievement.achievement_id == 98012
    assert achievement.title == "Beginner I"
    assert achievement.badge_url == "https://media.retroachievements.org/Badge/108302.png"
    assert achievement.points == 5
    assert achievement.true_ratio == 25
    assert achievement.hardcore is True
    assert achievement.game_title == "Pokemon Pinball mini"
    assert achievement.console_name == "Pokemon Mini"


@respx.mock
async def test_auth_failure_raises_without_retry():
    route = respx.get(f"{RA_API_BASE}/API_GetUserProfile.php").mock(
        return_value=httpx.Response(401, json={"message": "Unauthorized"})
    )

    with pytest.raises(RetroAchievementsAuthError):
        await make_client().get_user_profile("Flyingfox")

    assert route.called
    assert route.call_count == 1


@respx.mock
async def test_server_error_retries_then_raises():
    route = respx.get(f"{RA_API_BASE}/API_GetUserProfile.php").mock(
        return_value=httpx.Response(500, json={"message": "boom"})
    )

    with pytest.raises(RetroAchievementsError):
        await make_client().get_user_profile("Flyingfox")

    assert route.call_count == 3


def test_ra_media_url_returns_none_for_empty():
    assert ra_media_url(None) is None
    assert ra_media_url("") is None
