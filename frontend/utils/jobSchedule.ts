// Friendly schedule editing for the Jobs page: most schedules are a simple repeating
// pattern, and a raw 5-field cron string is a poor way to show one. These helpers
// translate between that pattern and cron, and format run times as relative + local
// ("Tomorrow at 2:00 AM (in 7 hours)") instead of bare locale strings.
//
// The friendly controls always speak the browser's local time. A stored cron whose
// zone differs from the browser's (or a legacy row with no zone, treated as UTC) can't
// be read as a local wall-time pattern without silently changing when it fires, so it
// stays on the Custom path with its raw cron shown.

export type ScheduleFrequency = "hourly" | "daily" | "weekly" | "monthly" | "custom";

export interface FriendlySchedule {
  frequency: ScheduleFrequency;
  /** 0-59. Hourly: the minute past the hour; other frequencies: the minute of the time. */
  minute: number;
  /** 0-23. Ignored for hourly. */
  hour: number;
  /** 0-6, Sunday = 0. Weekly only. */
  dayOfWeek: number;
  /** 1-31. Monthly only. */
  dayOfMonth: number;
}

function parseField(value: string, min: number, max: number): number | null {
  if (!/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return parsed >= min && parsed <= max ? parsed : null;
}

/** Parses a cron into the friendly pattern, or null when it isn't a simple one. */
export function parseCronToFriendly(cron: string | null): FriendlySchedule | null {
  if (!cron) return null;
  const fields = cron.trim().split(/\s+/);
  if (fields.length !== 5) return null;
  const [minuteField, hourField, domField, monthField, dowField] = fields;
  if (monthField !== "*") return null;

  const minute = parseField(minuteField, 0, 59);
  if (minute === null) return null;

  if (hourField === "*") {
    if (domField === "*" && dowField === "*") return { frequency: "hourly", minute, hour: 0, dayOfWeek: 1, dayOfMonth: 1 };
    return null;
  }
  const hour = parseField(hourField, 0, 23);
  if (hour === null) return null;

  if (domField === "*" && dowField === "*") {
    return { frequency: "daily", minute, hour, dayOfWeek: 1, dayOfMonth: 1 };
  }
  if (domField === "*" && dowField !== "*") {
    const dayOfWeek = parseField(dowField, 0, 7);
    if (dayOfWeek === null) return null;
    // Cron lets Sunday be 0 or 7; the UI only speaks 0.
    return { frequency: "weekly", minute, hour, dayOfWeek: dayOfWeek % 7, dayOfMonth: 1 };
  }
  if (dowField === "*" && domField !== "*") {
    const dayOfMonth = parseField(domField, 1, 31);
    if (dayOfMonth === null) return null;
    return { frequency: "monthly", minute, hour, dayOfWeek: 1, dayOfMonth };
  }
  return null;
}

/** Builds the cron for a friendly schedule (hourly/daily/weekly/monthly only). */
export function friendlyToCron(schedule: FriendlySchedule): string {
  switch (schedule.frequency) {
    case "hourly":
      return `${schedule.minute} * * * *`;
    case "daily":
      return `${schedule.minute} ${schedule.hour} * * *`;
    case "weekly":
      return `${schedule.minute} ${schedule.hour} * * ${schedule.dayOfWeek}`;
    case "monthly":
      return `${schedule.minute} ${schedule.hour} ${schedule.dayOfMonth} * *`;
    case "custom":
      throw new Error("Custom schedules have no friendly cron — use the raw text instead");
  }
}

export function getBrowserTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC";
}

function formatRelativeTime(date: Date, now: Date, locale: string): string {
  const diffSeconds = Math.round((date.getTime() - now.getTime()) / 1000);
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const absolute = Math.abs(diffSeconds);
  if (absolute < 60) return formatter.format(diffSeconds, "second");
  const diffMinutes = Math.round(diffSeconds / 60);
  if (Math.abs(diffMinutes) < 60) return formatter.format(diffMinutes, "minute");
  const diffHours = Math.round(diffSeconds / 3600);
  if (Math.abs(diffHours) < 24) return formatter.format(diffHours, "hour");
  return formatter.format(Math.round(diffSeconds / 86400), "day");
}

function formatAbsoluteLocal(date: Date, locale: string, timeZone?: string): string {
  const datePart = new Intl.DateTimeFormat(locale, {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone,
  }).format(date);
  const timePart = new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  }).format(date);
  return `${datePart}, ${timePart}`;
}

/** "Tue, Nov 17, 11:00 PM (in 4 hours)" — absolute local time plus the relative gap. */
export function formatNextRun(
  nextRunAt: string,
  now: Date,
  locale: string,
  timeZone?: string,
): string {
  const date = new Date(nextRunAt);
  return `${formatAbsoluteLocal(date, locale, timeZone)} (${formatRelativeTime(date, now, locale)})`;
}

/** "5 minutes ago · Tue, Nov 17, 7:05 PM" for a run still in flight. */
export function formatRunningSince(
  startedAt: string,
  now: Date,
  locale: string,
  timeZone?: string,
): string {
  const date = new Date(startedAt);
  return `${formatRelativeTime(date, now, locale)} · ${formatAbsoluteLocal(date, locale, timeZone)}`;
}

/**
 * "2 hours ago · Tue, Nov 17, 5:14 PM · 3m 12s" for a finished run — relative time,
 * absolute local time, and how long the run took when its start is known.
 */
export function formatLastRun(
  finishedAt: string,
  startedAt: string | null,
  now: Date,
  locale: string,
  timeZone?: string,
): string {
  const finished = new Date(finishedAt);
  const parts = [
    formatRelativeTime(finished, now, locale),
    formatAbsoluteLocal(finished, locale, timeZone),
  ];
  if (startedAt) {
    const durationMs = finished.getTime() - new Date(startedAt).getTime();
    if (durationMs >= 0) parts.push(formatDuration(durationMs));
  }
  return parts.join(" · ");
}

/** "45s", "3m 12s", "1h 5m" — symbols only, so no locale strings are needed. */
export function formatDuration(durationMs: number): string {
  const totalSeconds = Math.floor(durationMs / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const totalMinutes = Math.floor(totalSeconds / 60);
  if (totalMinutes < 60) {
    const seconds = totalSeconds % 60;
    return seconds === 0 ? `${totalMinutes}m` : `${totalMinutes}m ${seconds}s`;
  }
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
}
