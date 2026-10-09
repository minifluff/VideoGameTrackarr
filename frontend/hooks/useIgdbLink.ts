import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { acknowledgeIgdbLinkStatus, fetchIgdbLinkStatus, startIgdbLink } from "../api/igdbLink";

export const igdbLinkStatusQueryKey = ["igdb-link", "status"] as const;

// Polled continuously (like useCatalogResyncStatus) so the Data Management section picks
// up an already-running job on mount — e.g. the user started link-all, navigated away,
// and came back to Settings.
export function useIgdbLinkStatus() {
  return useQuery({
    queryKey: igdbLinkStatusQueryKey,
    queryFn: fetchIgdbLinkStatus,
    refetchInterval: 3000,
    staleTime: 0,
    refetchIntervalInBackground: true,
  });
}

export function useStartIgdbLink() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: startIgdbLink,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: igdbLinkStatusQueryKey });
    },
  });
}

export function useAcknowledgeIgdbLinkStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: acknowledgeIgdbLinkStatus,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: igdbLinkStatusQueryKey });
    },
  });
}
