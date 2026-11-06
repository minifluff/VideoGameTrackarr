import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import {
  getRetroAchievementsStatus,
  getRetroAchievementsSummary,
  updateRetroAchievementsSettings,
} from "../api/achievements";

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
