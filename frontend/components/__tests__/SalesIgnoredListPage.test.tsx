import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { IgnoredSalesTitle, TrackedSalesItem } from "../../api/salesTracking";
import { IgnoredPanel, UntrackedPanel } from "../SalesIgnoredListPage";

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

function renderPanel(panel: React.ReactNode) {
  return render(<MemoryRouter>{panel}</MemoryRouter>);
}

describe("Sale Manager panels", () => {
  it("IgnoredPanel lists ignored titles", () => {
    ignoredTitles = [ignoredRow];

    renderPanel(<IgnoredPanel />);

    expect(screen.getByText("Ignored Game")).toBeInTheDocument();
    expect(screen.getByText("Nintendo eShop")).toBeInTheDocument();
  });

  it("UntrackedPanel lists untracked wishlist games", () => {
    untrackedItems = [untrackedRow];

    renderPanel(<UntrackedPanel />);

    expect(screen.getByText("Untracked Game")).toBeInTheDocument();
    expect(screen.getByText("Nintendo Switch")).toBeInTheDocument();
  });

  it("UntrackedPanel tracks a game", async () => {
    const user = userEvent.setup();
    untrackedItems = [untrackedRow];
    spies.track.mockClear();

    renderPanel(<UntrackedPanel />);

    await user.click(screen.getByRole("button", { name: "Track" }));

    expect(spies.track).toHaveBeenCalledWith(7);
  });

  it("UntrackedPanel removes a game from the wishlist", async () => {
    const user = userEvent.setup();
    untrackedItems = [untrackedRow];
    spies.removeWishlist.mockClear();

    renderPanel(<UntrackedPanel />);

    await user.click(screen.getByRole("button", { name: "Remove from wishlist" }));

    expect(spies.removeWishlist).toHaveBeenCalledWith(7);
  });
});
