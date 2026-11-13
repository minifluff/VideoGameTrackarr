import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { ThemeProvider } from "@mui/material/styles";
import { describe, expect, it, vi } from "vitest";
import { createM3Theme } from "../../theme/createM3Theme";
import type { LibraryItem, PlatformResponse } from "../../api/types";
import GameLibrarySection from "../GameLibrarySection";

// The GOG Installers section inside the edit dialog reads these hooks.
let gogInstallersData: import("../../api/integrations").GogInstallers | undefined;
vi.mock("../../hooks/useIntegrations", () => ({
  useGogInstallers: () => ({ data: gogInstallersData, isError: false }),
  useQueueGogInstallerDownload: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useGogInstallerFileLink: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUploadGogInstaller: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteGogInstaller: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

// Same wrapper as the DashboardPage test: the section's mutation hooks need a
// QueryClient, and with no server in jsdom the queries fail into their error state.
const theme = createM3Theme("light", "normal");

function renderSection(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>{ui}</ThemeProvider>
    </QueryClientProvider>
  );
}

const platforms = [
  { id: 1, name: "PlayStation 5", abbreviation: "PS5" },
] as unknown as PlatformResponse[];

const ownedItem = {
  id: 1,
  status: "owned",
  platformId: 1,
  platformName: "PlayStation 5",
  format: "physical",
  digitalStorefront: null,
  edition: "Standard",
  steelbook: false,
  roms: [],
  isOnSale: false,
} as unknown as LibraryItem;

const wishlistedItem = {
  id: 2,
  status: "wishlist",
  platformId: null,
  platformName: "PC",
  format: "digital",
  digitalStorefront: "Steam",
  edition: null,
  steelbook: false,
  roms: [],
  isOnSale: true,
  salePriceAmount: 10,
  salePriceCurrency: "USD",
  saleShopName: "Steam",
  saleCut: 50,
} as unknown as LibraryItem;

const gogItem = {
  id: 3,
  status: "owned",
  platformId: 1,
  platformName: "PC",
  format: "digital",
  digitalStorefront: "GOG",
  edition: null,
  steelbook: false,
  roms: [],
  isOnSale: false,
} as unknown as LibraryItem;

const drmFreeItem = {
  id: 4,
  status: "owned",
  platformId: 1,
  platformName: "PC",
  format: "digital",
  digitalStorefront: "DRM-Free",
  edition: null,
  steelbook: false,
  roms: [],
  isOnSale: false,
} as unknown as LibraryItem;

const abandonwareItem = {
  id: 5,
  status: "owned",
  platformId: 1,
  platformName: "PC",
  format: "abandonware",
  digitalStorefront: null,
  edition: null,
  steelbook: false,
  roms: [],
  isOnSale: false,
} as unknown as LibraryItem;

const steamItem = {
  id: 6,
  status: "owned",
  platformId: 1,
  platformName: "Steam",
  format: "digital",
  digitalStorefront: "Steam",
  edition: null,
  steelbook: false,
  roms: [],
  isOnSale: false,
} as unknown as LibraryItem;

const gogInstallersWithDownload: import("../../api/integrations").GogInstallers = {
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
          totalSize: 20,
          files: [
            {
              id: "en1installer0",
              size: 20,
              downloadState: "completed",
              downloadedBytes: 20,
              downloadError: null,
            },
          ],
        },
      ],
    },
  ],
  uploadedFiles: [],
};

const baseProps = {
  gameId: 1,
  platforms,
  regions: [],
  gameCategory: null,
  hideFromPublic: false,
};

