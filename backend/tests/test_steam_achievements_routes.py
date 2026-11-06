import httpx
import respx

from app.core.config import get_settings
from app.services.steam_achievements_client import STEAM_API_BASE
from tests.test_steam_achievements_client import (
    PLAYER_ACHIEVEMENTS_RESPONSE,
    RECENTLY_PLAYED_RESPONSE,
    SCHEMA_RESPONSE,
)

TF2_PLAYER_ACHIEVEMENTS_RESPONSE = {
    "playerstats": {
        "steamID": "76561197960287930",
        "gameName": "Team Fortress 2",
        "achievements": [
            {"apiname": "TF2_WIN", "achieved": 1, "unlocktime": 1690002000},
        ],
        "success": True,
    }
}

TF2_SCHEMA_RESPONSE = {
    "game": {
        "gameName": "Team Fortress 2",
        "availableGameStats": {
            "achievements": [
                {
                    "name": "TF2_WIN",
                    "displayName": "Win a match",
                    "description": "Win any match.",
                    "icon": "tf2icon",
                    "icongray": "tf2gray",
                }
            ]
        },
    }
}


def _connect_steam(auth_client, monkeypatch, steam_id="76561197960287930"):
    # The API key is env-only (like Steam sync) — the settings object is cached,
    # so monkeypatch the attribute for the test's duration.
    monkeypatch.setattr(get_settings(), "steam_api_key", "test-steam-key")
    response = auth_client.put("/api/integrations/steam", json={"steamId64": steam_id})
    assert response.status_code == 200
    return response.json()


def _mock_steam_endpoints(tf2_has_stats=True):
    recently_route = respx.get(
        f"{STEAM_API_BASE}/IPlayerService/GetRecentlyPlayedGames/v1/"
    ).mock(return_value=httpx.Response(200, json=RECENTLY_PLAYED_RESPONSE))

    def _player_achievements(request):
        appid = request.url.params.get("appid")
        if appid == "220":
            return httpx.Response(200, json=PLAYER_ACHIEVEMENTS_RESPONSE)
        if appid == "440" and tf2_has_stats:
            return httpx.Response(200, json=TF2_PLAYER_ACHIEVEMENTS_RESPONSE)
        # A game with no stats: Steam answers 400, the service skips the game.
        return httpx.Response(400, json={"playerstats": {"success": False}})

    respx.get(f"{STEAM_API_BASE}/ISteamUserStats/GetPlayerAchievements/v0001/").mock(
        side_effect=_player_achievements
    )

    def _schema(request):
        appid = request.url.params.get("appid")
        if appid == "220":
            return httpx.Response(200, json=SCHEMA_RESPONSE)
        if appid == "440":
            return httpx.Response(200, json=TF2_SCHEMA_RESPONSE)
        return httpx.Response(200, json={"game": {}})

    respx.get(f"{STEAM_API_BASE}/ISteamUserStats/GetSchemaForGame/v2/").mock(
        side_effect=_schema
    )
    return recently_route


def test_status_reports_steam_unconfigured(auth_client, monkeypatch):
    monkeypatch.setattr(get_settings(), "steam_api_key", None)

    body = auth_client.get("/api/achievements/status").json()

    assert body["steamConfigured"] is False


def test_status_reports_steam_configured(auth_client, monkeypatch):
    _connect_steam(auth_client, monkeypatch)

    body = auth_client.get("/api/achievements/status").json()

    assert body["steamConfigured"] is True


def test_steam_summary_without_credentials_is_a_conflict(auth_client, monkeypatch):
    monkeypatch.setattr(get_settings(), "steam_api_key", None)

    response = auth_client.get("/api/achievements/steam/summary")

    assert response.status_code == 409


@respx.mock
def test_steam_summary_merges_games_and_sorts_recent_unlocks(auth_client, monkeypatch):
    _connect_steam(auth_client, monkeypatch, steam_id="76561197960287931")
    _mock_steam_endpoints()

    response = auth_client.get("/api/achievements/steam/summary")

    assert response.status_code == 200
    body = response.json()
    assert body["configured"] is True
    assert len(body["games"]) == 2
    hl2 = body["games"][0]
    assert hl2["appid"] == 220
    assert hl2["name"] == "Half-Life 2"
    assert hl2["iconUrl"] == (
        "https://media.steampowered.com/steamcommunity/public/images/apps/220/abc123icon.jpg"
    )
    assert hl2["unlockedCount"] == 1
    assert hl2["totalCount"] == 2
    # The merged feed is newest unlock first — TF2's unlock is later than HL2's.
    assert len(body["recentAchievements"]) == 2
    assert body["recentAchievements"][0]["apiname"] == "TF2_WIN"
    assert body["recentAchievements"][0]["displayName"] == "Win a match"
    assert body["recentAchievements"][0]["gameName"] == "Team Fortress 2"
    assert body["recentAchievements"][0]["appid"] == 440
    assert body["recentAchievements"][1]["apiname"] == "HL2_KILL_ALL"
    assert body["recentAchievements"][1]["displayName"] == "Kill them all"
    assert body["recentAchievements"][1]["iconUrl"] == (
        "https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/220/iconhash.jpg"
    )


@respx.mock
def test_steam_summary_skips_a_game_without_stats(auth_client, monkeypatch):
    _connect_steam(auth_client, monkeypatch, steam_id="76561197960287932")
    _mock_steam_endpoints(tf2_has_stats=False)

    response = auth_client.get("/api/achievements/steam/summary")

    assert response.status_code == 200
    body = response.json()
    tf2 = [game for game in body["games"] if game["appid"] == 440][0]
    assert tf2["unlockedCount"] == 0
    assert tf2["totalCount"] == 0
    assert [a["apiname"] for a in body["recentAchievements"]] == ["HL2_KILL_ALL"]


@respx.mock
def test_steam_summary_is_cached_and_refresh_bypasses_the_cache(auth_client, monkeypatch):
    _connect_steam(auth_client, monkeypatch, steam_id="76561197960287933")
    # Keep the route handle from the mock itself: calling respx.get() a second
    # time registers a second, unmocked route that answers with an empty 200.
    recently_route = _mock_steam_endpoints()

    first = auth_client.get("/api/achievements/steam/summary")
    second = auth_client.get("/api/achievements/steam/summary")
    third = auth_client.get("/api/achievements/steam/summary?refresh=true")

    assert first.status_code == 200
    assert second.status_code == 200
    assert third.status_code == 200
    assert recently_route.call_count == 2


@respx.mock
def test_steam_summary_with_a_bad_key_is_a_502(auth_client, monkeypatch):
    _connect_steam(auth_client, monkeypatch, steam_id="76561197960287934")
    respx.get(f"{STEAM_API_BASE}/IPlayerService/GetRecentlyPlayedGames/v1/").mock(
        return_value=httpx.Response(401, json={"message": "Unauthorized"})
    )

    response = auth_client.get("/api/achievements/steam/summary")

    assert response.status_code == 502
