import httpx
import respx

from app.services.retroachievements_client import RA_API_BASE
from tests.test_retroachievements_client import (
    GAME_PROGRESS_RESPONSE,
    PROFILE_RESPONSE,
    RECENT_ACHIEVEMENTS_RESPONSE,
    RECENTLY_PLAYED_RESPONSE,
)


def _mock_ra_endpoints():
    profile_route = respx.get(f"{RA_API_BASE}/API_GetUserProfile.php").mock(
        return_value=httpx.Response(200, json=PROFILE_RESPONSE)
    )
    respx.get(f"{RA_API_BASE}/API_GetUserRecentlyPlayedGames.php").mock(
        return_value=httpx.Response(200, json=RECENTLY_PLAYED_RESPONSE)
    )
    respx.get(f"{RA_API_BASE}/API_GetUserRecentAchievements.php").mock(
        return_value=httpx.Response(200, json=RECENT_ACHIEVEMENTS_RESPONSE)
    )
    return profile_route


def _connect(auth_client, username="Flyingfox"):
    response = auth_client.put(
        "/api/achievements/settings",
        json={"username": username, "apiKey": "test-ra-key"},
    )
    assert response.status_code == 200
    return response.json()


def test_status_requires_auth(client):
    assert client.get("/api/achievements/status").status_code == 401
    assert client.get("/api/achievements/summary").status_code == 401


def test_status_reports_unconfigured(auth_client):
    body = auth_client.get("/api/achievements/status").json()

    assert body["configured"] is False
    assert body["username"] is None
    assert body["apiKeyConfigured"] is False


def test_summary_without_credentials_is_a_conflict(auth_client):
    response = auth_client.get("/api/achievements/summary")

    assert response.status_code == 409


def test_settings_save_username_and_key_without_echoing_the_key(auth_client):
    body = _connect(auth_client)

    assert body["configured"] is True
    assert body["username"] == "Flyingfox"
    assert body["apiKeyConfigured"] is True
    assert "test-ra-key" not in str(body)


def test_settings_update_without_api_key_keeps_the_saved_key(auth_client):
    _connect(auth_client)

    response = auth_client.put("/api/achievements/settings", json={"username": "Flyingfox"})

    assert response.status_code == 200
    assert response.json()["apiKeyConfigured"] is True


def test_settings_can_clear_both_fields(auth_client):
    _connect(auth_client)

    response = auth_client.put(
        "/api/achievements/settings", json={"username": None, "apiKey": ""}
    )

    assert response.status_code == 200
    assert response.json()["configured"] is False


@respx.mock
def test_summary_merges_profile_games_and_achievements(auth_client):
    _connect(auth_client)
    _mock_ra_endpoints()

    response = auth_client.get("/api/achievements/summary")

    assert response.status_code == 200
    body = response.json()
    assert body["profile"]["username"] == "Flyingfox"
    assert body["profile"]["totalPoints"] == 399597
    assert len(body["recentlyPlayed"]) == 1
    assert body["recentlyPlayed"][0]["title"] == "Final Fantasy Origins"
    assert body["recentlyPlayed"][0]["numAchieved"] == 38
    assert len(body["recentAchievements"]) == 1
    assert body["recentAchievements"][0]["title"] == "Beginner I"


@respx.mock
def test_summary_is_cached_and_refresh_bypasses_the_cache(auth_client):
    _connect(auth_client, username="CacheUser")
    # Keep the route handle from the mock itself: calling respx.get() a second
    # time registers a second, unmocked route that answers with an empty 200.
    profile_route = _mock_ra_endpoints()

    first = auth_client.get("/api/achievements/summary")
    second = auth_client.get("/api/achievements/summary")
    third = auth_client.get("/api/achievements/summary?refresh=true")

    assert first.status_code == 200
    assert second.status_code == 200
    assert third.status_code == 200
    assert profile_route.call_count == 2


@respx.mock
def test_summary_with_a_bad_key_is_a_502(auth_client):
    _connect(auth_client, username="BadKeyUser")
    respx.get(f"{RA_API_BASE}/API_GetUserProfile.php").mock(
        return_value=httpx.Response(401, json={"message": "Unauthorized"})
    )
    respx.get(f"{RA_API_BASE}/API_GetUserRecentlyPlayedGames.php").mock(
        return_value=httpx.Response(200, json=[])
    )
    respx.get(f"{RA_API_BASE}/API_GetUserRecentAchievements.php").mock(
        return_value=httpx.Response(200, json=[])
    )

    response = auth_client.get("/api/achievements/summary")

    assert response.status_code == 502


def test_game_progress_without_credentials_is_a_conflict(auth_client):
    response = auth_client.get("/api/achievements/game/1")

    assert response.status_code == 409


@respx.mock
def test_game_progress_returns_full_achievement_list(auth_client):
    _connect(auth_client)
    respx.get(f"{RA_API_BASE}/API_GetGameInfoAndUserProgress.php").mock(
        return_value=httpx.Response(200, json=GAME_PROGRESS_RESPONSE)
    )

    response = auth_client.get("/api/achievements/game/1")

    assert response.status_code == 200
    body = response.json()
    assert body["gameId"] == 1
    assert body["title"] == "Sonic the Hedgehog"
    assert body["consoleName"] == "Mega Drive"
    assert body["numAchieved"] == 1
    assert body["numPossibleAchievements"] == 3
    assert body["scoreAchieved"] == 3
    assert body["possibleScore"] == 18
    assert len(body["achievements"]) == 3
    earned = body["achievements"][0]
    assert earned["title"] == "That Was Easy"
    assert earned["badgeUrl"] == "https://media.retroachievements.org/Badge/250336.png"
    assert earned["dateEarned"] == "2016-03-12 17:47:29"
    locked = {a["achievementId"]: a for a in body["achievements"]}
    assert locked[10]["dateEarned"] is None
    assert locked[11]["dateEarned"] is None


@respx.mock
def test_game_progress_is_cached_and_refresh_bypasses_the_cache(auth_client):
    _connect(auth_client, username="CacheGameUser")
    # Keep the route handle from the mock itself: calling respx.get() a second
    # time registers a second, unmocked route that answers with an empty 200.
    game_route = respx.get(f"{RA_API_BASE}/API_GetGameInfoAndUserProgress.php").mock(
        return_value=httpx.Response(200, json=GAME_PROGRESS_RESPONSE)
    )

    first = auth_client.get("/api/achievements/game/1")
    second = auth_client.get("/api/achievements/game/1")
    third = auth_client.get("/api/achievements/game/1?refresh=true")

    assert first.status_code == 200
    assert second.status_code == 200
    assert third.status_code == 200
    assert game_route.call_count == 2


@respx.mock
def test_game_progress_with_a_bad_key_is_a_502(auth_client):
    _connect(auth_client, username="BadGameKeyUser")
    respx.get(f"{RA_API_BASE}/API_GetGameInfoAndUserProgress.php").mock(
        return_value=httpx.Response(401, json={"message": "Unauthorized"})
    )

    response = auth_client.get("/api/achievements/game/1")

    assert response.status_code == 502
