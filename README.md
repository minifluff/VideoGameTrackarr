<p align="center">
  <img src="frontend/public/icon-master.svg" alt="VideoGameTrackarr logo" width="120" />
</p>

<h1 align="center">VideoGameTrackarr</h1>

<p align="center">
  A self-hosted web app for tracking your video game collection — what you own, what you want,
  what you're playing
</p>
 <p align="center"> 
  This is my personal customized build of [VideoGameTrackarr](https://github.com/wwwescape/VideoGameTrackarr) — a self-hosted web app for tracking your video game collection. Most of my changes can be seen at the bottom.
</p>
<p align="center">
My code is free to use how you wish. Just let me know if you need assistance. 
</p>

## Screenshots

![](./screenshots/1.png)
![](./screenshots/2.png)
![](./screenshots/3.png)
![](./screenshots/4.png)
![](./screenshots/5.png)

## Features

- **Library tracking** — owned games and a wishlist, per platform, region, and format
  (physical, digital, ISO, ROM, or Abandonware), with edition, storefront, steelbook, notes,
  and purchase or target price.
- **IGDB-powered catalog** — search IGDB, preview a game before adding it, or bulk-add several
  at once. Genres, companies, platforms, media, release dates, store links, collections, series,
  and addons (DLC, expansions, and packs) all come along.
- **Personal tracking** — progress and play sessions per platform you own a game on, a 0–10
  rating with review, notes, and colored tags (with a Tag Manager and bulk tagging).
- **Filters & sort** — filter by platform, format, storefront, tag, ownership, game type,
  steelbook, collection, or series (each with an Exclude option), and sort by name or release
  date. Pages remember your search, filters, and sort.
- **Hardware** — devices and accessories from a curated Sony, Microsoft, Nintendo, and Sega
  catalog, with product photos.
- **Steam sync** — import your Steam library and wishlist with playtime, review every change
  before it's applied, and relink or unlink mismatched entries.
- **Sale tracking** — opt-in wishlist price tracking via IsThereAnyDeal (PC, Mac, Linux, and
  Android) and PlatPrices (PlayStation), with target prices and an **On Sale** page.
- **Events** — upcoming gaming-industry events from IGDB, with any featured games already in
  your library.
- **In-browser play** — upload ROMs for games you own and play over 25 systems right in the
  browser, with a self-hosted emulator and saves kept on your server. See
  [docs/emulation.md](docs/emulation.md).
- **Media viewer** — a lightbox for screenshots and artwork, and a video player for trailers.
- **Dashboard & insights** — collection stats, game and hardware release calendars, duplicate
  detection, missing addons, orphaned accessories, and side-by-side game comparison.
- **Share links** — unlisted, read-only links to your Games or Hardware collection.
- **Jobs** — scheduled catalog resyncs, Steam import, sale refreshes, and event syncs, with live
  progress.
- **Data portability** — CSV export, and JSON or full `.zip` backups (including ROMs, saves,
  and BIOS files) with an automatic safety snapshot before every restore.
- **PWA** — installable, works offline for anything you've already viewed, and syncs offline
  edits when you reconnect.
- **Material 3 design** — light and dark mode, responsive navigation, and virtualized lists for
  large collections.
- **Languages** — English, Spanish, French, and Portuguese.
- **Single admin, self-hosted** — no public registration, no multi-tenancy.

## Installation

The published Docker image bundles the frontend and backend into a single container. Create a
`docker-compose.yml`:

```yaml
services:
  app:
    image: ghcr.io/minifluff/videogametrackarr:latest
    container_name: videogametrackarr
    ports:
      - "8000:8000"
    environment:
      # Required: free IGDB credentials from https://api-docs.igdb.com/#getting-started
      - IGDB_CLIENT_ID=
      - IGDB_CLIENT_SECRET=
      # Google "make JWT_SECRET_KEY secret key hex 32 for me" and add key here — keep private
      - JWT_SECRET_KEY= 
      # Optional integrations (uncomment to use):
      # - STEAM_API_KEY=
      # - ITAD_API_KEY=
      # - ITAD_COUNTRY=CA
      # - PLATPRICES_API_KEY=
      # - PLATPRICES_REGION=
      # - GGDEALS_API_KEY=
      # - GGDEALS_REGION=ca
      # - GOOGLE_SEARCH_API_KEY=
      # - GOOGLE_SEARCH_ENGINE_ID=
    volumes:
      - ./db-data:/app/backend/db
      - ./uploads-data:/app/backend/uploads
    restart: unless-stopped
```

```bash
docker compose up -d
```

Open `http://localhost:8000`. The first visit shows a create-admin form — fill it in once and
you're signed in. If you ever get locked out,
`docker compose exec app python -m scripts.create_admin --username admin` resets the password.

Migrations run automatically on startup, and your database and uploads live in the named
volumes, so they survive restarts and upgrades. Reverse proxy examples (Nginx, Traefik) are in
[docs/deployment/](docs/deployment/).

### Upgrading

```bash
docker compose pull && docker compose up -d
```

Running from source instead? `git pull`, reinstall dependencies if they changed, then run
`alembic upgrade head` from `backend/` before starting the app. Any breaking change is called
out in that release's notes.

## Configuration

Get IGDB credentials at https://api-docs.igdb.com/#getting-started (free, requires a Twitch
developer account).

