import { describe, expect, it } from "vitest";
import type { OverviewSectionSetting } from "../../api/types";
import { DEFAULT_OVERVIEW_LAYOUT, resolveOverviewLayout } from "../useOverviewLayout";

describe("resolveOverviewLayout", () => {
  it("returns the default layout when nothing is saved", () => {
    expect(resolveOverviewLayout(null)).toEqual(DEFAULT_OVERVIEW_LAYOUT);
    expect(resolveOverviewLayout([])).toEqual(DEFAULT_OVERVIEW_LAYOUT);
    expect(resolveOverviewLayout(undefined)).toEqual(DEFAULT_OVERVIEW_LAYOUT);
  });

  it("keeps the saved order and hidden flags", () => {
    const layout = resolveOverviewLayout([
      { key: "needsAttention", hidden: false },
      { key: "stats", hidden: true },
    ]);
    expect(layout[0]).toEqual({ key: "needsAttention", hidden: false });
    // The button entries follow needsAttention (their default predecessor), so they
    // land ahead of the saved stats entry; stats keeps its hidden flag wherever it is.
    expect(layout[1]).toEqual({ key: "displayMode", hidden: false });
    expect(layout[2]).toEqual({ key: "publicCollection", hidden: false });
    expect(layout.find((section) => section.key === "stats")).toEqual({ key: "stats", hidden: true });
    // The rest fall back to their default places, after their default predecessor.
    expect(layout.map((section) => section.key)).toContain("quickAdd");
  });

  it("drops unknown keys and repeats", () => {
    const saved: OverviewSectionSetting[] = [
      { key: "stats", hidden: false },
      { key: "nope", hidden: false },
      { key: "stats", hidden: true },
    ];
    const layout = resolveOverviewLayout(saved);
    expect(layout.filter((section) => section.key === "stats")).toHaveLength(1);
    expect(layout.some((section) => (section.key as string) === "nope")).toBe(false);
  });

  it("inserts a missing section after its default predecessor", () => {
    const layout = resolveOverviewLayout([{ key: "needsAttention", hidden: false }]);
    const keys = layout.map((section) => section.key);
    // The two button entries are last by default, so everything else precedes them.
    expect(keys[keys.length - 1]).toBe("publicCollection");
    expect(keys).toEqual([
      "stats",
      "quickAdd",
      "events",
      "onSale",
      "gamesCalendar",
      "hardwareCalendar",
      "nowPlaying",
      "recentlyPlayed",
      "recentlyAddedGames",
      "recentlyAddedHardware",
      "needsAttention",
      "displayMode",
      "publicCollection",
    ]);
  });
});
