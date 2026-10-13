from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.models.library import LibraryStatus
from app.repositories import library_item_repository
from app.repositories.game_repository import GameSortOption
from app.schemas.public import (
    PublicAccessorySummaryResponse,
    PublicDeviceSummaryResponse,
    PublicGameDetailResponse,
    PublicGameSummaryResponse,
    public_accessory_from_orm,
    public_device_from_orm,
    public_game_detail_from_orm,
    public_game_from_orm,
)
from app.services import accessory_service, auth_service, device_service, game_service

# No auth dependency — this is the app's one deliberately unauthenticated router, gated
# instead by the unlisted per-user token in the path. See auth_service.get_user_by_share_token.
router = APIRouter(prefix="/api/public/{token}", tags=["public"])


@router.get("/games", response_model=list[PublicGameSummaryResponse])
def list_public_games(
    token: str,
    search: str | None = Query(default=None),
    platform_ids: list[int] | None = Query(default=None, alias="platformId"),
    sort: GameSortOption = Query(default=GameSortOption.NAME_ASC),
    db: Session = Depends(get_db),
) -> list[PublicGameSummaryResponse]:
    auth_service.get_user_by_share_token(db, token)
    games = game_service.search_local_games(db, search=search, platform_ids=platform_ids, sort=sort)
    result = []
    for game in games:
        owned_platforms = []
        for item in library_item_repository.list_library_items(db, game.game.id, status=LibraryStatus.OWNED):
            if item.platform and item.platform.name not in owned_platforms:
                owned_platforms.append(item.platform.name)
        result.append(public_game_from_orm(game, owned_platforms=sorted(owned_platforms)))
    return result


@router.get("/platforms", response_model=list[dict])
def list_public_platforms(
    token: str,
    db: Session = Depends(get_db),
) -> list[dict]:
    """Platforms the user owns games on, for the public page filter."""
    from app.repositories import platform_repository
    auth_service.get_user_by_share_token(db, token)
    return [{"id": p.id, "name": p.name} for p in platform_repository.list_platforms(db)]


@router.get("/games/{game_id}", response_model=PublicGameDetailResponse)
def get_public_game(token: str, game_id: int, db: Session = Depends(get_db)) -> PublicGameDetailResponse:
    auth_service.get_user_by_share_token(db, token)
    return public_game_detail_from_orm(game_service.get_public_game_detail(db, game_id))


@router.get("/devices", response_model=list[PublicDeviceSummaryResponse])
def list_public_devices(
    token: str, search: str | None = Query(default=None), db: Session = Depends(get_db)
) -> list[PublicDeviceSummaryResponse]:
    auth_service.get_user_by_share_token(db, token)
    devices = device_service.list_devices(db, search=search)
    return [public_device_from_orm(device) for device in devices]


@router.get("/accessories", response_model=list[PublicAccessorySummaryResponse])
def list_public_accessories(
    token: str, search: str | None = Query(default=None), db: Session = Depends(get_db)
) -> list[PublicAccessorySummaryResponse]:
    auth_service.get_user_by_share_token(db, token)
    accessories = accessory_service.list_accessories(db, search=search)
    return [public_accessory_from_orm(accessory) for accessory in accessories]
