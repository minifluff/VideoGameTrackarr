import { describe, expect, it } from "vitest";
import type { GameSummary, LibraryListItem, PlatformResponse } from "../../api/types";
import { buildCaseFormats, buildShelves, caseFormatsKey, packRows, spineStyle } from "../BookshelfPage";

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
