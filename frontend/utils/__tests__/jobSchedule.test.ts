import { describe, expect, it } from "vitest";
import {
  formatDuration,
  formatLastRun,
  formatNextRun,
  formatRunningSince,
  friendlyToCron,
  parseCronToFriendly,
} from "../jobSchedule";

// Fixed "now" in Halifax time; every formatter gets the explicit zone so these
// assertions hold in any runner timezone (CI runs UTC, the sandbox Halifax).
const NOW = new Date("2026-11-17T12:00:00-04:00");
const ZONE = "America/Halifax";

describe("parseCronToFriendly", () => {
  it("parses hourly, daily, weekly, and monthly patterns", () => {
    expect(parseCronToFriendly("0 * * * *")).toEqual({
      frequency: "hourly",
      minute: 0,
      hour: 0,
      dayOfWeek: 1,
      dayOfMonth: 1,
    });
    expect(parseCronToFriendly("30 * * * *")).toEqual({
      frequency: "hourly",
      minute: 30,
      hour: 0,
      dayOfWeek: 1,
      dayOfMonth: 1,
    });
    expect(parseCronToFriendly("15 3 * * *")).toEqual({
      frequency: "daily",
      minute: 15,
      hour: 3,
      dayOfWeek: 1,
      dayOfMonth: 1,
    });
    expect(parseCronToFriendly("0 2 * * 1")).toEqual({
      frequency: "weekly",
      minute: 0,
      hour: 2,
      dayOfWeek: 1,
      dayOfMonth: 1,
    });
    expect(parseCronToFriendly("30 4 15 * *")).toEqual({
      frequency: "monthly",
      minute: 30,
      hour: 4,
      dayOfWeek: 1,
      dayOfMonth: 15,
    });
  });

  it("normalizes Sunday 7 to 0", () => {
    expect(parseCronToFriendly("0 2 * * 7")?.dayOfWeek).toBe(0);
  });

  it("returns null for anything that isn't a simple pattern", () => {
    expect(parseCronToFriendly(null)).toBeNull();
    expect(parseCronToFriendly("not a cron")).toBeNull();
    expect(parseCronToFriendly("*/15 * * * *")).toBeNull();
    expect(parseCronToFriendly("0 3 * * 1,3")).toBeNull();
    expect(parseCronToFriendly("0 3 1 * 1")).toBeNull();
    expect(parseCronToFriendly("0 25 * * *")).toBeNull();
    expect(parseCronToFriendly("0 3 * 2 *")).toBeNull();
  });
});

describe("friendlyToCron", () => {
  it("round-trips through parseCronToFriendly", () => {
    const crons = ["30 * * * *", "15 3 * * *", "0 2 * * 1", "30 4 15 * *"];
    for (const cron of crons) {
      const parsed = parseCronToFriendly(cron);
      expect(parsed).not.toBeNull();
      expect(friendlyToCron(parsed!)).toBe(cron);
    }
  });

  it("throws for custom", () => {
    expect(() =>
      friendlyToCron({ frequency: "custom", minute: 0, hour: 3, dayOfWeek: 1, dayOfMonth: 1 }),
    ).toThrow();
  });
});

describe("formatNextRun", () => {
  it("shows the absolute local time plus the relative gap", () => {
    expect(formatNextRun("2026-11-17T23:00:00-04:00", NOW, "en", ZONE)).toBe(
      "Tue, Nov 17, 11:00 PM (in 11 hours)",
    );
    expect(formatNextRun("2026-11-18T14:00:00-04:00", NOW, "en", ZONE)).toBe(
      "Wed, Nov 18, 2:00 PM (tomorrow)",
    );
  });
});

describe("formatRunningSince", () => {
  it("shows how long ago the run started", () => {
    expect(formatRunningSince("2026-11-17T11:55:00-04:00", NOW, "en", ZONE)).toBe(
      "5 minutes ago · Tue, Nov 17, 11:55 AM",
    );
  });
});

describe("formatLastRun", () => {
  it("shows the relative time, absolute local time, and duration", () => {
    expect(
      formatLastRun(
        "2026-11-17T10:00:00-04:00",
        "2026-11-17T09:56:48-04:00",
        NOW,
        "en",
        ZONE,
      ),
    ).toBe("2 hours ago · Tue, Nov 17, 10:00 AM · 3m 12s");
  });

  it("omits the duration when the start is unknown", () => {
    expect(formatLastRun("2026-11-17T10:00:00-04:00", null, NOW, "en", ZONE)).toBe(
      "2 hours ago · Tue, Nov 17, 10:00 AM",
    );
  });
});

describe("formatDuration", () => {
  it("formats seconds, minutes, and hours", () => {
    expect(formatDuration(45_000)).toBe("45s");
    expect(formatDuration(180_000)).toBe("3m");
    expect(formatDuration(192_000)).toBe("3m 12s");
    expect(formatDuration(3_600_000)).toBe("1h");
    expect(formatDuration(3_900_000)).toBe("1h 5m");
  });
});
