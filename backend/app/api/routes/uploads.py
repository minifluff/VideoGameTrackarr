from collections.abc import Callable

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from PIL.Image import DecompressionBombError

from app.api.deps import get_current_user
from app.schemas.upload import UploadResponse
from app.services import upload_service

router = APIRouter(prefix="/api/uploads", tags=["uploads"], dependencies=[Depends(get_current_user)])

_CHUNK_SIZE = 1024 * 1024
# Uploaded images are re-encoded to bounded JPEGs/PNGs downstream, but the raw
# upload used to be buffered unbounded (await file.read()) — a multi-GB body
# would OOM the container before Pillow ever saw it. Cap the buffered read;
# 32 MB is far above any real cover/spine scan.
MAX_IMAGE_BYTES = 32 * 1024 * 1024


async def read_upload_capped(file: UploadFile, max_bytes: int) -> bytes:
    """Chunked read with a byte cap, mirroring rom_service._stream_to_file's
    cap (buffered, but bounded by max_bytes instead of unbounded). Shared by
    the CSV/JSON import routes as well."""
    chunks: list[bytes] = []
    size = 0
    while chunk := await file.read(_CHUNK_SIZE):
        size += len(chunk)
        if size > max_bytes:
            raise HTTPException(
                status_code=413, detail=f"File is larger than the {max_bytes // (1024 * 1024)} MB limit"
            )
        chunks.append(chunk)
    return b"".join(chunks)


async def _save_upload(file: UploadFile, saver: Callable[[bytes], str]) -> str:
    raw = await read_upload_capped(file, MAX_IMAGE_BYTES)
    try:
        return saver(raw)
    except DecompressionBombError as exc:
        # Not a ValueError, so without this a decompression-bomb image escaped
        # the routes' ValueError handler as a 500.
        raise HTTPException(status_code=400, detail="Image pixel count exceeds the safety limit") from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/covers", response_model=UploadResponse, status_code=201)
async def upload_cover(file: UploadFile = File(...)) -> UploadResponse:
    return UploadResponse(url=await _save_upload(file, upload_service.save_cover_image))


@router.post("/spines", response_model=UploadResponse, status_code=201)
async def upload_spine(file: UploadFile = File(...)) -> UploadResponse:
    return UploadResponse(url=await _save_upload(file, upload_service.save_spine_image))


@router.post("/accessory-images", response_model=UploadResponse, status_code=201)
async def upload_accessory_image(file: UploadFile = File(...)) -> UploadResponse:
    return UploadResponse(url=await _save_upload(file, upload_service.save_accessory_image))
