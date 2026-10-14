import { publicClient } from "./publicClient";
import type {
  GameSortOption,
  PublicAccessorySummary,
  PublicDeviceSummary,
  PublicGameDetail,
  PublicGameSummary,
} from "./types";

export interface PublicGameFilters {
  search?: string;
  sort?: GameSortOption;
  platformIds?: number[];
  platformExclude?: boolean;
  tagIds?: number[];
  tagExclude?: boolean;
  collectionIds?: number[];
  collectionExclude?: boolean;
  franchiseIds?: number[];
  franchiseExclude?: boolean;
  formats?: string[];
  formatExclude?: boolean;
  playStatuses?: string[];
  playStatusExclude?: boolean;
  steelbookOnly?: boolean;
}

export async function listPublicGames(
  token: string,
  filters: PublicGameFilters = {},
): Promise<PublicGameSummary[]> {
  const params: Record<string, unknown> = {
    search: filters.search || undefined,
    sort: filters.sort,
    platformId: filters.platformIds?.length ? filters.platformIds : undefined,
    platformExclude: filters.platformExclude || undefined,
    tagId: filters.tagIds?.length ? filters.tagIds : undefined,
    tagExclude: filters.tagExclude || undefined,
    collectionId: filters.collectionIds?.length ? filters.collectionIds : undefined,
    collectionExclude: filters.collectionExclude || undefined,
    franchiseId: filters.franchiseIds?.length ? filters.franchiseIds : undefined,
    franchiseExclude: filters.franchiseExclude || undefined,
    format: filters.formats?.length ? filters.formats : undefined,
    formatExclude: filters.formatExclude || undefined,
    playStatus: filters.playStatuses?.length ? filters.playStatuses : undefined,
    playStatusExclude: filters.playStatusExclude || undefined,
    steelbookOnly: filters.steelbookOnly || undefined,
  };
  const response = await publicClient.get<PublicGameSummary[]>(`/api/public/${token}/games`, {
    params,
    paramsSerializer: { indexes: null },
  });
  return response.data;
}

export async function getPublicGame(token: string, gameId: number): Promise<PublicGameDetail> {
  const response = await publicClient.get<PublicGameDetail>(`/api/public/${token}/games/${gameId}`);
  return response.data;
}

export async function listPublicDevices(token: string, search?: string): Promise<PublicDeviceSummary[]> {
  const response = await publicClient.get<PublicDeviceSummary[]>(`/api/public/${token}/devices`, {
    params: { search: search || undefined },
  });
  return response.data;
}

export async function listPublicAccessories(token: string, search?: string): Promise<PublicAccessorySummary[]> {
  const response = await publicClient.get<PublicAccessorySummary[]>(`/api/public/${token}/accessories`, {
    params: { search: search || undefined },
  });
  return response.data;
}

export async function listPublicTags(token: string): Promise<{ id: number; name: string }[]> {
  const response = await publicClient.get<{ id: number; name: string }[]>(`/api/public/${token}/tags`);
  return response.data;
}

export async function listPublicCollections(token: string): Promise<{ id: number; name: string }[]> {
  const response = await publicClient.get<{ id: number; name: string }[]>(`/api/public/${token}/collections`);
  return response.data;
}

export async function listPublicFranchises(token: string): Promise<{ id: number; name: string }[]> {
  const response = await publicClient.get<{ id: number; name: string }[]>(`/api/public/${token}/franchises`);
  return response.data;
}

export async function listPublicPlatforms(token: string): Promise<{ id: number; name: string }[]> {
  const response = await publicClient.get<{ id: number; name: string }[]>(`/api/public/${token}/platforms`);
  return response.data;
}
