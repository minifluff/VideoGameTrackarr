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

  it("puts Bookshelf in the main menu right after Games as a top-level destination", () => {
    // Top-level (not a Games sub-item) so it renders on every nav surface —
    // the mobile bottom bar and the rail only show top-level destinations.
    const destinations = getNavDestinations(t);
    const tos = destinations.map((destination) => destination.to);
    expect(tos.indexOf("/games/bookshelf")).toBe(tos.indexOf("/games") + 1);
    const games = destinations.find((destination) => destination.to === "/games");
    expect((games?.subItems ?? []).map((item) => item.to)).not.toContain("/games/bookshelf");
  });

  it("omits only the Hardware destination when hideHardwareMenu is on", () => {
    const withHardware = getNavDestinations(t).map((destination) => destination.to);
    const withoutHardware = getNavDestinations(t, { hideHardwareMenu: true }).map(
      (destination) => destination.to
    );
    expect(withoutHardware).not.toContain("/hardware");
    expect(withoutHardware).toEqual(withHardware.filter((to) => to !== "/hardware"));
  });
});
