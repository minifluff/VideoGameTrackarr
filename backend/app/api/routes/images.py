from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from app.api.deps import get_current_user, get_db  # noqa: F401
from app.core.config import get_settings
from app.models.system import User  # noqa: F401
from app.services import image_search_service
from app.services.image_search_service import ImageSearchNotConfiguredError

router = APIRouter(prefix="/api/images", tags=["images"], dependencies=[Depends(get_current_user)])


class ImageSearchResult(BaseModel):
    url: str
    thumbnail: str
    title: str
    width: int | None = None
    height: int | None = None


class ImageSearchStatusResponse(BaseModel):
    configured: bool


@router.get("/search/status", response_model=ImageSearchStatusResponse)
def image_search_status() -> ImageSearchStatusResponse:
    settings = get_settings()
    return ImageSearchStatusResponse(
        configured=bool(settings.google_search_api_key and settings.google_search_engine_id)
    )


@router.get("/search", response_model=list[ImageSearchResult])
async def search_images(
    query: str = Query(min_length=1, max_length=200),
    limit: int = Query(default=10, ge=1, le=10),
) -> list[ImageSearchResult]:
    settings = get_settings()
    try:
        results = await image_search_service.search_images(
            settings.google_search_api_key,
            settings.google_search_engine_id,
            query,
            limit,
        )
    except ImageSearchNotConfiguredError as e:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(e)) from e
    except image_search_service.ImageSearchError as e:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(e)) from e
    return [ImageSearchResult(**r) for r in results]
