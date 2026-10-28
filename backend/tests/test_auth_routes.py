from datetime import UTC


def test_login_success_returns_tokens(client, test_user):
    response = client.post("/api/auth/login", json={"username": "admin", "password": "correct-password"})

    assert response.status_code == 200
    body = response.json()
    assert body["tokenType"] == "bearer"
    assert body["accessToken"]
    assert body["refreshToken"]


def test_login_wrong_password_rejected(client, test_user):
    response = client.post("/api/auth/login", json={"username": "admin", "password": "wrong-password"})

    assert response.status_code == 401


def test_login_unknown_user_rejected(client, test_user):
    response = client.post("/api/auth/login", json={"username": "nobody", "password": "whatever"})

    assert response.status_code == 401


def test_login_rate_limited_after_five_attempts(client, test_user):
    for _ in range(5):
        client.post("/api/auth/login", json={"username": "admin", "password": "wrong-password"})

    response = client.post("/api/auth/login", json={"username": "admin", "password": "wrong-password"})

    assert response.status_code == 429


def test_me_requires_auth(client):
    response = client.get("/api/auth/me")

    assert response.status_code == 401


def test_me_returns_current_user_with_valid_access_token(client, test_user):
    login = client.post("/api/auth/login", json={"username": "admin", "password": "correct-password"})
    access_token = login.json()["accessToken"]

    response = client.get("/api/auth/me", headers={"Authorization": f"Bearer {access_token}"})

    assert response.status_code == 200
    assert response.json() == {
        "id": test_user.id,
        "username": "admin",
        "overviewLayout": None,
        "overviewCardSize": None,
    }


def test_me_rejects_garbage_token(client):
    response = client.get("/api/auth/me", headers={"Authorization": "Bearer not-a-real-token"})

    assert response.status_code == 401


def test_refresh_issues_new_tokens(client, test_user):
    login = client.post("/api/auth/login", json={"username": "admin", "password": "correct-password"})
    old_refresh_token = login.json()["refreshToken"]

    response = client.post("/api/auth/refresh", json={"refreshToken": old_refresh_token})

    assert response.status_code == 200
    new_tokens = response.json()
    assert new_tokens["refreshToken"] != old_refresh_token


def test_refresh_token_cannot_be_replayed_after_rotation(client, test_user):
    login = client.post("/api/auth/login", json={"username": "admin", "password": "correct-password"})
    old_refresh_token = login.json()["refreshToken"]

    client.post("/api/auth/refresh", json={"refreshToken": old_refresh_token})
    replay = client.post("/api/auth/refresh", json={"refreshToken": old_refresh_token})

    assert replay.status_code == 401


def test_logout_revokes_refresh_token(client, test_user):
    login = client.post("/api/auth/login", json={"username": "admin", "password": "correct-password"})
    refresh_token = login.json()["refreshToken"]

    logout = client.post("/api/auth/logout", json={"refreshToken": refresh_token})
    assert logout.status_code == 204

    reuse = client.post("/api/auth/refresh", json={"refreshToken": refresh_token})
    assert reuse.status_code == 401


def test_logout_is_idempotent_for_already_revoked_token(client, test_user):
    login = client.post("/api/auth/login", json={"username": "admin", "password": "correct-password"})
    refresh_token = login.json()["refreshToken"]

    first = client.post("/api/auth/logout", json={"refreshToken": refresh_token})
    second = client.post("/api/auth/logout", json={"refreshToken": refresh_token})

    assert first.status_code == 204
    assert second.status_code == 204


def test_access_token_rejected_at_refresh_endpoint(client, test_user):
    login = client.post("/api/auth/login", json={"username": "admin", "password": "correct-password"})
    access_token = login.json()["accessToken"]

    response = client.post("/api/auth/refresh", json={"refreshToken": access_token})

    assert response.status_code == 401


def test_setup_status_reports_required_when_no_users(client):
    response = client.get("/api/auth/setup-status")

    assert response.status_code == 200
    assert response.json() == {"setupRequired": True}


def test_setup_status_reports_not_required_once_a_user_exists(client, test_user):
    response = client.get("/api/auth/setup-status")

    assert response.status_code == 200
    assert response.json() == {"setupRequired": False}


