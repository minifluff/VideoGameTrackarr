import logging
import mimetypes
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import FileResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.types import Scope

from app.api.routes import (
    accessories,
    appearance,
    auth,
    catalog_resync,
    collections,
    companies,
    dashboard,
    device,
    displaymode,
    events,
    franchises,
    games,
    hardware_lookups,
    hardware_stats,
    health,
    igdb,
    images,
    import_export,
    insights,
    integrations,
    jobs,
    library,
    notes,
    platforms,
    progress,
    public,
    regions,
    roms,
    sales_tracking,
    share,
    system,
    tags,
    uploads,
    version,
)
from app.core.config import HARDWARE_REFERENCE_IMAGES_DIR, REPO_ROOT, UPLOADS_DIR, get_settings
from app.core.limiter import limiter
from app.core.logging import configure_logging
from app.db.session import SessionLocal
from app.services import job_definitions, job_scheduler, platprices_service, rom_service
from app.services.exceptions import ConflictError, NotFoundError
from app.services.igdb_client import IGDBClient, IGDBCredentialsError

FRONTEND_BUILD_DIR = REPO_ROOT / "build"

# Python's mimetypes doesn't know .apk, so FileResponse would serve the Game
# Library APK as application/octet-stream — Android then saves the download
# as .bin instead of .apk. Register the proper type once at startup.
mimetypes.add_type("application/vnd.android.package-archive", ".apk")


class UploadsStaticFiles(StaticFiles):
    """The public /uploads mount, minus the roms/ subfolder. Covers and accessory images are
    fine to serve unauthenticated (they're shown on public share pages too), but uploaded
    ROMs live under the same directory (see rom_service.get_rom_dir) and must only ever be
    reachable through the signed-URL route in app/api/routes/roms.py."""

    def get_path(self, scope: Scope) -> str:
        path = super().get_path(scope)
        first_segment = path.replace("\\", "/").lstrip("/").split("/", 1)[0]
        if first_segment.lower() == rom_service.ROMS_SUBDIR:
            raise StarletteHTTPException(status_code=404)
        return path

    async def get_response(self, path: str, scope: Scope) -> Response:
        response = await super().get_response(path, scope)
        # Uploaded covers keep a stable URL per file, but a re-upload can replace
        # one — a day of caching balances scroll speed against freshness. Without
        # this, Starlette sends only ETag/Last-Modified and every cover costs a
        # revalidation round trip while scrolling.
        response.headers["Cache-Control"] = "public, max-age=86400"
        return response


class CachedStaticFiles(StaticFiles):
    """StaticFiles with a fixed Cache-Control on every response — see the mounts
    below for which policy each tree gets."""

    cache_control: str = "public, max-age=86400"

    async def get_response(self, path: str, scope: Scope) -> Response:
        response = await super().get_response(path, scope)
        response.headers["Cache-Control"] = self.cache_control
        return response


class ImmutableAssetsStaticFiles(CachedStaticFiles):
    # Vite emits /assets files with a content hash in the name — a new build is
    # new URLs, so these can be cached effectively forever.
    cache_control = "public, max-age=31536000, immutable"


def resolve_static_file(base_dir: Path, requested_path: str) -> Path | None:
    """Returns the real file under base_dir to serve for requested_path, or None if it
    should fall back to index.html (SPA client-side route, or nothing matched). Pulled out
    of the route handler so the path-traversal guard is unit-testable on its own, without
    depending on whether a real frontend build happens to exist on disk.

    requested_path is attacker-controlled - resolving and confirming the result is still
    inside base_dir (rather than trusting the joined path directly) is what stops a request
    like "../../etc/passwd" from escaping base_dir to serve arbitrary filesystem contents.
    """
    if not requested_path:
        return None
    candidate = (base_dir / requested_path).resolve()
    if candidate.is_relative_to(base_dir) and candidate.is_file():
        return candidate
    return None


# The DOS/PSP player tab needs SharedArrayBuffer (threaded emulator cores), which browsers
# only allow on a cross-origin-isolated page. Only that page and the player iframe it loads
# get these headers — the main app loads cross-origin images (IGDB cover art) that
# require-corp would block.
CROSS_ORIGIN_ISOLATION_HEADERS = {
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Embedder-Policy": "require-corp",
}


def isolation_headers_for(requested_path: str, threads: str | None) -> dict[str, str]:
    if requested_path == "player-isolated.html" or (requested_path == "emulatorjs/player.html" and threads == "1"):
        return dict(CROSS_ORIGIN_ISOLATION_HEADERS)
    return {}


