"""Spine art (Bookshelf mode): per-game set/clear, spine upload, and the
LaunchBox-layout bulk import."""

from io import BytesIO

from PIL import Image

from app.models.catalog import Game, GameCategory, GamePlatform


def _jpeg_bytes() -> bytes:
    buffer = BytesIO()
    Image.new("RGB", (60, 400), color=(30, 30, 120)).save(buffer, format="JPEG")
    return buffer.getvalue()


def test_set_and_clear_spine_on_igdb_linked_game(auth_client, seed_game):
    response = auth_client.put(
        f"/api/games/{seed_game.id}/spine", json={"spineUrl": "/uploads/spines/abc.jpg"}
    )
    assert response.status_code == 200
    assert response.json()["spineUrl"] == "/uploads/spines/abc.jpg"

    response = auth_client.put(f"/api/games/{seed_game.id}/spine", json={"spineUrl": None})
    assert response.status_code == 200
    assert response.json()["spineUrl"] is None


def test_set_spine_404_for_missing_game(auth_client):
    response = auth_client.put("/api/games/999999/spine", json={"spineUrl": "/uploads/spines/x.jpg"})
    assert response.status_code == 404


def test_game_summary_includes_spine_url(auth_client, seed_game):
    auth_client.put(f"/api/games/{seed_game.id}/spine", json={"spineUrl": "https://example.com/s.jpg"})

    [entry] = [g for g in auth_client.get("/api/games").json() if g["id"] == seed_game.id]
    assert entry["spineUrl"] == "https://example.com/s.jpg"


def test_upload_spine_returns_servable_url(auth_client):
    response = auth_client.post(
        "/api/uploads/spines", files={"file": ("spine.png", _jpeg_bytes(), "image/jpeg")}
    )
    assert response.status_code == 201
    assert response.json()["url"].startswith("/uploads/spines/")


def test_upload_spine_rejects_non_image(auth_client):
    response = auth_client.post(
        "/api/uploads/spines", files={"file": ("spine.png", b"not an image", "image/png")}
    )
    assert response.status_code == 400


def test_spine_import_matches_launchbox_layout(auth_client, db_session, seed_game, seed_platform):
    db_session.add(GamePlatform(game_id=seed_game.id, platform_id=seed_platform.id))
    db_session.commit()

    response = auth_client.post(
        "/api/games/spine-import",
        files=[
            (
                "files",
                ("LaunchBox/PlayStation 5/Box - Spine/Test Game.jpg", _jpeg_bytes(), "image/jpeg"),
            ),
            (
                "files",
                ("LaunchBox/PlayStation 5/Box - Spine/Not In Library.jpg", _jpeg_bytes(), "image/jpeg"),
            ),
            ("files", ("random/loose-file.jpg", _jpeg_bytes(), "image/jpeg")),
        ],
    )

    assert response.status_code == 200
    body = response.json()
    assert [entry["gameId"] for entry in body["matched"]] == [seed_game.id]
    assert len(body["unmatched"]) == 2

    detail = auth_client.get(f"/api/games/{seed_game.slug}").json()
    assert detail["spineUrl"].startswith("/uploads/spines/")


def test_spine_import_reports_ambiguous_title_platform_pairs(
    auth_client, db_session, seed_game, seed_platform
):
    duplicate = Game(igdb_id=2002, name="Test Game", category=GameCategory.MAIN_GAME)
    db_session.add(duplicate)
    db_session.commit()
    db_session.add_all(
        [
            GamePlatform(game_id=seed_game.id, platform_id=seed_platform.id),
            GamePlatform(game_id=duplicate.id, platform_id=seed_platform.id),
        ]
    )
    db_session.commit()

    response = auth_client.post(
        "/api/games/spine-import",
        files=[
            (
                "files",
                ("LaunchBox/PlayStation 5/Box - Spine/Test Game.jpg", _jpeg_bytes(), "image/jpeg"),
            )
        ],
    )

    assert response.status_code == 200
    body = response.json()
    assert body["matched"] == []
    assert len(body["ambiguous"]) == 1
