from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.api.routes.game_filters import GameFilterParams
from app.schemas.game import GameSummaryResponse, game_summary_from_orm
from app.schemas.platform_detail import (
    PlatformCreateRequest,
    PlatformDetailResponse,
    PlatformSummaryResponse,
    PlatformUpdateRequest,
    platform_detail_from_orm,
    platform_summary_from_orm,
)
from app.services import insight_service, platform_service

router = APIRouter(prefix="/api/platforms", tags=["platforms"], dependencies=[Depends(get_current_user)])


@router.get("", response_model=list[PlatformSummaryResponse])
def list_platforms(db: Session = Depends(get_db)) -> list[PlatformSummaryResponse]:
    platforms = platform_service.list_platforms(db)
    return [platform_summary_from_orm(platform, count) for platform, count in platforms]


@router.get("/{slug}", response_model=PlatformDetailResponse)
def get_platform(slug: str, db: Session = Depends(get_db)) -> PlatformDetailResponse:
    platform, games, addons = platform_service.get_platform_with_games(db, slug)
    on_sale_game_ids = insight_service.get_on_sale_game_ids(db)
    return platform_detail_from_orm(platform, games, addons, on_sale_game_ids)


@router.get("/{slug}/addons", response_model=list[GameSummaryResponse])
def list_platform_addons(
    slug: str, params: GameFilterParams = Depends(), db: Session = Depends(get_db)
) -> list[GameSummaryResponse]:
    addons = platform_service.list_platform_addons(db, slug, **vars(params))
    on_sale_game_ids = insight_service.get_on_sale_game_ids(db)
    return [game_summary_from_orm(addon, on_sale_game_ids) for addon in addons]


@router.post("", response_model=PlatformSummaryResponse, status_code=status.HTTP_201_CREATED)
def create_platform(body: PlatformCreateRequest, db: Session = Depends(get_db)) -> PlatformSummaryResponse:
    platform = platform_service.create_platform(db, body.name, body.abbreviation)
    return platform_summary_from_orm(platform, 0)


@router.patch("/{platform_id}", response_model=PlatformSummaryResponse)
def update_platform(
    platform_id: int, body: PlatformUpdateRequest, db: Session = Depends(get_db)
) -> PlatformSummaryResponse:
    platform = platform_service.update_platform(db, platform_id, body.name, body.abbreviation)
    return platform_summary_from_orm(platform, 0)


@router.delete("/{platform_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_platform(platform_id: int, db: Session = Depends(get_db)) -> None:
    platform_service.delete_platform(db, platform_id)


@router.post("/{source_id}/move-to/{target_id}")
def mass_move_games(
    source_id: int, target_id: int, db: Session = Depends(get_db)
) -> dict[str, int]:
    moved = platform_service.mass_move_games(db, source_id, target_id)
    return {"moved_count": moved}
