import { apiClient } from "./client";

export interface AppearanceSettings {
  accentColor: string;
  appTitle: string;
  appIcon: string;
}

export async function getAppearance(): Promise<AppearanceSettings> {
  const response = await apiClient.get<AppearanceSettings>("/api/settings/appearance");
  return response.data;
}

export async function updateAppearance(
  settings: Partial<AppearanceSettings>
): Promise<AppearanceSettings> {
  const response = await apiClient.put<AppearanceSettings>("/api/settings/appearance", settings);
  return response.data;
}
