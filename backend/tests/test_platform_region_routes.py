def test_list_platforms_requires_auth(client):
    response = client.get("/api/platforms")

    assert response.status_code == 401


def test_list_platforms_returns_seeded_platform(auth_client, seed_platform):
    response = auth_client.get("/api/platforms")

    assert response.status_code == 200
    body = response.json()
    assert body == [
        {
            "id": seed_platform.id,
            "name": "PlayStation 5",
            "slug": "ps5",
            "abbreviation": None,
            "gameCount": 0,
        }
    ]


def test_list_regions_requires_auth(client):
    response = client.get("/api/regions")

    assert response.status_code == 401


def test_list_regions_returns_seeded_region(auth_client, seed_region):
    response = auth_client.get("/api/regions")

    assert response.status_code == 200
    assert response.json() == [{"id": seed_region.id, "name": "PAL"}]


def test_list_platforms_counts_browsable_games(auth_client, db_session, seed_platform):
    from app.models.catalog import Game, GameCategory, GamePlatform

    game = Game(name="Zelda", slug="zelda", category=GameCategory.MAIN_GAME)
    addon = Game(name="Zelda DLC", slug="zelda-dlc", category=GameCategory.DLC_ADDON)
    db_session.add_all([game, addon])
    db_session.flush()
    addon.parent_game_id = game.id
    db_session.add_all(
        [
            GamePlatform(game_id=game.id, platform_id=seed_platform.id),
            GamePlatform(game_id=addon.id, platform_id=seed_platform.id),
        ]
    )
    db_session.commit()

    body = auth_client.get("/api/platforms").json()

    # Only the browsable top-level game counts — the addon doesn't inflate it.
    assert body[0]["gameCount"] == 1


def test_get_platform_requires_auth(client):
    response = client.get("/api/platforms/ps5")

    assert response.status_code == 401


def test_get_platform_404_for_missing(auth_client):
    response = auth_client.get("/api/platforms/no-such-platform")

    assert response.status_code == 404


def test_get_platform_returns_games_on_platform(auth_client, db_session, seed_platform, seed_game):
    from app.models.catalog import Game, GameCategory, GamePlatform

    other_game = Game(name="Unrelated", slug="unrelated", category=GameCategory.MAIN_GAME)
    db_session.add(other_game)
    db_session.flush()
    db_session.add(GamePlatform(game_id=seed_game.id, platform_id=seed_platform.id))
    db_session.commit()

    response = auth_client.get(f"/api/platforms/{seed_platform.slug}")

    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "PlayStation 5"
    assert [game["id"] for game in body["games"]] == [seed_game.id]
    assert body["addons"] == []


def test_list_platform_addons_returns_addons_of_platform_games(
    auth_client, db_session, seed_platform, seed_game
):
    from app.models.catalog import Game, GameCategory, GamePlatform
    from app.models.library import LibraryStatus, LibraryItem

    addon = Game(name="Test Game DLC", slug="test-game-dlc", category=GameCategory.DLC_ADDON)
    db_session.add(addon)
    db_session.flush()
    addon.parent_game_id = seed_game.id
    db_session.add(GamePlatform(game_id=seed_game.id, platform_id=seed_platform.id))
    db_session.add(LibraryItem(game_id=seed_game.id, status=LibraryStatus.OWNED))
    db_session.commit()

    response = auth_client.get(f"/api/platforms/{seed_platform.slug}/addons")

    assert response.status_code == 200
    assert [game["id"] for game in response.json()] == [addon.id]


def test_games_list_required_platform_id_filters(auth_client, db_session, seed_platform, seed_game):
    from app.models.catalog import Game, GameCategory, GamePlatform

    other_game = Game(name="Unrelated", slug="unrelated", category=GameCategory.MAIN_GAME)
    db_session.add(other_game)
    db_session.flush()
    db_session.add(GamePlatform(game_id=seed_game.id, platform_id=seed_platform.id))
    db_session.commit()

    response = auth_client.get("/api/games", params={"requiredPlatformId": seed_platform.id})

    assert response.status_code == 200
    assert [game["id"] for game in response.json()] == [seed_game.id]
