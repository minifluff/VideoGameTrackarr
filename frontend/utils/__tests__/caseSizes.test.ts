import { describe, expect, it } from "vitest";
import {
  caseSizeToPixels,
  defaultCaseSizeForPlatform,
  effectiveCaseSizeMm,
  presetForDimensions,
} from "../caseSizes";

describe("caseSizeToPixels", () => {
  it("renders at exactly 40% of actual size", () => {
    // Genesis: 184mm tall x 25mm spine at 3.7796 px/mm, scaled 0.4.
    expect(caseSizeToPixels(184, 25)).toEqual({ width: 38, height: 278 });
    // Switch: 170 x 10.4mm.
    expect(caseSizeToPixels(170, 10.4)).toEqual({ width: 16, height: 257 });
  });
});

describe("defaultCaseSizeForPlatform", () => {
  it("knows the common systems", () => {
    expect(defaultCaseSizeForPlatform({ name: "PlayStation 5" })?.id).toBe("bluray");
    expect(defaultCaseSizeForPlatform({ name: "PlayStation 2" })?.id).toBe("dvd");
    expect(defaultCaseSizeForPlatform({ name: "PlayStation" })?.id).toBe("jewel");
    expect(defaultCaseSizeForPlatform({ name: "Nintendo Switch" })?.id).toBe("switch");
    expect(defaultCaseSizeForPlatform({ name: "Sega Mega Drive/Genesis" })?.id).toBe("genesis");
    expect(defaultCaseSizeForPlatform({ name: "Nintendo 3DS" })?.id).toBe("n3ds");
    expect(defaultCaseSizeForPlatform({ name: "Nintendo DS" })?.id).toBe("ds");
    expect(defaultCaseSizeForPlatform({ name: "Xbox" })?.id).toBe("dvd");
    expect(defaultCaseSizeForPlatform({ name: "Xbox One" })?.id).toBe("bluray");
  });

  it("falls back to the abbreviation", () => {
    expect(defaultCaseSizeForPlatform({ name: "Custom", abbreviation: "PS5" })?.id).toBe("bluray");
    expect(defaultCaseSizeForPlatform({ name: "Custom", abbreviation: "GEN" })?.id).toBe("genesis");
  });

  it("has no default for systems without a physical case", () => {
    expect(defaultCaseSizeForPlatform({ name: "PC (Microsoft Windows)" })).toBeNull();
    expect(defaultCaseSizeForPlatform({ name: "Steam" })).toBeNull();
  });
});

describe("effectiveCaseSizeMm", () => {
  it("prefers the user's chosen size over the known default", () => {
    expect(
      effectiveCaseSizeMm({ name: "PlayStation 5", caseHeightMm: 184, caseSpineMm: 14 })
    ).toEqual({ heightMm: 184, spineMm: 14 });
  });

  it("uses the known default when nothing was chosen", () => {
    expect(effectiveCaseSizeMm({ name: "Nintendo Switch" })).toEqual({
      heightMm: 170,
      spineMm: 10.4,
    });
    expect(effectiveCaseSizeMm({ name: "Steam" })).toBeNull();
  });
});

describe("presetForDimensions", () => {
  it("finds the preset matching stored dimensions", () => {
    expect(presetForDimensions(184, 25)?.id).toBe("genesis");
    expect(presetForDimensions(123, 45)).toBeNull();
  });
});
