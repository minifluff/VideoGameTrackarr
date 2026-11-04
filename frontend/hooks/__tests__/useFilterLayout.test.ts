import { describe, expect, it } from "vitest";
import type { FilterFieldSetting } from "../../api/types";
import { DEFAULT_FILTER_LAYOUT, resolveFilterLayout } from "../useFilterLayout";

describe("resolveFilterLayout", () => {
  it("returns the default layout when nothing is saved", () => {
    expect(resolveFilterLayout(null)).toEqual(DEFAULT_FILTER_LAYOUT);
    expect(resolveFilterLayout([])).toEqual(DEFAULT_FILTER_LAYOUT);
    expect(resolveFilterLayout(undefined)).toEqual(DEFAULT_FILTER_LAYOUT);
  });

  it("keeps the saved order and hidden flags", () => {
    const layout = resolveFilterLayout([
      { key: "ownership", hidden: false },
      { key: "tags", hidden: true },
    ]);
    // Ownership moves ahead of Genre; Tags keeps its hidden flag wherever it is.
    const keys = layout.map((field) => field.key);
    expect(keys.indexOf("ownership")).toBeLessThan(keys.indexOf("genres"));
    expect(layout.find((field) => field.key === "tags")).toEqual({ key: "tags", hidden: true });
    // The rest fall back to their default places, after their default predecessor.
    expect(keys).toContain("steelbookOnly");
  });

  it("drops unknown keys and repeats", () => {
    const saved: FilterFieldSetting[] = [
      { key: "tags", hidden: false },
      { key: "nope", hidden: false },
      { key: "tags", hidden: true },
    ];
    const layout = resolveFilterLayout(saved);
    expect(layout.filter((field) => field.key === "tags")).toHaveLength(1);
    expect(layout.some((field) => (field.key as string) === "nope")).toBe(false);
  });

  it("inserts a missing field after its default predecessor", () => {
    const layout = resolveFilterLayout([{ key: "ownership", hidden: false }]);
    const keys = layout.map((field) => field.key);
    // A single saved entry lands in its default slot, with the missing fields
    // filling in around it in default order.
    expect(keys).toEqual([
      "toggles",
      "gameType",
      "tags",
      "genres",
      "gameModes",
      "ownership",
      "playStatus",
      "platforms",
      "formats",
      "storefronts",
      "collections",
      "franchises",
      "steelbookOnly",
    ]);
  });
});
