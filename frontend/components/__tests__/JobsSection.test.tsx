import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import type { JobSummary } from "../../api/types";
import { getBrowserTimeZone } from "../../utils/jobSchedule";
import JobsSection from "../JobsSection";

let jobsList: JobSummary[] = [];
const updateScheduleSpy = vi.fn();

vi.mock("../../hooks/useJobs", () => ({
  useJobsList: () => ({ data: jobsList }),
  useRunJob: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useAcknowledgeJobStatus: () => ({ mutateAsync: vi.fn() }),
  useUpdateJobSchedule: () => ({ mutateAsync: updateScheduleSpy, isPending: false }),
}));

function idleJob(id: string): JobSummary {
  return {
    id,
    run: {
      status: "idle",
      startedAt: null,
      finishedAt: null,
      result: null,
      error: null,
      progress: null,
    },
    schedule: { enabled: false, cronExpression: null, nextRunAt: null, timezone: null },
  };
}

describe("JobsSection GOG job labels", () => {
  it("shows display names for the GOG jobs instead of their raw ids", () => {
    jobsList = [idleJob("gog_import"), idleJob("gog_download")];

    render(<JobsSection />);

    expect(screen.getByText("GOG Import")).toBeInTheDocument();
    expect(screen.getByText("GOG Download")).toBeInTheDocument();
    expect(screen.queryByText("gog_import")).not.toBeInTheDocument();
    expect(screen.queryByText("gog_download")).not.toBeInTheDocument();
    expect(
      screen.getByText(/Fetches your GOG library and matches it to your catalog/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Downloads queued GOG installer files to this server/),
    ).toBeInTheDocument();
  });
});

describe("JobsSection friendly scheduler", () => {
  it("shows a daily schedule in the friendly controls with a relative next run", () => {
    const browserTimeZone = getBrowserTimeZone();
    const job = idleJob("resync_all");
    job.schedule = {
      enabled: true,
      cronExpression: "0 3 * * *",
      nextRunAt: new Date(Date.now() + 3 * 3600_000).toISOString(),
      timezone: browserTimeZone,
    };
    jobsList = [job];

    render(<JobsSection />);

    expect(screen.getByText("Daily")).toBeInTheDocument();
    expect(screen.getByLabelText("Time")).toHaveValue("03:00");
    expect(screen.getByText(`Times are in ${browserTimeZone}`)).toBeInTheDocument();
    expect(screen.getByText(/Next run: .* \(in 3 hours\)/)).toBeInTheDocument();
  });

  it("saves a friendly schedule as a cron in the browser's timezone", () => {
    const browserTimeZone = getBrowserTimeZone();
    const job = idleJob("resync_all");
    job.schedule = {
      enabled: true,
      cronExpression: "0 3 * * *",
      nextRunAt: null,
      timezone: browserTimeZone,
    };
    jobsList = [job];
    updateScheduleSpy.mockClear();

    render(<JobsSection />);
    fireEvent.click(screen.getByText("Save schedule"));

    expect(updateScheduleSpy).toHaveBeenCalledWith({
      jobId: "resync_all",
      enabled: true,
      cronExpression: "0 3 * * *",
      timezone: browserTimeZone,
    });
  });

  it("keeps a legacy UTC cron on the Custom path with its raw text", () => {
    const job = idleJob("resync_all");
    job.schedule = {
      enabled: true,
      cronExpression: "0 3 * * *",
      nextRunAt: null,
      timezone: null,
    };
    jobsList = [job];

    render(<JobsSection />);

    expect(screen.getByText("Custom")).toBeInTheDocument();
    expect(screen.getByLabelText("Cron expression")).toHaveValue("0 3 * * *");
    expect(screen.getByText("Times are in UTC")).toBeInTheDocument();
  });

  it("shows the last run with its relative time and duration", () => {
    const job = idleJob("resync_all");
    const finishedAt = new Date(Date.now() - 2 * 3600_000);
    const startedAt = new Date(finishedAt.getTime() - 192_000);
    job.run = {
      status: "completed",
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      result: null,
      error: null,
      progress: null,
    };
    jobsList = [job];

    render(<JobsSection />);

    expect(screen.getByText(/Last run: 2 hours ago · .* · 3m 12s/)).toBeInTheDocument();
  });
});

describe("JobsSection schedule toggle", () => {
  it("hides the schedule section and saves the disable when toggled off", () => {
    const job = idleJob("resync_all");
    job.schedule = {
      enabled: true,
      cronExpression: "0 3 * * *",
      nextRunAt: null,
      timezone: getBrowserTimeZone(),
    };
    jobsList = [job];
    updateScheduleSpy.mockClear();

    render(<JobsSection />);
    expect(screen.getByLabelText("How often")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Run on a schedule"));

    expect(screen.queryByLabelText("How often")).not.toBeInTheDocument();
    expect(updateScheduleSpy).toHaveBeenCalledWith({
      jobId: "resync_all",
      enabled: false,
      cronExpression: null,
    });
  });

  it("reveals the schedule section when toggled on without saving yet", () => {
    const job = idleJob("resync_all");
    jobsList = [job];
    updateScheduleSpy.mockClear();

    render(<JobsSection />);
    expect(screen.queryByLabelText("How often")).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Run on a schedule"));

    expect(screen.getByLabelText("How often")).toBeInTheDocument();
    expect(updateScheduleSpy).not.toHaveBeenCalled();
  });
});

describe("JobsSection failure list", () => {
  function completedResyncJob(): JobSummary {
    const job = idleJob("resync_all");
    job.run = {
      status: "completed",
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      result: {
        total: 2,
        succeeded: 1,
        failed: 1,
        failures: [
          {
            gameId: 7,
            gameName: "Test Game",
            gameSlug: "test-game",
            gameUuid: "11111111-2222-3333-4444-555555555555",
            error: "IGDB game 123 not found",
          },
        ],
      },
      error: null,
      progress: null,
    };
    return job;
  }

  it("links each failed game by name to its game page", () => {
    jobsList = [completedResyncJob()];

    render(
      <MemoryRouter>
        <JobsSection />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByLabelText("Expand"));

    const link = screen.getByRole("link", { name: "Test Game" });
    expect(link).toHaveAttribute("href", "/game/test-game");
    expect(screen.getByText(/IGDB game 123 not found/)).toBeInTheDocument();
  });

  it("shows a plain name when a failure carries no link identity", () => {
    const job = completedResyncJob();
    const result = job.run.result as { failures: { gameUuid: string | null }[] };
    result.failures[0].gameUuid = null;
    jobsList = [job];

    render(
      <MemoryRouter>
        <JobsSection />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByLabelText("Expand"));

    expect(screen.queryByRole("link", { name: "Test Game" })).not.toBeInTheDocument();
    expect(screen.getByText(/Test Game/)).toBeInTheDocument();
  });
});
