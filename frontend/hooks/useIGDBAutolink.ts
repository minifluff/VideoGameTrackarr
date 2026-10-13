import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { autolinkGames, getUnlinkedGames } from "../api/igdbAutolink";

export function useUnlinkedGames() {
  return useQuery({
    queryKey: ["igdb", "autolink", "unlinked"],
    queryFn: getUnlinkedGames,
  });
}

export function useAutolinkGames() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: autolinkGames,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["igdb", "autolink", "unlinked"] });
      queryClient.invalidateQueries({ queryKey: ["games"] });
    },
  });
}
