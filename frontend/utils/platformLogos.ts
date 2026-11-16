import { slugify } from "./identifiers";

// Platform logos are plain files dropped into assets/platforms/, named after the platform's
// IGDB slug (ps5.png, switch.svg, win.webp, …). Vite picks every one up at build time, so a
// new logo needs no code change. IGDB sometimes adds a "--N" suffix to a slug (e.g.
// "ps4--1"), so lookups ignore it: ps4.png covers both.
const logoModules = import.meta.glob<string>("../assets/platforms/*.{png,svg,webp,jpg}", {
  eager: true,
  query: "?url",
  import: "default",
});

// Split out from platformLogoUrl so tests can feed it a fake file list.
export function createLogoLookup(modules: Record<string, string>) {
  const logoBySlug = new Map<string, string>(
    Object.entries(modules).map(([path, url]) => {
      const fileName = path.split("/").pop() ?? "";
      return [fileName.replace(/\.[^.]+$/, "").toLowerCase(), url];
    })
  );
  return (slug: string | null | undefined): string | undefined => {
    if (!slug) return undefined;
    return logoBySlug.get(slug.split("--")[0].toLowerCase());
  };
}

export const platformLogoUrl = createLogoLookup(logoModules);

// Platform pages link by slug, falling back to the id for a platform without one.
export function platformIdentifier(platform: { id: number; slug: string | null }): string {
  return platform.slug ?? String(platform.id);
}

// Hardware platforms are named after their console generation ("PlayStation 5", "Xbox Series"
// — the Generation column of docs/data/hardware), not IGDB slugs, so each maps to the logo of
// the matching IGDB platform here. A name not listed tries its own slug ("Dreamcast" →
// dreamcast.png), so a new logo can still be dropped in without a code change.
const HARDWARE_PLATFORM_LOGO_SLUGS: Record<string, string> = {
  "Game Boy": "gb",
  "Game Boy Advance": "gba",
  "Game Boy Color": "gbc",
  GameCube: "ngc",
  NES: "nes",
  "Nintendo 3DS": "3ds",
  "Nintendo 64": "n64",
  "Nintendo DS": "nds",
  "Nintendo Switch": "switch",
  "Nintendo Switch 2": "switch-2",
  PlayStation: "ps",
  "PlayStation 2": "ps2",
  "PlayStation 3": "ps3",
  "PlayStation 4": "ps4",
  "PlayStation 5": "ps5",
  "PlayStation Portable": "psp",
  "PlayStation Vita": "psvita",
  SNES: "snes",
  Wii: "wii",
  "Wii U": "wiiu",
  Xbox: "xbox",
  "Xbox 360": "xbox360",
  "Xbox One": "xboxone",
  "Xbox Series": "series-x-s",
};

export function hardwarePlatformLogoSlug(name: string): string {
  return HARDWARE_PLATFORM_LOGO_SLUGS[name] ?? slugify(name);
}

export function hardwarePlatformLogoUrl(name: string): string | undefined {
  return platformLogoUrl(hardwarePlatformLogoSlug(name));
}
