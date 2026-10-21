from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.api.routes.game_filters import GameFilterParams
from app.models.library import MediaFormat
from app.schemas.game import GameSummaryResponse, game_summary_from_orm
from app.schemas.platform import LibraryPlatformResponse
from app.schemas.platform_detail import (
    PlatformCaseSizeRequest,
    PlatformCreateRequest,
    PlatformDetailResponse,
    PlatformSpineTemplateRequest,
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


# Declared before /{slug_or_id} so "library" isn't read as a platform slug.
@router.get("/library", response_model=list[LibraryPlatformResponse])
def list_library_platforms(db: Session = Depends(get_db)) -> list[LibraryPlatformResponse]:
    return [
        LibraryPlatformResponse(
            id=row.platform.id,
            name=row.platform.name,
            slug=row.platform.slug,
            abbreviation=row.platform.abbreviation,
            format=row.media_format.value if row.media_format else None,
            storefront=row.storefront,
            owned_count=row.owned,
            wishlisted_count=row.wishlisted,
        )
        for row in platform_service.list_library_platforms(db)
    ]


@router.get("/{slug_or_id}", response_model=PlatformDetailResponse)
def get_platform(slug_or_id: str, db: Session = Depends(get_db)) -> PlatformDetailResponse:
    platform, games, addons = platform_service.get_platform_with_games(db, slug_or_id)
    on_sale_game_ids = insight_service.get_on_sale_game_ids(db)
    return platform_detail_from_orm(platform, games, addons, on_sale_game_ids)


@router.get("/{slug_or_id}/addons", response_model=list[GameSummaryResponse])
def list_platform_addons(
    slug_or_id: str,
    params: GameFilterParams = Depends(),
    # Same names as GET /api/games, for a PC storefront card's page.
    required_platform_format: MediaFormat | None = Query(default=None, alias="requiredPlatformFormat"),
    required_platform_storefront: str | None = Query(default=None, alias="requiredPlatformStorefront"),
    db: Session = Depends(get_db),
) -> list[GameSummaryResponse]:
    addons = platform_service.list_platform_addons(
        db, slug_or_id, required_platform_format, required_platform_storefront, **vars(params)
    )
    on_sale_game_ids = insight_service.get_on_sale_game_ids(db)
    return [game_summary_from_orm(addon, on_sale_game_ids) for addon in addons]


@router.post("", response_model=PlatformSummaryResponse, status_code=status.HTTP_201_CREATED)
def create_platform(body: PlatformCreateRequest, db: Session = Depends(get_db)) -> PlatformSummaryResponse:
    platform = platform_service.create_platform(db, body.name, body.abbreviation, body.slug, body.igdb_id)
    return platform_summary_from_orm(platform, 0)


@router.patch("/{platform_id}", response_model=PlatformSummaryResponse)
def update_platform(
    platform_id: int, body: PlatformUpdateRequest, db: Session = Depends(get_db)
) -> PlatformSummaryResponse:
    platform = platform_service.update_platform(db, platform_id, body.name, body.abbreviation, body.slug, body.igdb_id)
    return platform_summary_from_orm(platform, 0)


@router.put("/{platform_id}/spine-template", response_model=PlatformSummaryResponse)
def set_platform_spine_template(
    platform_id: int, body: PlatformSpineTemplateRequest, db: Session = Depends(get_db)
) -> PlatformSummaryResponse:
    platform = platform_service.set_platform_spine_template(db, platform_id, body.spine_url)
    return platform_summary_from_orm(platform, 0)


@router.put("/{platform_id}/case-size", response_model=PlatformSummaryResponse)
def set_platform_case_size(
    platform_id: int, body: PlatformCaseSizeRequest, db: Session = Depends(get_db)
) -> PlatformSummaryResponse:
    platform = platform_service.set_platform_case_size(db, platform_id, body.height_mm, body.spine_mm)
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
