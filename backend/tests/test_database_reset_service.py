from sqlalchemy import select

from app.models.catalog import Game, GameCategory
from app.models.library import LibraryItem, LibraryStatus, MediaFormat
from app.models.playnite import PlayniteLibraryEntry
from app.models.steam import SteamLibraryEntry
from app.repositories import playnite_repository
from app.services import database_reset_service


def _seed(db_session):
    game = Game(name="Hollow Knight", category=GameCategory.MAIN_GAME)
    db_session.add(game)
    db_session.flush()
    db_session.add(
        LibraryItem(
            game_id=game.id,
            status=LibraryStatus.OWNED,
            format=MediaFormat.DIGITAL,
        )
    )
    playnite_repository.upsert_entry(db_session, "abc-123", "Hollow Knight", "PC", 120, None)
    db_session.add(SteamLibraryEntry(steam_app_id=12345, steam_name="Hollow Knight"))
    db_session.commit()
    return game


def test_reset_deletes_games_and_sync_caches(db_session):
    _seed(db_session)

    result = database_reset_service.reset_database(db_session)

    assert result["games_deleted"] == 1
    assert result["library_items_deleted"] == 1
    assert db_session.scalars(select(Game)).all() == []
    assert db_session.scalars(select(LibraryItem)).all() == []
    assert db_session.scalars(select(PlayniteLibraryEntry)).all() == []
    assert db_session.scalars(select(SteamLibraryEntry)).all() == []


def test_reset_empty_database_is_noop(db_session):
    result = database_reset_service.reset_database(db_session)

    assert result == {"games_deleted": 0, "library_items_deleted": 0}
