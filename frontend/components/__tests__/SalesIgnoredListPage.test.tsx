import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { IgnoredSalesTitle, TrackedSalesItem } from "../../api/salesTracking";
import SalesIgnoredListPage from "../SalesIgnoredListPage";

let ignoredTitles: IgnoredSalesTitle[] = [];
let untrackedItems: TrackedSalesItem[] = [];
const spies = {
  track: vi.fn(),
  removeWishlist: vi.fn(),
  retry: vi.fn(),
  removeIgnored: vi.fn(),
};

vi.mock("../../hooks/useSalesTracking", () => ({
  useIgnoredSalesTitles: () => ({ data: ignoredTitles }),
  useRetryIgnoredSalesTitle: () => ({ mutateAsync: spies.retry, isPending: false }),
  useRemoveIgnoredSalesTitle: () => ({ mutateAsync: spies.removeIgnored, isPending: false }),
  useUntrackedSalesItems: () => ({ data: untrackedItems }),
  useTrackSalesItem: () => ({ mutateAsync: spies.track, isPending: false, variables: undefined }),
  useRemoveWishlistItem: () => ({
    mutateAsync: spies.removeWishlist,
    isPending: false,
    variables: undefined,
  }),
}));

vi.mock("../../theme/CurrencyProvider", () => ({
  useCurrency: () => ({ currency: "CAD" }),
}));

const ignoredRow: IgnoredSalesTitle = {
  provider: "nintendo",
  gameId: 1,
  gameUuid: "uuid-1",
  gameName: "Ignored Game",
  gameSlug: "ignored-game",
  gameCoverUrl: null,
  checkedAt: "2026-11-17T00:00:00.000Z",
};

const untrackedRow: TrackedSalesItem = {
  libraryItemId: 7,
  gameId: 2,
  gameUuid: "uuid-2",
  gameName: "Untracked Game",
  gameSlug: "untracked-game",
  gameCoverUrl: null,
  platformId: 4,
  platformName: "Nintendo Switch",
  format: "digital",
  digitalStorefront: null,
  targetPrice: 29.99,
};

function renderPage(initialEntry = "/settings/sales-ignored") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <SalesIgnoredListPage />
    </MemoryRouter>
  );
}

describe("SalesIgnoredListPage tabs", () => {
  it("shows the Ignored tab by default with ignored titles", () => {
    ignoredTitles = [ignoredRow];
    untrackedItems = [untrackedRow];

    renderPage();

    expect(screen.getByRole("tab", { name: "Ignored" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Ignored Game")).toBeInTheDocument();
    expect(screen.queryByText("Untracked Game")).not.toBeInTheDocument();
  });

  it("opens the Untracked tab from the URL and lists untracked wishlist games", () => {
    ignoredTitles = [ignoredRow];
    untrackedItems = [untrackedRow];

    renderPage("/settings/sales-ignored?tab=untracked");

    expect(screen.getByRole("tab", { name: "Untracked" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Untracked Game")).toBeInTheDocument();
    expect(screen.getByText("Nintendo Switch")).toBeInTheDocument();
    expect(screen.queryByText("Ignored Game")).not.toBeInTheDocument();
  });

  it("switches tabs on click", async () => {
    const user = userEvent.setup();
    ignoredTitles = [ignoredRow];
    untrackedItems = [untrackedRow];

    renderPage();

    await user.click(screen.getByRole("tab", { name: "Untracked" }));

    expect(screen.getByText("Untracked Game")).toBeInTheDocument();
    expect(screen.queryByText("Ignored Game")).not.toBeInTheDocument();
  });

  it("tracks an untracked game from the Untracked tab", async () => {
    const user = userEvent.setup();
    ignoredTitles = [];
    untrackedItems = [untrackedRow];
    spies.track.mockClear();

    renderPage("/settings/sales-ignored?tab=untracked");

    await user.click(screen.getByRole("button", { name: "Track" }));

    expect(spies.track).toHaveBeenCalledWith(7);
  });

  it("removes an untracked game from the wishlist", async () => {
    const user = userEvent.setup();
    ignoredTitles = [];
    untrackedItems = [untrackedRow];
    spies.removeWishlist.mockClear();

    renderPage("/settings/sales-ignored?tab=untracked");

    await user.click(screen.getByRole("button", { name: "Remove from wishlist" }));

    expect(spies.removeWishlist).toHaveBeenCalledWith(7);
  });
});
