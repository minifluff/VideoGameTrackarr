from datetime import UTC, datetime, timedelta

from app.models.catalog import Game, GameCategory
from app.repositories import dashboard_repository, game_repository
from app.repositories.game_repository import GameSortOption


def _ts(moment: datetime) -> int:
    return int(moment.timestamp())


def _seed_games(db_session):
    """Four games whose plain added-date order differs from their effective order.

    ReleasedRecently was added 30 days ago but released 10 days ago, so its
    effective date (10 days ago) jumps it ahead of NoRelease, added 20 days ago.
    FutureRelease keeps its added date (5 days ago) because its release hasn't
    happened yet, and OldRelease keeps its added date (40 days ago) because its
    release predates it.
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
    }
    for game in games.values():
        db_session.add(game)
    db_session.commit()
    return games


def test_date_added_desc_uses_passed_release_date_over_added_date(db_session):
    games = _seed_games(db_session)

    ordered = game_repository.list_top_level_games(db_session, sort=GameSortOption.DATE_ADDED_DESC)

    assert [g.game.id for g in ordered] == [
        games["future_release"].id,
        games["released_recently"].id,
        games["no_release"].id,
        games["old_release"].id,
    ]


def test_date_added_asc_uses_passed_release_date_over_added_date(db_session):
    games = _seed_games(db_session)

    ordered = game_repository.list_top_level_games(db_session, sort=GameSortOption.DATE_ADDED_ASC)

    assert [g.game.id for g in ordered] == [
        games["old_release"].id,
        games["no_release"].id,
        games["released_recently"].id,
        games["future_release"].id,
    ]


def test_dashboard_recently_added_uses_effective_date(db_session):
    games = _seed_games(db_session)

    stats = dashboard_repository.get_stats(db_session)

    assert [g.game.id for g in stats.recently_added] == [
        games["future_release"].id,
        games["released_recently"].id,
        games["no_release"].id,
        games["old_release"].id,
    ]
