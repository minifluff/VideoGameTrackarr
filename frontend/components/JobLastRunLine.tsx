// The job's run history — when the last run finished (and how long it took), or
// how long the current run has been going. This is run state, not schedule config,
// so it renders whether or not the job is scheduled.
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import type { JobSummary } from "../api/types";
import { useNow } from "../hooks/useNow";
import { formatLastRun, formatRunningSince } from "../utils/jobSchedule";

const JobLastRunLine = ({ job }: { job: JobSummary }) => {
  const { t, i18n } = useTranslation();
  const now = useNow();
  const isRunning = job.run.status === "running";

  if (isRunning && job.run.startedAt) {
    return (
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
        {t("settings.jobs.runningSince", {
          date: formatRunningSince(job.run.startedAt, now, i18n.language),
        })}
      </Typography>
    );
  }
  if (!isRunning && job.run.finishedAt) {
    return (
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
        {t("settings.jobs.lastRun", {
          date: formatLastRun(job.run.finishedAt, job.run.startedAt, now, i18n.language),
        })}
      </Typography>
    );
  }
  return null;
};

export default JobLastRunLine;
