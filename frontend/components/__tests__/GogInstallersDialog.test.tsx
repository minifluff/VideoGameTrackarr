import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ThemeProvider } from "@mui/material/styles";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GogInstallers } from "../../api/integrations";
import { createM3Theme } from "../../theme/createM3Theme";
import GogInstallersDialog from "../GogInstallersDialog";

let installers: GogInstallers | undefined;
let installersError: { isAxiosError?: boolean; response?: { status?: number } } | null = null;
const downloadInstaller = vi.fn();
const fileLink = vi.fn();
vi.mock("../../hooks/useIntegrations", () => ({
  useGogInstallers: () => ({ data: installers, isLoading: false, error: installersError }),
  useDownloadGogInstaller: () => ({ mutateAsync: downloadInstaller, isPending: false }),
  useGogInstallerFileLink: () => ({ mutateAsync: fileLink, isPending: false }),
}));

const theme = createM3Theme("light", "normal");

function renderDialog() {
  render(
    <ThemeProvider theme={theme}>
      <GogInstallersDialog gameId={1} gameName="Absolute Drift" open onClose={() => {}} />
    </ThemeProvider>
  );
}

function makeInstallers(): GogInstallers {
  return {
    gameId: 1,
    gogProductId: 1207658695,
    groups: [
      {
        productId: 1207658695,
        title: "Absolute Drift",
        installers: [
          {
            id: "installer_windows_en",
            os: "windows",
            language: "en",
            version: "1.0",
            totalSize: 30,
            files: [
              {
                id: "en1installer0",
                size: 20,
                downloadState: "not_downloaded",
                downloadedBytes: 0,
                downloadError: null,
                filename: null,
              },
              {
                id: "en1installer1",
                size: 10,
                downloadState: "not_downloaded",
                downloadedBytes: 0,
                downloadError: null,
                filename: null,
              },
            ],
          },
        ],
      },
    ],
    uploadedFiles: [],
  };
}

describe("GogInstallersDialog", () => {
  beforeEach(() => {
    installers = makeInstallers();
    installersError = null;
    downloadInstaller.mockReset();
    fileLink.mockReset();
  });

  it("shows the installer card with OS, language, version, size and part count", () => {
    renderDialog();

    expect(screen.getByText("Offline installers — Absolute Drift")).toBeInTheDocument();
    expect(screen.getByText("Windows")).toBeInTheDocument();
    expect(screen.getByText("EN")).toBeInTheDocument();
    expect(screen.getByText("1.0 · 30 B · 2 files")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download to server" })).toBeInTheDocument();
  });

  it("queues every part of an installer with one Download to server click", async () => {
    renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "Download to server" }));

    expect(downloadInstaller).toHaveBeenCalledWith({
      productId: 1207658695,
      installerId: "installer_windows_en",
    });
  });

  it("shows a combined progress bar while any part is downloading", () => {
    installers = makeInstallers();
    installers.groups[0].installers[0].files[0] = {
      id: "en1installer0",
      size: 20,
      downloadState: "downloading",
      downloadedBytes: 10,
      downloadError: null,
      filename: "setup_absolute_drift_1.0.exe",
    };
    renderDialog();

    expect(screen.getByRole("progressbar")).toBeInTheDocument();
    expect(screen.getByText("setup_absolute_drift_1.0.exe · 20 B")).toBeInTheDocument();
    expect(screen.getByText("Downloading…")).toBeInTheDocument();
  });

  it("offers Save to device per finished part", async () => {
    installers = makeInstallers();
    installers.groups[0].installers[0].files[0] = {
      id: "en1installer0",
      size: 20,
      downloadState: "completed",
      downloadedBytes: 20,
      downloadError: null,
      filename: "setup_absolute_drift_1.0.exe",
    };
    fileLink.mockResolvedValue("/api/integrations/gog/games/1/installers/en1installer0/file/token/setup.exe");
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "Save to device" }));

    await waitFor(() => expect(fileLink).toHaveBeenCalledWith({ gameId: 1, fileId: "en1installer0" }));
    await waitFor(() =>
      expect(open).toHaveBeenCalledWith(
        "/api/integrations/gog/games/1/installers/en1installer0/file/token/setup.exe",
        "_blank",
        "noopener,noreferrer"
      )
    );
    open.mockRestore();
  });

  it("shows Retry when an installer failed", () => {
    installers = makeInstallers();
    installers.groups[0].installers[0].files[0] = {
      id: "en1installer0",
      size: 20,
      downloadState: "failed",
      downloadedBytes: 0,
      downloadError: "Connection reset",
      filename: null,
    };
    renderDialog();

    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    expect(screen.getByText("Part 1 of 2 · 20 B · Connection reset")).toBeInTheDocument();
  });

  it("explains when the game has no GOG copy to download from", () => {
    installersError = { isAxiosError: true, response: { status: 404 } };
    renderDialog();

    expect(
      screen.getByText(
        "Offline installers are only for games in your collection as a GOG copy that GOG Sync matched to your GOG library."
      )
    ).toBeInTheDocument();
  });

  it("says the list is empty when GOG lists no installers", () => {
    installers = { gameId: 1, gogProductId: 1207658695, groups: [], uploadedFiles: [] };
    renderDialog();

    expect(screen.getByText("GOG lists no offline installers for this game.")).toBeInTheDocument();
  });
});
