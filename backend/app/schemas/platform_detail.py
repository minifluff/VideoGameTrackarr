from pydantic import Field

from app.models.catalog import Platform
from app.repositories.game_repository import GameWithStatus
from app.schemas.base import CamelModel
from app.schemas.game import GameSummaryResponse, game_summary_from_orm


class PlatformDetailResponse(CamelModel):
    id: int
    name: str
    slug: str | None
    abbreviation: str | None
    games: list[GameSummaryResponse]
    addons: list[GameSummaryResponse]


class PlatformSummaryResponse(CamelModel):
    id: int
    igdb_id: int | None
    name: str
    slug: str | None
    abbreviation: str | None
    spine_template_url: str | None
    case_height_mm: float | None
    case_spine_mm: float | None
    game_count: int


def platform_detail_from_orm(
    platform: Platform,
    games: list[GameWithStatus],
    addons: list[GameWithStatus],
    on_sale_game_ids: frozenset[int] = frozenset(),
) -> PlatformDetailResponse:
    return PlatformDetailResponse(
        id=platform.id,
        name=platform.name,
        slug=platform.slug,
        abbreviation=platform.abbreviation,
        games=[game_summary_from_orm(game, on_sale_game_ids) for game in games],
        addons=[game_summary_from_orm(addon, on_sale_game_ids) for addon in addons],
    )


def platform_summary_from_orm(platform: Platform, game_count: int) -> PlatformSummaryResponse:
    return PlatformSummaryResponse(
        id=platform.id,
        igdb_id=platform.igdb_id,
        name=platform.name,
        slug=platform.slug,
        abbreviation=platform.abbreviation,
        spine_template_url=platform.spine_template_url,
        case_height_mm=platform.case_height_mm,
        case_spine_mm=platform.case_spine_mm,
        game_count=game_count,
    )


class PlatformSpineTemplateRequest(CamelModel):
    spine_url: str | None = Field(default=None, max_length=1024)


class PlatformCaseSizeRequest(CamelModel):
    height_mm: float | None = Field(default=None, gt=0, le=1000)
    spine_mm: float | None = Field(default=None, gt=0, le=500)


class PlatformCreateRequest(CamelModel):
    name: str = Field(min_length=1, max_length=255)
    abbreviation: str | None = Field(default=None, max_length=50)
    slug: str | None = Field(default=None, max_length=255)
    igdb_id: int | None = Field(default=None)


class PlatformUpdateRequest(CamelModel):
    name: str = Field(min_length=1, max_length=255)
    abbreviation: str | None = Field(default=None, max_length=50)
    slug: str | None = Field(default=None, max_length=255)
    igdb_id: int | None = Field(default=None)
