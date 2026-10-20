import { apiClient } from "./client";
import type { CatalogRef } from "./types";

export async function listGenres(): Promise<CatalogRef[]> {
  const response = await apiClient.get<CatalogRef[]>("/api/genres");
  return response.data;
}
