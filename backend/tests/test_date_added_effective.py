from datetime import UTC, datetime, timedelta

from app.models.catalog import Game, GameCategory
from app.models.library import LibraryItem, LibraryStatus
from app.repositories import dashboard_repository, game_repository
from app.repositories.game_repository import GameSortOption


def _ts(moment: datetime) -> int:
    return int(moment.timestamp())


def _seed_games(db_session):
    """Seven games whose plain added-date order differs from their effective order.

    ReleasedRecently was added 30 days ago but released 10 days ago, so its
    effective date (10 days ago) jumps it ahead of NoRelease, added 20 days ago.
    FutureRelease keeps its added date (5 days ago) because its release hasn't
    happened yet, and OldRelease keeps its added date (40 days ago) because its
    release predates it. AcquiredRecently was added 40 days ago but an owned
    copy was acquired 3 days ago, so its effective date is 3 days ago.
    WishlistAcquired only has a wishlist copy acquired 3 days ago, so it keeps
    its added date (40 days ago) — wishlist copies never count. FutureAcquired
    has an owned copy with a future acquired date, so it keeps its added date
    too, same as a future release.
    """
    now = datetime.now(UTC)
    games = {
        "released_recently": Game(
            igdb_id=9001,
            name="Released Recently",
            category=GameCategory.MAIN_GAME,
            created_at=now - timedelta(days=30),
            first_release_date=_ts(now - timedelta(days=10)),
        ),
        "no_release": Game(
            igdb_id=9002,
            name="No Release Date",
            category=GameCategory.MAIN_GAME,
            created_at=now - timedelta(days=20),
            first_release_date=None,
        ),
        "future_release": Game(
            igdb_id=9003,
            name="Future Release",
            category=GameCategory.MAIN_GAME,
            created_at=now - timedelta(days=5),
            first_release_date=_ts(now + timedelta(days=10)),
        ),
        "old_release": Game(
            igdb_id=9004,
            name="Old Release",
            category=GameCategory.MAIN_GAME,
            created_at=now - timedelta(days=40),
            first_release_date=_ts(now - timedelta(days=50)),
        ),
        "acquired_recently": Game(
            igdb_id=9005,
            name="Acquired Recently",
            category=GameCategory.MAIN_GAME,
            created_at=now - timedelta(days=40),
            first_release_date=None,
        ),
        "wishlist_acquired": Game(
            igdb_id=9006,
            name="Wishlist Acquired",
            category=GameCategory.MAIN_GAME,
            created_at=now - timedelta(days=40),
            first_release_date=None,
        ),
        "future_acquired": Game(
            igdb_id=9007,
            name="Future Acquired",
            category=GameCategory.MAIN_GAME,
            created_at=now - timedelta(days=40),
            first_release_date=None,
        ),
    }
    for game in games.values():
        db_session.add(game)
    db_session.commit()
    for item in (
        LibraryItem(
            game_id=games["acquired_recently"].id,
            status=LibraryStatus.OWNED,
            acquired_at=(now - timedelta(days=3)).date(),
        ),
        LibraryItem(
            game_id=games["wishlist_acquired"].id,
            status=LibraryStatus.WISHLIST,
            acquired_at=(now - timedelta(days=3)).date(),
        ),
        LibraryItem(
            game_id=games["future_acquired"].id,
            status=LibraryStatus.OWNED,
            acquired_at=(now + timedelta(days=10)).date(),
        ),
    ):
        db_session.add(item)
    db_session.commit()
    return games


def test_date_added_desc_uses_passed_release_date_over_added_date(db_session):
    games = _seed_games(db_session)

    ordered = game_repository.list_top_level_games(db_session, sort=GameSortOption.DATE_ADDED_DESC)

    assert [g.game.id for g in ordered] == [
        games["acquired_recently"].id,
        games["future_release"].id,
        games["released_recently"].id,
        games["no_release"].id,
        games["future_acquired"].id,
        games["old_release"].id,
        games["wishlist_acquired"].id,
    ]


def test_date_added_asc_uses_passed_release_date_over_added_date(db_session):
    games = _seed_games(db_session)

    ordered = game_repository.list_top_level_games(db_session, sort=GameSortOption.DATE_ADDED_ASC)

    assert [g.game.id for g in ordered] == [
        games["future_acquired"].id,
        games["old_release"].id,
        games["wishlist_acquired"].id,
        games["no_release"].id,
        games["released_recently"].id,
        games["future_release"].id,
        games["acquired_recently"].id,
    ]


def test_dashboard_recently_added_uses_effective_date(db_session):
    games = _seed_games(db_session)

    stats = dashboard_repository.get_stats(db_session)

    # Only additions whose effective date is within the last 14 days show:
    # Acquired Recently (added 40 days ago but an owned copy acquired 3 days
    # ago), Future Release (added 5 days ago) and Released Recently (added 30
    # days ago but released 10 days ago). No Release (20 days), Old Release
    # (40 days), Wishlist Acquired (wishlist copies don't count) and Future
    # Acquired (future acquired dates don't count) have already had their
    # moment on the dashboard.
    assert [g.game.id for g in stats.recently_added] == [
        games["acquired_recently"].id,
        games["future_release"].id,
        games["released_recently"].id,
    ]
