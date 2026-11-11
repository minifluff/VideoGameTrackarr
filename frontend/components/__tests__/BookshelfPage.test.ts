import { describe, expect, it } from "vitest";
import type { BookshelfEntry, PlatformResponse } from "../../api/types";
import { buildCaseFormatsFromEntries, buildShelvesFromEntries, buildTemplateCaseSizes, buildVisibleShelves, caseFormatsKey, caseSize, contrastTextColor, indexPlatformsByLabel, packRows, platformFilterLabel, resolvePlatformCaseSizes, sortShelfCases, spineStyle, TITLE_BOTTOM_INSET, TITLE_TOP_INSET, titleBandLight } from "../BookshelfPage";
import { BOOKEND_WIDTH } from "../BookshelfGrid";
import { presetForDimensions } from "../../utils/caseSizes";

const entry = (overrides: Partial<BookshelfEntry>): BookshelfEntry => ({
  gameId: 1,
  gameSlug: "a-game",
  gameUuid: "uuid-1",
  name: "A Game",
  platformLabel: "Nintendo Switch",
  formats: ["physical"],
  ...overrides,
});

describe("buildShelvesFromEntries", () => {
  it("creates one case per owned (game x platform) entry, sorted", () => {
    const shelves = buildShelvesFromEntries([
      entry({ gameId: 1, name: "Zelda", platformLabel: "Nintendo Switch" }),
      entry({ gameId: 1, name: "Zelda", platformLabel: "Wii U" }),
      entry({ gameId: 3, name: "Mario", platformLabel: "Nintendo Switch" }),
    ]);

    expect(shelves.map((shelf) => shelf.platform)).toEqual(["Nintendo Switch", "Wii U"]);
    const switchShelf = shelves[0];
    expect(switchShelf.cases.map((c) => c.game.name)).toEqual(["Mario", "Zelda"]);
    expect(switchShelf.cases[0].game).toEqual({ id: 3, name: "Mario", slug: "a-game", uuid: "uuid-1" });
  });

  it("handles an empty library", () => {
    expect(buildShelvesFromEntries(undefined)).toEqual([]);
    expect(buildShelvesFromEntries([])).toEqual([]);
  });
});

describe("buildCaseFormatsFromEntries", () => {
  it("keys formats by game and platform label", () => {
    const formats = buildCaseFormatsFromEntries([
      entry({ gameId: 1, platformLabel: "PS5", formats: ["physical", "digital"] }),
      entry({ gameId: 2, platformLabel: "PS5", formats: [] }),
    ]);
    expect(formats.get(caseFormatsKey(1, "PS5"))).toEqual(new Set(["physical", "digital"]));
    expect(formats.size).toBe(1);
  });
});

describe("packRows", () => {
  it("flows platforms continuously in one row when everything fits", () => {
    const shelves = buildShelvesFromEntries([
      entry({ gameId: 14, name: "A One", platformLabel: "Alpha" }),
      entry({ gameId: 28, name: "A Two", platformLabel: "Alpha" }),
      entry({ gameId: 42, name: "B One", platformLabel: "Beta" }),
    ]);
    const rows = packRows(shelves, 1000);
    expect(rows).toHaveLength(1);
    expect(rows[0].map((item) => item.kind)).toEqual(["bookend", "case", "case", "bookend", "case"]);
    expect(rows[0].map((item) => item.platform)).toEqual(["Alpha", "Alpha", "Alpha", "Beta", "Beta"]);
  });

  it("starts a new row when the next case would overflow, losing nothing", () => {
    const shelves = buildShelvesFromEntries([
      entry({ gameId: 14, name: "A One", platformLabel: "Alpha" }),
      entry({ gameId: 28, name: "A Two", platformLabel: "Alpha" }),
      entry({ gameId: 42, name: "A Three", platformLabel: "Alpha" }),
    ]);
    // Bookend (38) + two cases (24 each) + gaps = 92; the third case overflows.
    const rows = packRows(shelves, 92);
    expect(rows.map((row) => row.length)).toEqual([3, 1]);
    expect(rows.flat().filter((item) => item.kind === "case")).toHaveLength(3);
  });

  it("never leaves a bookend orphaned at a row's end", () => {
    const shelves = buildShelvesFromEntries([
      entry({ gameId: 14, name: "A One", platformLabel: "Alpha" }),
      entry({ gameId: 28, name: "B One", platformLabel: "Beta" }),
    ]);
    // Alpha bookend + case = 65; Beta's bookend alone would fit in 106, but
    // bookend + its first case (130) does not — so it moves to the next row.
    const rows = packRows(shelves, 106);
    expect(rows).toHaveLength(2);
    expect(rows[0].map((item) => item.platform)).toEqual(["Alpha", "Alpha"]);
    expect(rows[1].map((item) => item.kind)).toEqual(["bookend", "case"]);
  });
});

