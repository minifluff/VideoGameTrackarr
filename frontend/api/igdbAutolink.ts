import { apiClient } from "./client";

export interface UnlinkedGame {
  id: number;
  name: string;
}

export interface IGDBAutolinkFailure {
  gameId: number;
  error: string;
}

export interface IGDBAutolinkResult {
  linked: string[];
  noMatch: string[];
  failed: IGDBAutolinkFailure[];
}

export async function getUnlinkedGames(): Promise<UnlinkedGame[]> {
  const response = await apiClient.get<UnlinkedGame[]>("/api/igdb/autolink/unlinked");
  return response.data;
}

export async function autolinkGames(gameIds: number[]): Promise<IGDBAutolinkResult> {
  const response = await apiClient.post<IGDBAutolinkResult>("/api/igdb/autolink", {
    gameIds,
  });
  return response.data;
}
