import { describe, expect, it } from "vitest";
import type { GameSummary } from "../../api/types";
import { buildShelves, spineStyle } from "../BookshelfPage";

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
