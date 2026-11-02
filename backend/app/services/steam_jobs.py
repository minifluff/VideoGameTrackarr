import asyncio
from collections.abc import Callable
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.system import User
from app.repositories import game_repository, steam_repository, steam_wishlist_repository
from app.services import game_service
from app.services.igdb_client import IGDBClient
from app.services.job_registry import JobDefinition
from app.services.steam_client import SteamClient

JOB_STEAM_IMPORT = "steam_import"

# IGDB's free tier allows 4 requests/second. IGDBClient rate-limits request starts to
# that (see igdb_client.py), so matching can run more imports concurrently than the old
# cap of 4 without tripping 429s. Phase 1 below needs no pacing at all: it only upserts
# rows locally and makes no API calls, so the old 0.2s-per-entry sleep just burned
# ~3 minutes per 1,000-entry library on every import, even when nothing had changed.
_IGDB_MATCH_CONCURRENCY = 8
# external_games lookups are batched into one query per chunk instead of one per game.
_IGDB_LOOKUP_BATCH_SIZE = 50


class SteamNotConfiguredError(Exception):
    """Raised when either STEAM_API_KEY or the user's SteamID64 isn't set yet."""


class SteamProfilePrivateError(Exception):
    """Raised when Steam's response has no "games" key at all — a private/friends-only
    profile, not "this account owns 0 games" (see SteamClient.get_owned_games)."""


def run(
    session_factory: Callable[[], Session],
    report_progress: Callable[[int, int], None] | None = None,
) -> dict[str, Any]:
    db = session_factory()
    try:
        return asyncio.run(_import(db, report_progress or (lambda current, total: None)))
    finally:
        db.close()


async def _resolve_igdb_ids(
    igdb_client: IGDBClient, steam_app_ids: list[int]
) -> tuple[dict[int, int], dict[int, str]]:
    """Steam AppIDs to IGDB ids, in batches. Returns (resolved, failed): an id absent from
    resolved simply has no IGDB match, while a failed id maps to its lookup error — the
    caller records those as failures, the way a per-game lookup failure used to be. A
    failed batch falls back to one lookup per game in it, so one bad id can't sink the
    whole chunk."""
    resolved: dict[int, int] = {}
    failed: dict[int, str] = {}
    for start in range(0, len(steam_app_ids), _IGDB_LOOKUP_BATCH_SIZE):
        chunk = steam_app_ids[start : start + _IGDB_LOOKUP_BATCH_SIZE]
        try:
            resolved.update(await igdb_client.get_igdb_ids_for_steam_appids(chunk))
        except Exception:
            for app_id in chunk:
                try:
                    igdb_id = await igdb_client.get_igdb_id_for_steam_appid(app_id)
                    if igdb_id is not None:
                        resolved[app_id] = igdb_id
                except Exception as exc:
                    failed[app_id] = str(exc)
    return resolved, failed


async def _match_to_igdb(db: Session, igdb_client: IGDBClient, igdb_id: int) -> int:
    """Imports the IGDB game (and its hierarchical DLC/expansion/pack children) if it
    isn't already in VGT, and returns its local Game id. The caller resolves the Steam
    AppID to igdb_id first (batched, see _resolve_igdb_ids) — shared by the owned-games
    and wishlist loops below."""
    game = game_repository.get_game_by_igdb_id(db, igdb_id)
    if game is None:
        game_with_status = await game_service.import_game_from_igdb(db, igdb_client, igdb_id)
        game = game_with_status.game
    return game.id


