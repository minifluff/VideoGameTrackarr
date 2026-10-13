import { apiClient } from "./client";

export interface ImageSearchResult {
  url: string;
  thumbnail: string;
  title: string;
  width?: number | null;
  height?: number | null;
}

export async function getImageSearchStatus(): Promise<{ configured: boolean }> {
  const response = await apiClient.get<{ configured: boolean }>("/api/images/search/status");
  return response.data;
}

export async function searchImages(query: string, limit = 10): Promise<ImageSearchResult[]> {
  const response = await apiClient.get<ImageSearchResult[]>("/api/images/search", {
    params: { query, limit },
  });
  return response.data;
}
