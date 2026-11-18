from datetime import date

from app.models.catalog import Game, GameCategory
from app.models.itad import ItadPriceCache
from app.models.library import GameProgress, LibraryItem, LibraryStatus
from app.models.platprices import PlatPricesCache


def test_add_library_item_requires_auth(client, seed_game):
    response = client.post(f"/api/games/{seed_game.id}/library", json={"status": "owned"})

    assert response.status_code == 401


def test_add_library_item_404_for_missing_game(auth_client):
    response = auth_client.post("/api/games/999999/library", json={"status": "owned"})

    assert response.status_code == 404


def test_add_owned_library_item(auth_client, seed_game, seed_platform, seed_region):
    response = auth_client.post(
        f"/api/games/{seed_game.id}/library",
        json={
            "status": "owned",
            "platformId": seed_platform.id,
            "regionId": seed_region.id,
            "format": "physical",
            "edition": "Game of the Year",
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["gameId"] == seed_game.id
    assert body["status"] == "owned"
    assert body["platformName"] == "PlayStation 5"
    assert body["platformSlug"] == "ps5"
    assert body["regionName"] == "PAL"
    assert body["format"] == "physical"
    assert body["edition"] == "Game of the Year"


def test_add_wishlist_item_with_no_platform(auth_client, seed_game):
    response = auth_client.post(f"/api/games/{seed_game.id}/library", json={"status": "wishlist"})

    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "wishlist"
    assert body["platformId"] is None


def test_list_library_items_filters_by_status(auth_client, seed_game):
    auth_client.post(f"/api/games/{seed_game.id}/library", json={"status": "owned"})
    auth_client.post(f"/api/games/{seed_game.id}/library", json={"status": "wishlist"})

    owned = auth_client.get(f"/api/games/{seed_game.id}/library", params={"status": "owned"})
    everything = auth_client.get(f"/api/games/{seed_game.id}/library")

    assert [i["status"] for i in owned.json()] == ["owned"]
    assert sorted(i["status"] for i in everything.json()) == ["owned", "wishlist"]


def test_update_library_item_moves_wishlist_to_owned(auth_client, seed_game):
    created = auth_client.post(f"/api/games/{seed_game.id}/library", json={"status": "wishlist"}).json()

    response = auth_client.put(f"/api/library/{created['id']}", json={"status": "owned"})

    assert response.status_code == 200
    assert response.json()["status"] == "owned"


def test_update_library_item_partial_update_does_not_clobber_other_fields(auth_client, seed_game, seed_platform):
    created = auth_client.post(
        f"/api/games/{seed_game.id}/library",
        json={"status": "owned", "platformId": seed_platform.id, "edition": "Deluxe"},
    ).json()

    response = auth_client.put(f"/api/library/{created['id']}", json={"notes": "Bought on sale"})

    assert response.status_code == 200
    body = response.json()
    assert body["edition"] == "Deluxe"
    assert body["platformId"] == seed_platform.id
    assert body["notes"] == "Bought on sale"


def test_add_library_item_with_price(auth_client, seed_game):
    response = auth_client.post(f"/api/games/{seed_game.id}/library", json={"status": "owned", "price": 59.99})

    assert response.status_code == 201
    assert response.json()["price"] == 59.99


def test_update_library_item_sets_price(auth_client, seed_game):
    created = auth_client.post(f"/api/games/{seed_game.id}/library", json={"status": "owned"}).json()
    assert created["price"] is None

    response = auth_client.put(f"/api/library/{created['id']}", json={"price": 19.99})

    assert response.status_code == 200
    assert response.json()["price"] == 19.99


def test_update_library_item_sets_and_clears_acquired_at(auth_client, seed_game):
    created = auth_client.post(f"/api/games/{seed_game.id}/library", json={"status": "owned"}).json()
    # A manual add with no date is stamped today.
    assert created["acquiredAt"] == date.today().isoformat()

    response = auth_client.put(f"/api/library/{created['id']}", json={"acquiredAt": "2022-03-11"})

    assert response.status_code == 200
    assert response.json()["acquiredAt"] == "2022-03-11"

    response = auth_client.put(f"/api/library/{created['id']}", json={"acquiredAt": None})

    assert response.status_code == 200
    assert response.json()["acquiredAt"] is None


def test_add_wishlist_item_with_target_price(auth_client, seed_game):
    response = auth_client.post(f"/api/games/{seed_game.id}/library", json={"status": "wishlist", "targetPrice": 15.0})

    assert response.status_code == 201
    assert response.json()["targetPrice"] == 15.0


def test_update_library_item_sets_target_price(auth_client, seed_game):
    created = auth_client.post(f"/api/games/{seed_game.id}/library", json={"status": "wishlist"}).json()
    assert created["targetPrice"] is None

    response = auth_client.put(f"/api/library/{created['id']}", json={"targetPrice": 9.99})

    assert response.status_code == 200
    assert response.json()["targetPrice"] == 9.99


def test_add_wishlist_item_with_track_for_sales(auth_client, seed_game):
    response = auth_client.post(
        f"/api/games/{seed_game.id}/library", json={"status": "wishlist", "trackForSales": True}
    )

    assert response.status_code == 201
    assert response.json()["trackForSales"] is True


def test_update_library_item_toggles_track_for_sales_off(auth_client, seed_game):
    created = auth_client.post(
        f"/api/games/{seed_game.id}/library", json={"status": "wishlist", "trackForSales": True}
    ).json()
    assert created["trackForSales"] is True

    response = auth_client.put(f"/api/library/{created['id']}", json={"trackForSales": False})

    assert response.status_code == 200
    assert response.json()["trackForSales"] is False


def test_add_library_item_defaults_steelbook_to_false(auth_client, seed_game):
    response = auth_client.post(f"/api/games/{seed_game.id}/library", json={"status": "owned"})

    assert response.status_code == 201
    assert response.json()["steelbook"] is False


def test_add_library_item_with_steelbook(auth_client, seed_game):
    response = auth_client.post(
        f"/api/games/{seed_game.id}/library",
        json={"status": "owned", "format": "physical", "steelbook": True},
    )

    assert response.status_code == 201
    assert response.json()["steelbook"] is True


def test_update_library_item_toggles_steelbook_off(auth_client, seed_game):
    created = auth_client.post(
        f"/api/games/{seed_game.id}/library",
        json={"status": "owned", "format": "physical", "steelbook": True},
    ).json()
    assert created["steelbook"] is True

    response = auth_client.put(f"/api/library/{created['id']}", json={"steelbook": False})

    assert response.status_code == 200
    assert response.json()["steelbook"] is False


def test_list_library_items_reflects_a_current_discount_for_an_eligible_digital_pc_row(
    auth_client, db_session, seed_game, seed_pc_platform
):
    db_session.add(
        ItadPriceCache(
            game_id=seed_game.id,
            itad_game_id="itad-1",
            current_price_amount=14.99,
            current_price_currency="USD",
            current_shop_name="GOG",
            current_cut=40,
        )
    )
    db_session.commit()

    auth_client.post(
        f"/api/games/{seed_game.id}/library",
        json={
            "status": "wishlist",
            "format": "digital",
            "platformId": seed_pc_platform.id,
            "trackForSales": True,
        },
    )

    response = auth_client.get(f"/api/games/{seed_game.id}/library")

    [item] = response.json()
    assert item["isOnSale"] is True
    assert item["salePriceAmount"] == 14.99
    assert item["saleShopName"] == "GOG"
    assert item["saleCut"] == 40


def test_list_library_items_matches_the_rows_own_storefront_not_the_cheapest_shop(
    auth_client, db_session, seed_game, seed_pc_platform
):
    """Regression test: a Steam wishlist row must show Steam's own price/discount, not Epic
    Games Store's, even when Epic happens to be cheaper right now."""
    db_session.add(
        ItadPriceCache(
            game_id=seed_game.id,
            itad_game_id="itad-1",
            current_price_amount=8.0,
            current_price_currency="USD",
            current_shop_name="Epic Games Store",
            current_cut=60,
            deals=[
                {"shop_name": "Steam", "price_amount": 12.0, "price_currency": "USD", "cut": 40},
                {"shop_name": "Epic Game Store", "price_amount": 8.0, "price_currency": "USD", "cut": 60},
            ],
        )
    )
    db_session.commit()

    auth_client.post(
        f"/api/games/{seed_game.id}/library",
        json={
            "status": "wishlist",
            "format": "digital",
            "platformId": seed_pc_platform.id,
            "trackForSales": True,
            "digitalStorefront": "Steam",
        },
    )

    response = auth_client.get(f"/api/games/{seed_game.id}/library")

    [item] = response.json()
    assert item["isOnSale"] is True
    assert item["saleShopName"] == "Steam"
    assert item["salePriceAmount"] == 12.0
    assert item["saleCut"] == 40


def test_list_library_items_is_not_on_sale_for_a_non_itad_platform(auth_client, db_session, seed_game, seed_platform):
    db_session.add(
        ItadPriceCache(game_id=seed_game.id, itad_game_id="itad-1", current_price_amount=14.99, current_cut=40)
    )
    db_session.commit()

    auth_client.post(
        f"/api/games/{seed_game.id}/library",
        json={"status": "wishlist", "format": "digital", "platformId": seed_platform.id},
    )

    response = auth_client.get(f"/api/games/{seed_game.id}/library")

    [item] = response.json()
    assert item["isOnSale"] is False
    assert item["salePriceAmount"] is None


def test_list_library_items_reflects_a_current_discount_for_an_eligible_digital_ps5_row(
    auth_client, db_session, seed_game, seed_platform
):
    # conftest's seed_platform is "Sony PlayStation 5" (slug "ps5").
    db_session.add(
        PlatPricesCache(
            game_id=seed_game.id,
            ppid="222",
            current_price_amount=19.99,
            current_price_currency="USD",
            current_shop_name="PlayStation Store",
            current_cut=50,
        )
    )
    db_session.commit()

    auth_client.post(
        f"/api/games/{seed_game.id}/library",
        json={
            "status": "wishlist",
            "format": "digital",
            "platformId": seed_platform.id,
            "trackForSales": True,
        },
    )

    response = auth_client.get(f"/api/games/{seed_game.id}/library")

    [item] = response.json()
    assert item["isOnSale"] is True
    assert item["salePriceAmount"] == 19.99
    assert item["saleShopName"] == "PlayStation Store"
    assert item["saleCut"] == 50


def test_update_library_item_404_for_missing_item(auth_client):
    response = auth_client.put("/api/library/999999", json={"status": "owned"})

    assert response.status_code == 404


def test_delete_library_item(auth_client, seed_game):
    created = auth_client.post(f"/api/games/{seed_game.id}/library", json={"status": "wishlist"}).json()

    response = auth_client.delete(f"/api/library/{created['id']}")
    assert response.status_code == 204

    remaining = auth_client.get(f"/api/games/{seed_game.id}/library")
    assert remaining.json() == []


def test_delete_library_item_404_for_missing_item(auth_client):
    response = auth_client.delete("/api/library/999999")

    assert response.status_code == 404


def test_adding_library_item_does_not_create_game_progress(auth_client, db_session, seed_game):
    """Library items (ownership/wishlist) and game progress (play status) are
    deliberately separate concerns — adding a library item shouldn't silently create a
    progress row too."""
    auth_client.post(f"/api/games/{seed_game.id}/library", json={"status": "owned"})

    assert db_session.query(GameProgress).filter_by(game_id=seed_game.id).count() == 0


def test_add_library_item_with_subscription_format(auth_client, seed_game, seed_platform):
    response = auth_client.post(
        f"/api/games/{seed_game.id}/library",
        json={"status": "owned", "platformId": seed_platform.id, "format": "subscription"},
    )

    assert response.status_code == 201
    assert response.json()["format"] == "subscription"


def _add_item(auth_client, game_id, platform_id, fmt="physical"):
    response = auth_client.post(
        f"/api/games/{game_id}/library",
        json={"status": "owned", "platformId": platform_id, "format": fmt},
    )
    assert response.status_code == 201
    return response.json()["id"]


def test_bulk_update_format_across_items(auth_client, seed_game, seed_platform, seed_region):
    first = _add_item(auth_client, seed_game.id, seed_platform.id, "physical")
    second = _add_item(auth_client, seed_game.id, seed_platform.id, "digital")

    response = auth_client.post(
        "/api/library/bulk-update",
        json={"item_ids": [first, second], "field": "format", "value": "subscription"},
    )

    assert response.status_code == 200
    assert response.json() == {"updated": 2}
    items = auth_client.get(f"/api/games/{seed_game.id}/library").json()
    assert {item["format"] for item in items} == {"subscription"}


def test_bulk_update_digital_storefront_sets_and_clears(auth_client, seed_game, seed_platform):
    first = _add_item(auth_client, seed_game.id, seed_platform.id, "digital")
    second = _add_item(auth_client, seed_game.id, seed_platform.id, "digital")

    response = auth_client.post(
        "/api/library/bulk-update",
        json={"item_ids": [first, second], "field": "digital_storefront", "value": "GOG"},
    )

    assert response.status_code == 200
    assert response.json() == {"updated": 2}
    items = auth_client.get(f"/api/games/{seed_game.id}/library").json()
    assert {item["digitalStorefront"] for item in items} == {"GOG"}

    # Blank clears the storefront on every selected item.
    response = auth_client.post(
        "/api/library/bulk-update",
        json={"item_ids": [first, second], "field": "digital_storefront", "value": "  "},
    )

    assert response.status_code == 200
    items = auth_client.get(f"/api/games/{seed_game.id}/library").json()
    assert {item["digitalStorefront"] for item in items} == {None}


def test_list_items_includes_digital_storefront(auth_client, seed_game, seed_platform):
    item_id = _add_item(auth_client, seed_game.id, seed_platform.id, "digital")
    auth_client.post(
        "/api/library/bulk-update",
        json={"item_ids": [item_id], "field": "digital_storefront", "value": "GOG"},
    )

    response = auth_client.get("/api/library/items")

    assert response.status_code == 200
    rows = [row for row in response.json() if row["id"] == item_id]
    assert len(rows) == 1
    assert rows[0]["digitalStorefront"] == "GOG"


def test_switching_wishlist_to_owned_populates_acquired_date(auth_client, seed_game, seed_platform, db_session):
    from app.models.library import LibraryItem, LibraryStatus, MediaFormat

    # A wishlist copy with no acquired date (e.g. imported before acquired
    # dates existed) gets today's date when it becomes owned.
    db_session.add(
        LibraryItem(
            game_id=seed_game.id,
            platform_id=seed_platform.id,
            status=LibraryStatus.WISHLIST,
            format=MediaFormat.DIGITAL,
        )
    )
    db_session.commit()
    item_id = db_session.query(LibraryItem).filter(LibraryItem.game_id == seed_game.id).one().id

    response = auth_client.put(f"/api/library/{item_id}", json={"status": "owned"})

    assert response.status_code == 200
    assert response.json()["acquiredAt"] == date.today().isoformat()

    # An explicit date on the flip wins over today.
    db_session.query(LibraryItem).filter(LibraryItem.id == item_id).update(
        {"status": LibraryStatus.WISHLIST, "acquired_at": None}
    )
    db_session.commit()

    response = auth_client.put(
        f"/api/library/{item_id}", json={"status": "owned", "acquiredAt": "2022-03-11"}
    )

    assert response.status_code == 200
    assert response.json()["acquiredAt"] == "2022-03-11"

    # Editing an already-owned copy with no acquired date does not invent one.
    db_session.query(LibraryItem).filter(LibraryItem.id == item_id).update({"acquired_at": None})
    db_session.commit()

    response = auth_client.put(f"/api/library/{item_id}", json={"notes": "still no date"})

    assert response.status_code == 200
    assert response.json()["acquiredAt"] is None


def test_bulk_update_acquired_at_sets_and_clears(auth_client, seed_game, seed_platform):
    first = _add_item(auth_client, seed_game.id, seed_platform.id, "digital")
    second = _add_item(auth_client, seed_game.id, seed_platform.id, "digital")

    response = auth_client.post(
        "/api/library/bulk-update",
        json={"item_ids": [first, second], "field": "acquired_at", "value": "2022-03-11"},
    )

    assert response.status_code == 200
    assert response.json() == {"updated": 2}
    items = auth_client.get(f"/api/games/{seed_game.id}/library").json()
    assert {item["acquiredAt"] for item in items} == {"2022-03-11"}

    # Blank clears the acquired date on every selected item.
    response = auth_client.post(
        "/api/library/bulk-update",
        json={"item_ids": [first, second], "field": "acquired_at", "value": ""},
    )

    assert response.status_code == 200
    items = auth_client.get(f"/api/games/{seed_game.id}/library").json()
    assert {item["acquiredAt"] for item in items} == {None}

    # A malformed date is rejected, not stored.
    response = auth_client.post(
        "/api/library/bulk-update",
        json={"item_ids": [first], "field": "acquired_at", "value": "not-a-date"},
    )

    assert response.status_code == 422


def test_sync_acquired_dates_overwrites_with_game_added_date(auth_client, seed_game, seed_platform, db_session):
    from datetime import datetime

    seed_game.created_at = datetime(2022, 3, 11, 10, 0, 0)
    db_session.commit()

    first = _add_item(auth_client, seed_game.id, seed_platform.id, "digital")
    second = _add_item(auth_client, seed_game.id, seed_platform.id, "digital")
    # A wishlist copy is untouched — it was never acquired.
    wishlist = auth_client.post(
        f"/api/games/{seed_game.id}/library",
        json={"status": "wishlist", "platformId": seed_platform.id, "format": "digital"},
    )
    assert wishlist.status_code == 201
    wishlist_id = wishlist.json()["id"]

    response = auth_client.post("/api/library/sync-acquired-dates")

    assert response.status_code == 200
    assert response.json() == {"updated": 2}
    items = auth_client.get(f"/api/games/{seed_game.id}/library").json()
    by_id = {item["id"]: item for item in items}
    assert by_id[first]["acquiredAt"] == "2022-03-11"
    assert by_id[second]["acquiredAt"] == "2022-03-11"
    # The wishlist copy keeps the date it was created with, not the game's.
    assert by_id[wishlist_id]["acquiredAt"] == date.today().isoformat()


def test_bulk_update_platform_and_status(auth_client, seed_game, seed_platform, db_session):
    from app.models.catalog import Platform

    other_platform = Platform(name="Xbox Series X", slug="xbox-series", abbreviation="XSX")
    db_session.add(other_platform)
    db_session.commit()
    item_id = _add_item(auth_client, seed_game.id, seed_platform.id)

    response = auth_client.post(
        "/api/library/bulk-update",
        json={"item_ids": [item_id], "field": "platform", "value": other_platform.id},
    )
    assert response.status_code == 200

    response = auth_client.post(
        "/api/library/bulk-update",
        json={"item_ids": [item_id], "field": "status", "value": "wishlist"},
    )
    assert response.status_code == 200

    items = auth_client.get(f"/api/games/{seed_game.id}/library").json()
    assert items[0]["platformName"] == "Xbox Series X"
    assert items[0]["status"] == "wishlist"


def test_bulk_update_game_moves_items(auth_client, seed_game, seed_platform, db_session):
    from app.models.catalog import Game, GameCategory

    target = Game(name="Target Game", slug="target-game", category=GameCategory.MAIN_GAME)
    db_session.add(target)
    db_session.commit()
    first = _add_item(auth_client, seed_game.id, seed_platform.id, "physical")
    second = _add_item(auth_client, seed_game.id, seed_platform.id, "digital")

    response = auth_client.post(
        "/api/library/bulk-update",
        json={"item_ids": [first, second], "field": "game", "value": target.id},
    )

    assert response.status_code == 200
    assert response.json() == {"updated": 2}
    assert auth_client.get(f"/api/games/{seed_game.id}/library").json() == []
    items = auth_client.get(f"/api/games/{target.id}/library").json()
    assert len(items) == 2
    assert {item["format"] for item in items} == {"physical", "digital"}


def test_bulk_update_game_rejects_unknown_target(auth_client, seed_game, seed_platform):
    item_id = _add_item(auth_client, seed_game.id, seed_platform.id)

    response = auth_client.post(
        "/api/library/bulk-update",
        json={"item_ids": [item_id], "field": "game", "value": 999999},
    )

    assert response.status_code == 404
    items = auth_client.get(f"/api/games/{seed_game.id}/library").json()
    assert len(items) == 1


def test_bulk_update_edition_blank_clears(auth_client, seed_game, seed_platform):
    item_id = _add_item(auth_client, seed_game.id, seed_platform.id)

    response = auth_client.post(
        "/api/library/bulk-update",
        json={"item_ids": [item_id], "field": "edition", "value": "Collector's"},
    )
    assert response.status_code == 200
    response = auth_client.post(
        "/api/library/bulk-update",
        json={"item_ids": [item_id], "field": "edition", "value": "  "},
    )
    assert response.status_code == 200

    items = auth_client.get(f"/api/games/{seed_game.id}/library").json()
    assert items[0]["edition"] is None


def test_bulk_update_missing_item_updates_nothing(auth_client, seed_game, seed_platform):
    item_id = _add_item(auth_client, seed_game.id, seed_platform.id)

    response = auth_client.post(
        "/api/library/bulk-update",
        json={"item_ids": [item_id, 999999], "field": "format", "value": "rom"},
    )

    assert response.status_code == 404
    items = auth_client.get(f"/api/games/{seed_game.id}/library").json()
    assert items[0]["format"] == "physical"


def test_bulk_update_rejects_bad_field_and_empty_ids(auth_client, seed_game, seed_platform):
    item_id = _add_item(auth_client, seed_game.id, seed_platform.id)

    bad_field = auth_client.post(
        "/api/library/bulk-update",
        json={"item_ids": [item_id], "field": "steelbook", "value": True},
    )
    assert bad_field.status_code == 422

    empty = auth_client.post(
        "/api/library/bulk-update",
        json={"item_ids": [], "field": "format", "value": "rom"},
    )
    assert empty.status_code == 422

    bad_format = auth_client.post(
        "/api/library/bulk-update",
        json={"item_ids": [item_id], "field": "format", "value": "cartridge"},
    )
    assert bad_format.status_code == 422


def test_bulk_delete_removes_selected_items(auth_client, seed_game, seed_platform):
    first = _add_item(auth_client, seed_game.id, seed_platform.id)
    second = _add_item(auth_client, seed_game.id, seed_platform.id)
    keep = _add_item(auth_client, seed_game.id, seed_platform.id)

    response = auth_client.post(
        "/api/library/bulk-delete", json={"item_ids": [first, second]}
    )

    assert response.status_code == 200
    assert response.json() == {"deleted": 2}
    items = auth_client.get(f"/api/games/{seed_game.id}/library").json()
    assert [item["id"] for item in items] == [keep]


def test_bulk_delete_missing_item_deletes_nothing(auth_client, seed_game, seed_platform):
    item_id = _add_item(auth_client, seed_game.id, seed_platform.id)

    response = auth_client.post(
        "/api/library/bulk-delete", json={"item_ids": [item_id, 999999]}
    )

    assert response.status_code == 404
    items = auth_client.get(f"/api/games/{seed_game.id}/library").json()
    assert [item["id"] for item in items] == [item_id]


def test_bulk_delete_rejects_empty_ids(auth_client):
    response = auth_client.post("/api/library/bulk-delete", json={"item_ids": []})

    assert response.status_code == 422


def test_list_all_library_items_includes_status(auth_client, db_session, seed_game, seed_platform):
    db_session.add(
        LibraryItem(
            game_id=seed_game.id,
            platform_id=seed_platform.id,
            status=LibraryStatus.OWNED,
            acquired_at=date(2023, 6, 15),
        )
    )
    wishlisted_game = Game(igdb_id=5005, name="Wishlisted Game", category=GameCategory.MAIN_GAME)
    db_session.add(wishlisted_game)
    db_session.commit()
    db_session.add(LibraryItem(game_id=wishlisted_game.id, status=LibraryStatus.WISHLIST))
    db_session.commit()

    response = auth_client.get("/api/library/items")

    assert response.status_code == 200
    by_name = {item["gameName"]: item for item in response.json()}
    assert by_name["Test Game"]["status"] == "owned"
    assert by_name["Wishlisted Game"]["status"] == "wishlist"
    # The list response carries the stored acquired date through.
    assert by_name["Test Game"]["acquiredAt"] == "2023-06-15"


def test_list_all_library_items_carry_hide_from_public(auth_client, db_session, seed_game, seed_platform):
    db_session.add(LibraryItem(game_id=seed_game.id, platform_id=seed_platform.id, status=LibraryStatus.OWNED))
    hidden_game = Game(igdb_id=5006, name="Hidden Game", category=GameCategory.MAIN_GAME, hide_from_public=True)
    db_session.add(hidden_game)
    db_session.commit()
    db_session.add(LibraryItem(game_id=hidden_game.id, status=LibraryStatus.OWNED))
    db_session.commit()

    response = auth_client.get("/api/library/items")

    assert response.status_code == 200
    by_name = {item["gameName"]: item for item in response.json()}
    assert by_name["Test Game"]["hideFromPublic"] is False
    assert by_name["Hidden Game"]["hideFromPublic"] is True
