import { apiClient } from "./client";

export async function listGameModes(): Promise<string[]> {
  const response = await apiClient.get<string[]>("/api/game-modes");
  return response.data;
}
