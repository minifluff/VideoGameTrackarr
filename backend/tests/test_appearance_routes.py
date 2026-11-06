"""Appearance settings route — the hide-hardware-menu flag round-trips server-side."""


def test_appearance_defaults_hide_hardware_menu_off(auth_client):
    response = auth_client.get("/api/settings/appearance")

    assert response.status_code == 200
    assert response.json()["hideHardwareMenu"] is False
    assert response.json()["hideDashboardMenu"] is False
    assert response.json()["hideGamesMenu"] is False
    assert response.json()["hideEventsMenu"] is False
    assert response.json()["hideAchievementsMenu"] is False
    assert response.json()["hideInsightsMenu"] is False
    assert response.json()["startPage"] == "/"


def test_appearance_update_hide_hardware_menu_roundtrips(auth_client):
    response = auth_client.put("/api/settings/appearance", json={"hideHardwareMenu": True})

    assert response.status_code == 200
    assert response.json()["hideHardwareMenu"] is True
    assert auth_client.get("/api/settings/appearance").json()["hideHardwareMenu"] is True

    response = auth_client.put("/api/settings/appearance", json={"hideHardwareMenu": False})
    assert response.json()["hideHardwareMenu"] is False


def test_appearance_partial_update_keeps_hide_hardware_menu(auth_client):
    auth_client.put("/api/settings/appearance", json={"hideHardwareMenu": True})

    response = auth_client.put("/api/settings/appearance", json={"appTitle": "My Library"})

    assert response.json()["appTitle"] == "My Library"
    assert response.json()["hideHardwareMenu"] is True


def test_appearance_update_menu_toggles_and_start_page_roundtrip(auth_client):
    response = auth_client.put(
        "/api/settings/appearance",
        json={
            "hideDashboardMenu": True,
            "hideGamesMenu": True,
            "hideEventsMenu": True,
            "hideAchievementsMenu": True,
            "hideInsightsMenu": True,
            "startPage": "/games",
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["hideDashboardMenu"] is True
    assert body["hideGamesMenu"] is True
    assert body["hideEventsMenu"] is True
    assert body["hideAchievementsMenu"] is True
    assert body["hideInsightsMenu"] is True
    assert body["startPage"] == "/games"
    assert auth_client.get("/api/settings/appearance").json()["startPage"] == "/games"


def test_appearance_update_ignores_invalid_start_page(auth_client):
    auth_client.put("/api/settings/appearance", json={"startPage": "/achievements"})

    response = auth_client.put("/api/settings/appearance", json={"startPage": "/settings"})

    assert response.status_code == 200
    assert response.json()["startPage"] == "/achievements"

    response = auth_client.put("/api/settings/appearance", json={"startPage": "/nowhere"})

    assert response.json()["startPage"] == "/achievements"
