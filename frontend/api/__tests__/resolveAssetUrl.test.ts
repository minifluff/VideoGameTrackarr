import { describe, expect, it } from "vitest";
import { resolveAssetUrl } from "../client";

describe("resolveAssetUrl", () => {
  it("passes absolute https URLs through unchanged", () => {
    expect(resolveAssetUrl("https://images.igdb.com/igdb/image/upload/t_720p/co1.jpg")).toBe(
      "https://images.igdb.com/igdb/image/upload/t_720p/co1.jpg"
    );
  });

  it("gives protocol-relative URLs an https scheme instead of prepending the API origin", () => {
    expect(resolveAssetUrl("//images.igdb.com/igdb/image/upload/t_thumb/co1.jpg")).toBe(
      "https://images.igdb.com/igdb/image/upload/t_thumb/co1.jpg"
    );
  });

  it("prefixes relative upload paths with the API origin", () => {
    const resolved = resolveAssetUrl("/uploads/covers/abc.jpg");
    expect(resolved).toMatch(/^https?:\/\//);
    expect(resolved).toContain("/uploads/covers/abc.jpg");
  });

  it("returns null for null", () => {
    expect(resolveAssetUrl(null)).toBeNull();
  });
});
