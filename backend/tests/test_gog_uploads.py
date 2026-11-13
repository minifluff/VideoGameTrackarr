from app.models.catalog import Game, GameCategory, Platform
from app.models.gog import GogDownload
from app.models.library import LibraryItem, LibraryStatus, MediaFormat
from app.services import gog_download_service, gog_service

FILENAME = "setup_game_1.0.exe"
INSTALLER_BYTES = b"fake-drm-free-installer-bytes"
INSTALLER_BYTES_V2 = b"fake-drm-free-installer-bytes-v2"


def _seed_drm_free_game(db_session):
    game = Game(igdb_id=101, name="DRM-Free Game", slug="drm-free-game", category=GameCategory.MAIN_GAME)
    db_session.add(game)
    platform = Platform(name="PC (Microsoft Windows)", slug="win")
    db_session.add(platform)
    db_session.commit()
    db_session.add(
        LibraryItem(
            game_id=game.id,
            platform_id=platform.id,
            status=LibraryStatus.OWNED,
            format=MediaFormat.DIGITAL,
            digital_storefront="DRM-Free",
        )
    )
    db_session.commit()
    return game


def _seed_format_game(
    db_session, name, slug, igdb_id, format, storefront=None, status=LibraryStatus.OWNED
):
    game = Game(igdb_id=igdb_id, name=name, slug=slug, category=GameCategory.MAIN_GAME)
    db_session.add(game)
    platform = Platform(name="PC (Microsoft Windows)", slug="win")
    db_session.add(platform)
    db_session.commit()
    db_session.add(
        LibraryItem(
            game_id=game.id,
            platform_id=platform.id,
            status=status,
            format=format,
            digital_storefront=storefront,
        )
    )
    db_session.commit()
    return game


def _seed_plain_game(db_session):
    game = Game(igdb_id=102, name="Plain Game", slug="plain-game", category=GameCategory.MAIN_GAME)
    db_session.add(game)
    db_session.commit()
    return game


def _upload(auth_client, game_id, content=INSTALLER_BYTES, filename=FILENAME):
    return auth_client.post(
        f"/api/integrations/gog/games/{game_id}/installers/upload",
        files={"file": (filename, content, "application/octet-stream")},
    )


def test_upload_installer_requires_auth(client, db_session):
    game = _seed_drm_free_game(db_session)

    response = _upload(client, game.id)

    assert response.status_code == 401


def test_upload_installer_stores_file_and_lists_it(auth_client, db_session, tmp_path, monkeypatch):
    monkeypatch.setattr(gog_download_service, "UPLOADS_DIR", tmp_path / "uploads")
    game = _seed_drm_free_game(db_session)

    response = _upload(auth_client, game.id)

    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "completed"
    assert body["filename"] == FILENAME
    assert body["totalSize"] == len(INSTALLER_BYTES)
    stored = gog_download_service.get_uploaded_downloads_dir(game.id) / FILENAME
    assert stored.read_bytes() == INSTALLER_BYTES

    listed = auth_client.get(f"/api/integrations/gog/games/{game.id}/installers")
    assert listed.status_code == 200
    payload = listed.json()
    assert payload["gogProductId"] is None
    assert payload["groups"] == []
    [uploaded] = payload["uploadedFiles"]
    assert uploaded["filename"] == FILENAME
    assert uploaded["size"] == len(INSTALLER_BYTES)
    assert uploaded["fileId"] == body["fileId"]


def test_upload_installer_replaces_same_filename(auth_client, db_session, tmp_path, monkeypatch):
    monkeypatch.setattr(gog_download_service, "UPLOADS_DIR", tmp_path / "uploads")
    game = _seed_drm_free_game(db_session)
    first = _upload(auth_client, game.id)
    assert first.status_code == 201

    second = _upload(auth_client, game.id, content=INSTALLER_BYTES_V2)

    assert second.status_code == 201
    assert second.json()["fileId"] == first.json()["fileId"]
    stored = gog_download_service.get_uploaded_downloads_dir(game.id) / FILENAME
    assert stored.read_bytes() == INSTALLER_BYTES_V2
    rows = db_session.query(GogDownload).filter_by(game_id=game.id).all()
    assert len(rows) == 1
    listed = auth_client.get(f"/api/integrations/gog/games/{game.id}/installers").json()
    assert len(listed["uploadedFiles"]) == 1


