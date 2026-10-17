# VideoGameTrackarr (minifluff custom build)

This is my personal customized build of [VideoGameTrackarr](https://github.com/wwwescape/VideoGameTrackarr) — a self-hosted web app for tracking your video game collection.

For the full documentation, features, screenshots, and installation instructions, see the [main project](https://github.com/wwwescape/VideoGameTrackarr).

My code is free to use and is currently built off Version 1.30.0. Just let me know if you need assistance. 

## Customizations in this fork (most customizations are only under english pages)

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
- Google image search for cover art(broken)
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

## In-progress features (separate branches)

- `feature/remove-games` — Settings page for selecting and deleting library games with confirmation
