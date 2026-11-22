import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ThemeProvider } from "@mui/material/styles";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GogUploadedInstallerFile } from "../../api/integrations";
import { createM3Theme } from "../../theme/createM3Theme";
import UploadedInstallersDialog from "../UploadedInstallersDialog";

const fileLink = vi.fn();
vi.mock("../../hooks/useIntegrations", () => ({
  useGogInstallerFileLink: () => ({ mutateAsync: fileLink, isPending: false }),
}));

const files: GogUploadedInstallerFile[] = [
  { fileId: "upload-abc", filename: "setup_game_1.0.exe", size: 20 },
  { fileId: "upload-def", filename: null, size: 1024 },
];

function renderDialog(openFiles: GogUploadedInstallerFile[] = files) {
  return render(
    <ThemeProvider theme={createM3Theme("light", "normal")}>
      <UploadedInstallersDialog
        open
        gameId={1}
        gameName="Test Game"
        files={openFiles}
        onClose={vi.fn()}
      />
    </ThemeProvider>
  );
}

describe("UploadedInstallersDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fileLink.mockResolvedValue("/api/integrations/gog/games/1/installers/upload-abc/file/token/setup.exe");
  });

  it("lists each uploaded installer with its size and a Download button", () => {
    renderDialog();

    expect(screen.getByText("Uploaded installers — Test Game")).toBeInTheDocument();
    expect(screen.getByText("setup_game_1.0.exe · 20 B")).toBeInTheDocument();
    expect(screen.getByText("upload-def · 1.0 KB")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Download" })).toHaveLength(2);
  });

  it("opens the tokenized file link when Download is clicked", async () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    renderDialog();

    fireEvent.click(screen.getAllByRole("button", { name: "Download" })[0]);

    await waitFor(() => expect(fileLink).toHaveBeenCalledWith({ gameId: 1, fileId: "upload-abc" }));
    expect(open).toHaveBeenCalledWith(
      "/api/integrations/gog/games/1/installers/upload-abc/file/token/setup.exe",
      "_blank",
      "noopener,noreferrer"
    );
    open.mockRestore();
  });

  it("says so when nothing has been uploaded yet", () => {
    renderDialog([]);

    expect(screen.getByText("No installers have been uploaded for this game yet.")).toBeInTheDocument();
  });
});
