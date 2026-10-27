from app.models.catalog import Game, GameCategory
from app.models.library import LibraryItem, LibraryStatus


def test_clear_missing_games_requires_auth(client):
    response = client.post("/api/system/clear-missing-games", json={"confirmation": "confirm"})

    assert response.status_code == 401


def test_clear_missing_games_rejects_bad_confirmation(auth_client):
    response = auth_client.post("/api/system/clear-missing-games", json={"confirmation": "yes"})

    assert response.status_code == 400


def test_clear_missing_games_deletes_only_missing(auth_client, db_session, seed_game, seed_platform):
    db_session.add(LibraryItem(game_id=seed_game.id, platform_id=seed_platform.id, status=LibraryStatus.OWNED))
    manual_game = Game(name="Manual Game", category=GameCategory.MAIN_GAME)
    wishlisted_game = Game(igdb_id=5005, name="Wishlisted Game", category=GameCategory.MAIN_GAME)
    db_session.add(manual_game)
    db_session.add(wishlisted_game)
    db_session.commit()
    db_session.add(LibraryItem(game_id=wishlisted_game.id, status=LibraryStatus.WISHLIST))
    # Auto-discovered but claimed (owned copy) — not missing, must survive.
    claimed_discovery = Game(
        igdb_id=6006, name="Claimed Discovery", category=GameCategory.MAIN_GAME, auto_discovered=True
    )
    db_session.add(claimed_discovery)
    db_session.commit()
    db_session.add(LibraryItem(game_id=claimed_discovery.id, status=LibraryStatus.OWNED))
    missing_game = Game(
        igdb_id=7007, name="Missing Game", category=GameCategory.MAIN_GAME, auto_discovered=True
    )
    db_session.add(missing_game)
    db_session.commit()
    missing_addon = Game(
        name="Missing Addon",
        category=GameCategory.DLC_ADDON,
        parent_game_id=missing_game.id,
        auto_discovered=True,
    )
    db_session.add(missing_addon)
    db_session.commit()
    # Capture plain ids now: after the request deletes the rows, touching the
    # attached instances' attributes raises ObjectDeletedError.
    missing_game_id = missing_game.id
    missing_addon_id = missing_addon.id
    keep_ids = [seed_game.id, manual_game.id, wishlisted_game.id, claimed_discovery.id]

    response = auth_client.post("/api/system/clear-missing-games", json={"confirmation": "confirm"})

    assert response.status_code == 200
    assert response.json() == {"gamesDeleted": 1}
    db_session.expire_all()
    assert db_session.get(Game, missing_game_id) is None
    assert db_session.get(Game, missing_addon_id) is None
    for game_id in keep_ids:
        assert db_session.get(Game, game_id) is not None
