import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ThemeProvider } from "@mui/material/styles";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RomFileSummary } from "../../api/types";
import { createM3Theme } from "../../theme/createM3Theme";
import RomsDownloadDialog from "../RomsDownloadDialog";

const createRomDownloadLink = vi.fn();
const downloadFromUrl = vi.fn();
vi.mock("../../api/library", () => ({
  createRomDownloadLink: (...args: unknown[]) => createRomDownloadLink(...args),
}));
vi.mock("../../utils/download", () => ({
  downloadFromUrl: (...args: unknown[]) => downloadFromUrl(...args),
}));

const roms = [
  {
    id: 7,
    label: null,
    originalFilename: "Game (USA).nes",
    sizeBytes: 40960,
    extension: "nes",
    isArchive: false,
    playable: true,
    core: "fceumm",
    unplayableReason: null,
    missingBiosSystem: null,
    isolated: false,
    saveStateCount: 0,
    hasInGameSave: false,
  },
  {
    id: 8,
    label: "Alt version",
    originalFilename: "Game (Europe).nes",
    sizeBytes: 40960,
    extension: "nes",
    isArchive: false,
    playable: true,
    core: "fceumm",
    unplayableReason: null,
    missingBiosSystem: null,
    isolated: false,
    saveStateCount: 0,
    hasInGameSave: false,
  },
] as unknown as RomFileSummary[];

function renderDialog() {
  return render(
    <ThemeProvider theme={createM3Theme("light", "normal")}>
      <RomsDownloadDialog open gameName="Test Game" roms={roms} onClose={vi.fn()} />
    </ThemeProvider>
  );
}

describe("RomsDownloadDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createRomDownloadLink.mockResolvedValue("/api/roms/7/content/tok/Game%20(USA).nes");
  });

  it("lists each ROM with its size and a Download button", () => {
    renderDialog();

    expect(screen.getByText("ROMs — Test Game")).toBeInTheDocument();
    expect(screen.getByText("Game (USA).nes · 40.0 KB")).toBeInTheDocument();
    expect(screen.getByText("Alt version (Game (Europe).nes) · 40.0 KB")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Download" })).toHaveLength(2);
  });

  it("downloads the clicked ROM through its tokenized link", async () => {
    renderDialog();

    fireEvent.click(screen.getAllByRole("button", { name: "Download" })[0]);

    await waitFor(() => expect(createRomDownloadLink).toHaveBeenCalledWith(7));
    expect(downloadFromUrl).toHaveBeenCalledWith(expect.stringMatching(/\/api\/roms\/7\/content\/tok\//));
  });
});