describe("indexPlatformsByLabel", () => {
  const platform = (overrides: Partial<PlatformResponse>): PlatformResponse => ({
    id: 1,
    igdbId: null,
    name: "PlayStation 5",
    slug: "ps5",
    abbreviation: "PS5",
    spineTemplateUrl: null,
    caseHeightMm: null,
    caseSpineMm: null,
    spineColor: null,
    spineIcon: null,
    spineIconUrl: null,
    gameCount: 0,
    ...overrides,
  });

  it("keys platforms by abbreviation, falling back to the full name", () => {
    const index = indexPlatformsByLabel([
      platform({}),
      platform({ id: 2, name: "Nintendo Switch", abbreviation: null }),
    ]);
    expect(index.get("PS5")?.id).toBe(1);
    expect(index.get("Nintendo Switch")?.id).toBe(2);
    expect(index.get("PlayStation 5")).toBeUndefined();
  });
});

describe("platformFilterLabel", () => {
  const platform = (overrides: Partial<PlatformResponse>): PlatformResponse => ({
    id: 1,
    igdbId: null,
    name: "PlayStation 5",
    slug: "ps5",
    abbreviation: "PS5",
    spineTemplateUrl: null,
    caseHeightMm: null,
    caseSpineMm: null,
    spineColor: null,
    spineIcon: null,
    spineIconUrl: null,
    gameCount: 0,
    ...overrides,
  });

  it("shows the full name with the short label in parentheses", () => {
    const index = indexPlatformsByLabel([platform({})]);
    expect(platformFilterLabel(index, "PS5")).toBe("PlayStation 5 (PS5)");
  });

  it("renders the label as-is without an abbreviation or catalogue entry", () => {
    const index = indexPlatformsByLabel([
      platform({ id: 2, name: "Nintendo Switch", abbreviation: null }),
    ]);
    expect(platformFilterLabel(index, "Nintendo Switch")).toBe("Nintendo Switch");
    expect(platformFilterLabel(index, "Unknown")).toBe("Unknown");
  });
});

describe("caseSize", () => {
  it("uses the flat spine size when the platform has no template", () => {
    const flat = spineStyle("PlayStation 5", 10);
    expect(caseSize("PlayStation 5", 10)).toEqual({ width: flat.width, height: flat.height });
  });

  it("uses the precomputed template size when the platform has one", () => {
    expect(caseSize("Steam", 10, { width: 48, height: 190 })).toEqual({ width: 48, height: 190 });
  });
});

describe("case size presets", () => {
  it("resolves the Slim DVD preset at 184 x 7 mm", () => {
    expect(presetForDimensions(184, 7)?.id).toBe("slimdvd");
    expect(presetForDimensions(184, 7)?.label).toBe("Slim DVD case");
  });

  it("still resolves the standard DVD preset at 184 x 14 mm", () => {
    expect(presetForDimensions(184, 14)?.id).toBe("dvd");
  });
});

