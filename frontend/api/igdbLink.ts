import { apiClient } from "./client";
import type { IgdbLinkStatus } from "./types";

export async function startIgdbLink(): Promise<IgdbLinkStatus> {
  const response = await apiClient.post<IgdbLinkStatus>("/api/igdb-link/start");
  return response.data;
}

export async function fetchIgdbLinkStatus(): Promise<IgdbLinkStatus> {
  const response = await apiClient.get<IgdbLinkStatus>("/api/igdb-link/status");
  return response.data;
}

export async function acknowledgeIgdbLinkStatus(): Promise<void> {
  await apiClient.post("/api/igdb-link/status/acknowledge");
}
