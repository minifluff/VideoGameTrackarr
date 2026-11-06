import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { RetroAchievementsStatus, RetroAchievementsSummary } from "../../api/achievements";
import AchievementsPage from "../AchievementsPage";

let status: RetroAchievementsStatus = { configured: false, username: null, apiKeyConfigured: false };
let summary: RetroAchievementsSummary | undefined;
const summaryLoading = false;

vi.mock("../../hooks/useAchievements", () => ({
  useRetroAchievementsStatus: () => ({ data: status, isLoading: false }),
  useRetroAchievementsSummary: () => ({
    data: summary,
    isLoading: summaryLoading,
    isError: false,
    error: null,
    refresh: vi.fn(),
  }),
  useUpdateRetroAchievementsSettings: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

const summaryFixture: RetroAchievementsSummary = {
  profile: {
    username: "Flyingfox",
    userPicUrl: "https://media.retroachievements.org/UserPic/Flyingfox.png",
    motto: "Join me on Twitch!",
    memberSince: "2016-01-02 00:43:04",
    richPresence: "Playing Super Mario World",
    totalPoints: 399597,
    totalSoftcorePoints: 12,
    totalTruePoints: 1599212,
  },
  recentlyPlayed: [
    {
      gameId: 11332,
      consoleName: "PlayStation",
      title: "Final Fantasy Origins",
      imageIconUrl: "/Images/060249.png",
      imageBoxArtUrl: "/Images/046257.png",
      lastPlayed: "2023-10-27 00:30:04",
      numPossibleAchievements: 119,
      numAchieved: 38,
      numAchievedHardcore: 38,
      possibleScore: 945,
      scoreAchieved: 382,
    },
  ],
  recentAchievements: [
    {
      achievementId: 98012,
      title: "Beginner I",
      description: "Clear stages 01 - 05 in Quest.",
      badgeUrl: "/Badge/108302.png",
      points: 5,
      trueRatio: 25,
      hardcore: true,
      dateEarned: "2023-12-27 16:04:50",
      gameId: 14715,
      gameTitle: "Pokemon Pinball mini",
      gameIconUrl: "/Images/028399.png",
      consoleName: "Pokemon Mini",
    },
  ],
};

describe("AchievementsPage", () => {
  it("shows the setup state when RetroAchievements isn't connected", () => {
    status = { configured: false, username: null, apiKeyConfigured: false };
    summary = undefined;

    render(
      <MemoryRouter>
        <AchievementsPage />
      </MemoryRouter>,
    );

    expect(screen.getByText("RetroAchievements isn't connected yet")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to Integrations" })).toHaveAttribute(
      "href",
      "/settings/integrations",
    );
  });

  it("shows the profile header and recently played games, without member since or recent achievements", () => {
    status = { configured: true, username: "Flyingfox", apiKeyConfigured: true };
    summary = summaryFixture;

    render(
      <MemoryRouter>
        <AchievementsPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: "Flyingfox" })).toHaveAttribute(
      "href",
      "https://retroachievements.org/user/Flyingfox",
    );
    // RA's TotalPoints are the hardcore points; softcore is the second stat.
    expect(screen.getByText("399,597")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.queryByText("Member Since")).not.toBeInTheDocument();
    expect(screen.queryByText("Beginner I")).not.toBeInTheDocument();
    expect(screen.getByText("Final Fantasy Origins")).toBeInTheDocument();
    expect(screen.getByText("38 / 119 · 382 pts")).toBeInTheDocument();
    // The whole recently-played row links to the in-app game page.
    expect(screen.getByRole("link", { name: /Final Fantasy Origins/ })).toHaveAttribute(
      "href",
      "/achievements/game/11332",
    );
  });
});
