import { apiClient } from "./client";

export async function getShareLink(): Promise<string> {
  const response = await apiClient.get<{ token: string }>("/api/share-link");
  return response.data.token;
}

// Unauthenticated: the login screen resolves the public collection link before
// anyone has signed in. Null when no admin account or no share link exists yet.
export async function getPublicCollectionLink(): Promise<string | null> {
  const response = await apiClient.get<{ token: string | null }>("/api/public-collection-link");
  return response.data.token;
}

export async function regenerateShareLink(): Promise<string> {
  const response = await apiClient.post<{ token: string }>("/api/share-link/regenerate");
  return response.data.token;
}
