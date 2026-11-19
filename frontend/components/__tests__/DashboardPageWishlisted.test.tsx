import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { ThemeProvider } from "@mui/material/styles";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { createM3Theme } from "../../theme/createM3Theme";
import type { DashboardStats, WishlistedGameSummary } from "../../api/types";
import DashboardPage from "../DashboardPage";

// Same pattern as GameStatsSection.test.tsx: the dashboard stats are stubbed
// with a module-level variable the tests set per case; every other dashboard
// query has no server in jsdom and fails into its placeholder state.
let stats: DashboardStats | undefined;

vi.mock("../../hooks/useDashboard", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../hooks/useDashboard")>();
  return {
    ...actual,
    // DashboardPage also uses useReleaseCalendar from this module, so the
    // real module stays in play and only the stats query is stubbed.
    useDashboardStats: () => ({ data: stats, isLoading: false }),
  };
});

const theme = createM3Theme("light", "normal");

function renderDashboard() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <MemoryRouter initialEntries={["/"]}>
          <DashboardPage />
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

const physicalGame: WishlistedGameSummary = {
  id: 1,
  uuid: "uuid-physical",
  igdbId: 101,
  name: "Physical Game",
  slug: "physical-game",
  coverUrl: null,
  spineUrl: null,
  category: "main_game",
  firstReleaseDate: null,
  owned: false,
  wishlisted: true,
  playStatus: null,
  rating: null,
  isOnSale: false,
  autoDiscovered: false,
  hideFromPublic: false,
  ownedPlatforms: ["PlayStation 5"],
  formats: ["physical"],
};

const digitalGame: WishlistedGameSummary = {
  ...physicalGame,
  id: 2,
  uuid: "uuid-digital",
  igdbId: 102,
  name: "Digital Game",
  slug: "digital-game",
  formats: ["digital"],
};

function statsWithWishlist(games: WishlistedGameSummary[]): DashboardStats {
  return {
    totalOwned: 0,
    totalWishlisted: games.length,
    totalTracked: games.length,
    totalPlaytimeMinutes: 0,
    averageRating: null,
    playStatusBreakdown: {},
    platformBreakdown: [],
    genreBreakdown: [],
    formatBreakdown: [],
    recentlyAdded: [],
    recentlyPlayed: [],
    wishlistedGames: games,
  };
}

describe("DashboardPage Wishlisted Games section", () => {
  it("shows wishlisted games with a Physical checkbox that filters to physical copies", async () => {
    stats = statsWithWishlist([physicalGame, digitalGame]);
    renderDashboard();

    expect(await screen.findByText("Wishlisted Games")).toBeInTheDocument();
    expect(screen.getByText("Physical Game")).toBeInTheDocument();
    expect(screen.getByText("Digital Game")).toBeInTheDocument();

    const checkbox = screen.getByRole("checkbox", { name: "Physical" });
    fireEvent.click(checkbox);
    expect(screen.getByText("Physical Game")).toBeInTheDocument();
    expect(screen.queryByText("Digital Game")).not.toBeInTheDocument();

    fireEvent.click(checkbox);
    expect(screen.getByText("Digital Game")).toBeInTheDocument();
  });

  it("keeps the section and its checkbox when the Physical filter empties the row", async () => {
    stats = statsWithWishlist([digitalGame]);
    renderDashboard();

    expect(await screen.findByText("Wishlisted Games")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: "Physical" }));

    expect(screen.getByText("Wishlisted Games")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Physical" })).toBeInTheDocument();
    expect(screen.getByText("No physical games on your wishlist.")).toBeInTheDocument();
    expect(screen.queryByText("Digital Game")).not.toBeInTheDocument();
  });
});
