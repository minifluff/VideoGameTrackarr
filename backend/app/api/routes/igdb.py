import re
from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, get_igdb_client
from app.schemas.game import (
    IGDBAutolinkRequest,
    IGDBAutolinkResultResponse,
    IgdbGamePreviewResponse,
    IGDBParentGameResponse,
    IGDBSearchResultResponse,
    UnlinkedGameResponse,
    igdb_game_preview_from_payload,
)
from app.services import game_service, igdb_autolink_service
from app.services.game_service import resolve_igdb_category
from app.services.igdb_client import IGDBClient

router = APIRouter(prefix="/api/igdb", tags=["igdb"], dependencies=[Depends(get_current_user)])

# Lets users paste an exact IGDB id (e.g. "igdb:3542") instead of a name search — handy
# when a name search is ambiguous or too noisy to find a specific entry.
_IGDB_ID_QUERY_PATTERN = re.compile(r"^igdb:(\d+)$", re.IGNORECASE)


def _to_search_result(result: dict) -> IGDBSearchResultResponse:
    parent_ref = result.get("parent_game")
    parent_game = (
        IGDBParentGameResponse(igdb_id=parent_ref["id"], name=parent_ref.get("name") or f"IGDB #{parent_ref['id']}")
        if isinstance(parent_ref, dict) and parent_ref.get("id") is not None
        else None
    )
    return IGDBSearchResultResponse(
        igdb_id=result["id"],
        name=result.get("name"),
        slug=result.get("slug"),
        summary=result.get("summary"),
        cover_url=result.get("cover_url"),
        category=resolve_igdb_category(result)[1],
        first_release_date=result.get("first_release_date"),
        parent_game=parent_game,
    )


@router.get("/search", response_model=list[IGDBSearchResultResponse])
async def search_igdb(
    query: str = Query(min_length=1),
    category_scope: Literal["game", "addon"] = Query(default="game", alias="categoryScope"),
    igdb_client: IGDBClient = Depends(get_igdb_client),
) -> list[IGDBSearchResultResponse]:
    id_match = _IGDB_ID_QUERY_PATTERN.match(query.strip())
    if id_match:
        results = await igdb_client.get_games_by_ids([int(id_match.group(1))])
    else:
        results = await igdb_client.search_games(query, category_scope=category_scope)
    return [_to_search_result(result) for result in results]


@router.get("/games/{igdb_id}", response_model=IgdbGamePreviewResponse)
async def preview_igdb_game(
    igdb_id: int,
    db: Session = Depends(get_db),
    igdb_client: IGDBClient = Depends(get_igdb_client),
) -> IgdbGamePreviewResponse:
    """Read-only preview of an IGDB game for the Add Game page — never stores anything."""
    payload, category, store_urls, local_game = await game_service.get_igdb_preview_payload(
        db, igdb_client, igdb_id
    )
    return igdb_game_preview_from_payload(payload, category, store_urls, local_game)


@router.get("/autolink/unlinked", response_model=list[UnlinkedGameResponse])
def list_unlinked_games(
    db: Session = Depends(get_db),
) -> list[UnlinkedGameResponse]:
    """Games in the library that aren't linked to IGDB yet."""
    games = igdb_autolink_service.list_unlinked_games(db)
    return [UnlinkedGameResponse(id=g.id, name=g.name) for g in games]


@router.post("/autolink", response_model=IGDBAutolinkResultResponse)
async def autolink_games(
    payload: IGDBAutolinkRequest,
    db: Session = Depends(get_db),
    igdb_client: IGDBClient = Depends(get_igdb_client),
) -> IGDBAutolinkResultResponse:
    """Auto-links games to IGDB by exact name match."""
    result = await igdb_autolink_service.autolink_games(db, igdb_client, payload.game_ids)
    return IGDBAutolinkResultResponse.model_validate(result)
