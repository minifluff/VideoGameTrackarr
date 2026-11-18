import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { DashboardStats, HardwareStats } from "../../api/types";
import InsightsPage from "../InsightsPage";

let gameStats: DashboardStats | undefined;
let hardwareStats: HardwareStats | undefined;
let missingAddons: unknown[] | undefined;
let duplicates: unknown[] | undefined;
let orphans: unknown[] | undefined;
let onSale: unknown[] | undefined;

vi.mock("../../hooks/useDashboard", () => ({
  useDashboardStats: () => ({ data: gameStats, isLoading: false }),
}));

vi.mock("../../hooks/usePlatforms", () => ({
  usePlatforms: () => ({ data: [] }),
}));

vi.mock("../../hooks/useGenres", () => ({
  useGenres: () => ({ data: [] }),
}));

vi.mock("../../hooks/useHardwareStats", () => ({
  useHardwareStats: () => ({ data: hardwareStats, isLoading: false }),
}));

vi.mock("../../hooks/useInsights", () => ({
  useMissingAddons: () => ({ data: missingAddons }),
  useDuplicateLibraryItems: () => ({ data: duplicates }),
  useAccessoriesWithoutOwnedHardware: () => ({ data: orphans }),
  useOnSale: () => ({ data: onSale }),
}));

vi.mock("../../theme/CurrencyProvider", () => ({
  useCurrency: () => ({ currency: "CAD" }),
}));

describe("InsightsPage", () => {
  it("shows the More section with the sub-page counts", () => {
    gameStats = {
      totalOwned: 10,
      totalWishlisted: 3,
      totalTracked: 13,
      totalPlaytimeMinutes: 60,
      averageRating: null,
      playStatusBreakdown: {},
      platformBreakdown: [],
      genreBreakdown: [],
      formatBreakdown: [],
      recentlyAdded: [],
      recentlyPlayed: [],
    } as DashboardStats;
    hardwareStats = {
      ownedConsoles: 1,
      ownedAccessories: 0,
      wishlistHardware: 0,
      collectionValue: 0,
      manufacturerDistribution: [],
      platformDistribution: [],
      recentlyAdded: [],
    } as HardwareStats;
    missingAddons = [{}, {}];
    duplicates = [{}];
    orphans = [];
    onSale = [{}, {}, {}];

    render(
      <MemoryRouter>
        <InsightsPage />
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { name: "Games" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Hardware" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "More insights" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Missing Addons/ })).toHaveAttribute("href", "/insights/missing-addons");
    expect(screen.getByRole("link", { name: /Duplicates/ })).toHaveAttribute("href", "/insights/duplicates");
    expect(screen.getByRole("link", { name: /Orphaned Accessories/ })).toHaveAttribute(
      "href",
      "/insights/orphaned-accessories"
    );
    expect(screen.getByRole("link", { name: /On Sale/ })).toHaveAttribute("href", "/insights/on-sale");
  });
});
