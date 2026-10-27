import { useMutation, useQueryClient } from "@tanstack/react-query";
import { clearMissingGames, clearPlaytime, resetDatabase } from "../api/system";

export const useResetDatabase = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (confirmation: string) => resetDatabase(confirmation),
    onSuccess: () => {
      // Everything the UI knew about the library is gone — refetch it all.
      queryClient.invalidateQueries();
    },
  });
};

export const useClearPlaytime = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (confirmation: string) => clearPlaytime(confirmation),
    onSuccess: () => {
      // Progress data changed — refetch queries that display it.
      queryClient.invalidateQueries();
    },
  });
};

export const useClearMissingGames = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (confirmation: string) => clearMissingGames(confirmation),
    onSuccess: () => {
      // Missing games fed the games list, search, and dashboard counts — refetch it all.
      queryClient.invalidateQueries();
    },
  });
};
