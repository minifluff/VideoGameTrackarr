# VideoGameTrackarr (minifluff custom build)

This is my personal customized build of [VideoGameTrackarr](https://github.com/wwwescape/VideoGameTrackarr) — a self-hosted web app for tracking your video game collection.

For the full documentation, features, screenshots, and installation instructions, see the [main project](https://github.com/wwwescape/VideoGameTrackarr).

My code is free to use and is currently built off Version 1.30.0. Just let me know if you need assistance. 

## Customizations in this fork

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
- Many Fixes

## In-progress features (separate branches)


- `feature/collapsible-headers` — collapsible title/description and sticky toolbar on catalog pages
- `feature/remove-games` — Settings page for selecting and deleting library games with confirmation
