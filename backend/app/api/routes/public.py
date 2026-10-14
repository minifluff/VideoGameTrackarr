from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.api.routes.game_filters import GameFilterParams
from app.models.library import LibraryStatus
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
    params: GameFilterParams = Depends(),
    db: Session = Depends(get_db),
) -> list[PublicGameSummaryResponse]:
    auth_service.get_user_by_share_token(db, token)
    games = game_service.search_local_games(db, **vars(params))
    # Single query for all owned platforms across the returned games (avoids N+1).
    game_ids = [g.game.id for g in games]
    platforms_by_game: dict[int, set[str]] = {}
    if game_ids:
        from sqlalchemy import select

        from app.models.catalog import Platform
        from app.models.library import LibraryItem
        rows = db.execute(
            select(LibraryItem.game_id, Platform.name)
            .join(Platform, LibraryItem.platform_id == Platform.id)
            .where(
                LibraryItem.game_id.in_(game_ids),
                LibraryItem.status == LibraryStatus.OWNED,
            )
        ).all()
        for game_id, platform_name in rows:
            platforms_by_game.setdefault(game_id, set()).add(platform_name)
    return [
        public_game_from_orm(
            g, owned_platforms=sorted(platforms_by_game.get(g.game.id, set()))
        )
        for g in games
    ]


@router.get("/platforms", response_model=list[dict])
def list_public_platforms(
    token: str,
    db: Session = Depends(get_db),
) -> list[dict]:
    """Platforms the user owns games on, for the public page filter."""
    from app.repositories import platform_repository
    auth_service.get_user_by_share_token(db, token)
    return [{"id": p.id, "name": p.name} for p in platform_repository.list_platforms(db)]


@router.get("/tags", response_model=list[dict])
def list_public_tags(
    token: str,
    db: Session = Depends(get_db),
) -> list[dict]:
    """Tags used on games, for the public page filter."""
    from app.repositories import tag_repository
    auth_service.get_user_by_share_token(db, token)
    return [{"id": t.id, "name": t.name} for t in tag_repository.list_tags(db)]


@router.get("/collections", response_model=list[dict])
def list_public_collections(
    token: str,
    db: Session = Depends(get_db),
) -> list[dict]:
    """Collections, for the public page filter."""
    from app.repositories import collection_repository
    auth_service.get_user_by_share_token(db, token)
    return [{"id": col.id, "name": col.name} for col in collection_repository.list_collections(db)]


@router.get("/franchises", response_model=list[dict])
def list_public_franchises(
    token: str,
    db: Session = Depends(get_db),
) -> list[dict]:
    """Franchises (series), for the public page filter."""
    from app.repositories import franchise_repository
    auth_service.get_user_by_share_token(db, token)
    return [{"id": f.id, "name": f.name} for f in franchise_repository.list_franchises(db)]


@router.get("/games/{game_id}", response_model=PublicGameDetailResponse)
def get_public_game(token: str, game_id: int, db: Session = Depends(get_db)) -> PublicGameDetailResponse:
    auth_service.get_user_by_share_token(db, token)
    status = game_service.get_public_game_detail(db, game_id)
    # Owned platforms for this game.
    from sqlalchemy import select

    from app.models.catalog import Platform
    from app.models.library import LibraryItem

    rows = db.execute(
        select(Platform.name)
        .join(LibraryItem, LibraryItem.platform_id == Platform.id)
        .where(
            LibraryItem.game_id == status.game.id,
            LibraryItem.status == LibraryStatus.OWNED,
        )
    ).all()
    owned_platforms = sorted({row[0] for row in rows})
    return public_game_detail_from_orm(status, owned_platforms=owned_platforms)


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
