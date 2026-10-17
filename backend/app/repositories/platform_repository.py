from dataclasses import dataclass
from typing import Any

from sqlalchemy import case, delete, exists, func, select, update
from sqlalchemy.orm import Session

from app.models.catalog import Game, GameCategory, GamePlatform, Platform
from app.models.library import LibraryItem, LibraryStatus, MediaFormat
from app.repositories.game_repository import (
    GameSortOption,
    GameWithStatus,
    _apply_optional_game_filters,
    _is_browsable_game,
    _owned_exists,
    _play_status_subquery,
    _rating_subquery,
    _row_to_game_with_status,
    _wishlisted_exists,
    platform_copy_exists,
)

# Platforms whose copies Games → Platforms splits into one card per storefront (plus one per
# other format, e.g. Physical): just PC (Microsoft Windows), IGDB id 6 (the same id as
# steam_service.PC_IGDB_PLATFORM_ID). Every other platform gets a single card.
STOREFRONT_SPLIT_IGDB_PLATFORM_IDS = frozenset({6})


@dataclass
class LibraryPlatformCount:
    """One Games → Platforms card. media_format/storefront are only set for a split platform:
    a digital storefront card (DIGITAL + storefront, or DIGITAL + None for "no storefront
    set") or a card for another format (storefront None)."""

    platform: Platform
    media_format: MediaFormat | None
    storefront: str | None
    owned: int
    wishlisted: int


def list_platforms(db: Session) -> list[Platform]:
    return list(db.scalars(select(Platform).order_by(Platform.name)))


def get_by_name(db: Session, name: str) -> Platform | None:
    return db.scalars(select(Platform).where(Platform.name == name)).first()


def _slugify(name: str) -> str:
    """Simple slug generator for platform names (e.g. 'PlayStation 5' -> 'playstation-5')."""
    import re
    slug = name.lower().strip()
    slug = re.sub(r"[^a-z0-9]+", "-", slug)
    return slug.strip("-") or "platform"


def get_or_create_by_name(db: Session, name: str) -> Platform:
    # CSV import names platforms/regions as free text (matching what a personal
    # spreadsheet would have) — get-or-create by name, same lenient pattern as tags.
    platform = get_by_name(db, name)
    if platform is not None:
        # Backfill slug for platforms created before slugs were generated —
        # the Platforms page filters out slugless entries.
        if not platform.slug:
            platform.slug = _slugify(platform.name)
            db.flush()
        return platform

    platform = Platform(name=name, slug=_slugify(name))
    db.add(platform)
    db.flush()
    return platform


def get_by_igdb_id(db: Session, igdb_id: int) -> Platform | None:
    return db.scalars(select(Platform).where(Platform.igdb_id == igdb_id)).first()


def _fill_missing_abbreviation(platform: Platform, abbreviation: str | None) -> None:
    """Fill-only: an existing row gets IGDB's short name when it has none (e.g. rows created
    before platforms were linked to IGDB), but a value that's already there — curated by a
    migration or by hand — is never overwritten."""
    if abbreviation and not platform.abbreviation:
        platform.abbreviation = abbreviation


def get_or_create_by_igdb(db: Session, igdb_id: int, name: str, slug: str | None, abbreviation: str | None) -> Platform:
    platform = db.scalars(select(Platform).where(Platform.igdb_id == igdb_id)).first()
    if platform is not None:
        _fill_missing_abbreviation(platform, abbreviation)
        return platform

    # IGDB occasionally disambiguates a platform's slug with a trailing "--N" suffix (e.g.
    # "ps4--1") when its own catalog has more than one row for what's conceptually the same
    # hardware. A row from before this app tracked igdb_id (igdb_id is NULL) may already
    # represent that same platform under the bare slug — match on it and backfill the link
    # instead of inserting a parallel duplicate. Name/slug are deliberately left untouched
    # here and above: once a platform row exists, its display name may have been
    # deliberately curated (e.g. "Sony PlayStation 4") and shouldn't be silently overwritten
    # by IGDB's raw name on a later sync. The abbreviation is only ever filled when missing.
    bare_slug = slug.split("--")[0] if slug else None
    if bare_slug:
        platform = db.scalars(select(Platform).where(Platform.slug == bare_slug)).first()
        if platform is not None:
            platform.igdb_id = igdb_id
            _fill_missing_abbreviation(platform, abbreviation)
            db.flush()
            return platform

    platform = Platform(igdb_id=igdb_id, name=name, slug=slug, abbreviation=abbreviation)
    db.add(platform)
    db.flush()
    return platform


