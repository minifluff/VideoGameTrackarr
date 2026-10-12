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
