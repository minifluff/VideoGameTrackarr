import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type {
  RetroAchievementsStatus,
  RetroAchievementsSummary,
  SteamAchievementsSummary,
} from "../../api/achievements";
import AchievementsPage from "../AchievementsPage";

let status: RetroAchievementsStatus = {
  configured: false,
  username: null,
  apiKeyConfigured: false,
  steamConfigured: false,
};
let summary: RetroAchievementsSummary | undefined;
let steamSummary: SteamAchievementsSummary | undefined;
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
  useSteamAchievementsSummary: () => ({
    data: steamSummary,
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

const steamSummaryFixture: SteamAchievementsSummary = {
  configured: true,
  games: [
    {
      appid: 220,
      name: "Half-Life 2",
      iconUrl:
        "https://media.steampowered.com/steamcommunity/public/images/apps/220/abc123icon.jpg",
      lastPlayed: "2023-12-28T04:26:40Z",
      playtimeForeverMinutes: 754,
      playtime2WeeksMinutes: 120,
      unlockedCount: 1,
      totalCount: 2,
    },
  ],
  recentAchievements: [
    {
      apiname: "HL2_KILL_ALL",
      displayName: "Kill them all",
      description: "Defeat every enemy.",
      iconUrl:
        "https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/220/iconhash.jpg",
      unlockedAt: "2023-12-28T04:43:20Z",
      gameName: "Half-Life 2",
      appid: 220,
    },
  ],
};

describe("AchievementsPage", () => {
  it("shows the setup state when neither source is connected", () => {
    status = {
      configured: false,
      username: null,
      apiKeyConfigured: false,
      steamConfigured: false,
    };
    summary = undefined;
    steamSummary = undefined;

    render(
      <MemoryRouter>
        <AchievementsPage />
      </MemoryRouter>,
    );

    expect(screen.getByText("RetroAchievements isn't connected yet")).toBeInTheDocument();
    expect(screen.getByText("Steam isn't connected yet")).toBeInTheDocument();
    const links = screen.getAllByRole("link", { name: "Go to Integrations" });
    expect(links).toHaveLength(2);
    for (const link of links) {
      expect(link).toHaveAttribute("href", "/settings/integrations");
    }
  });

  it("shows the profile header, recently played games and recent achievements", () => {
    status = {
      configured: true,
      username: "Flyingfox",
      apiKeyConfigured: true,
      steamConfigured: false,
    };
    summary = summaryFixture;
    steamSummary = undefined;

    render(
      <MemoryRouter>
        <AchievementsPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: "Flyingfox" })).toHaveAttribute(
      "href",
      "https://retroachievements.org/user/Flyingfox",
    );
    expect(screen.getByText("399,597")).toBeInTheDocument();
    expect(screen.getByText("Final Fantasy Origins")).toBeInTheDocument();
    expect(screen.getByText("38 / 119 achievements · 382 pts")).toBeInTheDocument();
    expect(screen.getByText("Beginner I")).toBeInTheDocument();
    expect(screen.getByText("Hardcore")).toBeInTheDocument();
    expect(screen.getByText("5 pts")).toBeInTheDocument();
  });

  it("merges Steam rows into the same feed, newest first, with source chips", () => {
    status = {
      configured: true,
      username: "Flyingfox",
      apiKeyConfigured: true,
      steamConfigured: true,
    };
    summary = summaryFixture;
    steamSummary = steamSummaryFixture;

    const { container } = render(
      <MemoryRouter>
        <AchievementsPage />
      </MemoryRouter>,
    );

    // Steam's game and unlock are newer than RA's, so they sort first in both lists.
    const html = container.innerHTML;
    expect(html.indexOf("Half-Life 2")).toBeLessThan(html.indexOf("Final Fantasy Origins"));
    expect(html.indexOf("Kill them all")).toBeLessThan(html.indexOf("Beginner I"));

    // Every row carries a source chip: RA game + RA achievement, Steam game +
    // Steam achievement (+ the Steam game's "Steam" subtitle).
    expect(screen.getAllByText("RetroAchievements")).toHaveLength(2);
    expect(screen.getAllByText("Steam")).toHaveLength(3);

    // Steam rows link to the store, show progress without points, and carry no
    // points line — the only "pts" text on the page is RA's.
    expect(screen.getByRole("link", { name: "Half-Life 2" })).toHaveAttribute(
      "href",
      "https://store.steampowered.com/app/220",
    );
    expect(screen.getByText("1 / 2 achievements")).toBeInTheDocument();
    expect(screen.getAllByText(/pts/)).toHaveLength(2);
  });

  it("shows a Steam setup hint when only RetroAchievements is connected", () => {
    status = {
      configured: true,
      username: "Flyingfox",
      apiKeyConfigured: true,
      steamConfigured: false,
    };
    summary = summaryFixture;
    steamSummary = undefined;

    render(
      <MemoryRouter>
        <AchievementsPage />
      </MemoryRouter>,
    );

    expect(screen.getByText("Steam isn't connected yet")).toBeInTheDocument();
    expect(screen.getByText("Final Fantasy Origins")).toBeInTheDocument();
  });

  it("shows Steam-only content with a RetroAchievements hint when RA isn't connected", () => {
    status = {
      configured: false,
      username: null,
      apiKeyConfigured: false,
      steamConfigured: true,
    };
    summary = undefined;
    steamSummary = steamSummaryFixture;

    render(
      <MemoryRouter>
        <AchievementsPage />
      </MemoryRouter>,
    );

    // No RA profile header, but the Steam rows are there — the game title shows
    // twice (game row link + achievement's game line)…
    expect(screen.queryByRole("link", { name: "Flyingfox" })).not.toBeInTheDocument();
    expect(screen.getAllByText("Half-Life 2")).toHaveLength(2);
    expect(screen.getByText("Kill them all")).toBeInTheDocument();
    // …and the RA setup hint sits below the feed.
    expect(screen.getByText("RetroAchievements isn't connected yet")).toBeInTheDocument();
    expect(screen.queryByText("Steam isn't connected yet")).not.toBeInTheDocument();
  });
});
