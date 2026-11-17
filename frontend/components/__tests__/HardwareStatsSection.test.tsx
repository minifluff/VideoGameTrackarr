import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { HardwareStats } from "../../api/types";
import HardwareStatsSection from "../HardwareStatsSection";

let stats: HardwareStats | undefined;

vi.mock("../../hooks/useHardwareStats", () => ({
  useHardwareStats: () => ({ data: stats, isLoading: false }),
}));

vi.mock("../../theme/CurrencyProvider", () => ({
  useCurrency: () => ({ currency: "CAD" }),
}));

const statsFixture = {
  ownedConsoles: 2,
  ownedAccessories: 5,
  wishlistHardware: 1,
  collectionValue: 1250,
  manufacturerDistribution: [{ name: "Nintendo", count: 3 }],
  platformDistribution: [{ name: "Nintendo Switch", count: 2 }],
} as HardwareStats;

describe("HardwareStatsSection", () => {
  it("shows the headline tiles and the two bar breakdowns", () => {
    stats = statsFixture;

    render(
      <MemoryRouter>
        <HardwareStatsSection />
      </MemoryRouter>
    );

    expect(screen.getByText("Owned consoles")).toBeInTheDocument();
    expect(screen.getByText("By manufacturer")).toBeInTheDocument();
    expect(screen.getByText("Nintendo")).toBeInTheDocument();
    expect(screen.getByText("By platform")).toBeInTheDocument();
    expect(screen.getByText("Nintendo Switch")).toBeInTheDocument();
  });
});
