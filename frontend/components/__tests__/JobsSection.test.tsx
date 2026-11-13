import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { JobSummary } from "../../api/types";
import JobsSection from "../JobsSection";

let jobsList: JobSummary[] = [];

vi.mock("../../hooks/useJobs", () => ({
  useJobsList: () => ({ data: jobsList }),
  useRunJob: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useAcknowledgeJobStatus: () => ({ mutateAsync: vi.fn() }),
  useUpdateJobSchedule: () => ({ mutateAsync: vi.fn(), isPending: false }),
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
    schedule: { enabled: false, cronExpression: null, nextRunAt: null },
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
