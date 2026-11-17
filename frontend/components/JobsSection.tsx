import { useEffect, useState } from "react";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Collapse from "@mui/material/Collapse";
import Divider from "@mui/material/Divider";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import LinearProgress from "@mui/material/LinearProgress";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import type { ChipProps } from "@mui/material/Chip";
import type { JobRunStatus, JobSummary, ResyncJobResult } from "../api/types";
import {
  useAcknowledgeJobStatus,
  useJobsList,
  useRunJob,
  useUpdateJobSchedule,
} from "../hooks/useJobs";
import { useNow } from "../hooks/useNow";
import { TOAST_OPTIONS } from "../utils/toastOptions";
import type { FriendlySchedule, ScheduleFrequency } from "../utils/jobSchedule";
import {
  formatLastRun,
  formatNextRun,
  formatRunningSince,
  friendlyToCron,
  getBrowserTimeZone,
  parseCronToFriendly,
} from "../utils/jobSchedule";
import ExportBackupJobCard from "./ExportBackupJobCard";

// The friendly controls always speak the browser's local time. A stored cron whose
// zone differs from the browser's — or a legacy row with no zone, treated as UTC —
// can't be read as a local wall-time pattern without silently changing when it fires,
// so it stays on the Custom path with its raw cron shown.
function deriveFriendly(job: JobSummary): FriendlySchedule | null {
  if (job.schedule.timezone !== getBrowserTimeZone()) return null;
  return parseCronToFriendly(job.schedule.cronExpression);
}

// Registering a future job means adding one entry here — job ids on their own aren't good
// UI copy, so a small static display-name lookup is the one manual step the "reusable
// registry" design accepts (see backend/app/services/job_definitions.py's docstring).
const JOB_DISPLAY_KEYS: Record<string, { nameKey: string; descriptionKey: string }> = {
  resync_all: {
    nameKey: "settings.jobs.jobs.resyncAll.name",
    descriptionKey: "settings.jobs.jobs.resyncAll.description",
  },
  resync_games: {
    nameKey: "settings.jobs.jobs.resyncGames.name",
    descriptionKey: "settings.jobs.jobs.resyncGames.description",
  },
  resync_collections: {
    nameKey: "settings.jobs.jobs.resyncCollections.name",
    descriptionKey: "settings.jobs.jobs.resyncCollections.description",
  },
  resync_series: {
    nameKey: "settings.jobs.jobs.resyncSeries.name",
    descriptionKey: "settings.jobs.jobs.resyncSeries.description",
  },
  steam_import: {
    nameKey: "settings.jobs.jobs.steamImport.name",
    descriptionKey: "settings.jobs.jobs.steamImport.description",
  },
  gog_import: {
    nameKey: "settings.jobs.jobs.gogImport.name",
    descriptionKey: "settings.jobs.jobs.gogImport.description",
  },
  gog_download: {
    nameKey: "settings.jobs.jobs.gogDownload.name",
    descriptionKey: "settings.jobs.jobs.gogDownload.description",
  },
  itad_refresh: {
    nameKey: "settings.jobs.jobs.itadRefresh.name",
    descriptionKey: "settings.jobs.jobs.itadRefresh.description",
  },
  platprices_refresh: {
    nameKey: "settings.jobs.jobs.platpricesRefresh.name",
    descriptionKey: "settings.jobs.jobs.platpricesRefresh.description",
  },
  nintendo_refresh: {
    nameKey: "settings.jobs.jobs.nintendoRefresh.name",
    descriptionKey: "settings.jobs.jobs.nintendoRefresh.description",
  },
  events_sync: {
    nameKey: "settings.jobs.jobs.eventsSync.name",
    descriptionKey: "settings.jobs.jobs.eventsSync.description",
  },
  export_backup: {
    nameKey: "settings.jobs.jobs.exportBackup.name",
    descriptionKey: "settings.jobs.jobs.exportBackup.description",
  },
};

const STATUS_CHIP_COLOR: Record<JobRunStatus, ChipProps["color"]> = {
  idle: "default",
  running: "info",
  completed: "success",
  failed: "error",
};

