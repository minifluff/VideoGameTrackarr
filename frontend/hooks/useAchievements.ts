import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import {
  getRetroAchievementsGameProgress,
  getRetroAchievementsStatus,
  getRetroAchievementsSummary,
  updateRetroAchievementsSettings,
} from "../api/achievements";

// The server caches both RA responses for 15 minutes, so polling on the same
// cadence keeps the pages fresh without hammering the RA API — each tick lands
// just as the cache expires. The interval pauses while the tab is hidden
// (TanStack default); coming back to the tab refetches on focus instead.
export const ACHIEVEMENTS_AUTO_REFRESH_MS = 15 * 60 * 1000;

export function useRetroAchievementsStatus() {
  return useQuery({ queryKey: ["achievements-status"], queryFn: getRetroAchievementsStatus });
}

export function useUpdateRetroAchievementsSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      username,
      apiKey,
    }: {
      username: string | null;
      apiKey?: string | null;
    }) => updateRetroAchievementsSettings(username, apiKey),
    onSuccess: (status) => {
      queryClient.setQueryData(["achievements-status"], status);
      queryClient.invalidateQueries({ queryKey: ["achievements-summary"] });
    },
  });
}

export function useRetroAchievementsSummary(enabled: boolean) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["achievements-summary"],
    queryFn: () => getRetroAchievementsSummary(false),
    enabled,
    refetchInterval: ACHIEVEMENTS_AUTO_REFRESH_MS,
  });
  // Refresh skips the server's 15-minute cache once and writes the fresh result
  // straight into the query — a plain refetch would keep serving the cache.
  const refresh = async () => {
    const fresh = await getRetroAchievementsSummary(true);
    queryClient.setQueryData(["achievements-summary"], fresh);
    return fresh;
  };
  return { ...query, refresh };
}

export function useRetroAchievementsGameProgress(gameId: string | undefined) {
  return useQuery({
    queryKey: ["achievements-game", gameId],
    queryFn: () => getRetroAchievementsGameProgress(Number(gameId)),
    enabled: gameId !== undefined && Number.isInteger(Number(gameId)),
    refetchInterval: ACHIEVEMENTS_AUTO_REFRESH_MS,
  });
}
