import { describe, expect, it } from "vitest";
import type { TFunction } from "i18next";
import { getNavDestinations } from "../destinations";

// Labels echo their i18n key, so destinations are identified by `to` throughout.
const t = ((key: string) => key) as unknown as TFunction;

describe("getNavDestinations", () => {
  it("includes the Hardware destination by default", () => {
    const tos = getNavDestinations(t).map((destination) => destination.to);
    expect(tos).toContain("/hardware");
  });

  it("puts Bookshelf in the Games menu right after Add Game", () => {
    const destinations = getNavDestinations(t);
    const games = destinations.find((destination) => destination.to === "/games");
    const subTos = (games?.subItems ?? []).map((item) => item.to);
    expect(subTos.indexOf("/games/bookshelf")).toBe(subTos.indexOf("/games/add") + 1);
    expect(destinations.map((destination) => destination.to)).not.toContain("/games/bookshelf");
  });

  it("omits only the Hardware destination when hideHardwareMenu is on", () => {
    const withHardware = getNavDestinations(t).map((destination) => destination.to);
    const withoutHardware = getNavDestinations(t, { hideHardwareMenu: true }).map(
      (destination) => destination.to
    );
    expect(withoutHardware).not.toContain("/hardware");
    expect(withoutHardware).toEqual(withHardware.filter((to) => to !== "/hardware"));
  });

  it.each([
    [{ hideDashboardMenu: true }, "/"],
    [{ hideGamesMenu: true }, "/games"],
    [{ hideEventsMenu: true }, "/events"],
    [{ hideAchievementsMenu: true }, "/achievements"],
    [{ hideInsightsMenu: true }, "/insights"],
  ] as const)("omits only %s when its hide flag is on", (options, hiddenTo) => {
    const all = getNavDestinations(t).map((destination) => destination.to);
    const filtered = getNavDestinations(t, options).map((destination) => destination.to);
    expect(filtered).not.toContain(hiddenTo);
    expect(filtered).toEqual(all.filter((to) => to !== hiddenTo));
  });

  it("omits every hidden destination at once, keeping Settings", () => {
    const filtered = getNavDestinations(t, {
      hideDashboardMenu: true,
      hideGamesMenu: true,
      hideHardwareMenu: true,
      hideEventsMenu: true,
      hideAchievementsMenu: true,
      hideInsightsMenu: true,
    }).map((destination) => destination.to);
    expect(filtered).toEqual(["/settings"]);
  });
});