describe("buildTemplateCaseSizes", () => {
  it("scales every template proportionally to the largest one", () => {
    const sizes = buildTemplateCaseSizes(
      new Map([
        ["Steam", { naturalWidth: 400, naturalHeight: 1600, light: false }],
        ["Switch", { naturalWidth: 300, naturalHeight: 1200, light: false }],
      ]),
      190
    );
    // Steam is the largest: full target height, width by proportion.
    expect(sizes.get("Steam")).toEqual({ width: 48, height: 190 });
    // Switch's template is 3/4 the height, so its case is 3/4 the size.
    expect(sizes.get("Switch")).toEqual({ width: 36, height: 143 });
  });

  it("returns nothing when no template has been measured", () => {
    expect(buildTemplateCaseSizes(new Map()).size).toBe(0);
  });

  it("floors the proportional shrink so a small template never renders tiny", () => {
    const sizes = buildTemplateCaseSizes(
      new Map([
        ["Huge", { naturalWidth: 400, naturalHeight: 3200, light: false }],
        ["Tiny", { naturalWidth: 50, naturalHeight: 200, light: false }],
      ]),
      190
    );
    expect(sizes.get("Huge")).toEqual({ width: 24, height: 190 });
    // Tiny's true ratio is 1/16 — floored to 0.6, so it renders 114 tall with
    // its width following the same factor (aspect exact, just not tiny).
    expect(sizes.get("Tiny")).toEqual({ width: 29, height: 114 });
  });

  it("ignores templates for platforms that are not on the shelf", () => {
    const sizes = buildTemplateCaseSizes(
      new Map([
        ["Steam", { naturalWidth: 400, naturalHeight: 1600, light: false }],
        ["Stray", { naturalWidth: 900, naturalHeight: 9000, light: false }],
      ]),
      190,
      new Set(["Steam"])
    );
    expect(sizes.has("Stray")).toBe(false);
    // Steam is the largest SHELF template, so it still gets the full height.
    expect(sizes.get("Steam")).toEqual({ width: 48, height: 190 });
  });
});

describe("titleBandLight", () => {
  // Build a 4-wide, 100-tall sample whose title band rows (30..92) are one
  // colour and everything outside the band is another, to prove only the
  // band decides the text colour.
  const sample = (band: number, outside: number) => {
    const width = 4;
    const height = 100;
    const data: number[] = [];
    for (let y = 0; y < height; y++) {
      const value = y >= 30 && y < 92 ? band : outside;
      for (let x = 0; x < width; x++) data.push(value, value, value, 255);
    }
    return { data, width, height };
  };

  it("flags a light title band for black text", () => {
    const { data, width, height } = sample(235, 235);
    expect(titleBandLight(data, width, height)).toBe(true);
  });

  it("keeps white text for a mid-grey band (the PS4-template case)", () => {
    const { data, width, height } = sample(118, 30);
    expect(titleBandLight(data, width, height)).toBe(false);
  });

  it("ignores a bright banner and logo outside the band", () => {
    // White header/footer around a dark band: whole-image averaging used to
    // call this light and print black on dark grey.
    const { data, width, height } = sample(105, 255);
    expect(titleBandLight(data, width, height)).toBe(false);
  });

  it("ignores a dark banner over a white band", () => {
    const { data, width, height } = sample(240, 10);
    expect(titleBandLight(data, width, height)).toBe(true);
  });
});

