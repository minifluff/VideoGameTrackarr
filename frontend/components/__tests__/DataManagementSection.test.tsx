import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DataManagementSection from "../DataManagementSection";

vi.mock("react-toastify", () => ({
  toast: { success: vi.fn(), error: vi.fn(), dismiss: vi.fn() },
}));

const exportBackup = vi.fn();
const restoreBackup = vi.fn();
const idle = { mutateAsync: vi.fn(), isPending: false };

vi.mock("../../hooks/useImportExport", () => ({
  useExportCsv: () => idle,
  useExportHardwareCsv: () => idle,
  useExportBackup: () => ({ mutateAsync: exportBackup, isPending: false }),
  useRestoreBackup: () => ({ mutateAsync: restoreBackup, isPending: false }),
  useRestoreStatus: () => ({ data: { status: "idle" } }),
  useImportCsv: () => idle,
}));

const startIgdbLink = vi.fn();
const acknowledgeIgdbLink = vi.fn();
let igdbLinkStatusData: {
  status: string;
  progress?: { current: number; total: number };
  result?: {
    totalCandidates: number;
    linked: number;
    skipped: number;
    noMatch: number;
    ambiguous: number;
    failed: number;
    needsReview: { gameId: number; name: string; reason: string }[];
    failures: { gameId: number; name: string; error: string }[];
  };
} = { status: "idle" };

vi.mock("../../hooks/useIgdbLink", () => ({
  useStartIgdbLink: () => ({ mutateAsync: startIgdbLink, isPending: false }),
  useIgdbLinkStatus: () => ({ data: igdbLinkStatusData }),
  useAcknowledgeIgdbLinkStatus: () => ({ mutate: acknowledgeIgdbLink }),
}));

describe("DataManagementSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    igdbLinkStatusData = { status: "idle" };
  });

  it("exports the JSON backup by default, and the full .zip when files are included", async () => {
    const user = userEvent.setup();
    render(<DataManagementSection />);

    await user.click(screen.getByRole("button", { name: "Full backup (JSON)" }));
    expect(exportBackup).toHaveBeenLastCalledWith({ includeFiles: false });

    await user.click(screen.getByRole("checkbox", { name: "Include ROMs, saves and BIOS files" }));
    await user.click(screen.getByRole("button", { name: "Full backup with files (ZIP)" }));
    expect(exportBackup).toHaveBeenLastCalledWith({ includeFiles: true });
  });

  it("restores from a .zip full backup as well as .json", async () => {
    const user = userEvent.setup();
    render(<DataManagementSection />);

    const input = document.querySelector('input[type="file"][accept*=".zip"]') as HTMLInputElement;
    expect(input.accept).toContain(".zip");
    const zip = new File(["PK"], "videogametrackarr-full-backup.zip", { type: "application/zip" });
    await user.upload(input, zip);
    await user.click(screen.getByRole("button", { name: "Replace my library" }));

    expect(restoreBackup).toHaveBeenCalledWith(zip);
  });

  it("asks for confirmation before starting the IGDB link-all job", async () => {
    const user = userEvent.setup();
    render(<DataManagementSection />);

    await user.click(screen.getByRole("button", { name: "Link all games to IGDB" }));
    expect(screen.getByText("Link all games to IGDB?")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Link all" }));
    expect(startIgdbLink).toHaveBeenCalledTimes(1);
  });

  it("disables the link button while a job is running and shows progress", async () => {
    igdbLinkStatusData = {
      status: "running",
      progress: { current: 3, total: 10 },
    };
    render(<DataManagementSection />);

    expect(screen.getByRole("button", { name: "Link all games to IGDB" })).toBeDisabled();
    expect(screen.getByText("Linking game 3 of 10...")).toBeInTheDocument();
  });

  it("shows the link result summary with games needing review", async () => {
    igdbLinkStatusData = {
      status: "completed",
      result: {
        totalCandidates: 5,
        linked: 3,
        skipped: 0,
        noMatch: 1,
        ambiguous: 1,
        failed: 0,
        needsReview: [
          { gameId: 1, name: "Obscure Homebrew", reason: "no_match" },
          { gameId: 2, name: "Doom", reason: "ambiguous" },
        ],
        failures: [],
      },
    };
    const user = userEvent.setup();
    render(<DataManagementSection />);

    expect(screen.getByText("Linked 3 of 5 games. 2 need manual review, 0 failed.")).toBeInTheDocument();
    expect(screen.getByText("Obscure Homebrew — no IGDB match found")).toBeInTheDocument();
    expect(screen.getByText("Doom — multiple IGDB matches found")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(acknowledgeIgdbLink).toHaveBeenCalledTimes(1);
  });
});
