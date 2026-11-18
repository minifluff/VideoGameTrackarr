import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { JobSummary } from "../../api/types";
import { getBrowserTimeZone } from "../../utils/jobSchedule";
import ExportBackupJobCard from "../ExportBackupJobCard";

const updateScheduleSpy = vi.fn();

vi.mock("../../hooks/useJobs", () => ({
  useJobsList: () => ({ data: [] }),
  useRunJob: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useAcknowledgeJobStatus: () => ({ mutateAsync: vi.fn() }),
  useUpdateJobSchedule: () => ({ mutateAsync: updateScheduleSpy, isPending: false }),
}));

vi.mock("../../hooks/useExportJob", () => ({
  useExportJobConfig: () => ({ data: null }),
  useTestExportJobConnection: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateExportJobConfig: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

function exportJob(): JobSummary {
  return {
    id: "export_backup",
    run: { status: "idle", startedAt: null, finishedAt: null, result: null, error: null, progress: null },
    schedule: { enabled: false, cronExpression: null, nextRunAt: null, timezone: null },
  };
}

describe("ExportBackupJobCard schedule", () => {
  it("shows the friendly schedule controls, not a raw cron field", () => {
    const job = exportJob();
    job.schedule = {
      enabled: true,
      cronExpression: "0 3 * * *",
      nextRunAt: new Date(Date.now() + 3 * 3600_000).toISOString(),
      timezone: getBrowserTimeZone(),
    };

    render(<ExportBackupJobCard job={job} />);

    expect(screen.getByText("Daily")).toBeInTheDocument();
    expect(screen.getByLabelText("Time")).toHaveValue("03:00");
    expect(screen.getByText(/Next run: .* \(in 3 hours\)/)).toBeInTheDocument();
    expect(screen.queryByLabelText("Cron expression")).not.toBeInTheDocument();
  });

  it("keeps a legacy UTC cron on the Custom path", () => {
    const job = exportJob();
    job.schedule = { enabled: true, cronExpression: "0 3 * * *", nextRunAt: null, timezone: null };

    render(<ExportBackupJobCard job={job} />);

    expect(screen.getByText("Custom")).toBeInTheDocument();
    expect(screen.getByLabelText("Cron expression")).toHaveValue("0 3 * * *");
  });

  it("hides the schedule section when the toggle is off", () => {
    const job = exportJob();
    job.schedule = {
      enabled: true,
      cronExpression: "0 3 * * *",
      nextRunAt: null,
      timezone: getBrowserTimeZone(),
    };
    updateScheduleSpy.mockClear();

    render(<ExportBackupJobCard job={job} />);
    fireEvent.click(screen.getByLabelText("Run on a schedule"));

    expect(screen.queryByText("How often")).not.toBeInTheDocument();
    expect(updateScheduleSpy).toHaveBeenCalledWith({
      jobId: "export_backup",
      enabled: false,
      cronExpression: null,
    });
  });

  it("puts Run now in the same row as Save and Test connection", () => {
    const job = exportJob();

    render(<ExportBackupJobCard job={job} />);

    const testButton = screen.getByText("Test connection");
    const runNowButton = screen.getByText("Run now");
    expect(testButton.parentElement).toContainElement(runNowButton);
    expect(testButton.parentElement).toContainElement(screen.getByText("Save"));
  });
});
