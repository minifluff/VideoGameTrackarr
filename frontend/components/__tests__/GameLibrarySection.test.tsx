import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { ThemeProvider } from "@mui/material/styles";
import { describe, expect, it } from "vitest";
import { createM3Theme } from "../../theme/createM3Theme";
import type { LibraryItem, PlatformResponse } from "../../api/types";
import GameLibrarySection from "../GameLibrarySection";

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

  it("opens the Add copy menu with collection and wishlist entries", () => {
    renderSection(<GameLibrarySection {...baseProps} libraryItems={[]} />);

    fireEvent.click(screen.getByRole("button", { name: "Add copy" }));
    expect(screen.getByRole("menuitem", { name: "To your collection" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "To your wishlist" })).toBeInTheDocument();
  });

  it("shows the empty line when there are no copies", () => {
    renderSection(<GameLibrarySection {...baseProps} libraryItems={[]} />);

    expect(screen.getByText("Not in your library yet.")).toBeInTheDocument();
  });
});
