from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.api.routes.game_filters import GameFilterParams
from app.models.library import LibraryStatus
from app.repositories.game_repository import PRIVATE_SORTS, GameSortOption
from app.schemas.game import BookshelfEntryResponse
from app.schemas.public import (
    PublicAccessorySummaryResponse,
    PublicBookshelfPlatformResponse,
    PublicBookshelfResponse,
    PublicDeviceSummaryResponse,
    PublicGameDetailResponse,
    PublicGameSummaryResponse,
    PublicOwnedCopyResponse,
    public_accessory_from_orm,
    public_device_from_orm,
    public_game_detail_from_orm,
    public_game_from_orm,
)
from app.services import accessory_service, auth_service, device_service, game_service
from app.services.exceptions import NotFoundError

# No auth dependency — this is the app's one deliberately unauthenticated router, gated
# instead by the unlisted per-user token in the path. See auth_service.get_user_by_share_token.
router = APIRouter(prefix="/api/public/{token}", tags=["public"])


@router.get("/bookshelf", response_model=PublicBookshelfResponse)
def get_public_bookshelf(
    token: str,
    db: Session = Depends(get_db),
) -> PublicBookshelfResponse:
    auth_service.get_user_by_share_token(db, token)
    entries = game_service.list_bookshelf_entries(db, public=True)
    # The shelf's platform display records (template art, case size, spine
    # styling) for just the platforms that have cases on it.
    from app.models.catalog import Platform

    labels = {entry.platform_label for entry in entries}
    platforms = [
        PublicBookshelfPlatformResponse(
            label=platform.abbreviation or platform.name,
            name=platform.name,
            abbreviation=platform.abbreviation,
            spine_template_url=platform.spine_template_url,
            case_height_mm=platform.case_height_mm,
            case_spine_mm=platform.case_spine_mm,
            spine_color=platform.spine_color,
            spine_icon=platform.spine_icon,
            spine_icon_url=platform.spine_icon_url,
        )
        for platform in db.query(Platform).all()
        if (platform.abbreviation or platform.name) in labels
    ]
    return PublicBookshelfResponse(
        entries=[
            BookshelfEntryResponse(
                game_id=entry.game_id,
                game_slug=entry.game_slug,
                game_uuid=entry.game_uuid,
                name=entry.name,
                platform_label=entry.platform_label,
                formats=entry.formats,
            )
            for entry in entries
        ],
        platforms=platforms,
    )


@router.get("/games", response_model=list[PublicGameSummaryResponse])
def list_public_games(
    token: str,
    params: GameFilterParams = Depends(),
    db: Session = Depends(get_db),
) -> list[PublicGameSummaryResponse]:
    auth_service.get_user_by_share_token(db, token)
    # The share page doesn't show copies, progress, ratings or sales, so those sorts
    # are meaningless here — fall back to name order instead of leaking them through.
    if params.sort in PRIVATE_SORTS:
        params.sort = GameSortOption.NAME_ASC
    games = game_service.search_local_games(db, **vars(params))
    # Hidden games never appear on public pages.
    games = [g for g in games if not g.game.hide_from_public]
    # Neither do unclaimed "what's missing" discoveries: an auto-discovered catalog
    # entry the user hasn't claimed (not owned, not wishlisted) isn't part of their
    # library yet — the private Games list hides exactly these (see GameList.tsx),
    # and they must not leak onto the public share page either.
    games = [g for g in games if not (g.game.auto_discovered and not g.owned and not g.wishlisted)]
    # Single query for all owned platforms and formats across the returned games (avoids N+1).
    game_ids = [g.game.id for g in games]
    platforms_by_game: dict[int, set[str]] = {}
    formats_by_game: dict[int, set[str]] = {}
    editions_by_game: dict[int, set[str]] = {}
    copies_by_game: dict[int, list] = {}
    if game_ids:
        from sqlalchemy import select

        from app.models.catalog import Platform
        from app.models.library import LibraryItem
        from app.schemas.public import PublicOwnedCopyResponse
        rows = db.execute(
            select(
                LibraryItem.game_id,
                Platform.abbreviation,
                Platform.name,
                LibraryItem.format,
                LibraryItem.edition,
            )
            .join(Platform, LibraryItem.platform_id == Platform.id)
            .where(
                LibraryItem.game_id.in_(game_ids),
                LibraryItem.status == LibraryStatus.OWNED,
            )
        ).all()
        for game_id, platform_abbr, platform_name, format_val, edition_val in rows:
            # Platform chips show the abbreviation when IGDB has one ("PS4", "WIN"),
            # falling back to the full name ("Sony PlayStation 4") when it doesn't.
            platforms_by_game.setdefault(game_id, set()).add(platform_abbr or platform_name)
            if format_val and hasattr(format_val, "value"):
                fmt = format_val.value
            elif format_val:
                fmt = str(format_val)
            else:
                fmt = None
            if fmt:
                formats_by_game.setdefault(game_id, set()).add(fmt)
            if edition_val:
                editions_by_game.setdefault(game_id, set()).add(edition_val)
            copies_by_game.setdefault(game_id, []).append(
                PublicOwnedCopyResponse(platform=platform_name, edition=edition_val, format=fmt)
            )
    return [
        public_game_from_orm(
            g,
            owned_platforms=sorted(platforms_by_game.get(g.game.id, set())),
            owned_formats=sorted(formats_by_game.get(g.game.id, set())),
            owned_editions=sorted(editions_by_game.get(g.game.id, set())),
            owned_copies=copies_by_game.get(g.game.id, []),
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


@router.get("/genres", response_model=list[dict])
def list_public_genres(token: str, db: Session = Depends(get_db)) -> list[dict]:
    """All known genres, for the public page filter."""
    from app.repositories import genre_repository

    auth_service.get_user_by_share_token(db, token)
    return [{"id": g.id, "name": g.name} for g in genre_repository.list_all(db)]


@router.get("/game-modes", response_model=list[str])
def list_public_game_modes(token: str, db: Session = Depends(get_db)) -> list[str]:
    """Every IGDB game-mode name recorded on any game, for the public page filter."""
    from app.repositories import game_repository

    auth_service.get_user_by_share_token(db, token)
    return game_repository.list_distinct_game_modes(db)


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
    if status.game.hide_from_public:
        raise NotFoundError(f"Game {game_id} not found")
    # Same unclaimed-discovery rule as the list above: no direct-link back door.
    if status.game.auto_discovered and not status.owned and not status.wishlisted:
        raise NotFoundError(f"Game {game_id} not found")
    # Owned platforms for this game.
    from sqlalchemy import select

    from app.models.catalog import Platform
    from app.models.library import LibraryItem

    rows = db.execute(
        select(Platform.abbreviation, Platform.name, LibraryItem.edition, LibraryItem.format)
        .join(LibraryItem, LibraryItem.platform_id == Platform.id)
        .where(
            LibraryItem.game_id == status.game.id,
            LibraryItem.status == LibraryStatus.OWNED,
        )
    ).all()
    # Chips show the abbreviation when IGDB has one, else the full name (same as the
    # public list); the per-copy rows below keep the full platform name.
    owned_platforms = sorted({row[0] or row[1] for row in rows})
    owned_copies = [
        PublicOwnedCopyResponse(
            platform=row[1],
            edition=row[2],
            format=row[3].value if row[3] is not None else None,
        )
        for row in rows
    ]
    return public_game_detail_from_orm(
        status, owned_platforms=owned_platforms, owned_copies=owned_copies
    )


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