function JobCard({ job }: { job: JobSummary }) {
  const { t, i18n } = useTranslation();
  const runJob = useRunJob();
  const acknowledge = useAcknowledgeJobStatus();
  const updateSchedule = useUpdateJobSchedule();
  const now = useNow();

  const displayKeys = JOB_DISPLAY_KEYS[job.id];
  const [scheduleEnabled, setScheduleEnabled] = useState(job.schedule.enabled);
  const [cronExpression, setCronExpression] = useState(job.schedule.cronExpression ?? "");
  const [friendly, setFriendly] = useState<FriendlySchedule | null>(() => deriveFriendly(job));
  const browserTimeZone = getBrowserTimeZone();
  const frequency: ScheduleFrequency = friendly?.frequency ?? "custom";
  const [showFailures, setShowFailures] = useState(false);

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

  const isRunning = job.run.status === "running";
  const result = job.run.result as ResyncJobResult | null;

  const handleRun = async () => {
    try {
      await runJob.mutateAsync(job.id);
    } catch (error) {
      console.error(`Error running job ${job.id}:`, error);
      toast.error(t("settings.jobs.runError"), TOAST_OPTIONS);
    }
  };

  const handleDismiss = async () => {
    try {
      await acknowledge.mutateAsync(job.id);
    } catch (error) {
      console.error(`Error dismissing job ${job.id} status:`, error);
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
      setFriendly((prev) =>
        prev === null ? prev : { ...prev, hour, minute },
      );
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

  const timeValue = friendly
    ? `${String(friendly.hour).padStart(2, "0")}:${String(friendly.minute).padStart(2, "0")}`
    : "";

  return (
    <Box>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", flexWrap: "wrap" }}>
        <Typography variant="subtitle2">{displayKeys ? t(displayKeys.nameKey) : job.id}</Typography>
        <Chip
          size="small"
          color={STATUS_CHIP_COLOR[job.run.status]}
          label={t(`settings.jobs.status.${job.run.status}`)}
        />
      </Stack>
      {displayKeys && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {t(displayKeys.descriptionKey)}
        </Typography>
      )}

      <Button
        variant="outlined"
        size="small"
        startIcon={<PlayArrowIcon />}
        sx={{ mt: 1.5 }}
        disabled={isRunning}
        onClick={handleRun}
      >
        {t("settings.jobs.runNow")}
      </Button>

      {isRunning && (
        <Box sx={{ mt: 1.5 }}>
          <LinearProgress
            variant={job.run.progress ? "determinate" : "indeterminate"}
            value={
              job.run.progress && job.run.progress.total > 0
                ? (job.run.progress.current / job.run.progress.total) * 100
                : undefined
            }
          />
          {job.run.progress && (
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
              {t("settings.jobs.progress", {
                current: job.run.progress.current,
                total: job.run.progress.total,
              })}
            </Typography>
          )}
        </Box>
      )}

      {result && (
        <Box sx={{ mt: 1.5 }}>
          <Alert
            severity={
              job.run.status === "failed" ? "error" : result.failed > 0 ? "warning" : "success"
            }
            action={
              <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                {result.failed > 0 && (
                  <IconButton
                    size="small"
                    onClick={() => setShowFailures((prev) => !prev)}
                    aria-label={showFailures ? t("common.collapse") : t("common.expand")}
                    aria-expanded={showFailures}
                  >
                    {showFailures ? (
                      <ExpandLessIcon fontSize="small" />
                    ) : (
                      <ExpandMoreIcon fontSize="small" />
                    )}
                  </IconButton>
                )}
                <Button size="small" onClick={handleDismiss}>
                  {t("settings.jobs.dismiss")}
                </Button>
              </Stack>
            }
          >
            {t("settings.jobs.resultSummary", {
              succeeded: result.succeeded,
              failed: result.failed,
              total: result.total,
            })}
          </Alert>
          <Collapse in={showFailures}>
            <Stack spacing={0.5} sx={{ mt: 1, pl: 2 }}>
              {result.failures.map((failure) => (
                <Typography key={failure.gameId} variant="body2" color="text.secondary">
                  {failure.gameName}: {failure.error}
                </Typography>
              ))}
            </Stack>
          </Collapse>
        </Box>
      )}
      {job.run.status === "failed" && !result && (
        <Alert
          severity="error"
          sx={{ mt: 1.5 }}
          action={
            <Button size="small" onClick={handleDismiss}>
              {t("settings.jobs.dismiss")}
            </Button>
          }
        >
          {job.run.error}
        </Alert>
      )}

      <Divider sx={{ my: 2 }} />

      <Typography variant="body2" color="text.secondary" gutterBottom>
        {t("settings.jobs.scheduleHeading")}
      </Typography>
      <FormControlLabel
        control={
          <Switch
            checked={scheduleEnabled}
            onChange={(event) => setScheduleEnabled(event.target.checked)}
          />
        }
        label={t("settings.jobs.scheduleEnabledLabel")}
      />
      <Stack
        direction="row"
        spacing={1.5}
        sx={{ alignItems: "flex-start", flexWrap: "wrap", mt: 1 }}
      >
        <TextField
          select
          size="small"
          label={t("settings.jobs.frequencyLabel")}
          value={frequency}
          disabled={!scheduleEnabled}
          onChange={(event) => handleFrequencyChange(event.target.value as ScheduleFrequency)}
          sx={{ minWidth: 160 }}
        >
          {(["hourly", "daily", "weekly", "monthly", "custom"] as ScheduleFrequency[]).map(
            (option) => (
              <MenuItem key={option} value={option}>
                {t(`settings.jobs.frequency.${option}`)}
              </MenuItem>
            ),
          )}
        </TextField>
        {frequency === "hourly" && (
          <TextField
            size="small"
            type="number"
            label={t("settings.jobs.minuteLabel")}
            value={friendly?.minute ?? 0}
            disabled={!scheduleEnabled}
            onChange={(event) => {
              const minute = Number(event.target.value);
              if (Number.isInteger(minute) && minute >= 0 && minute <= 59) {
                setFriendly((prev) => (prev === null ? prev : { ...prev, minute }));
              }
            }}
            slotProps={{ htmlInput: { min: 0, max: 59 } }}
            sx={{ width: 140 }}
          />
        )}
        {(frequency === "daily" || frequency === "weekly" || frequency === "monthly") && (
          <TextField
            size="small"
            type="time"
            label={t("settings.jobs.timeLabel")}
            value={timeValue}
            disabled={!scheduleEnabled}
            onChange={(event) => handleTimeChange(event.target.value)}
            sx={{ width: 140 }}
          />
        )}
        {frequency === "weekly" && (
          <TextField
            select
            size="small"
            label={t("settings.jobs.weekdayLabel")}
            value={friendly?.dayOfWeek ?? 1}
            disabled={!scheduleEnabled}
            onChange={(event) =>
              setFriendly((prev) =>
                prev === null ? prev : { ...prev, dayOfWeek: Number(event.target.value) },
              )
            }
            sx={{ minWidth: 140 }}
          >
            {weekdays.map((day) => (
              <MenuItem key={day.value} value={day.value}>
                {day.label}
              </MenuItem>
            ))}
          </TextField>
        )}
        {frequency === "monthly" && (
          <TextField
            size="small"
            type="number"
            label={t("settings.jobs.dayOfMonthLabel")}
            value={friendly?.dayOfMonth ?? 1}
            disabled={!scheduleEnabled}
            onChange={(event) => {
              const dayOfMonth = Number(event.target.value);
              if (Number.isInteger(dayOfMonth) && dayOfMonth >= 1 && dayOfMonth <= 31) {
                setFriendly((prev) => (prev === null ? prev : { ...prev, dayOfMonth }));
              }
            }}
            slotProps={{ htmlInput: { min: 1, max: 31 } }}
            sx={{ width: 140 }}
          />
        )}
        {frequency === "custom" && (
          <TextField
            size="small"
            label={t("settings.jobs.cronExpressionLabel")}
            helperText={t("settings.jobs.cronExpressionHelp")}
            value={cronExpression}
            disabled={!scheduleEnabled}
            onChange={(event) => setCronExpression(event.target.value)}
            sx={{ minWidth: 220 }}
          />
        )}
        <Button
          variant="outlined"
          size="small"
          onClick={handleSaveSchedule}
          disabled={updateSchedule.isPending}
        >
          {t("settings.jobs.saveSchedule")}
        </Button>
      </Stack>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
        {t("settings.jobs.timezoneNote", {
          timezone: friendly ? browserTimeZone : (job.schedule.timezone ?? "UTC"),
        })}
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
        {job.schedule.nextRunAt
          ? t("settings.jobs.nextRun", {
              date: formatNextRun(job.schedule.nextRunAt, now, i18n.language),
            })
          : t("settings.jobs.neverScheduled")}
      </Typography>
      {isRunning && job.run.startedAt && (
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
          {t("settings.jobs.runningSince", {
            date: formatRunningSince(job.run.startedAt, now, i18n.language),
          })}
        </Typography>
      )}
      {!isRunning && job.run.finishedAt && (
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
          {t("settings.jobs.lastRun", {
            date: formatLastRun(
              job.run.finishedAt,
              job.run.startedAt,
              now,
              i18n.language,
            ),
          })}
        </Typography>
      )}
    </Box>
  );
}

const EXPORT_BACKUP_JOB_ID = "export_backup";

const JobsSection = () => {
  const { data: jobs } = useJobsList();

  if (!jobs || jobs.length === 0) return null;

  const regularJobs = jobs.filter((job) => job.id !== EXPORT_BACKUP_JOB_ID);
  const exportJob = jobs.find((job) => job.id === EXPORT_BACKUP_JOB_ID);

  return (
    <Stack spacing={3}>
      {regularJobs.map((job, index) => (
        <Box key={job.id}>
          {index > 0 && <Divider sx={{ mb: 3 }} />}
          <JobCard job={job} />
        </Box>
      ))}
      {exportJob && (
        <Box>
          <Divider sx={{ mb: 3 }} />
          <ExportBackupJobCard job={exportJob} />
        </Box>
      )}
    </Stack>
  );
};

export default JobsSection;