def sync_for_game(db: Session, game_id: int, platform_ids: list[int]) -> None:
    db.execute(delete(GamePlatform).where(GamePlatform.game_id == game_id))
    for platform_id in platform_ids:
        db.add(GamePlatform(game_id=game_id, platform_id=platform_id))
    db.flush()


def get_by_slug(db: Session, slug: str) -> Platform | None:
    return db.scalars(select(Platform).where(Platform.slug == slug)).first()


def list_platforms_with_counts(db: Session) -> list[tuple[Platform, int]]:
    """Every platform with its locally-known, browsable (non-addon) game count — a game
    counts for a platform when the user has a *copy* for it (library_items.platform_id),
    not merely because IGDB lists the game as released on it. Uses the same scoping as
    list_games_for_platform, so the count always matches what the platform's own page
    shows. Platforms with zero games are included with count 0; the browsable filter
    lives in the JOIN condition (not WHERE) so the outer join keeps zero-count
    platforms instead of dropping them."""
    stmt = (
        select(Platform, func.count(func.distinct(Game.id)))
        .outerjoin(LibraryItem, LibraryItem.platform_id == Platform.id)
        .outerjoin(
            Game,
            (Game.id == LibraryItem.game_id) & Game.parent_game_id.is_(None) & _is_browsable_game(Game.category),
        )
        .group_by(Platform.id)
        .order_by(Platform.name)
    )
    return [(platform, count) for platform, count in db.execute(stmt)]


def _count(status: LibraryStatus) -> Any:
    return func.count(func.distinct(case((LibraryItem.status == status, LibraryItem.game_id))))


def list_library_platforms_with_counts(db: Session) -> list[LibraryPlatformCount]:
    """Every platform with at least one library copy (owned or wishlisted) of a browsable,
    top-level game, with how many distinct such games are owned and wishlisted on it — split
    by format and storefront for STOREFRONT_SPLIT_IGDB_PLATFORM_IDS. Same top-level/browsable
    rule as the Games list and Collections/Series counts, so a card's numbers match what its
    Platform page shows; a platform whose only copies are DLC is left out rather than leading
    to an empty page."""
    is_split = func.coalesce(Platform.igdb_id, 0).in_(STOREFRONT_SPLIT_IGDB_PLATFORM_IDS)
    in_library = (
        select(Platform)
        .join(LibraryItem, LibraryItem.platform_id == Platform.id)
        .join(Game, Game.id == LibraryItem.game_id)
        .where(Game.parent_game_id.is_(None), _is_browsable_game(Game.category))
    )

    whole = in_library.add_columns(_count(LibraryStatus.OWNED), _count(LibraryStatus.WISHLIST))
    whole = whole.where(~is_split).group_by(Platform.id)
    results = [
        LibraryPlatformCount(platform, None, None, owned, wishlisted)
        for platform, owned, wishlisted in db.execute(whole)
    ]

    # Blank storefronts count as "none set", like platform_copy_exists' coalesce.
    storefront = case(
        (LibraryItem.format == MediaFormat.DIGITAL, func.nullif(LibraryItem.digital_storefront, "")),
        else_=None,
    )
    split = in_library.add_columns(
        LibraryItem.format, storefront, _count(LibraryStatus.OWNED), _count(LibraryStatus.WISHLIST)
    )
    split = split.where(is_split).group_by(Platform.id, LibraryItem.format, storefront)
    merged: dict[tuple[int, MediaFormat, str | None], LibraryPlatformCount] = {}
    for platform, media_format, store, owned, wishlisted in db.execute(split):
        # A copy with no format is treated as "other" (see platform_copy_exists), which can
        # mean two grouped rows for one card.
        key = (platform.id, media_format or MediaFormat.OTHER, store)
        if key in merged:
            merged[key].owned += owned
            merged[key].wishlisted += wishlisted
        else:
            merged[key] = LibraryPlatformCount(platform, key[1], store, owned, wishlisted)
    results.extend(merged.values())

    results.sort(key=lambda row: (row.platform.name.lower(), row.media_format is not None, row.storefront or ""))
    return results


def get_by_slug_or_id(db: Session, slug_or_id: str) -> Platform | None:
    """Platform pages link by slug, falling back to the id for a platform without one
    (e.g. a platform added by name). Slugs aren't unique, so the oldest row wins."""
    if slug_or_id.isdigit():
        return db.get(Platform, int(slug_or_id))
    return db.scalars(select(Platform).where(Platform.slug == slug_or_id).order_by(Platform.id)).first()


