"""Appearance settings route — the hide-hardware-menu flag round-trips server-side."""


def test_appearance_defaults_hide_hardware_menu_off(auth_client):
    response = auth_client.get("/api/settings/appearance")

    assert response.status_code == 200
    assert response.json()["hideHardwareMenu"] is False


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
