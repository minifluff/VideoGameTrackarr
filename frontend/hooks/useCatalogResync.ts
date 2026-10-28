import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  acknowledgeCatalogResyncStatus,
  fetchCatalogResyncStatus,
  startCollectionResync,
  startFranchiseResync,
} from "../api/catalogResync";

export const catalogResyncStatusQueryKey = ["catalog-resync", "status"] as const;

// Polled only while a resync is running (same pattern as useJobsList) — the mount-time
// fetch still picks up an already-running job, e.g. the user started a resync, navigated
// away, and came back to the same Collection/Series page, without a 3s request forever.
export function useCatalogResyncStatus() {
  return useQuery({
    queryKey: catalogResyncStatusQueryKey,
    queryFn: fetchCatalogResyncStatus,
    refetchInterval: (query) => (query.state.data?.status === "running" ? 3000 : false),
    staleTime: 0,
    refetchIntervalInBackground: true,
  });
}

export function useStartCollectionResync() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: startCollectionResync,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: catalogResyncStatusQueryKey });
    },
  });
}

export function useStartFranchiseResync() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: startFranchiseResync,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: catalogResyncStatusQueryKey });
    },
  });
}

export function useAcknowledgeCatalogResyncStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: acknowledgeCatalogResyncStatus,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: catalogResyncStatusQueryKey });
    },
  });
}
