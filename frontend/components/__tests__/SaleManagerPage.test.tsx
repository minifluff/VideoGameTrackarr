import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { IgnoredSalesTitle, TrackedSalesItem } from "../../api/salesTracking";
import SaleManagerPage from "../SaleManagerPage";

let trackedItems: TrackedSalesItem[] = [];
let ignoredTitles: IgnoredSalesTitle[] = [];
let untrackedItems: TrackedSalesItem[] = [];

vi.mock("../../hooks/useSalesTracking", () => ({
  useTrackedSalesItems: () => ({ data: trackedItems }),
  useUntrackSalesItem: () => ({ mutateAsync: vi.fn(), isPending: false, variables: undefined }),
  useIgnoredSalesTitles: () => ({ data: ignoredTitles }),
  useRetryIgnoredSalesTitle: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useRemoveIgnoredSalesTitle: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUntrackedSalesItems: () => ({ data: untrackedItems }),
  useTrackSalesItem: () => ({ mutateAsync: vi.fn(), isPending: false, variables: undefined }),
  useRemoveWishlistItem: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
    variables: undefined,
  }),
}));

vi.mock("../../theme/CurrencyProvider", () => ({
  useCurrency: () => ({ currency: "CAD" }),
}));

const trackedRow: TrackedSalesItem = {
  libraryItemId: 5,
  gameId: 3,
  gameUuid: "uuid-3",
  gameName: "Tracked Game",
  gameSlug: "tracked-game",
  gameCoverUrl: null,
  platformId: 1,
  platformName: "PC (Microsoft Windows)",
  format: "digital",
  digitalStorefront: "Steam",
  targetPrice: 19.99,
};

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

function renderPage(initialEntry = "/settings/sale-manager") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <SaleManagerPage />
    </MemoryRouter>
  );
}

describe("SaleManagerPage", () => {
  it("shows the Tracked tab first and hides the tracked page heading", () => {
    trackedItems = [trackedRow];
    ignoredTitles = [ignoredRow];
    untrackedItems = [untrackedRow];

    renderPage();

    expect(screen.getByRole("heading", { name: "Sale Manager" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Tracked" })).toHaveAttribute("aria-selected", "true");
    expect(screen.queryByRole("heading", { name: "Sale - Tracked" })).not.toBeInTheDocument();
    expect(screen.getByText("Tracked Game")).toBeInTheDocument();
    expect(screen.queryByText("Ignored Game")).not.toBeInTheDocument();
    expect(screen.queryByText("Untracked Game")).not.toBeInTheDocument();
  });

  it("switches to the Ignored tab on click", async () => {
    const user = userEvent.setup();
    trackedItems = [trackedRow];
    ignoredTitles = [ignoredRow];
    untrackedItems = [untrackedRow];

    renderPage();

    await user.click(screen.getByRole("tab", { name: "Ignored" }));

    expect(screen.getByText("Ignored Game")).toBeInTheDocument();
    expect(screen.queryByText("Tracked Game")).not.toBeInTheDocument();
  });

  it("switches to the Untracked tab on click", async () => {
    const user = userEvent.setup();
    trackedItems = [trackedRow];
    ignoredTitles = [ignoredRow];
    untrackedItems = [untrackedRow];

    renderPage();

    await user.click(screen.getByRole("tab", { name: "Untracked" }));

    expect(screen.getByText("Untracked Game")).toBeInTheDocument();
    expect(screen.queryByText("Tracked Game")).not.toBeInTheDocument();
  });

  it("opens the Ignored tab from the URL", () => {
    trackedItems = [trackedRow];
    ignoredTitles = [ignoredRow];
    untrackedItems = [untrackedRow];

    renderPage("/settings/sale-manager?tab=ignored");

    expect(screen.getByRole("tab", { name: "Ignored" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Ignored Game")).toBeInTheDocument();
  });
});
