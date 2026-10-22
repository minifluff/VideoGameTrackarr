from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.library import LibraryStatus, MediaFormat
from app.repositories import game_repository, genre_repository, itad_repository, platprices_repository
from app.schemas.catalog import CatalogRefResponse, genre_ref_from_orm
from app.schemas.library import (
    LibraryItemCreateRequest,
    LibraryItemResponse,
    LibraryItemUpdateRequest,
    LibraryListItemResponse,
    library_item_from_orm,
)
from app.services import library_service

router = APIRouter(tags=["library"], dependencies=[Depends(get_current_user)])


@router.get("/api/storefronts", response_model=list[str])
def list_storefronts(db: Session = Depends(get_db)) -> list[str]:
    return library_service.list_distinct_storefronts(db)


@router.get("/api/genres", response_model=list[CatalogRefResponse])
def list_genres(db: Session = Depends(get_db)) -> list[CatalogRefResponse]:
    """Every known genre (id+name+slug), name-sorted — the Genre filter's options."""
    return [genre_ref_from_orm(genre) for genre in genre_repository.list_all(db)]


@router.get("/api/game-modes", response_model=list[str])
def list_game_modes(db: Session = Depends(get_db)) -> list[str]:
    """Every IGDB game-mode name recorded on any game, sorted — the Game Modes filter's options."""
    return game_repository.list_distinct_game_modes(db)


@router.get("/api/library/items", response_model=list[LibraryListItemResponse])
def list_all_library_items(db: Session = Depends(get_db)) -> list[LibraryListItemResponse]:
    """Flat list of all library items for the Games List page table."""
    return [LibraryListItemResponse(**item) for item in library_service.list_all_library_items(db)]


@router.get("/api/games/{game_id}/library", response_model=list[LibraryItemResponse])
def list_library_items(
    game_id: int,
    status_filter: LibraryStatus | None = Query(default=None, alias="status"),
    db: Session = Depends(get_db),
) -> list[LibraryItemResponse]:
    items = library_service.list_library_items(db, game_id, status=status_filter)
    itad_cache = itad_repository.get_cache(db, game_id)
    platprices_cache = platprices_repository.get_cache(db, game_id)
    return [library_item_from_orm(item, itad_cache, platprices_cache) for item in items]


@router.post("/api/games/{game_id}/library", response_model=LibraryItemResponse, status_code=status.HTTP_201_CREATED)
def add_library_item(
    game_id: int, body: LibraryItemCreateRequest, db: Session = Depends(get_db)
) -> LibraryItemResponse:
    item = library_service.add_library_item(db, game_id, **body.model_dump())
    itad_cache = itad_repository.get_cache(db, game_id)
    platprices_cache = platprices_repository.get_cache(db, game_id)
    return library_item_from_orm(item, itad_cache, platprices_cache)


@router.put("/api/library/{item_id}", response_model=LibraryItemResponse)
def update_library_item(
    item_id: int, body: LibraryItemUpdateRequest, db: Session = Depends(get_db)
) -> LibraryItemResponse:
    item = library_service.update_library_item(db, item_id, **body.model_dump(exclude_unset=True))
    itad_cache = itad_repository.get_cache(db, item.game_id)
    platprices_cache = platprices_repository.get_cache(db, item.game_id)
    return library_item_from_orm(item, itad_cache, platprices_cache)


class BulkUpdateLibraryItemsRequest(BaseModel):
    item_ids: list[int] = Field(min_length=1, max_length=1000)
    field: Literal["format", "platform", "region", "status", "edition", "notes"]
    # format/status arrive as their enum value strings, platform/region as
    # integer ids, edition/notes as free text (blank clears the field).
    value: str | int | None = None


class BulkUpdateResponse(BaseModel):
    updated: int


@router.post("/api/library/bulk-update", response_model=BulkUpdateResponse)
def bulk_update_library_items(
    body: BulkUpdateLibraryItemsRequest, db: Session = Depends(get_db)
) -> BulkUpdateResponse:
    """Set a single field on many library items at once (List page bulk edit)."""
    value: object = body.value
    if body.field == "format":
        try:
            value = MediaFormat(body.value) if body.value is not None else None
        except ValueError:
            raise HTTPException(status_code=422, detail=f"Invalid format: {body.value}") from None
    elif body.field == "status":
        try:
            value = LibraryStatus(body.value)  # type: ignore[arg-type]
        except ValueError:
            raise HTTPException(status_code=422, detail=f"Invalid status: {body.value}") from None
    elif body.field in ("platform", "region"):
        if not isinstance(body.value, int):
            raise HTTPException(status_code=422, detail=f"{body.field} value must be an id")
    updated = library_service.bulk_update_library_items(db, body.item_ids, body.field, value)
    return BulkUpdateResponse(updated=updated)


class BulkDeleteLibraryItemsRequest(BaseModel):
    item_ids: list[int] = Field(min_length=1, max_length=1000)


class BulkDeleteResponse(BaseModel):
    deleted: int


@router.post("/api/library/bulk-delete", response_model=BulkDeleteResponse)
def bulk_delete_library_items(
    body: BulkDeleteLibraryItemsRequest, db: Session = Depends(get_db)
) -> BulkDeleteResponse:
    """Delete many library items at once (List page bulk delete)."""
    deleted = library_service.bulk_delete_library_items(db, body.item_ids)
    return BulkDeleteResponse(deleted=deleted)


@router.delete("/api/library/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_library_item(item_id: int, db: Session = Depends(get_db)) -> None:
    library_service.delete_library_item(db, item_id)


class MoveLibraryItemRequest(BaseModel):
    target_game_id: int


class SplitLibraryItemRequest(BaseModel):
    new_game_name: str


@router.post("/api/library/{item_id}/move", response_model=LibraryItemResponse)
def move_library_item(
    item_id: int, body: MoveLibraryItemRequest, db: Session = Depends(get_db)
) -> LibraryItemResponse:
    """Move a library item to a different game."""
    item = library_service.move_library_item(db, item_id, body.target_game_id)
    itad_cache = itad_repository.get_cache(db, item.game_id)
    platprices_cache = platprices_repository.get_cache(db, item.game_id)
    return library_item_from_orm(item, itad_cache, platprices_cache)


@router.post("/api/library/{item_id}/split", response_model=LibraryItemResponse)
def split_library_item(
    item_id: int, body: SplitLibraryItemRequest, db: Session = Depends(get_db)
) -> LibraryItemResponse:
    """Split a library item into its own new game listing."""
    _new_game, item = library_service.split_library_item_to_new_game(
        db, item_id, body.new_game_name
    )
    itad_cache = itad_repository.get_cache(db, item.game_id)
    platprices_cache = platprices_repository.get_cache(db, item.game_id)
    return library_item_from_orm(item, itad_cache, platprices_cache)