Optional integrations — add key, then run `docker compose up -d` (a plain
`docker compose restart` doesn't pick up changes). Each shows a live status in
**Settings → Integrations**, along with the store region in use for the price integrations:

| Integration    | Setting              | Get a key                                                         | Notes                                                                                                                                      |
| -------------- | -------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Steam          | `STEAM_API_KEY`      | [steamcommunity.com/dev/apikey](https://steamcommunity.com/dev/apikey) | Your SteamID64 is set in-app, under **Settings → Integrations**.                                                                     |
| IsThereAnyDeal | `ITAD_API_KEY`       | [isthereanydeal.com/apps/my](https://isthereanydeal.com/apps/my/) | PC, Mac, Linux, and Android prices. `ITAD_COUNTRY` (two-letter code, default `US`) sets the store country.                                |
| PlatPrices     | `PLATPRICES_API_KEY` | [platprices.com/api-request](https://platprices.com/api-request) | PlayStation prices. The free tier tracks any 2 PS Store regions, chosen on your PlatPrices dashboard. `PLATPRICES_REGION` (two-letter code such as `GB` or `IN`, default `US`) must be one of them. |

Other options: `ROM_MAX_UPLOAD_MB` (default `2048`) caps ROM uploads — raise your reverse
proxy's upload limit to match. `DATABASE_URL` (SQLite by default), `REDIS_URL`, and
`CORS_ORIGINS` are optional.

## License

GPL-3.0 — see [LICENSE](LICENSE).

## Customizations in this fork (most customizations are only tested under english pages)

- Playnite library sync (via network share and JSON exporter plugin)
- Steam sync "Sync all" button
- CSV import
- Custom appearance settings (accent color, app title)
- Master Database reset (Danger Zone in Settings)
- IGDB auto-link all games
- Ability to Change IGDB link
- Unlink IGDB only option (keeps game as manual entry)
- Added date added sort option
- Added unlinked games section in insights
- Google image search for cover art (broken removed from frontend)
- Platform page added
- Platform Manager page added
- Added platforms to Public page
- Added dates to Games Calender section
- Removed Events from Dashboard
- Added Linked cover art (local nas or web).
- Change search to allow any order of words.
- Added Navigation Menu hides on scroll on phones
- Changed Steam sync to import to platform Steam instead of PC(Microsoft Windows)
- Added Public Games Collection button to Dashboard and updated public search
- Added public game hiding feature
- Move Remove to dropdown of multi-select and added confirm. Making tags the default action.
- collapsible title/description and sticky toolbar on catalog pages
- Added Test Game list page
- Submenus collapse
- Added Scheduled JSON backup to Network share
- Fixed Isthereanydeal sale tracking and removed requirement to manual enter games to track
- Many more Fixes and changes
- Added persistent login
- Added simple Andoid app. Downloadable from settings.
- Display Mode added. Displays cover art, Screenshot, Artwork and Videos in slideshow
- Added BookShelf. Shows games in a Bookshelf format and can be customized with Spine art.

## Support

If you find VideoGameTrackarr useful, consider buying me a coffee:

[<img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" height="40" />](https://buymeacoffee.com/minifluff)
