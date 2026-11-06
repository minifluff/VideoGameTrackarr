import httpx
import pytest
import respx

from app.services.steam_achievements_client import (
    STEAM_API_BASE,
    SteamAchievementsAuthError,
    SteamAchievementsClient,
    SteamAchievementsError,
    steam_achievement_icon_url,
    steam_game_icon_url,
)

RECENTLY_PLAYED_RESPONSE = {
    "response": {
        "game_count": 2,
        "games": [
            {
                "appid": 220,
                "name": "Half-Life 2",
                "playtime_2weeks": 120,
                "playtime_forever": 754,
                "img_icon_url": "abc123icon",
                "rtime_last_played": 1690000000,
            },
            {
                "appid": 440,
                "name": "Team Fortress 2",
                "playtime_2weeks": 0,
                "playtime_forever": 3000,
                "img_icon_url": "",
                "rtime_last_played": 0,
            },
        ],
    }
}

PLAYER_ACHIEVEMENTS_RESPONSE = {
    "playerstats": {
        "steamID": "76561197960287930",
        "gameName": "Half-Life 2",
        "achievements": [
            {"apiname": "HL2_KILL_ALL", "achieved": 1, "unlocktime": 1690001000},
            {"apiname": "HL2_LOCKED", "achieved": 0, "unlocktime": 0},
        ],
        "success": True,
    }
}

SCHEMA_RESPONSE = {
    "game": {
        "gameName": "Half-Life 2",
        "availableGameStats": {
            "achievements": [
                {
                    "name": "HL2_KILL_ALL",
                    "displayName": "Kill them all",
                    "description": "Defeat every enemy.",
                    "icon": "iconhash",
                    "icongray": "grayhash",
                }
            ]
        },
    }
}


def make_client() -> SteamAchievementsClient:
    return SteamAchievementsClient(api_key="test-steam-key")


@respx.mock
async def test_get_recently_played_games_maps_fields():
    respx.get(f"{STEAM_API_BASE}/IPlayerService/GetRecentlyPlayedGames/v1/").mock(
        return_value=httpx.Response(200, json=RECENTLY_PLAYED_RESPONSE)
    )

    games = await make_client().get_recently_played_games("76561197960287930")

    assert len(games) == 2
    assert games[0].app_id == 220
    assert games[0].name == "Half-Life 2"
    assert games[0].playtime_2weeks_minutes == 120
    assert games[0].playtime_forever_minutes == 754
    assert games[0].last_played == "2023-07-22T04:26:40Z"
    # A game never played in the window has no icon and no last-played time.
    assert games[1].img_icon_url == ""
    assert games[1].last_played is None


@respx.mock
async def test_get_recently_played_games_returns_empty_for_a_private_profile():
    respx.get(f"{STEAM_API_BASE}/IPlayerService/GetRecentlyPlayedGames/v1/").mock(
        return_value=httpx.Response(200, json={"response": {}})
    )

    games = await make_client().get_recently_played_games("76561197960287930")

    assert games == []


@respx.mock
async def test_get_player_achievements_maps_unlocks():
    respx.get(f"{STEAM_API_BASE}/ISteamUserStats/GetPlayerAchievements/v0001/").mock(
        return_value=httpx.Response(200, json=PLAYER_ACHIEVEMENTS_RESPONSE)
    )

    achievements = await make_client().get_player_achievements("76561197960287930", 220)

    assert achievements is not None
    assert len(achievements) == 2
    assert achievements[0].apiname == "HL2_KILL_ALL"
    assert achievements[0].achieved is True
    assert achievements[0].unlocktime == "2023-07-22T04:43:20Z"
    assert achievements[1].achieved is False
    assert achievements[1].unlocktime is None


@respx.mock
async def test_get_player_achievements_returns_none_when_success_is_false():
    respx.get(f"{STEAM_API_BASE}/ISteamUserStats/GetPlayerAchievements/v0001/").mock(
        return_value=httpx.Response(200, json={"playerstats": {"success": False}})
    )

    assert await make_client().get_player_achievements("76561197960287930", 440) is None


@respx.mock
async def test_get_player_achievements_skips_a_stat_less_game_without_retry():
    # Steam answers 400 for a game with no stats — that must be a cheap skip,
    # not three retried requests.
    route = respx.get(f"{STEAM_API_BASE}/ISteamUserStats/GetPlayerAchievements/v0001/").mock(
        return_value=httpx.Response(400, json={"playerstats": {"success": False}})
    )

    assert await make_client().get_player_achievements("76561197960287930", 440) is None
    assert route.call_count == 1


@respx.mock
async def test_get_game_schema_maps_by_apiname():
    respx.get(f"{STEAM_API_BASE}/ISteamUserStats/GetSchemaForGame/v2/").mock(
        return_value=httpx.Response(200, json=SCHEMA_RESPONSE)
    )

    schema = await make_client().get_game_schema(220)

    assert set(schema) == {"HL2_KILL_ALL"}
    assert schema["HL2_KILL_ALL"].display_name == "Kill them all"
    assert schema["HL2_KILL_ALL"].description == "Defeat every enemy."
    assert schema["HL2_KILL_ALL"].icon == "iconhash"


@respx.mock
async def test_get_game_schema_returns_empty_when_the_game_has_no_stats():
    respx.get(f"{STEAM_API_BASE}/ISteamUserStats/GetSchemaForGame/v2/").mock(
        return_value=httpx.Response(200, json={"game": {}})
    )

    assert await make_client().get_game_schema(440) == {}


@respx.mock
async def test_auth_failure_raises_without_retry():
    route = respx.get(f"{STEAM_API_BASE}/IPlayerService/GetRecentlyPlayedGames/v1/").mock(
        return_value=httpx.Response(401, json={"message": "Unauthorized"})
    )

    with pytest.raises(SteamAchievementsAuthError):
        await make_client().get_recently_played_games("76561197960287930")

    assert route.called
    assert route.call_count == 1


@respx.mock
async def test_server_error_retries_then_raises():
    route = respx.get(f"{STEAM_API_BASE}/IPlayerService/GetRecentlyPlayedGames/v1/").mock(
        return_value=httpx.Response(500, json={"message": "boom"})
    )

    with pytest.raises(SteamAchievementsError):
        await make_client().get_recently_played_games("76561197960287930")

    assert route.call_count == 3


def test_steam_image_url_helpers():
    assert (
        steam_game_icon_url(220, "abc123icon")
        == "https://media.steampowered.com/steamcommunity/public/images/apps/220/abc123icon.jpg"
    )
    assert steam_game_icon_url(220, "") is None
    assert steam_game_icon_url(220, None) is None
    assert (
        steam_achievement_icon_url(220, "iconhash")
        == "https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/220/iconhash.jpg"
    )
    assert steam_achievement_icon_url(220, None) is None
