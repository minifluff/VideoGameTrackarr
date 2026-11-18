// Shared schedule editing state for the Jobs page cards (JobCard and
// ExportBackupJobCard). Both cards render the same schedule UI — the friendly
// frequency/time controls, the save, and the relative run times — so the state lives
// here once instead of being copied per card (a copy is how the backup card was
// missed when the friendly scheduler landed).
//
// The "Run on a schedule" toggle lives in each card's header and is part of this
// state too: flipping it off saves the disable immediately (the schedule section
// disappears with it, so there is no Save button left to persist the change);
// flipping it on only reveals the section, and Save persists the new schedule.
import { useEffect, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import type { JobSummary } from "../api/types";
import { useUpdateJobSchedule } from "./useJobs";
import { TOAST_OPTIONS } from "../utils/toastOptions";
import type { FriendlySchedule, ScheduleFrequency } from "../utils/jobSchedule";
import {
  friendlyToCron,
  getBrowserTimeZone,
  parseCronToFriendly,
} from "../utils/jobSchedule";

// The friendly controls always speak the browser's local time. A stored cron whose
// zone differs from the browser's — or a legacy row with no zone, treated as UTC —
// can't be read as a local wall-time pattern without silently changing when it fires,
// so it stays on the Custom path with its raw cron shown.
function deriveFriendly(job: JobSummary): FriendlySchedule | null {
  if (job.schedule.timezone !== getBrowserTimeZone()) return null;
  return parseCronToFriendly(job.schedule.cronExpression);
}

export interface JobScheduleEditor {
  scheduleEnabled: boolean;
  cronExpression: string;
  setCronExpression: (value: string) => void;
  friendly: FriendlySchedule | null;
  setFriendly: Dispatch<SetStateAction<FriendlySchedule | null>>;
  frequency: ScheduleFrequency;
  browserTimeZone: string;
  weekdays: { value: number; label: string }[];
  timeValue: string;
  isSaving: boolean;
  handleToggle: (enabled: boolean) => Promise<void>;
  handleSaveSchedule: () => Promise<void>;
  handleFrequencyChange: (next: ScheduleFrequency) => void;
  handleTimeChange: (value: string) => void;
}

export function useJobScheduleEditor(job: JobSummary): JobScheduleEditor {
  const { t, i18n } = useTranslation();
  const updateSchedule = useUpdateJobSchedule();

  const [scheduleEnabled, setScheduleEnabled] = useState(job.schedule.enabled);
  const [cronExpression, setCronExpression] = useState(job.schedule.cronExpression ?? "");
  const [friendly, setFriendly] = useState<FriendlySchedule | null>(() => deriveFriendly(job));
  const browserTimeZone = getBrowserTimeZone();
  const frequency: ScheduleFrequency = friendly?.frequency ?? "custom";

  useEffect(() => {
    setScheduleEnabled(job.schedule.enabled);
    setCronExpression(job.schedule.cronExpression ?? "");
    setFriendly(deriveFriendly(job));
  }, [job.schedule.enabled, job.schedule.cronExpression, job.schedule.timezone]);

  const weekdays = [0, 1, 2, 3, 4, 5, 6].map((day) => ({
    value: day,
    // Jan 4, 2026 is a Sunday; the UTC zone keeps the date fixed in every locale.
    label: new Intl.DateTimeFormat(i18n.language, { weekday: "long", timeZone: "UTC" }).format(
      new Date(Date.UTC(2026, 0, 4 + day)),
    ),
  }));

  const timeValue = friendly
    ? `${String(friendly.hour).padStart(2, "0")}:${String(friendly.minute).padStart(2, "0")}`
    : "";

  const handleToggle = async (enabled: boolean) => {
    setScheduleEnabled(enabled);
    if (enabled) return; // Turning on only reveals the section; Save persists it.
    try {
      await updateSchedule.mutateAsync({
        jobId: job.id,
        enabled: false,
        cronExpression: null,
      });
    } catch (error) {
      console.error(`Error disabling schedule for job ${job.id}:`, error);
      setScheduleEnabled(job.schedule.enabled);
      toast.error(t("settings.jobs.scheduleSaveError"), TOAST_OPTIONS);
    }
  };

  const handleSaveSchedule = async () => {
    try {
      // A friendly save stores the cron in the browser's zone, so the picked local
      // time keeps meaning that local time across daylight-saving changes. A custom
      // save sends no zone and keeps whatever is stored.
      await updateSchedule.mutateAsync({
        jobId: job.id,
        enabled: scheduleEnabled,
        cronExpression: scheduleEnabled
          ? friendly
            ? friendlyToCron(friendly)
            : cronExpression.trim()
          : null,
        timezone: scheduleEnabled && friendly ? browserTimeZone : undefined,
      });
    } catch (error) {
      console.error(`Error saving schedule for job ${job.id}:`, error);
      toast.error(t("settings.jobs.scheduleSaveError"), TOAST_OPTIONS);
    }
  };

  const handleTimeChange = (value: string) => {
    const [hourText, minuteText] = value.split(":");
    const hour = Number(hourText);
    const minute = Number(minuteText);
    if (Number.isInteger(hour) && Number.isInteger(minute)) {
      setFriendly((prev) => (prev === null ? prev : { ...prev, hour, minute }));
    }
  };

  const handleFrequencyChange = (next: ScheduleFrequency) => {
    if (next === "custom") {
      setFriendly(null);
      return;
    }
    setFriendly((prev) => ({
      frequency: next,
      minute: prev?.minute ?? 0,
      hour: prev?.hour ?? 3,
      dayOfWeek: prev?.dayOfWeek ?? 1,
      dayOfMonth: prev?.dayOfMonth ?? 1,
    }));
  };

  return {
    scheduleEnabled,
    cronExpression,
    setCronExpression,
    friendly,
    setFriendly,
    frequency,
    browserTimeZone,
    weekdays,
    timeValue,
    isSaving: updateSchedule.isPending,
    handleToggle,
    handleSaveSchedule,
    handleFrequencyChange,
    handleTimeChange,
  };
}