def test_upload_installer_requires_uploadable_copy(auth_client, db_session, tmp_path, monkeypatch):
    monkeypatch.setattr(gog_download_service, "UPLOADS_DIR", tmp_path / "uploads")
    plain = _seed_plain_game(db_session)

    response = _upload(auth_client, plain.id)

    assert response.status_code == 404
    listed = auth_client.get(f"/api/integrations/gog/games/{plain.id}/installers")
    assert listed.status_code == 404


def test_upload_installer_works_for_abandonware_copy(auth_client, db_session, tmp_path, monkeypatch):
    monkeypatch.setattr(gog_download_service, "UPLOADS_DIR", tmp_path / "uploads")
    game = _seed_format_game(
        db_session, "Abandonware Game", "abandonware-game", 103, MediaFormat.ABANDONWARE
    )

    response = _upload(auth_client, game.id)

    assert response.status_code == 201
    assert response.json()["status"] == "completed"
    listed = auth_client.get(f"/api/integrations/gog/games/{game.id}/installers").json()
    assert listed["gogProductId"] is None
    assert listed["groups"] == []
    [uploaded] = listed["uploadedFiles"]
    assert uploaded["filename"] == FILENAME


def test_upload_installer_works_for_other_copy(auth_client, db_session, tmp_path, monkeypatch):
    monkeypatch.setattr(gog_download_service, "UPLOADS_DIR", tmp_path / "uploads")
    game = _seed_format_game(db_session, "Other Game", "other-game", 104, MediaFormat.OTHER)

    response = _upload(auth_client, game.id)

    assert response.status_code == 201
    listed = auth_client.get(f"/api/integrations/gog/games/{game.id}/installers").json()
    assert len(listed["uploadedFiles"]) == 1


def test_upload_installer_rejects_wishlist_copy(auth_client, db_session, tmp_path, monkeypatch):
    monkeypatch.setattr(gog_download_service, "UPLOADS_DIR", tmp_path / "uploads")
    game = _seed_format_game(
        db_session,
        "Wishlist DRM-Free Game",
        "wishlist-drm-free-game",
        105,
        MediaFormat.DIGITAL,
        storefront="DRM-Free",
        status=LibraryStatus.WISHLIST,
    )

    response = _upload(auth_client, game.id)

    assert response.status_code == 404


def test_installers_list_for_drm_free_game_never_calls_gog(
    auth_client, db_session, tmp_path, monkeypatch
):
    """A DRM-Free game has no GOG product, so listing its installers must not
    touch the GOG API at all — not even a token refresh."""
    monkeypatch.setattr(gog_download_service, "UPLOADS_DIR", tmp_path / "uploads")
    game = _seed_drm_free_game(db_session)
    assert _upload(auth_client, game.id).status_code == 201

    def _boom(*args, **kwargs):
        raise AssertionError("GOG API must not be called for a DRM-Free game")

    monkeypatch.setattr(gog_service, "client_for_user", _boom)

    response = auth_client.get(f"/api/integrations/gog/games/{game.id}/installers")

    assert response.status_code == 200
    assert len(response.json()["uploadedFiles"]) == 1


def test_uploaded_file_link_serves_the_file(
    client, auth_client, db_session, tmp_path, monkeypatch
):
    monkeypatch.setattr(gog_download_service, "UPLOADS_DIR", tmp_path / "uploads")
    game = _seed_drm_free_game(db_session)
    uploaded = _upload(auth_client, game.id)
    assert uploaded.status_code == 201
    file_id = uploaded.json()["fileId"]

    link = auth_client.post(
        f"/api/integrations/gog/games/{game.id}/installers/{file_id}/file-link"
    )

    assert link.status_code == 200
    url = link.json()["url"]
    assert url.startswith(f"/api/integrations/gog/games/{game.id}/installers/{file_id}/file/")
    client.headers.pop("Authorization", None)
    downloaded = client.get(url)
    assert downloaded.status_code == 200
    assert downloaded.content == INSTALLER_BYTES
    assert FILENAME in downloaded.headers["content-disposition"]


def test_uploaded_file_link_is_404_before_any_upload(auth_client, db_session):
    game = _seed_drm_free_game(db_session)

    response = auth_client.post(
        f"/api/integrations/gog/games/{game.id}/installers/nope/file-link"
    )

    assert response.status_code == 404