configure_logging()
settings = get_settings()
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    app.state.igdb_client = IGDBClient()

    job_definitions.register_builtin_jobs()
    db = SessionLocal()
    try:
        job_scheduler.start(db, SessionLocal)
        try:
            cleared = platprices_service.clear_prices_from_other_regions(db)
            if cleared:
                logger.info("Cleared %d cached PlatPrices price(s) from a previous region", cleared)
        except Exception:  # noqa: BLE001 - a stale-price cleanup must never stop startup
            db.rollback()
            logger.exception("Couldn't clear PlatPrices prices from a previous region")
    finally:
        db.close()

    yield

    job_scheduler.shutdown()
    await app.state.igdb_client.aclose()


app = FastAPI(title=settings.app_name, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)
# Compress API JSON — the games list is ~6 MB raw at a ~9.6k-game library and
# ~0.4 MB gzipped; every big list (games, collections, series, public) pays it.
# Added last so it wraps the whole stack and compresses the final response.
app.add_middleware(GZipMiddleware, minimum_size=1000)


@app.exception_handler(NotFoundError)
async def not_found_handler(request: Request, exc: NotFoundError) -> JSONResponse:
    return JSONResponse(status_code=404, content={"detail": str(exc)})


@app.exception_handler(ConflictError)
async def conflict_handler(request: Request, exc: ConflictError) -> JSONResponse:
    return JSONResponse(status_code=409, content={"detail": str(exc)})


@app.exception_handler(IGDBCredentialsError)
async def igdb_credentials_handler(request: Request, exc: IGDBCredentialsError) -> JSONResponse:
    return JSONResponse(status_code=503, content={"detail": str(exc)})

app.include_router(health.router)
app.include_router(auth.router)
app.include_router(appearance.router)
app.include_router(displaymode.router)
app.include_router(displaymode.settings_router)
app.include_router(platforms.router)
app.include_router(regions.router)
app.include_router(games.router)
app.include_router(igdb.router)
app.include_router(images.router)
app.include_router(library.router)
app.include_router(progress.router)
app.include_router(notes.router)
app.include_router(tags.router)
app.include_router(import_export.router)
app.include_router(import_export.download_router)
app.include_router(insights.router)
app.include_router(franchises.router)
app.include_router(collections.router)
app.include_router(catalog_resync.router)
app.include_router(events.router)
app.include_router(dashboard.router)
app.include_router(hardware_lookups.router)
app.include_router(device.router)
app.include_router(accessories.router)
app.include_router(hardware_stats.router)
app.include_router(companies.router)
app.include_router(uploads.router)
app.include_router(jobs.router)
app.include_router(version.router)
app.include_router(share.router)
app.include_router(system.router)
app.include_router(integrations.router)
app.include_router(sales_tracking.router)
app.include_router(roms.router)
app.include_router(roms.content_router)
app.include_router(public.router)

# Uploaded cover images (see app/services/upload_service.py) — created on first use rather
# than committed to the repo, so it needs to exist before StaticFiles will mount it.
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", UploadsStaticFiles(directory=UPLOADS_DIR), name="uploads")

# Curated HardwareReferenceEntry product shots — checked into the repo (see
# HARDWARE_REFERENCE_IMAGES_DIR), but still created defensively so StaticFiles can mount it
# even before any images have been added.
HARDWARE_REFERENCE_IMAGES_DIR.mkdir(parents=True, exist_ok=True)
app.mount(
    "/static/hardware-reference",
    CachedStaticFiles(directory=HARDWARE_REFERENCE_IMAGES_DIR),
    name="hardware-reference-images",
)

# Serves the built frontend (npm run build's output) from the same origin as the API.
# Guarded by existence so a backend-only dev run (frontend served separately by Vite on
# :3000, or the test suite, neither of which ever produce a build/ directory) is
# unaffected. Registered last so it never shadows the /api/* or /healthz routes above —
# Starlette matches routes in registration order.
if FRONTEND_BUILD_DIR.is_dir():
    app.mount("/assets", ImmutableAssetsStaticFiles(directory=FRONTEND_BUILD_DIR / "assets"), name="frontend-assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_frontend(full_path: str, request: Request) -> FileResponse:
        static_file = resolve_static_file(FRONTEND_BUILD_DIR, full_path)
        headers = isolation_headers_for(full_path, request.query_params.get("threads"))
        is_shell_file = (
            static_file is None
            or static_file.suffix == ".html"
            or static_file.name == "sw.js"
            or static_file.name.startswith("workbox-")
        )
        if is_shell_file:
            # index.html (and every SPA-route fallback to it) must revalidate on
            # every load — a heuristically-cached copy points at the previous
            # build's hashed assets, which no longer exist after a redeploy.
            # Same for the service worker and the player page (both .html/.js at
            # the build root with stable names).
            headers["Cache-Control"] = "no-cache"
            return FileResponse(
                static_file if static_file is not None else FRONTEND_BUILD_DIR / "index.html",
                headers=headers,
            )
        headers["Cache-Control"] = "public, max-age=86400"
        return FileResponse(static_file, headers=headers)
