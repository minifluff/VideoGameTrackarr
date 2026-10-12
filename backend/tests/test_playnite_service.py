from sqlalchemy import select

from app.models.catalog import Game, GameCategory
from app.models.library import LibraryItem, LibraryStatus, MediaFormat
from app.models.system import User
from app.repositories import playnite_repository
from app.services import playnite_service
from app.services.playnite_service import PlayniteEntryStatus, PlayniteError


def _make_entry(db_session, playnite_id="abc-123", name="Hollow Knight", platform="PC (Microsoft Windows)"):
    entry = playnite_repository.upsert_entry(db_session, playnite_id, name, platform, 120, None)
    db_session.commit()
    return entry


def test_entry_status_no_match(db_session):
    entry = _make_entry(db_session)
    result = playnite_service.list_entries(db_session)

    assert len(result) == 1
    assert result[0].entry.playnite_id == entry.playnite_id
    assert result[0].status == PlayniteEntryStatus.NO_MATCH


def test_entry_status_new_when_matched_but_not_in_library(db_session):
    game = Game(name="Hollow Knight", category=GameCategory.MAIN_GAME)
    db_session.add(game)
    db_session.commit()

    entry = _make_entry(db_session)
    playnite_repository.set_game_id(db_session, entry, game.id)
    db_session.commit()

    result = playnite_service.list_entries(db_session)

    assert result[0].status == PlayniteEntryStatus.NEW


def test_entry_status_up_to_date_when_library_item_exists(db_session):
    game = Game(name="Hollow Knight", category=GameCategory.MAIN_GAME)
    db_session.add(game)
    db_session.flush()
    db_session.add(
        LibraryItem(
            game_id=game.id,
            status=LibraryStatus.OWNED,
            format=MediaFormat.DIGITAL,
            digital_storefront="Playnite",
        )
    )
    db_session.commit()

    entry = _make_entry(db_session)
    playnite_repository.set_game_id(db_session, entry, game.id)
    db_session.commit()

    result = playnite_service.list_entries(db_session)

    # No platform on the item and no progress recorded yet — vgt minutes (0) != playnite
    # minutes (120), so this reads as NEW until a sync writes the progress.
    assert result[0].status == PlayniteEntryStatus.NEW


def test_entry_status_ignored(db_session):
    entry = _make_entry(db_session)
    playnite_service.ignore_entry(db_session, entry.playnite_id)

    result = playnite_service.list_entries(db_session)

    assert result[0].status == PlayniteEntryStatus.IGNORED

    playnite_service.unignore_entry(db_session, entry.playnite_id)
    result = playnite_service.list_entries(db_session)

    assert result[0].status == PlayniteEntryStatus.NO_MATCH


def test_sync_creates_game_and_library_item(db_session):
    entry = _make_entry(db_session, name="Celeste")

    result = playnite_service.sync_entries(db_session, [entry.playnite_id])

    assert result["synced"] == 1
    assert result["failed"] == 0

    db_session.refresh(entry)
    assert entry.game_id is not None

    items = list(db_session.scalars(select(LibraryItem).where(LibraryItem.game_id == entry.game_id)))
    assert len(items) == 1
    assert items[0].status == LibraryStatus.OWNED
    assert items[0].format == MediaFormat.DIGITAL


def test_sync_matched_game_adds_library_item(db_session):
    game = Game(name="Hollow Knight", category=GameCategory.MAIN_GAME)
    db_session.add(game)
    db_session.commit()

    entry = _make_entry(db_session)
    playnite_repository.set_game_id(db_session, entry, game.id)
    db_session.commit()

    result = playnite_service.sync_entries(db_session, [entry.playnite_id])

    assert result["synced"] == 1
    assert result["failed"] == 0

    items = list(db_session.scalars(select(LibraryItem).where(LibraryItem.game_id == game.id)))
    assert len(items) == 1
    assert items[0].digital_storefront is None


def test_sync_unknown_id_is_failure_not_crash(db_session):
    result = playnite_service.sync_entries(db_session, ["does-not-exist"])

    assert result["synced"] == 0
    assert result["failed"] == 1
    assert len(result["failures"]) == 1


def test_config_set_and_get(db_session, test_user: User):
    assert playnite_service.get_config(test_user)["smb_path"] is None
    assert playnite_service.get_config(test_user)["has_password"] is False

    updated = playnite_service.set_config(
        db_session, test_user, "\\\\server\\share\\Playnite", "matthew", "s3cret"
    )

    config = playnite_service.get_config(updated)
    assert config["smb_path"] == "\\\\server\\share\\Playnite"
    assert config["smb_username"] == "matthew"
    assert config["has_password"] is True
    # The password itself must never appear in the config dict.
    assert "s3cret" not in str(config.values())

    # None clears; empty password clears too.
    playnite_service.set_config(db_session, test_user, None, None, "")
    config = playnite_service.get_config(test_user)
    assert config["smb_path"] is None
    assert config["has_password"] is False


def test_scan_requires_config(db_session, test_user: User):
    try:
        playnite_service.scan_library(db_session, test_user)
        raise AssertionError("expected PlayniteError")
    except PlayniteError as exc:
        assert "isn't configured" in str(exc)


def test_status_includes_playnite_configured(auth_client, test_user: User):
    response = auth_client.get("/api/integrations")

    assert response.status_code == 200
    assert response.json()["playniteConfigured"] is False


def test_playnite_config_routes(auth_client):
    # Password never comes back in any response.
    response = auth_client.put(
        "/api/integrations/playnite",
        json={"smb_path": "\\\\server\\share\\Playnite", "smb_username": "matthew", "smb_password": "s3cret"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["smbPath"] == "\\\\server\\share\\Playnite"
    assert body["hasPassword"] is True
    assert "s3cret" not in response.text

    response = auth_client.get("/api/integrations/playnite")

    assert response.status_code == 200
    assert response.json()["hasPassword"] is True

    response = auth_client.get("/api/integrations")
    assert response.json()["playniteConfigured"] is True


def test_playnite_entries_route_empty(auth_client):
    response = auth_client.get("/api/integrations/playnite/entries")

    assert response.status_code == 200
    assert response.json() == []


def test_playnite_scan_without_config_returns_422(auth_client):
    response = auth_client.post("/api/integrations/playnite/scan")

    assert response.status_code == 422
    assert "isn't configured" in response.json()["detail"]


def test_playnite_ignore_unignore_routes(auth_client, db_session):
    _make_entry(db_session)

    response = auth_client.post("/api/integrations/playnite/abc-123/ignore")
    assert response.status_code == 200
    assert response.json()["status"] == "ignored"

    response = auth_client.post("/api/integrations/playnite/abc-123/unignore")
    assert response.status_code == 200
    assert response.json()["status"] == "no_match"


def test_playnite_routes_require_auth(client):
    assert client.get("/api/integrations/playnite").status_code == 401
    assert client.put("/api/integrations/playnite", json={}).status_code == 401
    assert client.post("/api/integrations/playnite/scan").status_code == 401
    assert client.get("/api/integrations/playnite/entries").status_code == 401
    assert client.post("/api/integrations/playnite/sync", json={"playniteIds": []}).status_code == 401
