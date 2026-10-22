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


def test_upload_spine_downscales_oversized_image(auth_client):
    # Regression: the downscale branch (long edge > SPINE_MAX_EDGE) once called
    # Image.thumbnail() with a `method=` kwarg Pillow doesn't accept — small
    # test images never reached that branch, so it shipped broken and only a
    # real full-size upload (e.g. a platform template) hit the 500.
    buffer = BytesIO()
    Image.new("RGB", (100, 2000), color=(10, 90, 10)).save(buffer, format="JPEG")

    response = auth_client.post(
        "/api/uploads/spines", files={"file": ("big.jpg", buffer.getvalue(), "image/jpeg")}
    )
    assert response.status_code == 201
    url = response.json()["url"]

    from app.core.config import UPLOADS_DIR

    with Image.open(UPLOADS_DIR / "spines" / url.rsplit("/", 1)[-1]) as stored:
        assert max(stored.size) == 1200


def test_upload_spine_preserves_transparency_as_png(auth_client):
    # Regression: a platform logo uploaded as a spine icon is a transparent
    # PNG, but the saver flattened everything through JPEG — convert("RGB")
    # drops the alpha channel and the raw RGB under transparent pixels is
    # usually black, so logos rendered with a black box around the glyph.
    buffer = BytesIO()
    logo = Image.new("RGBA", (60, 60), color=(0, 0, 0, 0))
    for x in range(20, 40):
        for y in range(15, 45):
            logo.putpixel((x, y), (255, 255, 255, 255))
    logo.save(buffer, format="PNG")

    response = auth_client.post(
        "/api/uploads/spines", files={"file": ("logo.png", buffer.getvalue(), "image/png")}
    )
    assert response.status_code == 201
    url = response.json()["url"]
    assert url.endswith(".png")

    from app.core.config import UPLOADS_DIR

    with Image.open(UPLOADS_DIR / "spines" / url.rsplit("/", 1)[-1]) as stored:
        assert stored.mode == "RGBA"
        assert stored.getpixel((0, 0))[3] == 0
        assert stored.getpixel((30, 30)) == (255, 255, 255, 255)


def test_upload_spine_fully_opaque_rgba_still_jpeg(auth_client):
    # An alpha channel that never actually goes transparent changes nothing:
    # opaque uploads keep the JPEG encoding spine scans have always used.
    buffer = BytesIO()
    Image.new("RGBA", (60, 400), color=(30, 30, 120, 255)).save(buffer, format="PNG")

    response = auth_client.post(
        "/api/uploads/spines", files={"file": ("spine.png", buffer.getvalue(), "image/png")}
    )
    assert response.status_code == 201
    assert response.json()["url"].endswith(".jpg")


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
