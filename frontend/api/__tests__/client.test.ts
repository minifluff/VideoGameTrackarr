import { describe, expect, it } from "vitest";
import { shouldSkipTokenRefresh } from "../client";

describe("shouldSkipTokenRefresh", () => {
  it("skips refresh only for login and refresh", () => {
    expect(shouldSkipTokenRefresh("/api/auth/login")).toBe(true);
    expect(shouldSkipTokenRefresh("/api/auth/refresh")).toBe(true);
  });

  it("refreshes normally for /me, preferences, and other endpoints", () => {
    // /api/auth/me is the Dashboard's cold-start call: an expired access token
    // there must refresh like anywhere else, not sign the user out.
    expect(shouldSkipTokenRefresh("/api/auth/me")).toBe(false);
    expect(shouldSkipTokenRefresh("/api/auth/me/preferences")).toBe(false);
    expect(shouldSkipTokenRefresh("/api/auth/change-password")).toBe(false);
    expect(shouldSkipTokenRefresh("/api/games")).toBe(false);
    expect(shouldSkipTokenRefresh(undefined)).toBe(false);
  });
});
