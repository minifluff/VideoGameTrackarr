import { apiClient } from "./client";
import type { CatalogResyncStatus } from "./types";

export async function startCollectionResync(slug: string): Promise<CatalogResyncStatus> {
  const response = await apiClient.post<CatalogResyncStatus>(`/api/collections/${encodeURIComponent(slug)}/resync`);
  return response.data;
}

export async function startFranchiseResync(slug: string): Promise<CatalogResyncStatus> {
  const response = await apiClient.post<CatalogResyncStatus>(`/api/franchises/${encodeURIComponent(slug)}/resync`);
  return response.data;
}

export async function fetchCatalogResyncStatus(): Promise<CatalogResyncStatus> {
  const response = await apiClient.get<CatalogResyncStatus>("/api/catalog-resync/status");
  return response.data;
}

export async function acknowledgeCatalogResyncStatus(): Promise<void> {
  await apiClient.post("/api/catalog-resync/status/acknowledge");
}
