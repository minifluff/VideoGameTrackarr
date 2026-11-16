import { describe, expect, it } from "vitest";
import { hardwarePlatformLogoSlug } from "../platformLogos";

describe("hardwarePlatformLogoSlug", () => {
  it("maps generation names to their IGDB platform slugs", () => {
    expect(hardwarePlatformLogoSlug("PlayStation 5")).toBe("ps5");
    expect(hardwarePlatformLogoSlug("Xbox Series")).toBe("series-x-s");
    expect(hardwarePlatformLogoSlug("Game Boy Advance")).toBe("gba");
    expect(hardwarePlatformLogoSlug("Nintendo Switch 2")).toBe("switch-2");
  });

  it("falls back to the name's own slug for unlisted platforms", () => {
    expect(hardwarePlatformLogoSlug("Dreamcast")).toBe("dreamcast");
    expect(hardwarePlatformLogoSlug("Neo Geo Pocket Color")).toBe("neo-geo-pocket-color");
  });
});
