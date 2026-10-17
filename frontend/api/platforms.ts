import { apiClient } from "./client";
import { buildGameFilterParams, type GameListFilters } from "./games";
import type { CatalogBrowseResult, GameSummary, LibraryPlatform, PlatformResponse } from "./types";

export async function listPlatforms(): Promise<PlatformResponse[]> {
  const response = await apiClient.get<PlatformResponse[]>("/api/platforms");
  return response.data;
}

export async function listLibraryPlatforms(): Promise<LibraryPlatform[]> {
  const response = await apiClient.get<LibraryPlatform[]>("/api/platforms/library");
  return response.data;
}

export async function getPlatform(slug: string): Promise<CatalogBrowseResult> {
  const response = await apiClient.get<CatalogBrowseResult>(`/api/platforms/${slug}`);
  return response.data;
}

export async function listPlatformAddons(
  slug: string,
  filters: GameListFilters = {},
  signal?: AbortSignal
): Promise<GameSummary[]> {
  const response = await apiClient.get<GameSummary[]>(`/api/platforms/${slug}/addons`, {
    params: buildGameFilterParams(filters),
    paramsSerializer: { indexes: null },
    signal,
  });
  return response.data;
}

export async function createPlatform(
  name: string,
  abbreviation?: string | null,
  slug?: string | null,
  igdbId?: number | null
): Promise<PlatformResponse> {
  const response = await apiClient.post<PlatformResponse>("/api/platforms", {
    name,
    abbreviation,
    slug,
    igdbId,
  });
  return response.data;
}

export async function updatePlatform(
  platformId: number,
  name: string,
  abbreviation?: string | null,
  slug?: string | null,
  igdbId?: number | null
): Promise<PlatformResponse> {
  const response = await apiClient.patch<PlatformResponse>(`/api/platforms/${platformId}`, {
    name,
    abbreviation,
    slug,
    igdbId,
  });
  return response.data;
}

export async function deletePlatform(platformId: number): Promise<void> {
  await apiClient.delete(`/api/platforms/${platformId}`);
}

export async function massMoveGames(sourceId: number, targetId: number): Promise<{ moved_count: number }> {
  const response = await apiClient.post<{ moved_count: number }>(
    `/api/platforms/${sourceId}/move-to/${targetId}`
  );
  return response.data;
}