def test_setup_creates_first_user_and_logs_in(client):
    response = client.post("/api/auth/setup", json={"username": "admin", "password": "a-strong-password"})

    assert response.status_code == 200
    body = response.json()
    assert body["tokenType"] == "bearer"
    assert body["accessToken"]
    assert body["refreshToken"]

    assert client.get("/api/auth/setup-status").json() == {"setupRequired": False}

    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {body['accessToken']}"})
    assert me.status_code == 200
    assert me.json()["username"] == "admin"


def test_setup_rejected_once_a_user_already_exists(client, test_user):
    response = client.post("/api/auth/setup", json={"username": "someone-else", "password": "a-strong-password"})

    assert response.status_code == 409


def test_setup_rejects_short_password(client):
    response = client.post("/api/auth/setup", json={"username": "admin", "password": "short"})

    assert response.status_code == 422


def test_setup_rejects_short_username(client):
    response = client.post("/api/auth/setup", json={"username": "ab", "password": "a-strong-password"})

    assert response.status_code == 422


def test_setup_rejects_password_over_bcrypt_limit(client):
    # bcrypt silently truncates past 72 bytes, so setup must reject a longer
    # password — otherwise the stored password is shorter than the one given.
    response = client.post("/api/auth/setup", json={"username": "admin", "password": "x" * 73})

    assert response.status_code == 422


def test_setup_accepts_password_at_bcrypt_limit(client):
    response = client.post("/api/auth/setup", json={"username": "admin", "password": "x" * 72})

    assert response.status_code == 200


def test_refresh_reuse_revokes_all_tokens(client, test_user):
    login = client.post("/api/auth/login", json={"username": "admin", "password": "correct-password"})
    old_refresh_token = login.json()["refreshToken"]

    rotated = client.post("/api/auth/refresh", json={"refreshToken": old_refresh_token})
    assert rotated.status_code == 200
    new_refresh_token = rotated.json()["refreshToken"]

    # Replaying the revoked token fails — and as reuse evidence it revokes the
    # whole family, so the rotated token dies with it.
    replay = client.post("/api/auth/refresh", json={"refreshToken": old_refresh_token})
    assert replay.status_code == 401

    reuse = client.post("/api/auth/refresh", json={"refreshToken": new_refresh_token})
    assert reuse.status_code == 401


def test_setup_rate_limited_after_five_attempts(client):
    for _ in range(5):
        client.post("/api/auth/setup", json={"username": "admin", "password": "a-strong-password"})

    response = client.post("/api/auth/setup", json={"username": "admin", "password": "a-strong-password"})

    assert response.status_code == 429


def _refresh_token_lifetime_days(token: str) -> float:
    from datetime import datetime

    import jwt

    exp = jwt.decode(token, options={"verify_signature": False})["exp"]
    return (datetime.fromtimestamp(exp, tz=UTC) - datetime.now(UTC)).total_seconds() / 86400


def test_login_remember_me_issues_year_long_refresh_token(client, test_user):
    response = client.post(
        "/api/auth/login",
        json={"username": "admin", "password": "correct-password", "rememberMe": True},
    )

    assert response.status_code == 200
    assert _refresh_token_lifetime_days(response.json()["refreshToken"]) > 360


def test_login_without_remember_me_uses_default_refresh_lifetime(client, test_user):
    response = client.post(
        "/api/auth/login",
        json={"username": "admin", "password": "correct-password"},
    )

    assert response.status_code == 200
    assert _refresh_token_lifetime_days(response.json()["refreshToken"]) <= 30


def test_refresh_preserves_remember_me_lifetime(client, test_user):
    login = client.post(
        "/api/auth/login",
        json={"username": "admin", "password": "correct-password", "rememberMe": True},
    )
    old_refresh_token = login.json()["refreshToken"]

    response = client.post("/api/auth/refresh", json={"refreshToken": old_refresh_token})

    assert response.status_code == 200
    assert _refresh_token_lifetime_days(response.json()["refreshToken"]) > 360