describe("GameLibrarySection", () => {
  it("lists owned copies before wishlist copies with their pills", () => {
    renderSection(
      <GameLibrarySection {...baseProps} libraryItems={[wishlistedItem, ownedItem]} />
    );

    // CardHeader renders its title as a span, not a heading, like the other detail
    // sections (Tags, Addons, Notes).
    expect(screen.getByText("Your Library")).toBeInTheDocument();
    expect(
      screen.getByText("Collection and wishlist entries across platforms and regions")
    ).toBeInTheDocument();
    expect(screen.getByText("Owned")).toBeInTheDocument();
    expect(screen.getByText("Wishlist")).toBeInTheDocument();
    // Owned first even when the wishlist item comes first in the prop list. Rows are
    // queried by their accessible names: the wishlist badge falls back to the platform's
    // first word, so its title text alone isn't unique.
    const ownedRow = screen.getByRole("button", { name: "PlayStation 5" });
    const wishlistRow = screen.getByRole("button", { name: "PC" });
    expect(ownedRow.compareDocumentPosition(wishlistRow) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("shows no platform badge — the platform name is the row title", () => {
    renderSection(<GameLibrarySection {...baseProps} libraryItems={[ownedItem]} />);

    expect(screen.queryByText("PS5")).not.toBeInTheDocument();
    expect(screen.getByText("PlayStation 5")).toBeInTheDocument();
  });

  it("keeps the Move action and puts the Hide checkbox left of Add copy", () => {
    renderSection(<GameLibrarySection {...baseProps} libraryItems={[ownedItem]} />);

    expect(screen.getByRole("button", { name: "Move to wishlist" })).toBeInTheDocument();
    const hide = screen.getByLabelText("Hide");
    const addCopy = screen.getByRole("button", { name: "Add copy" });
    expect(hide.compareDocumentPosition(addCopy) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("opens the Move library item dialog from a row's Transfer action", async () => {
    renderSection(<GameLibrarySection {...baseProps} libraryItems={[ownedItem]} />);

    fireEvent.click(screen.getByRole("button", { name: "Move to another game" }));
    expect(await screen.findByText("Move library item")).toBeInTheDocument();
  });

  it("opens the Add copy dialog directly with a wishlist checkbox in the bottom-right", () => {
    renderSection(<GameLibrarySection {...baseProps} libraryItems={[]} />);

    fireEvent.click(screen.getByRole("button", { name: "Add copy" }));

    // No popup menu anymore — the dialog opens straight away, owned by default.
    expect(screen.queryByRole("menuitem", { name: "To your wishlist" })).not.toBeInTheDocument();
    expect(screen.getByText("Add game to your collection")).toBeInTheDocument();
    const wishlistCheckbox = screen.getByLabelText("To your wishlist");
    expect(wishlistCheckbox).not.toBeChecked();
    // The checkbox sits in the dialog's bottom-right actions row, next to Cancel.
    expect(wishlistCheckbox.closest(".MuiDialogActions-root")).not.toBeNull();
    expect(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancel" })).toBeInTheDocument();

    fireEvent.click(wishlistCheckbox);
    expect(screen.getByText("Add game to your wishlist")).toBeInTheDocument();
    expect(screen.getByLabelText("To your wishlist")).toBeChecked();

    fireEvent.click(screen.getByLabelText("To your wishlist"));
    expect(screen.getByText("Add game to your collection")).toBeInTheDocument();
  });

  it("shows the empty line when there are no copies", () => {
    renderSection(<GameLibrarySection {...baseProps} libraryItems={[]} />);

    expect(screen.getByText("Not in your library yet.")).toBeInTheDocument();
  });

  it("shows the GOG Installers section in the edit dialog for a GOG copy", () => {
    gogInstallersData = {
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
              totalSize: 20,
              files: [
                {
                  id: "en1installer0",
                  size: 20,
                  downloadState: "not_downloaded",
                  downloadedBytes: 0,
                  downloadError: null,
                },
              ],
            },
          ],
        },
      ],
      uploadedFiles: [],
    };
    renderSection(<GameLibrarySection {...baseProps} libraryItems={[gogItem]} />);

    fireEvent.click(screen.getByRole("button", { name: "PC" }));

    expect(screen.getByText("Update game in your collection")).toBeInTheDocument();
    expect(screen.getByText("GOG Installers")).toBeInTheDocument();
    expect(screen.getByText("Absolute Drift")).toBeInTheDocument();
  });

  it("does not show the GOG Installers section in the edit dialog for a non-GOG copy", () => {
    gogInstallersData = undefined;
    renderSection(<GameLibrarySection {...baseProps} libraryItems={[ownedItem]} />);

    fireEvent.click(screen.getByRole("button", { name: "PlayStation 5" }));

    expect(screen.getByText("Update game in your collection")).toBeInTheDocument();
    expect(screen.queryByText("GOG Installers")).not.toBeInTheDocument();
  });

  it("shows the ROM gamepad icon on a GOG row with a downloaded installer", () => {
    gogInstallersData = {
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
              totalSize: 20,
              files: [
                {
                  id: "en1installer0",
                  size: 20,
                  downloadState: "completed",
                  downloadedBytes: 20,
                  downloadError: null,
                },
              ],
            },
          ],
        },
      ],
      uploadedFiles: [],
    };
    renderSection(<GameLibrarySection {...baseProps} libraryItems={[gogItem]} />);

    expect(
      screen.getByLabelText("GOG installer downloaded: windows · en · 1.0")
    ).toBeInTheDocument();
  });

  it("shows no GOG icon on a GOG row whose installer has not finished downloading", () => {
    gogInstallersData = {
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
              totalSize: 20,
              files: [
                {
                  id: "en1installer0",
                  size: 20,
                  downloadState: "not_downloaded",
                  downloadedBytes: 0,
                  downloadError: null,
                },
              ],
            },
          ],
        },
      ],
      uploadedFiles: [],
    };
    renderSection(<GameLibrarySection {...baseProps} libraryItems={[gogItem]} />);

    expect(screen.queryByLabelText(/GOG installer downloaded/)).not.toBeInTheDocument();
  });

  it("shows the Installers section with an upload button in the edit dialog for a DRM-Free copy", () => {
    gogInstallersData = { gameId: 1, gogProductId: null, groups: [], uploadedFiles: [] };
    renderSection(<GameLibrarySection {...baseProps} libraryItems={[drmFreeItem]} />);

    fireEvent.click(screen.getByRole("button", { name: "PC" }));

    expect(screen.getByText("Update game in your collection")).toBeInTheDocument();
    expect(screen.getByText("Installers")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Upload" })).toBeInTheDocument();
  });

  it("shows the gamepad icon on a DRM-Free row with an uploaded installer", () => {
    gogInstallersData = {
      gameId: 1,
      gogProductId: null,
      groups: [],
      uploadedFiles: [{ fileId: "upload-abc", filename: "setup_game_1.0.exe", size: 20 }],
    };
    renderSection(<GameLibrarySection {...baseProps} libraryItems={[drmFreeItem]} />);

    expect(screen.getByLabelText("Installer downloaded: setup_game_1.0.exe")).toBeInTheDocument();
  });

  it("shows no icon on a DRM-Free row with nothing uploaded", () => {
    gogInstallersData = { gameId: 1, gogProductId: null, groups: [], uploadedFiles: [] };
    renderSection(<GameLibrarySection {...baseProps} libraryItems={[drmFreeItem]} />);

    expect(screen.queryByLabelText(/Installer downloaded/)).not.toBeInTheDocument();
  });

  it("shows the Installers section with an upload button in the edit dialog for an Abandonware copy", () => {
    gogInstallersData = { gameId: 1, gogProductId: null, groups: [], uploadedFiles: [] };
    renderSection(<GameLibrarySection {...baseProps} libraryItems={[abandonwareItem]} />);

    fireEvent.click(screen.getByRole("button", { name: "PC" }));

    expect(screen.getByText("Update game in your collection")).toBeInTheDocument();
    expect(screen.getByText("Installers")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Upload" })).toBeInTheDocument();
  });

  it("shows the gamepad icon on an Abandonware row with an uploaded installer", () => {
    gogInstallersData = {
      gameId: 1,
      gogProductId: null,
      groups: [],
      uploadedFiles: [{ fileId: "upload-abc", filename: "setup_game_1.0.exe", size: 20 }],
    };
    renderSection(<GameLibrarySection {...baseProps} libraryItems={[abandonwareItem]} />);

    expect(screen.getByLabelText("Installer downloaded: setup_game_1.0.exe")).toBeInTheDocument();
  });

  it("hides the GOG Installers section in the edit dialog for a Steam copy of a GOG game", () => {
    gogInstallersData = gogInstallersWithDownload;
    renderSection(<GameLibrarySection {...baseProps} libraryItems={[gogItem, steamItem]} />);

    fireEvent.click(screen.getByRole("button", { name: "Steam" }));

    expect(screen.getByText("Update game in your collection")).toBeInTheDocument();
    expect(screen.queryByText("GOG Installers")).not.toBeInTheDocument();
    expect(screen.queryByText("Installers")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Upload" })).not.toBeInTheDocument();
  });

  it("shows the GOG Installers section in the edit dialog for the GOG copy", () => {
    gogInstallersData = gogInstallersWithDownload;
    renderSection(<GameLibrarySection {...baseProps} libraryItems={[gogItem, steamItem]} />);

    fireEvent.click(screen.getByRole("button", { name: "PC" }));

    expect(screen.getByText("Update game in your collection")).toBeInTheDocument();
    expect(screen.getByText("GOG Installers")).toBeInTheDocument();
    expect(screen.getByText("Absolute Drift")).toBeInTheDocument();
  });

  it("shows no Installers section when adding a copy to a GOG game", () => {
    gogInstallersData = gogInstallersWithDownload;
    renderSection(<GameLibrarySection {...baseProps} libraryItems={[gogItem]} />);

    fireEvent.click(screen.getByRole("button", { name: "Add copy" }));

    expect(screen.getByText("Add game to your collection")).toBeInTheDocument();
    expect(screen.queryByText("GOG Installers")).not.toBeInTheDocument();
    expect(screen.queryByText("Installers")).not.toBeInTheDocument();
  });
});
