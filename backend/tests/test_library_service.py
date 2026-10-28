import logging

import pytest

from app.models.library import LibraryItem, LibraryStatus
from app.services import library_service


def _make_items(db_session, game, platform, count):
    items = [
        LibraryItem(game_id=game.id, platform_id=platform.id, status=LibraryStatus.OWNED) for _ in range(count)
    ]
    db_session.add_all(items)
    db_session.commit()
    return items


def test_split_slug_never_collides_with_same_named_game(db_session, seed_game, seed_platform):
    item = LibraryItem(game_id=seed_game.id, platform_id=seed_platform.id, status=LibraryStatus.OWNED)
    db_session.add(item)
    db_session.commit()

    # seed_game is "Test Game" with slug "test-game" — splitting to the same name
    # must not reuse that slug (the column is unique).
    new_game, moved = library_service.split_library_item_to_new_game(db_session, item.id, "Test Game")

    assert new_game.slug != "test-game"
    assert new_game.slug.startswith("test-game-")
    assert moved.game_id == new_game.id

    # A second split to the same name gets yet another distinct slug.
    item2 = LibraryItem(game_id=seed_game.id, platform_id=seed_platform.id, status=LibraryStatus.OWNED)
    db_session.add(item2)
    db_session.commit()
    new_game2, _ = library_service.split_library_item_to_new_game(db_session, item2.id, "Test Game")

    assert new_game2.slug != new_game.slug
    assert new_game2.slug.startswith("test-game-")


def test_bulk_update_is_atomic_on_mid_loop_failure(db_session, seed_game, seed_platform, monkeypatch):
    items = _make_items(db_session, seed_game, seed_platform, 3)
    ids = [item.id for item in items]
    real_update = library_service._update_library_item
    calls = {"n": 0}

    def flaky(db, item_id, **fields):
        calls["n"] += 1
        if calls["n"] == 2:
            raise RuntimeError("boom")
        return real_update(db, item_id, **fields)

    monkeypatch.setattr(library_service, "_update_library_item", flaky)

    with pytest.raises(RuntimeError, match="boom"):
        library_service.bulk_update_library_items(db_session, ids, "edition", "New Edition")

    # Nothing committed: the first item's edit is discarded with the session.
    db_session.rollback()
    db_session.expire_all()
    assert [db_session.get(LibraryItem, item_id).edition for item_id in ids] == [None, None, None]


def test_bulk_delete_is_atomic_on_mid_loop_failure(db_session, seed_game, seed_platform, monkeypatch):
    items = _make_items(db_session, seed_game, seed_platform, 3)
    ids = [item.id for item in items]
    real_delete = library_service._delete_library_item
    calls = {"n": 0}

    def flaky(db, item_id):
        calls["n"] += 1
        if calls["n"] == 2:
            raise RuntimeError("boom")
        return real_delete(db, item_id)

    monkeypatch.setattr(library_service, "_delete_library_item", flaky)

    with pytest.raises(RuntimeError, match="boom"):
        library_service.bulk_delete_library_items(db_session, ids)

    db_session.rollback()
    db_session.expire_all()
    assert all(db_session.get(LibraryItem, item_id) is not None for item_id in ids)


def test_list_all_library_items_logs_and_skips_broken_row(
    db_session, seed_game, seed_platform, monkeypatch, caplog
):
    # A row that fails serialization must be logged with its ids and skipped,
    # not crash the list or silently vanish. (No DB state can produce such a
    # row — status/format are CHECK-constrained — so the failure is injected
    # at the serializer seam; the log-and-continue wiring under test is real.)
    items = _make_items(db_session, seed_game, seed_platform, 2)
    real_serialize = library_service._library_item_to_dict

    def flaky(item, game):
        if item.id == items[0].id:
            raise RuntimeError("boom")
        return real_serialize(item, game)

    monkeypatch.setattr(library_service, "_library_item_to_dict", flaky)

    with caplog.at_level(logging.ERROR, logger="app.services.library_service"):
        rows = library_service.list_all_library_items(db_session)

    assert [row["id"] for row in rows] == [items[1].id]
    assert "Skipping library item" in caplog.text
    assert str(items[0].id) in caplog.text
