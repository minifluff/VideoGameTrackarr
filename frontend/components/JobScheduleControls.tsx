// The schedule section shared by every Jobs page card: friendly frequency/time
// controls, the save, and the relative next/last run times in local time. The
// "Run on a schedule" toggle itself lives in each card's header (see
// useJobScheduleEditor) — this is only the section that hides when it is off.
import Button from "@mui/material/Button";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import type { JobSummary } from "../api/types";
import { useNow } from "../hooks/useNow";
import type { JobScheduleEditor } from "../hooks/useJobScheduleEditor";
import type { ScheduleFrequency } from "../utils/jobSchedule";
import { formatNextRun } from "../utils/jobSchedule";

const FREQUENCIES: ScheduleFrequency[] = ["hourly", "daily", "weekly", "monthly", "custom"];

const JobScheduleControls = ({ job, editor }: { job: JobSummary; editor: JobScheduleEditor }) => {
  const { t, i18n } = useTranslation();
  const now = useNow();
  const { frequency, friendly } = editor;

  return (
    <>
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
          onChange={(event) => editor.handleFrequencyChange(event.target.value as ScheduleFrequency)}
          sx={{ minWidth: 160 }}
        >
          {FREQUENCIES.map((option) => (
            <MenuItem key={option} value={option}>
              {t(`settings.jobs.frequency.${option}`)}
            </MenuItem>
          ))}
        </TextField>
        {frequency === "hourly" && (
          <TextField
            size="small"
            type="number"
            label={t("settings.jobs.minuteLabel")}
            value={friendly?.minute ?? 0}
            onChange={(event) => {
              const minute = Number(event.target.value);
              if (Number.isInteger(minute) && minute >= 0 && minute <= 59) {
                editor.setFriendly((prev) => (prev === null ? prev : { ...prev, minute }));
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
            value={editor.timeValue}
            onChange={(event) => editor.handleTimeChange(event.target.value)}
            sx={{ width: 140 }}
          />
        )}
        {frequency === "weekly" && (
          <TextField
            select
            size="small"
            label={t("settings.jobs.weekdayLabel")}
            value={friendly?.dayOfWeek ?? 1}
            onChange={(event) =>
              editor.setFriendly((prev) =>
                prev === null ? prev : { ...prev, dayOfWeek: Number(event.target.value) },
              )
            }
            sx={{ minWidth: 140 }}
          >
            {editor.weekdays.map((day) => (
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
            onChange={(event) => {
              const dayOfMonth = Number(event.target.value);
              if (Number.isInteger(dayOfMonth) && dayOfMonth >= 1 && dayOfMonth <= 31) {
                editor.setFriendly((prev) => (prev === null ? prev : { ...prev, dayOfMonth }));
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
            value={editor.cronExpression}
            onChange={(event) => editor.setCronExpression(event.target.value)}
            sx={{ minWidth: 220 }}
          />
        )}
        <Button
          variant="outlined"
          size="small"
          onClick={editor.handleSaveSchedule}
          disabled={editor.isSaving}
        >
          {t("settings.jobs.saveSchedule")}
        </Button>
      </Stack>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
        {t("settings.jobs.timezoneNote", {
          timezone: friendly ? editor.browserTimeZone : (job.schedule.timezone ?? "UTC"),
        })}
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
        {job.schedule.nextRunAt
          ? t("settings.jobs.nextRun", {
              date: formatNextRun(job.schedule.nextRunAt, now, i18n.language),
            })
          : t("settings.jobs.neverScheduled")}
      </Typography>
    </>
  );
};

export default JobScheduleControls;
