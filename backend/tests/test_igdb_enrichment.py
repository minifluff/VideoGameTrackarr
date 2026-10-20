"""Tests for the IGDB enrichment fields: status, game modes, age ratings, time to beat."""

import httpx
import respx

from app.core.config import Settings
from app.services import igdb_client as igdb_client_module
from app.services.cache import InMemoryTTLCache
from app.services.igdb_client import (
    IGDB_API_BASE,
    IGDB_TOKEN_URL,
    IGDBClient,
    extract_age_ratings,
    extract_game_mode_names,
)

TOKEN_RESPONSE = httpx.Response(200, json={"access_token": "test-token", "expires_in": 3600})


def make_client(**overrides) -> IGDBClient:
    kwargs = {"client_id": "client-id", "client_secret": "client-secret", "cache": InMemoryTTLCache()}
    kwargs.update(overrides)
    return IGDBClient(**kwargs)


def testextract_age_ratings_maps_esrb_and_pegi():
    igdb_game = {
        "age_ratings": [
            {"category": 1, "rating": 3},  # ESRB E
            {"category": 2, "rating": 4},  # PEGI 16
        ]
    }
    assert extract_age_ratings(igdb_game) == {"ESRB": "E", "PEGI": "16"}


def testextract_age_ratings_keeps_other_systems_raw():
    igdb_game = {"age_ratings": [{"category": 3, "rating": 5}]}  # CERO, no label map
    assert extract_age_ratings(igdb_game) == {"CERO": "5"}


def testextract_age_ratings_returns_none_when_empty_or_missing():
    assert extract_age_ratings({}) is None
    assert extract_age_ratings({"age_ratings": []}) is None
    assert extract_age_ratings({"age_ratings": [{"category": 99, "rating": 1}]}) is None
    assert extract_age_ratings({"age_ratings": [{"category": 1}]}) is None


def testextract_game_mode_names():
    igdb_game = {"game_modes": [{"name": "Single player"}, {"name": "Multiplayer"}, {"slug": "no-name"}]}
    assert extract_game_mode_names(igdb_game) == ["Single player", "Multiplayer"]


def testextract_game_mode_names_returns_none_when_empty():
    assert extract_game_mode_names({}) is None
    assert extract_game_mode_names({"game_modes": []}) is None


@respx.mock
async def test_get_time_to_beat_by_igdb_ids(monkeypatch):
    monkeypatch.setattr(
        igdb_client_module,
        "get_settings",
        lambda: Settings(_env_file=None, igdb_client_id="id", igdb_client_secret="secret"),
    )
    respx.post(IGDB_TOKEN_URL).mock(return_value=TOKEN_RESPONSE)
    route = respx.post(f"{IGDB_API_BASE}/game_time_to_beats").mock(
        return_value=httpx.Response(
            200,
            json=[
                {"game_id": 1, "hastily": 5400, "normally": 7200, "completely": 10800, "count": 42},
                {"game_id": 2, "hastily": None, "normally": 3600, "completely": None, "count": 7},
            ],
        )
    )

    result = await make_client().get_time_to_beat_by_igdb_ids([1, 2, 3])

    assert route.call_count == 1
    assert result[1] == {"hastily": 5400, "normally": 7200, "completely": 10800, "count": 42}
    assert result[2] == {"hastily": None, "normally": 3600, "completely": None, "count": 7}
    assert 3 not in result  # no submissions → absent, not zeroed


@respx.mock
async def test_get_time_to_beat_by_igdb_ids_empty_input_makes_no_request():
    route = respx.post(f"{IGDB_API_BASE}/game_time_to_beats").mock(
        return_value=httpx.Response(200, json=[])
    )
    assert await make_client().get_time_to_beat_by_igdb_ids([]) == {}
    assert route.call_count == 0


def test_upsert_stores_enrichment_fields_and_detail_exposes_them(db_session):
    from app.services.game_service import _upsert_from_igdb_payload, get_game_detail

    payload = {
        "id": 1942,
        "name": "Enrichment Test Game",
        "slug": "enrichment-test-game",
        "status": 4,  # early access
        "game_modes": [{"name": "Single player"}, {"name": "Co-operative"}],
        "age_ratings": [
            {"category": 1, "rating": 6},  # ESRB M
            {"category": 2, "rating": 5},  # PEGI 18
        ],
        "time_to_beat_data": {"hastily": 3600, "normally": 5400, "completely": 9000, "count": 11},
    }

    game = _upsert_from_igdb_payload(db_session, payload)
    db_session.commit()

    assert game.igdb_status == 4
    assert game.game_modes == ["Single player", "Co-operative"]
    assert game.age_ratings == {"ESRB": "M", "PEGI": "18"}
    assert game.time_to_beat == {"hastily": 3600, "normally": 5400, "completely": 9000, "count": 11}

    detail = get_game_detail(db_session, game.id)
    assert detail.igdb_status == 4
    assert detail.game_modes == ["Single player", "Co-operative"]
    assert detail.age_ratings == {"ESRB": "M", "PEGI": "18"}
    assert detail.time_to_beat["normally"] == 5400
