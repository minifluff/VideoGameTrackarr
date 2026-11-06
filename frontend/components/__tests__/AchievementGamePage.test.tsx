import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { RAGameUserProgress } from "../../api/achievements";
import AchievementGamePage from "../AchievementGamePage";

let progress: RAGameUserProgress | undefined;
let loading = false;
let isError = false;

vi.mock("../../hooks/useAchievements", () => ({
  useRetroAchievementsGameProgress: () => ({
    data: progress,
    isLoading: loading,
    isError,
    error: null,
  }),
}));

const progressFixture: RAGameUserProgress = {
  gameId: 1,
  title: "Super Mario Bros. 3",
  consoleName: "NES/Famicom",
  imageIconUrl: "/Images/067895.png",
  imageBoxArtUrl: "/Images/051872.png",
  numAchieved: 2,
  numPossibleAchievements: 3,
  scoreAchieved: 7,
  possibleScore: 17,
  achievements: [
    {
      achievementId: 9,
      title: "Older Unlock",
      description: "Earned a while ago",
      badgeUrl: "/Badge/250336.png",
      points: 2,
      trueRatio: 2,
      displayOrder: 2,
      numAwarded: 24273,
      dateEarned: "2022-04-17 00:00:00",
      dateEarnedHardcore: "2022-04-17 00:00:00",
    },
    {
      achievementId: 10,
      title: "Newer Unlock",
      description: "Earned most recently",
      badgeUrl: "/Badge/250337.png",
      points: 5,
      trueRatio: 5,
      displayOrder: 0,
      numAwarded: 100,
      dateEarned: "2026-07-26 00:00:00",
      dateEarnedHardcore: null,
    },
    {
      achievementId: 11,
      title: "Still Locked",
      description: "Not earned yet",
      badgeUrl: "/Badge/250338.png",
      points: 10,
      trueRatio: 25,
      displayOrder: 1,
      numAwarded: 5,
      dateEarned: null,
      dateEarnedHardcore: null,
    },
  ],
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/achievements/game/1"]}>
      <Routes>
        <Route path="/achievements/game/:gameId" element={<AchievementGamePage />} />
      </Routes>
    </MemoryRouter>,
  );
}

function rowTexts(container: HTMLElement): string[] {
  return [...container.querySelectorAll("li")]
    .map((li) => li.textContent ?? "")
    .filter((text) => text.length > 0);
}

describe("AchievementGamePage", () => {
  it("shows the header counts and unlocked-first ordering", () => {
    progress = progressFixture;
    loading = false;
    isError = false;

    const { container } = renderPage();

    expect(screen.getByText("Super Mario Bros. 3")).toBeInTheDocument();
    expect(screen.getByText("NES/Famicom")).toBeInTheDocument();
    expect(screen.getByText("Achievements: 2/3")).toBeInTheDocument();
    expect(screen.getByText("Points: 7/17")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View on RetroAchievements" })).toHaveAttribute(
      "href",
      "https://retroachievements.org/game/1",
    );
    expect(screen.getByRole("link", { name: "Back to Achievements" })).toHaveAttribute(
      "href",
      "/achievements",
    );

    const rows = rowTexts(container);
    expect(rows).toHaveLength(3);
    // Most recently unlocked first, then the older unlock, then the locked one.
    expect(rows[0]).toContain("Newer Unlock");
    expect(rows[0]).toContain("Unlocked: Jul 26, 2026");
    expect(rows[0]).toContain("Points: 5");
    expect(rows[1]).toContain("Older Unlock");
    expect(rows[1]).toContain("Unlocked: Apr 17, 2022");
    expect(rows[2]).toContain("Still Locked");
    expect(rows[2]).toContain("Not unlocked yet");
    expect(rows[2]).toContain("Points: 10");
  });

  it("shows a spinner while loading", () => {
    progress = undefined;
    loading = true;
    isError = false;

    renderPage();

    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("shows the load error and a way back", () => {
    progress = undefined;
    loading = false;
    isError = true;

    renderPage();

    expect(screen.getByText("Couldn't load your RetroAchievements data.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to Achievements" })).toHaveAttribute(
      "href",
      "/achievements",
    );
  });
});