def list_games_for_platform(db: Session, platform_id: int) -> list[GameWithStatus]:
    """Only games the user actually has a copy for on this platform — scoped by
    library_items.platform_id (the platform on the owned/wishlisted copy), not
    game_platforms (IGDB's full list of platforms the game was ever released on).
    An addon's platform link would otherwise clutter the grid; addons stay reachable
    via the parent's own Addons tab and the page's "Include addons" toggle."""
    stmt = (
        select(
            Game,
            _owned_exists(Game.id),
            _wishlisted_exists(Game.id),
            _play_status_subquery(Game.id),
            _rating_subquery(Game.id),
        )
        .where(
            exists().where(
                LibraryItem.game_id == Game.id,
                LibraryItem.platform_id == platform_id,
            ),
            Game.parent_game_id.is_(None),
            _is_browsable_game(Game.category),
        )
        .order_by(Game.name)
    )
    return [_row_to_game_with_status(row) for row in db.execute(stmt)]


def list_addons_for_platform(
    db: Session,
    platform_id: int,
    *,
    media_format: MediaFormat | None = None,
    storefront: str | None = None,
    search: str | None = None,
    platform_ids: list[int] | None = None,
    platform_exclude: bool = False,
    tag_ids: list[int] | None = None,
    tag_exclude: bool = False,
    collection_ids: list[int] | None = None,
    collection_exclude: bool = False,
    franchise_ids: list[int] | None = None,
    franchise_exclude: bool = False,
    categories: list[GameCategory] | None = None,
    category_exclude: bool = False,
    formats: list[MediaFormat] | None = None,
    format_exclude: bool = False,
    storefronts: list[str] | None = None,
    storefront_exclude: bool = False,
    steelbook_only: bool = False,
    sort: GameSortOption = GameSortOption.NAME_ASC,
) -> list[GameWithStatus]:
    """Addons of this platform's top-level games — same parent-based approach as
    collection_repository.list_addons_for_collection: an addon inherits its platform
    through its parent, so this goes via the parent ids. The parent is scoped by the
    user's copies (library_items.platform_id), not the catalog release list. When
    media_format/storefront are given (a PC storefront card's page), the parent must have
    a copy in that format/storefront — see game_repository.platform_copy_exists."""
    if media_format is not None:
        parent_copy = platform_copy_exists(Game.id, platform_id, media_format, storefront)
    else:
        parent_copy = exists().where(
            LibraryItem.game_id == Game.id,
            LibraryItem.platform_id == platform_id,
        )
    parent_ids = select(Game.id).where(
        parent_copy,
        Game.parent_game_id.is_(None),
        _is_browsable_game(Game.category),
    )
    stmt = select(
        Game,
        _owned_exists(Game.id),
        _wishlisted_exists(Game.id),
        _play_status_subquery(Game.id),
        _rating_subquery(Game.id),
    ).where(Game.parent_game_id.in_(parent_ids))
    stmt = _apply_optional_game_filters(
        stmt,
        search=search,
        platform_ids=platform_ids,
        platform_exclude=platform_exclude,
        tag_ids=tag_ids,
        tag_exclude=tag_exclude,
        collection_ids=collection_ids,
        collection_exclude=collection_exclude,
        franchise_ids=franchise_ids,
        franchise_exclude=franchise_exclude,
        categories=categories,
        category_exclude=category_exclude,
        formats=formats,
        format_exclude=format_exclude,
        storefronts=storefronts,
        storefront_exclude=storefront_exclude,
        steelbook_only=steelbook_only,
        sort=sort,
    )
    return [_row_to_game_with_status(row) for row in db.execute(stmt)]


def create_platform(
    db: Session, name: str, abbreviation: str | None, slug: str | None = None, igdb_id: int | None = None
) -> Platform:
    platform = Platform(
        name=name,
        slug=slug.strip() if slug and slug.strip() else _slugify(name),
        abbreviation=abbreviation,
        igdb_id=igdb_id,
    )
    db.add(platform)
    db.flush()
    return platform


def update_platform(
    db: Session,
    platform: Platform,
    name: str,
    abbreviation: str | None,
    slug: str | None = None,
    igdb_id: int | None = None,
) -> Platform:
    platform.name = name
    platform.abbreviation = abbreviation
    # Use the provided slug, or regenerate from the name if blank.
    platform.slug = slug.strip() if slug and slug.strip() else _slugify(name)
    platform.igdb_id = igdb_id
    db.flush()
    return platform


def delete_platform(db: Session, platform: Platform) -> None:
    # Unlink library copies from the platform (the game stays, just with no platform set),
    # drop IGDB release-list rows, then delete the platform itself — mirrors how tag
    # deletion clears its association rows before deleting the tag.
    db.execute(
        update(LibraryItem).where(LibraryItem.platform_id == platform.id).values(platform_id=None)
    )
    db.execute(delete(GamePlatform).where(GamePlatform.platform_id == platform.id))
    db.delete(platform)
    db.flush()
