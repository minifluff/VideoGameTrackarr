"""Full database reset: removes every game (library items, catalog entries, and all
attached data) and clears the sync-tool caches so Playnite/Steam/CSV can reimport
from scratch. User account, settings, and connection configs are left untouched."""

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models.catalog import (
    Artwork,
    Game,
    GameCollection,
    GameCompany,
    GameFranchise,
    GameGenre,
    GamePlatform,
    GameVideo,
    ReleaseDate,
    Screenshot,
)
from app.models.library import (
    GameProgress,
    GameTag,
    LibraryItem,
    Note,
    PlaySession,
    RomFile,
    RomSaveState,
)
from app.models.playnite import PlayniteLibraryEntry
from app.models.steam import SteamLibraryEntry, SteamWishlistEntry
from app.services import rom_service


def reset_database(db: Session) -> dict[str, int]:
    """Delete every game and its attached data, plus all sync-tool caches.

    Returns counts of deleted games and library items for the response."""
    game_ids = list(db.scalars(select(Game.id)))
    item_ids = list(db.scalars(select(LibraryItem.id).where(LibraryItem.game_id.in_(game_ids)))) if game_ids else []

    # Collect ROM filenames so the caller can remove them from disk after commit.
    rom_filenames: list[str] = []
    if item_ids:
        rom_ids = select(RomFile.id).where(RomFile.library_item_id.in_(item_ids))
        for stored, sram in db.execute(
            select(RomFile.stored_filename, RomFile.sram_stored_filename).where(RomFile.id.in_(rom_ids))
        ):
            rom_filenames.extend(f for f in (stored, sram) if f)
        for stored, screenshot in db.execute(
            select(RomSaveState.stored_filename, RomSaveState.screenshot_filename).where(
                RomSaveState.rom_file_id.in_(rom_ids)
            )
        ):
            rom_filenames.extend(f for f in (stored, screenshot) if f)
        db.execute(delete(RomSaveState).where(RomSaveState.rom_file_id.in_(rom_ids)))
        db.execute(delete(RomFile).where(RomFile.library_item_id.in_(item_ids)))

    if game_ids:
        db.execute(delete(LibraryItem).where(LibraryItem.game_id.in_(game_ids)))
        db.execute(delete(GameProgress).where(GameProgress.game_id.in_(game_ids)))
        db.execute(delete(PlaySession).where(PlaySession.game_id.in_(game_ids)))
        db.execute(delete(Note).where(Note.game_id.in_(game_ids)))
        db.execute(delete(GameTag).where(GameTag.game_id.in_(game_ids)))
        db.execute(delete(GameGenre).where(GameGenre.game_id.in_(game_ids)))
        db.execute(delete(GamePlatform).where(GamePlatform.game_id.in_(game_ids)))
        db.execute(delete(GameCompany).where(GameCompany.game_id.in_(game_ids)))
        db.execute(delete(GameFranchise).where(GameFranchise.game_id.in_(game_ids)))
        db.execute(delete(GameCollection).where(GameCollection.game_id.in_(game_ids)))
        db.execute(delete(Screenshot).where(Screenshot.game_id.in_(game_ids)))
        db.execute(delete(Artwork).where(Artwork.game_id.in_(game_ids)))
        db.execute(delete(GameVideo).where(GameVideo.game_id.in_(game_ids)))
        db.execute(delete(ReleaseDate).where(ReleaseDate.game_id.in_(game_ids)))
        db.execute(delete(Game).where(Game.id.in_(game_ids)))

    # Reset the sync tools: clear their scan/match caches so a fresh import works.
    db.execute(delete(PlayniteLibraryEntry))
    db.execute(delete(SteamLibraryEntry))
    db.execute(delete(SteamWishlistEntry))

    db.commit()
    rom_service.delete_files(rom_filenames)

    return {"games_deleted": len(game_ids), "library_items_deleted": len(item_ids)}
