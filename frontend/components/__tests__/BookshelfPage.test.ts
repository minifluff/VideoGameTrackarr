import { describe, expect, it } from "vitest";
import type { GameSummary, LibraryListItem, PlatformResponse } from "../../api/types";
import { buildCaseFormats, buildShelves, buildTemplateCaseSizes, caseFormatsKey, caseSize, indexPlatformsByLabel, isMostlyWhite, packRows, spineStyle } from "../BookshelfPage";

const game = (overrides: Partial<GameSummary>): GameSummary => ({
  id: 1,
  uuid: "uuid-1",
  igdbId: 1,
  name: "A Game",
  slug: "a-game",
  coverUrl: null,
  spineUrl: null,
  category: "main_game",
  firstReleaseDate: null,
  owned: true,
  wishlisted: false,
  playStatus: null,
  rating: null,
  isOnSale: false,
  autoDiscovered: false,
  hideFromPublic: false,
  ownedPlatforms: ["Nintendo Switch"],
  ...overrides,
});

describe("buildShelves", () => {
  it("creates one case per owned platform and skips unowned games", () => {
    const shelves = buildShelves([
      game({ id: 1, name: "Zelda", ownedPlatforms: ["Nintendo Switch", "Wii U"] }),
      game({ id: 2, name: "Not Owned", owned: false }),
      game({ id: 3, name: "Mario", ownedPlatforms: ["Nintendo Switch"] }),
    ]);

    expect(shelves.map((shelf) => shelf.platform)).toEqual(["Nintendo Switch", "Wii U"]);
    const switchShelf = shelves[0];
    expect(switchShelf.cases.map((entry) => entry.game.name)).toEqual(["Mario", "Zelda"]);
  });

  it("handles an empty library", () => {
    expect(buildShelves(undefined)).toEqual([]);
    expect(buildShelves([])).toEqual([]);
  });
});

describe("buildCaseFormats", () => {
  const item = (overrides: Partial<LibraryListItem>): LibraryListItem => ({
    id: 1,
    gameId: 1,
    gameName: "A Game",
    gameUuid: "uuid-1",
    platformName: "PlayStation 5",
    edition: null,
    format: "physical",
    firstReleaseDate: null,
    dateAdded: null,
    tagNames: [],
    notes: null,
    ...overrides,
  });
  const platform = (overrides: Partial<PlatformResponse>): PlatformResponse => ({
    id: 1,
    igdbId: null,
    name: "PlayStation 5",
    slug: "ps5",
    abbreviation: "PS5",
    spineTemplateUrl: null,
    gameCount: 0,
    ...overrides,
  });

  it("keys formats by the summary's abbreviated platform label", () => {
    const formats = buildCaseFormats([item({})], [platform({})]);
    expect(formats.get(caseFormatsKey(1, "PS5"))).toEqual(new Set(["physical"]));
  });

  it("falls back to the full name when the platform has no abbreviation", () => {
    const formats = buildCaseFormats(
      [item({ platformName: "Nintendo Switch" })],
      [platform({ name: "Nintendo Switch", abbreviation: null })]
    );
    expect(formats.get(caseFormatsKey(1, "Nintendo Switch"))).toEqual(new Set(["physical"]));
  });

  it("collects multiple formats per case and skips format-less items", () => {
    const formats = buildCaseFormats(
      [item({}), item({ id: 2, format: "digital" }), item({ id: 3, format: null })],
      [platform({})]
    );
    expect(formats.get(caseFormatsKey(1, "PS5"))).toEqual(new Set(["physical", "digital"]));
    expect(formats.size).toBe(1);
  });
});

describe("packRows", () => {
  it("flows platforms continuously in one row when everything fits", () => {
    const shelves = buildShelves([
      game({ id: 14, name: "A One", ownedPlatforms: ["Alpha"] }),
      game({ id: 28, name: "A Two", ownedPlatforms: ["Alpha"] }),
      game({ id: 42, name: "B One", ownedPlatforms: ["Beta"] }),
    ]);
    const rows = packRows(shelves, 1000);
    expect(rows).toHaveLength(1);
    expect(rows[0].map((item) => item.kind)).toEqual(["bookend", "case", "case", "bookend", "case"]);
    expect(rows[0].map((item) => item.platform)).toEqual(["Alpha", "Alpha", "Alpha", "Beta", "Beta"]);
  });

  it("starts a new row when the next case would overflow, losing nothing", () => {
    const shelves = buildShelves([
      game({ id: 14, name: "A One", ownedPlatforms: ["Alpha"] }),
      game({ id: 28, name: "A Two", ownedPlatforms: ["Alpha"] }),
      game({ id: 42, name: "A Three", ownedPlatforms: ["Alpha"] }),
    ]);
    // Bookend (38) + two cases (24 each) + gaps = 92; the third case overflows.
    const rows = packRows(shelves, 92);
    expect(rows.map((row) => row.length)).toEqual([3, 1]);
    expect(rows.flat().filter((item) => item.kind === "case")).toHaveLength(3);
  });

  it("never leaves a bookend orphaned at a row's end", () => {
    const shelves = buildShelves([
      game({ id: 14, name: "A One", ownedPlatforms: ["Alpha"] }),
      game({ id: 28, name: "B One", ownedPlatforms: ["Beta"] }),
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

describe("caseSize", () => {
  it("uses the flat spine size when the platform has no template", () => {
    const flat = spineStyle("PlayStation 5", 10);
    expect(caseSize("PlayStation 5", 10)).toEqual({ width: flat.width, height: flat.height });
  });

  it("uses the precomputed template size when the platform has one", () => {
    expect(caseSize("Steam", 10, { width: 48, height: 190 })).toEqual({ width: 48, height: 190 });
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

describe("isMostlyWhite", () => {
  const rgba = (r: number, g: number, b: number, pixels = 4) =>
    Array.from({ length: pixels }, () => [r, g, b, 255]).flat();

  it("detects a white template", () => {
    expect(isMostlyWhite(rgba(255, 255, 255))).toBe(true);
    expect(isMostlyWhite(rgba(240, 238, 235))).toBe(true);
  });

  it("does not flag dark or mid-tone templates", () => {
    expect(isMostlyWhite(rgba(20, 20, 20))).toBe(false);
    expect(isMostlyWhite(rgba(128, 128, 128))).toBe(false);
    expect(isMostlyWhite(rgba(27, 71, 161))).toBe(false);
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