describe("resolvePlatformCaseSizes", () => {
  const record = (overrides: Partial<PlatformResponse>): PlatformResponse => ({
    id: 1,
    igdbId: null,
    name: "Steam",
    slug: "steam",
    abbreviation: null,
    spineTemplateUrl: null,
    caseHeightMm: null,
    caseSpineMm: null,
    spineColor: null,
    spineIcon: null,
    spineIconUrl: null,
    gameCount: 0,
    ...overrides,
  });

  it("renders a chosen actual size at 40%, ahead of any template size", () => {
    const byLabel = new Map([
      ["Steam", record({ caseHeightMm: 184, caseSpineMm: 14 })],
    ]);
    const sizes = resolvePlatformCaseSizes(["Steam"], byLabel, new Map([["Steam", { width: 48, height: 190 }]]));
    expect(sizes.get("Steam")).toEqual({ width: 21, height: 278 });
  });

  it("applies the known system size when nothing was chosen", () => {
    const byLabel = new Map([["PS5", record({ name: "PlayStation 5", abbreviation: "PS5" })]]);
    const sizes = resolvePlatformCaseSizes(["PS5"], byLabel, new Map());
    expect(sizes.get("PS5")).toEqual({ width: 18, height: 259 });
  });

  it("falls back to the template size, then to no fixed size", () => {
    const byLabel = new Map([["Steam", record({})]]);
    const withTemplate = resolvePlatformCaseSizes(
      ["Steam"],
      byLabel,
      new Map([["Steam", { width: 48, height: 190 }]])
    );
    expect(withTemplate.get("Steam")).toEqual({ width: 48, height: 190 });
    expect(resolvePlatformCaseSizes(["Steam"], byLabel, new Map()).has("Steam")).toBe(false);
  });
});

describe("title band (GameCube reference spacing)", () => {
  it("keeps titles out of the header and maker-logo zones on every spine", () => {
    // Measured from a real GameCube spine (header ends 27.3%, bottom logo
    // starts 95.1%); Matthew set the clearance to 30% top / 8% bottom.
    expect(TITLE_TOP_INSET).toBe(0.3);
    expect(TITLE_BOTTOM_INSET).toBe(0.08);
    expect(TITLE_TOP_INSET + TITLE_BOTTOM_INSET).toBeLessThan(0.5);
  });
});

describe("contrastTextColor", () => {
  it("puts dark text on light colours and white on dark ones", () => {
    expect(contrastTextColor("#f2f2f2")).toBe("#161616");
    expect(contrastTextColor("#e60012")).toBe("#ffffff");
    expect(contrastTextColor("#111111")).toBe("#ffffff");
    expect(contrastTextColor("#f5a623")).toBe("#161616");
  });

  it("falls back to white for unparseable values", () => {
    expect(contrastTextColor("red")).toBe("#ffffff");
  });
});

describe("spineStyle", () => {
  it("uses the Switch's light spine and shorter case", () => {
    const style = spineStyle("Nintendo Switch", 5);
    expect(style.height).toBe(158);
    expect(style.background).toBe("#f2f2f2");
  });

  it("is deterministic per game id", () => {
    expect(spineStyle("PC", 42)).toEqual(spineStyle("PC", 42));
    expect(spineStyle("Unknown Deck", 3).width).toBeGreaterThanOrEqual(24);
  });
});

describe("packRows mixed mode", () => {
  it("drops the platform bookends and flows every case into one run", () => {
    const shelves = buildShelvesFromEntries([
      entry({ gameId: 14, name: "A One", platformLabel: "Alpha" }),
      entry({ gameId: 28, name: "B One", platformLabel: "Beta" }),
    ]);
    const rows = packRows(shelves, 1000, undefined, { mixed: true });
    expect(rows).toHaveLength(1);
    expect(rows[0].map((item) => item.kind)).toEqual(["case", "case"]);
    expect(rows[0].map((item) => item.platform)).toEqual(["Alpha", "Beta"]);
  });
});

describe("packRows case scale", () => {
  it("scales every case, and the bookend's height, by the same factor", () => {
    const shelves = buildShelvesFromEntries([
      entry({ gameId: 14, name: "A One", platformLabel: "Alpha" }),
    ]);
    const plain = packRows(shelves, 1000);
    const doubled = packRows(shelves, 1000, undefined, { caseScale: 2 });
    expect(doubled[0].map((item) => item.kind)).toEqual(plain[0].map((item) => item.kind));
    const [plainBookend, plainCase] = plain[0];
    const [doubledBookend, doubledCase] = doubled[0];
    // The divider keeps its fixed width; only its height follows the scale.
    expect(doubledBookend.width).toBe(BOOKEND_WIDTH);
    expect(doubledBookend.height).toBe(plainBookend.height * 2);
    expect(doubledCase.width).toBe(plainCase.width * 2);
    expect(doubledCase.height).toBe(plainCase.height * 2);
  });
});

