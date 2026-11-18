import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { DashboardStats } from "../../api/types";
import GameStatsSection from "../GameStatsSection";

let stats: DashboardStats | undefined;
let platforms: { id: number; name: string }[] | undefined;
let genres: { id: number; name: string }[] | undefined;

vi.mock("../../hooks/useDashboard", () => ({
  useDashboardStats: () => ({ data: stats, isLoading: false }),
}));

vi.mock("../../hooks/usePlatforms", () => ({
  usePlatforms: () => ({ data: platforms }),
}));

vi.mock("../../hooks/useGenres", () => ({
  useGenres: () => ({ data: genres }),
}));

const statsFixture: DashboardStats = {
  totalOwned: 10,
  totalWishlisted: 3,
  totalTracked: 13,
  totalPlaytimeMinutes: 125,
  averageRating: 4.5,
  playStatusBreakdown: { playing: 4, completed: 6 },
  platformBreakdown: [{ name: "PC (Microsoft Windows)", count: 7 }],
  genreBreakdown: [{ name: "RPG", count: 5 }],
  formatBreakdown: [{ name: "digital", count: 6 }],
} as DashboardStats;

function renderSection() {
  return render(
    <MemoryRouter>
      <GameStatsSection />
    </MemoryRouter>
  );
}

describe("GameStatsSection", () => {
  it("shows the headline tiles and the four bar breakdowns", () => {
    stats = statsFixture;
    platforms = [{ id: 1, name: "PC (Microsoft Windows)" }];
    genres = [{ id: 2, name: "RPG" }];

    renderSection();

    expect(screen.getByText("Owned")).toBeInTheDocument();
    expect(screen.getByText("2h 5m")).toBeInTheDocument();
    expect(screen.getByText("By Play Status")).toBeInTheDocument();
    expect(screen.getByText("Playing")).toBeInTheDocument();
    expect(screen.getByText("By Platform")).toBeInTheDocument();
    expect(screen.getByText("PC (Microsoft Windows)")).toBeInTheDocument();
    expect(screen.getByText("By Genre")).toBeInTheDocument();
    expect(screen.getByText("RPG")).toBeInTheDocument();
    expect(screen.getByText("By Format")).toBeInTheDocument();
    expect(screen.getByText("Digital")).toBeInTheDocument();
  });

  it("opens the Games list filtered to a play status from a bar row", async () => {
    const user = userEvent.setup();
    stats = statsFixture;
    platforms = [{ id: 1, name: "PC (Microsoft Windows)" }];
    genres = [{ id: 2, name: "RPG" }];

    renderSection();

    await user.click(screen.getByText("Playing"));

    expect(JSON.parse(window.sessionStorage.getItem("vgt.view.games.playStatuses") ?? "null")).toEqual([
      "playing",
    ]);
  });

  it("opens the Games list filtered to a genre from a bar row", async () => {
    const user = userEvent.setup();
    stats = statsFixture;
    platforms = [{ id: 1, name: "PC (Microsoft Windows)" }];
    genres = [{ id: 2, name: "RPG" }];

    renderSection();

    await user.click(screen.getByText("RPG"));

    expect(JSON.parse(window.sessionStorage.getItem("vgt.view.games.genreIds") ?? "null")).toEqual([2]);
  });

  it("opens the Games list filtered to a format from a bar row", async () => {
    const user = userEvent.setup();
    stats = statsFixture;
    platforms = [{ id: 1, name: "PC (Microsoft Windows)" }];
    genres = [{ id: 2, name: "RPG" }];

    renderSection();

    await user.click(screen.getByText("Digital"));

    expect(JSON.parse(window.sessionStorage.getItem("vgt.view.games.formats") ?? "null")).toEqual([
      "digital",
    ]);
  });
});
