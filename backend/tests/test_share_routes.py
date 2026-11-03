def test_get_share_link_requires_auth(client):
    response = client.get("/api/share-link")

    assert response.status_code == 401


def test_get_share_link_generates_a_token_on_first_call(auth_client):
    response = auth_client.get("/api/share-link")

    assert response.status_code == 200
    token = response.json()["token"]
    assert len(token) > 20


def test_get_share_link_returns_the_same_token_on_repeat_calls(auth_client):
    first = auth_client.get("/api/share-link").json()["token"]
    second = auth_client.get("/api/share-link").json()["token"]

    assert first == second


def test_regenerate_share_link_requires_auth(client):
    response = client.post("/api/share-link/regenerate")

    assert response.status_code == 401


def test_regenerate_share_link_issues_a_new_token(auth_client):
    original = auth_client.get("/api/share-link").json()["token"]

    response = auth_client.post("/api/share-link/regenerate")

    assert response.status_code == 200
    new_token = response.json()["token"]
    assert new_token != original
    assert auth_client.get("/api/share-link").json()["token"] == new_token


def test_public_collection_link_is_unauthenticated_and_null_without_a_user(client):
    response = client.get("/api/public-collection-link")

    assert response.status_code == 200
    assert response.json()["token"] is None


def test_public_collection_link_returns_the_admin_token_unauthenticated(auth_client):
    token = auth_client.get("/api/share-link").json()["token"]

    # auth_client is the same client with an Authorization header — drop it to prove
    # the endpoint needs no auth.
    auth_client.headers.pop("Authorization", None)
    response = auth_client.get("/api/public-collection-link")

    assert response.status_code == 200
    assert response.json()["token"] == token


def test_public_collection_link_does_not_mint_a_token(auth_client):
    # The admin exists but has no share link yet: the public endpoint reports null —
    # and since it returns whatever is stored, null proves it stored nothing — instead
    # of creating a token for an anonymous caller.
    assert auth_client.get("/api/public-collection-link").json()["token"] is None
