import { apiClient } from "./client";

export interface ResetDatabaseResult {
  gamesDeleted: number;
  libraryItemsDeleted: number;
}

export const resetDatabase = async (confirmation: string): Promise<ResetDatabaseResult> => {
  const { data } = await apiClient.post<ResetDatabaseResult>("/api/system/reset-database", {
    confirmation,
  });
  return data;
};

export interface ClearPlaytimeResult {
  progressDeleted: number;
  sessionsDeleted: number;
}

export const clearPlaytime = async (confirmation: string): Promise<ClearPlaytimeResult> => {
  const { data } = await apiClient.post<ClearPlaytimeResult>("/api/system/clear-playtime", {
    confirmation,
  });
  return data;
};
