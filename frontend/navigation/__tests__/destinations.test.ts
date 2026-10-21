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

  it("omits only the Hardware destination when hideHardwareMenu is on", () => {
    const withHardware = getNavDestinations(t).map((destination) => destination.to);
    const withoutHardware = getNavDestinations(t, { hideHardwareMenu: true }).map(
      (destination) => destination.to
    );
    expect(withoutHardware).not.toContain("/hardware");
    expect(withoutHardware).toEqual(withHardware.filter((to) => to !== "/hardware"));
  });
});
