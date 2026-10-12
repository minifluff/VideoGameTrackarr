# Fork policy: do NOT sync with upstream

This fork is intentionally decoupled from upstream (wwwescape/VideoGameTrackarr).

- Pinned at upstream 1.30.0 + custom changes (Oct 12, 2026).
- **Never use GitHub's "Sync fork" / "Update branch" button.** On Oct 12, 2026 that wiped every
  fork-specific change and they had to be re-applied by hand.
- The Docker image (`ghcr.io/minifluff/videogametrackarr`) builds from this repo's `main`
  on every push — no upstream tracking needed, ever.
- If a future upstream feature is ever wanted, treat it as a deliberate one-off migration,
  not a routine merge. Custom changes live as discrete commits on top of the 1.30.0 base,
  so they can be rebased onto a newer base if truly needed.

## Custom changes on top of 1.30.0 (Oct 12, 2026)

- GHCR release workflow (publishes `:latest` to `ghcr.io/minifluff/videogametrackarr` on every `main` push)
- Platform browse pages scoped to owned copies (platform_service, platform_detail
  schema/routes/repository; PlatformsPage/PlatformPage; nav/router/breadcrumbs; gameCount)
- "Sync all" button on the Steam sync page toolbar
- CSV import (backend endpoint/service/schema + Settings UI)
- Appearance settings (custom accent color + app title)
- Note: upstream 1.28.0 added its own hide-synced feature, so the fork's old
  "Hide synced games" checkbox was intentionally dropped, not lost.
- Locale rule: only update `en` locale strings going forward; leave `es`/`fr`/`pt` untouched.