describe("sortShelfCases", () => {
  const shelves = buildShelvesFromEntries([
    entry({ gameId: 1, name: "Zelda", platformLabel: "Nintendo Switch" }),
    entry({ gameId: 2, name: "Mario", platformLabel: "Nintendo Switch" }),
    entry({ gameId: 3, name: "A Link", platformLabel: "Wii U" }),
  ]);
  const switchCases = shelves[0].cases;

  it("sorts by name ascending", () => {
    expect(sortShelfCases(switchCases, "name", "asc").map((c) => c.game.name)).toEqual([
      "Mario",
      "Zelda",
    ]);
  });

  it("reverses by name descending", () => {
    expect(sortShelfCases(switchCases, "name", "desc").map((c) => c.game.name)).toEqual([
      "Zelda",
      "Mario",
    ]);
  });

  it("sorts by platform, then name", () => {
    const all = shelves.flatMap((shelf) => shelf.cases);
    expect(sortShelfCases(all, "platform", "asc").map((c) => `${c.platform}:${c.game.name}`)).toEqual([
      "Nintendo Switch:Mario",
      "Nintendo Switch:Zelda",
      "Wii U:A Link",
    ]);
  });
});

describe("buildVisibleShelves", () => {
  const entries = [
    entry({ gameId: 1, name: "Zelda", platformLabel: "Nintendo Switch", formats: ["physical"] }),
    entry({ gameId: 2, name: "Mario", platformLabel: "Nintendo Switch", formats: ["digital"] }),
    entry({ gameId: 3, name: "Metroid", platformLabel: "Wii U", formats: ["physical"] }),
  ];
  const shelves = buildShelvesFromEntries(entries);
  const caseFormats = buildCaseFormatsFromEntries(entries);
  const options = {
    keyword: "",
    platformFilter: "all",
    formatFilter: "all",
    caseFormats,
    sortField: "name" as const,
    sortDirection: "asc" as const,
    mixed: false,
  };

  it("keeps platform grouping by default", () => {
    const visible = buildVisibleShelves(shelves, options);
    expect(visible.map((shelf) => shelf.platform)).toEqual(["Nintendo Switch", "Wii U"]);
    expect(visible[0].cases.map((c) => c.game.name)).toEqual(["Mario", "Zelda"]);
  });

  it("merges every visible case into one ungrouped run when mixed", () => {
    const visible = buildVisibleShelves(shelves, { ...options, mixed: true });
    expect(visible).toHaveLength(1);
    expect(visible[0].cases.map((c) => c.game.name)).toEqual(["Mario", "Metroid", "Zelda"]);
  });

  it("still honours the platform filter while mixed", () => {
    const visible = buildVisibleShelves(shelves, {
      ...options,
      mixed: true,
      platformFilter: "Wii U",
    });
    expect(visible).toHaveLength(1);
    expect(visible[0].cases.map((c) => c.game.name)).toEqual(["Metroid"]);
  });

  it("reverses shelf order on a platform-desc sort", () => {
    const visible = buildVisibleShelves(shelves, {
      ...options,
      sortField: "platform",
      sortDirection: "desc",
    });
    expect(visible.map((shelf) => shelf.platform)).toEqual(["Wii U", "Nintendo Switch"]);
  });

  it("returns nothing when a filter matches no case", () => {
    expect(buildVisibleShelves(shelves, { ...options, keyword: "zzz" })).toEqual([]);
    expect(buildVisibleShelves(shelves, { ...options, mixed: true, keyword: "zzz" })).toEqual([]);
  });
});