def test_change_password_signs_other_sessions_out_and_keeps_this_one(client, test_user):
    first = client.post("/api/auth/login", json={"username": test_user.username, "password": "correct-password"}).json()
    other = client.post("/api/auth/login", json={"username": test_user.username, "password": "correct-password"}).json()

    response = client.post(
        "/api/auth/change-password",
        json={"currentPassword": "correct-password", "newPassword": "a-brand-new-password"},
        headers={"Authorization": f"Bearer {first['accessToken']}"},
    )

    assert response.status_code == 200
    # The other session is signed out by the password change alone.
    assert client.post("/api/auth/refresh", json={"refreshToken": other["refreshToken"]}).status_code == 401
    # The stale refresh fails quietly (its record was deleted, not revoked), so it
    # is NOT reuse evidence — the fresh token from the password change survives it.
    assert client.post("/api/auth/refresh", json={"refreshToken": response.json()["refreshToken"]}).status_code == 200
    login = client.post("/api/auth/login", json={"username": test_user.username, "password": "a-brand-new-password"})
    assert login.status_code == 200


def test_change_password_keeps_this_session_without_stale_refresh(client, test_user):
    first = client.post("/api/auth/login", json={"username": test_user.username, "password": "correct-password"}).json()
    client.post("/api/auth/login", json={"username": test_user.username, "password": "correct-password"}).json()

    response = client.post(
        "/api/auth/change-password",
        json={"currentPassword": "correct-password", "newPassword": "a-brand-new-password"},
        headers={"Authorization": f"Bearer {first['accessToken']}"},
    )

    assert response.status_code == 200
    assert client.post("/api/auth/refresh", json={"refreshToken": response.json()["refreshToken"]}).status_code == 200


def test_change_password_rejects_a_wrong_current_password(client, test_user):
    tokens = client.post(
        "/api/auth/login", json={"username": test_user.username, "password": "correct-password"}
    ).json()

    response = client.post(
        "/api/auth/change-password",
        json={"currentPassword": "not-it", "newPassword": "a-brand-new-password"},
        headers={"Authorization": f"Bearer {tokens['accessToken']}"},
    )

    assert response.status_code == 400


def test_change_password_rejects_a_short_new_password(auth_client):
    response = auth_client.post(
        "/api/auth/change-password", json={"currentPassword": "correct-password", "newPassword": "short"}
    )

    assert response.status_code == 422


def test_change_password_requires_auth(client):
    response = client.post(
        "/api/auth/change-password", json={"currentPassword": "x", "newPassword": "a-brand-new-password"}
    )

    assert response.status_code == 401


def test_change_password_rejects_a_password_longer_than_72_bytes(auth_client):
    response = auth_client.post(
        "/api/auth/change-password", json={"currentPassword": "correct-password", "newPassword": "x" * 73}
    )

    assert response.status_code == 422


def test_preferences_requires_auth(client):
    response = client.put("/api/auth/me/preferences", json={"overviewLayout": []})

    assert response.status_code == 401


def test_preferences_saves_overview_layout(auth_client):
    layout = [
        {"key": "needsAttention", "hidden": False},
        {"key": "stats", "hidden": True},
    ]
    response = auth_client.put("/api/auth/me/preferences", json={"overviewLayout": layout})

    assert response.status_code == 200
    assert response.json()["overviewLayout"] == layout

    me = auth_client.get("/api/auth/me")
    assert me.json()["overviewLayout"] == layout


def test_preferences_rejects_bad_section_key(auth_client):
    response = auth_client.put(
        "/api/auth/me/preferences", json={"overviewLayout": [{"key": "bad key!", "hidden": False}]}
    )

    assert response.status_code == 422


def test_preferences_saves_overview_card_size(auth_client):
    response = auth_client.put("/api/auth/me/preferences", json={"overviewCardSize": 1.5})

    assert response.status_code == 200
    assert response.json()["overviewCardSize"] == 1.5

    me = auth_client.get("/api/auth/me")
    assert me.json()["overviewCardSize"] == 1.5


def test_preferences_rejects_out_of_range_card_size(auth_client):
    response = auth_client.put("/api/auth/me/preferences", json={"overviewCardSize": 3.0})

    assert response.status_code == 422
