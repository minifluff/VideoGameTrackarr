import { apiClient } from "./client";

export interface DisplayModeSlide {
  id: number;
  name: string;
  coverUrl: string;
}

export interface DisplayModeSettings {
  slideIntervalSeconds: number;
  showTitle: boolean;
  showHidden: boolean;
  showWishlisted: boolean;
}

export async function fetchDisplayModeSlides(limit = 200): Promise<DisplayModeSlide[]> {
  const response = await apiClient.get<DisplayModeSlide[]>("/api/display-mode/slides", {
    params: { limit },
  });
  return response.data;
}

export async function fetchDisplayModeSettings(): Promise<DisplayModeSettings> {
  const response = await apiClient.get<DisplayModeSettings>("/api/settings/display-mode");
  return response.data;
}

export async function updateDisplayModeSettings(
  settings: Partial<DisplayModeSettings>,
): Promise<DisplayModeSettings> {
  const response = await apiClient.put<DisplayModeSettings>("/api/settings/display-mode", settings);
  return response.data;
}
