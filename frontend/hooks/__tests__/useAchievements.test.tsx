import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  RAGameUserProgress,
  RetroAchievementsSummary,
} from "../../api/achievements";
import {
  getRetroAchievementsGameProgress,
  getRetroAchievementsSummary,
} from "../../api/achievements";
import {
  ACHIEVEMENTS_AUTO_REFRESH_MS,
  useRetroAchievementsGameProgress,
  useRetroAchievementsSummary,
} from "../useAchievements";

vi.mock("../../api/achievements", () => ({
  getRetroAchievementsGameProgress: vi.fn(),
  getRetroAchievementsStatus: vi.fn(),
  getRetroAchievementsSummary: vi.fn(),
  updateRetroAchievementsSettings: vi.fn(),
}));

const summaryFixture: RetroAchievementsSummary = {
  profile: {
    username: "Flyingfox",
    userPicUrl: null,
    motto: null,
    memberSince: null,
    richPresence: null,
    totalPoints: 100,
    totalSoftcorePoints: 50,
    totalTruePoints: 200,
  },
  recentlyPlayed: [],
  recentAchievements: [],
};

const progressFixture: RAGameUserProgress = {
  gameId: 1,
  title: "Super Mario Bros. 3",
  consoleName: "NES/Famicom",
  imageIconUrl: null,
  imageBoxArtUrl: null,
  numAchieved: 0,
  numPossibleAchievements: 3,
  scoreAchieved: 0,
  possibleScore: 17,
  achievements: [],
};

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  Wrapper.displayName = "QueryClientWrapper";
  return Wrapper;
}

describe("achievements auto-refresh", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("refetches the summary every 15 minutes", async () => {
    vi.mocked(getRetroAchievementsSummary).mockResolvedValue(summaryFixture);
    const { result } = renderHook(() => useRetroAchievementsSummary(true), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.isSuccess).toBe(true);
    expect(getRetroAchievementsSummary).toHaveBeenCalledTimes(1);
    expect(getRetroAchievementsSummary).toHaveBeenCalledWith(false);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(ACHIEVEMENTS_AUTO_REFRESH_MS);
    });
    expect(getRetroAchievementsSummary).toHaveBeenCalledTimes(2);
  });

  it("refetches game progress every 15 minutes", async () => {
    vi.mocked(getRetroAchievementsGameProgress).mockResolvedValue(progressFixture);
    const { result } = renderHook(() => useRetroAchievementsGameProgress("1"), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.isSuccess).toBe(true);
    expect(getRetroAchievementsGameProgress).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(ACHIEVEMENTS_AUTO_REFRESH_MS);
    });
    expect(getRetroAchievementsGameProgress).toHaveBeenCalledTimes(2);
  });
});
