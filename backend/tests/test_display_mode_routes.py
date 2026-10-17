from app.models.catalog import Game, GameCategory
from app.models.library import LibraryItem, LibraryStatus


def _make_game(db_session, name, cover_url=None, hide_from_public=False):
    game = Game(
        name=name,
        category=GameCategory.MAIN_GAME,
        cover_url=cover_url,
        hide_from_public=hide_from_public,
    )
    db_session.add(game)
    db_session.commit()
    return game


def test_slides_requires_auth(client, db_session):
    response = client.get("/api/display-mode/slides")

    assert response.status_code == 401


def test_slides_empty_library_returns_empty_list(auth_client):
    response = auth_client.get("/api/display-mode/slides")

    assert response.status_code == 200
    assert response.json() == []


def test_slides_returns_only_owned_visible_games_with_covers(auth_client, db_session):
    owned = _make_game(db_session, "Owned Game", cover_url="https://example.com/a.jpg")
    db_session.add(LibraryItem(game_id=owned.id, status=LibraryStatus.OWNED))
    wishlisted = _make_game(db_session, "Wishlisted Game", cover_url="https://example.com/b.jpg")
    db_session.add(LibraryItem(game_id=wishlisted.id, status=LibraryStatus.WISHLIST))
    no_cover = _make_game(db_session, "No Cover Game")
    db_session.add(LibraryItem(game_id=no_cover.id, status=LibraryStatus.OWNED))
    hidden = _make_game(
        db_session, "Hidden Game", cover_url="https://example.com/c.jpg", hide_from_public=True
    )
    db_session.add(LibraryItem(game_id=hidden.id, status=LibraryStatus.OWNED))
    db_session.commit()

    response = auth_client.get("/api/display-mode/slides")

    assert response.status_code == 200
    slides = response.json()
    assert len(slides) == 1
    assert slides[0]["name"] == "Owned Game"
    assert slides[0]["coverUrl"] == "https://example.com/a.jpg"
    assert slides[0]["id"] == owned.id


def test_slides_respects_limit(auth_client, db_session):
    for i in range(5):
        game = _make_game(db_session, f"Game {i}", cover_url=f"https://example.com/{i}.jpg")
        db_session.add(LibraryItem(game_id=game.id, status=LibraryStatus.OWNED))
    db_session.commit()

    response = auth_client.get("/api/display-mode/slides", params={"limit": 3})

    assert response.status_code == 200
    assert len(response.json()) == 3


def test_slides_includes_hidden_and_wishlisted_when_allowed(auth_client, db_session):
    hidden = _make_game(
        db_session, "Hidden Game", cover_url="https://example.com/h.jpg", hide_from_public=True
    )
    db_session.add(LibraryItem(game_id=hidden.id, status=LibraryStatus.OWNED))
    wishlisted = _make_game(db_session, "Wishlisted Game", cover_url="https://example.com/w.jpg")
    db_session.add(LibraryItem(game_id=wishlisted.id, status=LibraryStatus.WISHLIST))
    db_session.commit()

    auth_client.put(
        "/api/settings/display-mode",
        json={"showHidden": True, "showWishlisted": True},
    )
    response = auth_client.get("/api/display-mode/slides")

    assert response.status_code == 200
    names = {slide["name"] for slide in response.json()}
    assert names == {"Hidden Game", "Wishlisted Game"}


def test_display_mode_settings_defaults(auth_client):
    response = auth_client.get("/api/settings/display-mode")

    assert response.status_code == 200
    assert response.json() == {
        "slideIntervalSeconds": 10,
        "showTitle": True,
        "showHidden": False,
        "showWishlisted": False,
    }


def test_display_mode_settings_update(auth_client):
    response = auth_client.put(
        "/api/settings/display-mode",
        json={
            "slideIntervalSeconds": 30,
            "showTitle": False,
            "showHidden": True,
            "showWishlisted": True,
        },
    )

    assert response.status_code == 200
    assert response.json() == {
        "slideIntervalSeconds": 30,
        "showTitle": False,
        "showHidden": True,
        "showWishlisted": True,
    }

    # Persisted
    again = auth_client.get("/api/settings/display-mode")
    assert again.json() == {
        "slideIntervalSeconds": 30,
        "showTitle": False,
        "showHidden": True,
        "showWishlisted": True,
    }


def test_display_mode_settings_rejects_out_of_range_interval(auth_client):
    response = auth_client.put(
        "/api/settings/display-mode", json={"slideIntervalSeconds": 2}
    )

    assert response.status_code == 422
