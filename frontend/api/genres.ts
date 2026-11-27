import { apiClient } from "./client";
import type { GenreResponse } from "./types";

export async function listGenres(): Promise<GenreResponse[]> {
  const response = await apiClient.get<GenreResponse[]>("/api/genres");
  return response.data;
}
