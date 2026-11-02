import { apiClient } from "./client";
import { buildGameFilterParams, type GameListFilters } from "./games";
import type {
  DuplicateLibraryItemGroup,
  IgnoreDuplicateGroupRequest,
  IgnoredDuplicateGroup,
  InsightAccessoryRef,
  MissingAddonsEntry,
  OnSaleItem,
} from "./types";

export async function listDuplicateLibraryItems(): Promise<DuplicateLibraryItemGroup[]> {
  const response = await apiClient.get<DuplicateLibraryItemGroup[]>(
    "/api/insights/duplicate-library-items"
  );
  return response.data;
}

export async function listIgnoredDuplicateLibraryItems(): Promise<IgnoredDuplicateGroup[]> {
  const response = await apiClient.get<IgnoredDuplicateGroup[]>(
    "/api/insights/duplicate-library-items/ignored"
  );
  return response.data;
}

export async function ignoreDuplicateLibraryItems(
  payload: IgnoreDuplicateGroupRequest
): Promise<IgnoredDuplicateGroup> {
  const response = await apiClient.post<IgnoredDuplicateGroup>(
    "/api/insights/duplicate-library-items/ignore",
    payload
  );
  return response.data;
}

export async function unignoreDuplicateLibraryItems(ignoredId: number): Promise<void> {
  await apiClient.post(`/api/insights/duplicate-library-items/ignored/${ignoredId}/unignore`);
}

export async function listMissingAddons(
  filters: GameListFilters = {},
  signal?: AbortSignal
): Promise<MissingAddonsEntry[]> {
  const response = await apiClient.get<MissingAddonsEntry[]>("/api/insights/missing-addons", {
    params: buildGameFilterParams(filters),
    paramsSerializer: { indexes: null },
    signal,
  });
  return response.data;
}

export async function listAccessoriesWithoutOwnedHardware(): Promise<InsightAccessoryRef[]> {
  const response = await apiClient.get<InsightAccessoryRef[]>(
    "/api/insights/accessories-without-owned-hardware"
  );
  return response.data;
}

export async function listOnSale(): Promise<OnSaleItem[]> {
  const response = await apiClient.get<OnSaleItem[]>("/api/insights/on-sale");
  return response.data;
}
