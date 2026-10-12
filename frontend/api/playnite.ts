import { apiClient } from "./client";

export interface PlayniteConfig {
  smbPath: string | null;
  smbUsername: string | null;
  hasPassword: boolean;
}

export interface PlayniteEntry {
  playniteId: string;
  playniteName: string;
  playnitePlatform: string | null;
  playtimeMinutes: number;
  playniteTags: string | null;
  status: "no_match" | "new" | "up_to_date" | "ignored";
  gameId: number | null;
  gameName: string | null;
  dismissed: boolean;
}

export interface PlayniteScanResult {
  scanned: number;
  newCount: number;
}

export interface PlayniteSyncResult {
  synced: number;
  failures: { playniteId: string; error: string }[];
}

export async function getPlayniteConfig(): Promise<PlayniteConfig> {
  const response = await apiClient.get<PlayniteConfig>("/api/integrations/playnite");
  return response.data;
}

export async function updatePlayniteConfig(config: {
  smbPath: string | null;
  smbUsername: string | null;
  smbPassword: string | null;
}): Promise<PlayniteConfig> {
  const response = await apiClient.put<PlayniteConfig>("/api/integrations/playnite", config);
  return response.data;
}

export async function testPlayniteConnection(config: {
  smbPath: string | null;
  smbUsername: string | null;
  smbPassword: string | null;
}): Promise<{ ok: boolean; message: string }> {
  const response = await apiClient.post<{ ok: boolean; message: string }>(
    "/api/integrations/playnite/test",
    config
  );
  return response.data;
}

export async function scanPlayniteLibrary(): Promise<PlayniteScanResult> {
  const response = await apiClient.post<PlayniteScanResult>("/api/integrations/playnite/scan");
  return response.data;
}

export async function listPlayniteEntries(): Promise<PlayniteEntry[]> {
  const response = await apiClient.get<PlayniteEntry[]>("/api/integrations/playnite/entries");
  return response.data;
}

export async function syncPlayniteEntries(playniteIds: string[]): Promise<PlayniteSyncResult> {
  const response = await apiClient.post<PlayniteSyncResult>("/api/integrations/playnite/sync", {
    playniteIds,
  });
  return response.data;
}

export async function ignorePlayniteEntry(playniteId: string): Promise<void> {
  await apiClient.post(`/api/integrations/playnite/${playniteId}/ignore`);
}

export async function unignorePlayniteEntry(playniteId: string): Promise<void> {
  await apiClient.post(`/api/integrations/playnite/${playniteId}/unignore`);
}
