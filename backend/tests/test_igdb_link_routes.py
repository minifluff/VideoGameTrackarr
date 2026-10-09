from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.models.catalog import Game
from app.services import igdb_link_job
from app.services.igdb_link_job import IgdbLinkReviewReason, IgdbLinkStatus


def _make_game(db_session, name="Test Game", igdb_id=None, parent_game_id=None, slug=None):
    game = Game(
        name=name,
        slug=slug or name.lower().replace(" ", "-"),
        igdb_id=igdb_id,
        parent_game_id=parent_game_id,
        category=None,
    )
    db_session.add(game)
    db_session.commit()
    return game


def _mock_client(search_results=None):
    client = MagicMock()
    client.search_games = AsyncMock(return_value=search_results or [])
    client.aclose = AsyncMock()
    return client


def test_start_link_all_rejects_concurrent_run(db_session):
    igdb_link_job._state = igdb_link_job.IgdbLinkState(status=IgdbLinkStatus.RUNNING)
    with pytest.raises(Exception, match="already in progress"):
        igdb_link_job.start_link_all(lambda: db_session)


def test_status_endpoint_reports_idle(auth_client):
    response = auth_client.get("/api/igdb-link/status")
    assert response.status_code == 200
    assert response.json()["status"] == "idle"


def test_start_endpoint_kicks_off_job(auth_client, db_session):
    with patch("app.services.igdb_link_job.threading.Thread"):
        response = auth_client.post("/api/igdb-link/start")
    assert response.status_code == 202
    assert response.json()["status"] == "running"


def test_start_endpoint_rejects_second_start(auth_client, db_session):
    with patch("app.services.igdb_link_job.threading.Thread"):
        auth_client.post("/api/igdb-link/start")
        response = auth_client.post("/api/igdb-link/start")
    assert response.status_code == 409


def test_acknowledge_clears_completed_job(auth_client, db_session):
    igdb_link_job._state = igdb_link_job.IgdbLinkState(status=IgdbLinkStatus.COMPLETED)
    response = auth_client.post("/api/igdb-link/status/acknowledge")
    assert response.status_code == 204
    assert igdb_link_job.get_state().status == IgdbLinkStatus.IDLE


def test_acknowledge_is_noop_while_running(auth_client, db_session):
    igdb_link_job._state = igdb_link_job.IgdbLinkState(status=IgdbLinkStatus.RUNNING)
    response = auth_client.post("/api/igdb-link/status/acknowledge")
    assert response.status_code == 204
    assert igdb_link_job.get_state().status == IgdbLinkStatus.RUNNING


@pytest.mark.asyncio
async def test_try_link_one_links_single_exact_match(db_session):
    game = _make_game(db_session, name="Doom")
    client = _mock_client([{"id": 1234, "name": "Doom"}])

    with patch("app.services.game_service.link_game_to_igdb", new=AsyncMock()) as mock_link:
        outcome = await igdb_link_job._try_link_one(db_session, client, game)

    assert outcome == "linked"
    mock_link.assert_called_once_with(db_session, client, game.id, 1234)


@pytest.mark.asyncio
async def test_try_link_one_ignores_punctuation_and_case(db_session):
    game = _make_game(db_session, name="DOOM 3: BFG Edition")
    client = _mock_client([{"id": 5678, "name": "doom 3 bfg edition"}])

    with patch("app.services.game_service.link_game_to_igdb", new=AsyncMock()) as mock_link:
        outcome = await igdb_link_job._try_link_one(db_session, client, game)

    assert outcome == "linked"
    mock_link.assert_called_once()


@pytest.mark.asyncio
async def test_try_link_one_no_match_goes_to_review(db_session):
    game = _make_game(db_session, name="Obscure Homebrew")
    client = _mock_client([{"id": 999, "name": "Something Else"}])

    outcome = await igdb_link_job._try_link_one(db_session, client, game)

    assert outcome == IgdbLinkReviewReason.NO_MATCH


@pytest.mark.asyncio
async def test_try_link_one_ambiguous_goes_to_review(db_session):
    game = _make_game(db_session, name="Doom")
    client = _mock_client(
        [
            {"id": 1234, "name": "Doom"},
            {"id": 5678, "name": "Doom"},
        ]
    )

    with patch("app.services.game_service.link_game_to_igdb", new=AsyncMock()) as mock_link:
        outcome = await igdb_link_job._try_link_one(db_session, client, game)

    assert outcome == IgdbLinkReviewReason.AMBIGUOUS
    mock_link.assert_not_called()


@pytest.mark.asyncio
async def test_try_link_one_already_in_library_goes_to_review(db_session):
    _make_game(db_session, name="Doom", igdb_id=1234, slug="doom-1")
    game = _make_game(db_session, name="Doom", slug="doom-2")
    client = _mock_client([{"id": 1234, "name": "Doom"}])

    with patch("app.services.game_service.link_game_to_igdb", new=AsyncMock()) as mock_link:
        outcome = await igdb_link_job._try_link_one(db_session, client, game)

    assert outcome == IgdbLinkReviewReason.ALREADY_IN_LIBRARY
    mock_link.assert_not_called()


@pytest.mark.asyncio
async def test_try_link_one_searches_addon_scope_for_child_games(db_session):
    parent = _make_game(db_session, name="Parent Game")
    game = _make_game(db_session, name="Cool DLC", parent_game_id=parent.id)
    client = _mock_client([{"id": 777, "name": "Cool DLC"}])

    with patch("app.services.game_service.link_game_to_igdb", new=AsyncMock()):
        await igdb_link_job._try_link_one(db_session, client, game)

    client.search_games.assert_called_once()
    assert client.search_games.call_args.kwargs["category_scope"] == "addon"


@pytest.mark.asyncio
async def test_try_link_one_searches_game_scope_for_top_level(db_session):
    game = _make_game(db_session, name="Doom")
    client = _mock_client([{"id": 1234, "name": "Doom"}])

    with patch("app.services.game_service.link_game_to_igdb", new=AsyncMock()):
        await igdb_link_job._try_link_one(db_session, client, game)

    assert client.search_games.call_args.kwargs["category_scope"] == "game"
