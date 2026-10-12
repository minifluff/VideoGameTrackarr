from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.system import User
from app.schemas.integrations import (
    IntegrationsStatusResponse,
    PlayniteConfigRequest,
    PlayniteConfigResponse,
    PlayniteEntryResponse,
    PlayniteScanResponse,
    PlayniteSyncRequest,
    PlayniteSyncResultResponse,
    PlayniteTestRequest,
    PlayniteTestResponse,
    RelinkSteamEntryRequest,
    SteamEntryResponse,
    SteamStoreDetailsResponse,
    SteamWishlistEntryResponse,
    SyncResultResponse,
    SyncSteamEntriesRequest,
    UpdateSteamIdRequest,
)
from app.services import integrations_service, playnite_service, steam_service, steam_wishlist_service
from app.services.exceptions import NotFoundError
from app.services.playnite_service import PlayniteError
from app.services.steam_store_client import SteamStoreClient

router = APIRouter(tags=["integrations"], dependencies=[Depends(get_current_user)])


@router.get("/api/integrations", response_model=IntegrationsStatusResponse)
def get_integrations_status(current_user: User = Depends(get_current_user)) -> IntegrationsStatusResponse:
    return integrations_service.get_status(current_user)


@router.put("/api/integrations/steam", response_model=IntegrationsStatusResponse)
def update_steam_id(
    payload: UpdateSteamIdRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> IntegrationsStatusResponse:
    updated_user = integrations_service.set_steam_id(db, current_user, payload.steam_id_64)
    return integrations_service.get_status(updated_user)


@router.get("/api/integrations/steam/entries", response_model=list[SteamEntryResponse])
def get_steam_entries(db: Session = Depends(get_db)) -> list[SteamEntryResponse]:
    return [_entry_response(item) for item in steam_service.list_entries(db)]


@router.post("/api/integrations/steam/sync", response_model=SyncResultResponse)
def sync_steam_entries(payload: SyncSteamEntriesRequest, db: Session = Depends(get_db)) -> SyncResultResponse:
    return SyncResultResponse.model_validate(steam_service.sync_entries(db, payload.steam_app_ids))


@router.post("/api/integrations/steam/{steam_app_id}/ignore", response_model=SteamEntryResponse)
def ignore_steam_entry(steam_app_id: int, db: Session = Depends(get_db)) -> SteamEntryResponse:
    return _entry_response(steam_service.ignore_entry(db, steam_app_id))


@router.post("/api/integrations/steam/{steam_app_id}/relink", response_model=SteamEntryResponse)
def relink_steam_entry(
    steam_app_id: int, payload: RelinkSteamEntryRequest, db: Session = Depends(get_db)
) -> SteamEntryResponse:
    return _entry_response(steam_service.relink_entry(db, steam_app_id, payload.game_id))


@router.post("/api/integrations/steam/{steam_app_id}/unlink", response_model=SteamEntryResponse)
def unlink_steam_entry(steam_app_id: int, db: Session = Depends(get_db)) -> SteamEntryResponse:
    return _entry_response(steam_service.unlink_entry(db, steam_app_id))


@router.get("/api/integrations/steam/{steam_app_id}/store-details", response_model=SteamStoreDetailsResponse)
async def get_steam_store_details(steam_app_id: int) -> SteamStoreDetailsResponse:
    async with SteamStoreClient() as client:
        details = await client.get_app_details(steam_app_id)
    if details is None:
        raise NotFoundError(f"No Steam store page found for app {steam_app_id}")
    return SteamStoreDetailsResponse(name=details.name, summary=details.summary, cover_url=details.cover_url)


@router.get("/api/integrations/steam/wishlist/entries", response_model=list[SteamWishlistEntryResponse])
def get_steam_wishlist_entries(db: Session = Depends(get_db)) -> list[SteamWishlistEntryResponse]:
    return [_wishlist_entry_response(item) for item in steam_wishlist_service.list_entries(db)]


@router.post("/api/integrations/steam/wishlist/sync", response_model=SyncResultResponse)
def sync_steam_wishlist_entries(
    payload: SyncSteamEntriesRequest, db: Session = Depends(get_db)
) -> SyncResultResponse:
    return SyncResultResponse.model_validate(steam_wishlist_service.sync_entries(db, payload.steam_app_ids))


@router.post(
    "/api/integrations/steam/wishlist/{steam_app_id}/ignore", response_model=SteamWishlistEntryResponse
)
def ignore_steam_wishlist_entry(steam_app_id: int, db: Session = Depends(get_db)) -> SteamWishlistEntryResponse:
    return _wishlist_entry_response(steam_wishlist_service.ignore_entry(db, steam_app_id))


@router.post(
    "/api/integrations/steam/wishlist/{steam_app_id}/relink", response_model=SteamWishlistEntryResponse
)
def relink_steam_wishlist_entry(
    steam_app_id: int, payload: RelinkSteamEntryRequest, db: Session = Depends(get_db)
) -> SteamWishlistEntryResponse:
    return _wishlist_entry_response(steam_wishlist_service.relink_entry(db, steam_app_id, payload.game_id))


@router.post(
    "/api/integrations/steam/wishlist/{steam_app_id}/unlink", response_model=SteamWishlistEntryResponse
)
def unlink_steam_wishlist_entry(steam_app_id: int, db: Session = Depends(get_db)) -> SteamWishlistEntryResponse:
    return _wishlist_entry_response(steam_wishlist_service.unlink_entry(db, steam_app_id))


def _wishlist_entry_response(
    item: "steam_wishlist_service.SteamWishlistEntryWithStatus",
) -> SteamWishlistEntryResponse:
    entry = item.entry
    game = entry.game
    return SteamWishlistEntryResponse(
        steam_app_id=entry.steam_app_id,
        steam_name=entry.steam_name,
        wishlist_added_at=entry.wishlist_added_at,
        status=item.status.value,
        game_id=game.id if game else None,
        game_name=game.name if game else None,
        game_slug=game.slug if game else None,
        game_cover_url=game.cover_url if game else None,
        parent_game_id=game.parent_game_id if game else None,
    )


def _entry_response(item: "steam_service.SteamEntryWithStatus") -> SteamEntryResponse:
    entry = item.entry
    game = entry.game
    return SteamEntryResponse(
        steam_app_id=entry.steam_app_id,
        steam_name=entry.steam_name,
        steam_playtime_minutes=entry.steam_playtime_minutes,
        steam_last_played_at=entry.steam_last_played_at,
        status=item.status.value,
        game_id=game.id if game else None,
        game_name=game.name if game else None,
        game_slug=game.slug if game else None,
        game_cover_url=game.cover_url if game else None,
        vgt_playtime_minutes=item.vgt_playtime_minutes,
        parent_game_id=game.parent_game_id if game else None,
    )


@router.put("/api/integrations/playnite", response_model=PlayniteConfigResponse)
def update_playnite_config(
    payload: PlayniteConfigRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PlayniteConfigResponse:
    updated_user = playnite_service.set_config(
        db, current_user, payload.smb_path, payload.smb_username, payload.smb_password
    )
    return PlayniteConfigResponse.model_validate(playnite_service.get_config(updated_user))


@router.get("/api/integrations/playnite", response_model=PlayniteConfigResponse)
def get_playnite_config(current_user: User = Depends(get_current_user)) -> PlayniteConfigResponse:
    return PlayniteConfigResponse.model_validate(playnite_service.get_config(current_user))


@router.post("/api/integrations/playnite/test", response_model=PlayniteTestResponse)
def test_playnite_connection(
    payload: PlayniteTestRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PlayniteTestResponse:
    # Blank fields fall back to the saved config, so testing works without retyping
    # the password every time.
    saved = playnite_service.get_config(current_user)
    smb_path = payload.smb_path or saved.get("smb_path")
    smb_username = payload.smb_username if payload.smb_username is not None else saved.get("smb_username")
    smb_password = payload.smb_password or (current_user.playnite_smb_password or None)
    try:
        playnite_service.test_connection(smb_path or "", smb_username, smb_password)
    except PlayniteError as exc:
        return PlayniteTestResponse(ok=False, message=str(exc))
    return PlayniteTestResponse(ok=True, message="Connection successful.")


@router.post("/api/integrations/playnite/scan", response_model=PlayniteScanResponse)
def scan_playnite_library(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PlayniteScanResponse:
    try:
        result = playnite_service.scan_library(db, current_user)
    except PlayniteError as exc:
        # 422 (not 500): this is a user-fixable config/network problem, not a server bug.
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return PlayniteScanResponse.model_validate(result)


@router.get("/api/integrations/playnite/entries", response_model=list[PlayniteEntryResponse])
def get_playnite_entries(db: Session = Depends(get_db)) -> list[PlayniteEntryResponse]:
    return [_playnite_entry_response(item) for item in playnite_service.list_entries(db)]


@router.post("/api/integrations/playnite/sync", response_model=PlayniteSyncResultResponse)
def sync_playnite_entries(payload: PlayniteSyncRequest, db: Session = Depends(get_db)) -> PlayniteSyncResultResponse:
    return PlayniteSyncResultResponse.model_validate(playnite_service.sync_entries(db, payload.playnite_ids))


@router.post("/api/integrations/playnite/{playnite_id}/ignore", response_model=PlayniteEntryResponse)
def ignore_playnite_entry(playnite_id: str, db: Session = Depends(get_db)) -> PlayniteEntryResponse:
    return _playnite_entry_response(playnite_service.ignore_entry(db, playnite_id))


@router.post("/api/integrations/playnite/{playnite_id}/unignore", response_model=PlayniteEntryResponse)
def unignore_playnite_entry(playnite_id: str, db: Session = Depends(get_db)) -> PlayniteEntryResponse:
    return _playnite_entry_response(playnite_service.unignore_entry(db, playnite_id))


def _playnite_entry_response(item: "playnite_service.PlayniteEntryWithStatus") -> PlayniteEntryResponse:
    entry = item.entry
    game = entry.game
    return PlayniteEntryResponse(
        playnite_id=entry.playnite_id,
        playnite_name=entry.playnite_name,
        playnite_platform=entry.playnite_platform,
        playtime_minutes=entry.playnite_playtime_minutes,
        status=item.status.value,
        game_id=game.id if game else None,
        game_name=game.name if game else None,
        dismissed=entry.dismissed,
    )
