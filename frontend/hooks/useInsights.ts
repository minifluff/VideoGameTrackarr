import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ignoreDuplicateLibraryItems,
  listAccessoriesWithoutOwnedHardware,
  listDuplicateLibraryItems,
  listIgnoredDuplicateLibraryItems,
  listMissingAddons,
  listOnSale,
  unignoreDuplicateLibraryItems,
} from "../api/insights";
import type { GameListFilters } from "../api/games";
import type { IgnoreDuplicateGroupRequest } from "../api/types";

export function useDuplicateLibraryItems() {
  return useQuery({
    queryKey: ["insights", "duplicate-library-items"],
    queryFn: listDuplicateLibraryItems,
  });
}

export function useIgnoredDuplicateLibraryItems(enabled: boolean) {
  return useQuery({
    queryKey: ["insights", "duplicate-library-items", "ignored"],
    queryFn: listIgnoredDuplicateLibraryItems,
    enabled,
  });
}

function useInvalidateDuplicateLibraryItems() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ["insights", "duplicate-library-items"] });
  };
}

export function useIgnoreDuplicateLibraryItems() {
  const invalidate = useInvalidateDuplicateLibraryItems();
  return useMutation({
    mutationFn: (payload: IgnoreDuplicateGroupRequest) => ignoreDuplicateLibraryItems(payload),
    onSuccess: invalidate,
  });
}

export function useUnignoreDuplicateLibraryItems() {
  const invalidate = useInvalidateDuplicateLibraryItems();
  return useMutation({
    mutationFn: (ignoredId: number) => unignoreDuplicateLibraryItems(ignoredId),
    onSuccess: invalidate,
  });
}

export function useMissingAddons(filters: GameListFilters = {}) {
  return useQuery({
    queryKey: ["insights", "missing-addons", filters],
    queryFn: ({ signal }) => listMissingAddons(filters, signal),
  });
}

export function useAccessoriesWithoutOwnedHardware() {
  return useQuery({
    queryKey: ["insights", "accessories-without-owned-hardware"],
    queryFn: listAccessoriesWithoutOwnedHardware,
  });
}

export function useOnSale() {
  return useQuery({ queryKey: ["insights", "on-sale"], queryFn: listOnSale });
}
