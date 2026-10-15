from fastapi import APIRouter, Depends, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.library import LibraryStatus
from app.repositories import itad_repository, platprices_repository
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


@router.get("/api/library/items")
def list_all_library_items(db: Session = Depends(get_db)):
    """Flat list of all library items for the Games List page table."""
    import traceback
    try:
        items = library_service.list_all_library_items(db)
        result = []
        errors = []
        for item in items:
            try:
                result.append(LibraryListItemResponse(**item).model_dump(by_alias=True))
            except Exception as e:
                errors.append(f"Item {item.get('id')}: {e}")
                continue
        # Return errors in a header for debugging
        return {"items": result, "errors": errors}
    except Exception as e:
        tb = traceback.format_exc()
        # Return the full traceback so we can see what's failing
        from fastapi.responses import JSONResponse
        return JSONResponse(
            status_code=500,
            content={"error": str(e), "traceback": tb}
        )


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