async def _import(db: Session, report_progress: Callable[[int, int], None]) -> dict[str, Any]:
    """Fetches + caches + IGDB-matches the user's Steam library and wishlist — nothing more.
    This job never writes to LibraryItem/GameProgress, for tracked or untracked games alike;
    applying Steam's data to VGT is always a separate, explicit, user-confirmed action (see
    steam_service.sync_entries / steam_wishlist_service.sync_entries), triggered from the
    Insights → Steam Sync page."""
    settings = get_settings()
    user = db.scalars(select(User)).first()
    if not settings.steam_api_key or not (user and user.steam_id_64):
        raise SteamNotConfiguredError(
            "Steam isn't configured yet — set STEAM_API_KEY in .env and add a SteamID64 in "
            "Settings → Integrations."
        )

    # Fresh, short-lived clients rather than any shared instance — same reasoning as
    # resync_jobs.py: this job runs on a plain threading.Thread with no event loop of its
    # own until asyncio.run() creates one here.
    steam_client = SteamClient(api_key=settings.steam_api_key)
    igdb_client = IGDBClient()
    try:
        owned_games = await steam_client.get_owned_games(user.steam_id_64)
        if owned_games is None:
            raise SteamProfilePrivateError(
                "Steam profile is private or has no game details visible — check its privacy "
                "settings (Game details must be Public)."
            )

        succeeded = 0
        failures: list[dict[str, Any]] = []
        owned_app_ids: set[int] = set()
        # Phase 1: fast local upserts of every Steam entry (no IGDB calls yet, so no
        # pacing — the old per-entry sleep is what made re-imports slow even with
        # nothing new to match).
        unmatched: list[tuple[int, str]] = []
        for index, steam_game in enumerate(owned_games):
            try:
                entry = steam_repository.upsert_entry(
                    db, steam_game.app_id, steam_game.name, steam_game.playtime_minutes, steam_game.last_played_at
                )
                owned_app_ids.add(steam_game.app_id)
                if entry.game_id is None and not entry.dismissed:
                    unmatched.append((steam_game.app_id, steam_game.name))
                succeeded += 1
            except Exception as exc:  # noqa: BLE001 - one bad upsert must not abort the batch
                db.rollback()
                failures.append({"gameId": steam_game.app_id, "gameName": steam_game.name, "error": str(exc)})
            report_progress(index + 1, len(owned_games))
        db.commit()

        # Phase 2: IGDB-match the unmatched entries concurrently. Lookups are batched
        # first (one query per 50 ids instead of one per game); only the imports run
        # concurrently, capped by _IGDB_MATCH_CONCURRENCY with IGDBClient's own rate
        # limiting keeping request starts at the free tier's 4/second. Progress is
        # reported per matched game — previously this whole phase reported nothing,
        # so the job looked stuck while matching.
        if unmatched:
            name_by_app_id = dict(unmatched)
            resolved, lookup_failed = await _resolve_igdb_ids(igdb_client, [app_id for app_id, _ in unmatched])
            for app_id, error in lookup_failed.items():
                succeeded -= 1
                failures.append({"gameId": app_id, "gameName": name_by_app_id[app_id], "error": error})
            semaphore = asyncio.Semaphore(_IGDB_MATCH_CONCURRENCY)
            matched = 0

            async def _match_one(app_id: int, game_name: str) -> None:
                nonlocal succeeded, matched
                async with semaphore:
                    try:
                        igdb_id = resolved.get(app_id)
                        if igdb_id is None:
                            return  # no IGDB match — the entry stays cached, unmatched
                        game_id = await _match_to_igdb(db, igdb_client, igdb_id)
                        entry = steam_repository.get_entry(db, app_id)
                        if entry is not None:
                            steam_repository.set_game_id(db, entry, game_id)
                            db.commit()
                    except Exception as exc:  # noqa: BLE001 - one bad match must not abort the batch
                        db.rollback()
                        # Phase 1 already counted this game as succeeded — a Phase 2
                        # IGDB failure means the import actually failed for it.
                        succeeded -= 1
                        failures.append({"gameId": app_id, "gameName": game_name, "error": str(exc)})
                    finally:
                        matched += 1
                        report_progress(matched, len(unmatched))

            await asyncio.gather(*(_match_one(app_id, name) for app_id, name in unmatched))

        result: dict[str, Any] = {
            "total": len(owned_games),
            "succeeded": succeeded,
            "failed": len(failures),
            "failures": failures,
        }

        # A separate try/except around the whole phase — a wishlist-side problem (e.g. a
        # transient network error) must never roll back or hide the owned-games results
        # already committed above.
        try:
            result["wishlist"] = await _import_wishlist(
                db, steam_client, igdb_client, user.steam_id_64, report_progress, owned_app_ids
            )
        except Exception as exc:  # noqa: BLE001 - see comment above
            result["wishlist"] = {"total": 0, "succeeded": 0, "failed": 0, "failures": [], "error": str(exc)}

        return result
    finally:
        await steam_client.aclose()
        await igdb_client.aclose()


