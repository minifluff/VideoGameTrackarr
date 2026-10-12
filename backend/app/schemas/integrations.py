from datetime import datetime

from app.schemas.base import CamelModel


class IntegrationsStatusResponse(CamelModel):
    igdb_configured: bool
    steam_api_key_configured: bool
    steam_id_64: str | None
    itad_configured: bool
    itad_country: str
    platprices_configured: bool
    platprices_region: str
    playnite_configured: bool


class UpdateSteamIdRequest(CamelModel):
    steam_id_64: str | None


class SteamEntryResponse(CamelModel):
    steam_app_id: int
    steam_name: str
    steam_playtime_minutes: int
    steam_last_played_at: datetime | None
    status: str
    game_id: int | None
    game_name: str | None
    game_slug: str | None
    game_cover_url: str | None
    vgt_playtime_minutes: int | None
    # The matched game's parent (if any) — lets the Steam Sync page nest a DLC/expansion/
    # pack row under its parent's row instead of listing it flat.
    parent_game_id: int | None


class SyncSteamEntriesRequest(CamelModel):
    steam_app_ids: list[int]


class RelinkSteamEntryRequest(CamelModel):
    game_id: int


class SyncResultFailure(CamelModel):
    steam_app_id: int
    error: str


class SyncResultResponse(CamelModel):
    synced: int
    failed: int
    failures: list[SyncResultFailure]


class SteamStoreDetailsResponse(CamelModel):
    name: str
    summary: str | None
    cover_url: str | None


class SteamWishlistEntryResponse(CamelModel):
    steam_app_id: int
    steam_name: str
    wishlist_added_at: datetime | None
    status: str
    game_id: int | None
    game_name: str | None
    game_slug: str | None
    game_cover_url: str | None
    parent_game_id: int | None


class PlayniteConfigRequest(CamelModel):
    # All optional — None clears the stored value. An empty password string also clears
    # it; None leaves the existing password untouched.
    smb_path: str | None = None
    smb_username: str | None = None
    smb_password: str | None = None


class PlayniteConfigResponse(CamelModel):
    smb_path: str | None
    smb_username: str | None
    # Never expose the actual password — only whether one is stored.
    has_password: bool


class PlayniteEntryResponse(CamelModel):
    playnite_id: str
    playnite_name: str
    playnite_platform: str | None
    playtime_minutes: int
    status: str
    game_id: int | None
    game_name: str | None
    dismissed: bool


class PlayniteScanResponse(CamelModel):
    scanned: int
    new_count: int


class PlayniteSyncRequest(CamelModel):
    playnite_ids: list[str]


class PlayniteSyncFailure(CamelModel):
    playnite_id: str
    error: str


class PlayniteSyncResultResponse(CamelModel):
    synced: int
    failed: int
    failures: list[PlayniteSyncFailure]


class PlayniteTestRequest(CamelModel):
    smb_path: str | None = None
    smb_username: str | None = None
    smb_password: str | None = None


class PlayniteTestResponse(CamelModel):
    ok: bool
    message: str