async def _import_wishlist(
    db: Session,
    steam_client: SteamClient,
    igdb_client: IGDBClient,
    steam_id_64: str,
    report_progress: Callable[[int, int], None],
    owned_app_ids: set[int],
) -> dict[str, Any]:
    wishlist_items = await steam_client.get_wishlist(steam_id_64)

    # A game bought since the last import disappears from Steam's wishlist but stays in
    # ours — drop any wishlist entry whose app id now shows up in the owned list so the
    # Steam Sync table doesn't show a stale wishlist row alongside the new owned row.
    stale_entries = [
        entry
        for entry in steam_wishlist_repository.list_all_entries(db)
        if entry.steam_app_id in owned_app_ids
    ]
    for stale in stale_entries:
        db.delete(stale)
    if stale_entries:
        db.commit()

    # A game removed from the Steam wishlist itself should disappear from ours too.
    # Safety: Steam's wishlist endpoint can't distinguish "private" from "genuinely
    # empty", so this only runs when we actually got wishlist data back — an empty
    # response is skipped rather than risking wiping the table on a private profile.
    if wishlist_items:
        fresh_app_ids = {item.app_id for item in wishlist_items}
        removed_entries = [
            entry
            for entry in steam_wishlist_repository.list_all_entries(db)
            if entry.steam_app_id not in fresh_app_ids
        ]
        for removed in removed_entries:
            db.delete(removed)
        if removed_entries:
            db.commit()

    succeeded = 0
    failures: list[dict[str, Any]] = []
    # Phase 1: fast local upserts (no API calls, so no pacing — same as owned above).
    unmatched_app_ids: list[int] = []
    for index, item in enumerate(wishlist_items):
        try:
            existing = steam_wishlist_repository.get_entry(db, item.app_id)
            # GetWishlist never gives a name (see SteamClient.get_wishlist) — keep whatever
            # name a prior match/custom-add already resolved rather than clobbering it with
            # the placeholder on every re-run.
            steam_name = existing.steam_name if existing else f"Steam App {item.app_id}"
            entry = steam_wishlist_repository.upsert_entry(db, item.app_id, steam_name, item.added_at)
            if entry.game_id is None and not entry.dismissed:
                unmatched_app_ids.append(item.app_id)
            succeeded += 1
        except Exception as exc:  # noqa: BLE001 - one bad upsert must not abort the batch
            db.rollback()
            failures.append({"gameId": item.app_id, "error": str(exc)})
        report_progress(index + 1, len(wishlist_items))
    db.commit()

    # Phase 2: concurrent IGDB matching (batched lookups + progress, same as owned).
    if unmatched_app_ids:
        resolved, lookup_failed = await _resolve_igdb_ids(igdb_client, unmatched_app_ids)
        for app_id, error in lookup_failed.items():
            succeeded -= 1
            failures.append({"gameId": app_id, "error": error})
        semaphore = asyncio.Semaphore(_IGDB_MATCH_CONCURRENCY)
        matched = 0

        async def _match_one(app_id: int) -> None:
            nonlocal succeeded, matched
            async with semaphore:
                try:
                    igdb_id = resolved.get(app_id)
                    if igdb_id is None:
                        return  # no IGDB match — the entry stays cached, unmatched
                    game_id = await _match_to_igdb(db, igdb_client, igdb_id)
                    entry = steam_wishlist_repository.get_entry(db, app_id)
                    if entry is not None:
                        steam_wishlist_repository.set_game_id(db, entry, game_id)
                        db.commit()
                except Exception as exc:  # noqa: BLE001 - one bad match must not abort the batch
                    db.rollback()
                    # Phase 1 already counted this item as succeeded — a Phase 2
                    # IGDB failure means the import actually failed for it.
                    succeeded -= 1
                    failures.append({"gameId": app_id, "error": str(exc)})
                finally:
                    matched += 1
                    report_progress(matched, len(unmatched_app_ids))

        await asyncio.gather(*(_match_one(app_id) for app_id in unmatched_app_ids))

    return {
        "total": len(wishlist_items),
        "succeeded": succeeded,
        "failed": len(failures),
        "failures": failures,
    }


DEFINITION_STEAM_IMPORT = JobDefinition(id=JOB_STEAM_IMPORT, run=run)
