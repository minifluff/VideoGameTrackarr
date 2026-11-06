import { apiClient } from "./client";

export interface RetroAchievementsStatus {
  configured: boolean;
  username: string | null;
  apiKeyConfigured: boolean;
}

export interface RAProfile {
  username: string;
  userPicUrl: string | null;
  motto: string | null;
  memberSince: string | null;
  richPresence: string | null;
  totalPoints: number;
  totalSoftcorePoints: number;
  totalTruePoints: number;
}

export interface RARecentlyPlayedGame {
  gameId: number;
  consoleName: string;
  title: string;
  imageIconUrl: string | null;
  imageBoxArtUrl: string | null;
  lastPlayed: string | null;
  numPossibleAchievements: number;
  numAchieved: number;
  numAchievedHardcore: number;
  possibleScore: number;
  scoreAchieved: number;
}

export interface RARecentAchievement {
  achievementId: number;
  title: string;
  description: string | null;
  badgeUrl: string | null;
  points: number;
  trueRatio: number;
  hardcore: boolean;
  dateEarned: string | null;
  gameId: number;
  gameTitle: string;
  gameIconUrl: string | null;
  consoleName: string;
}

export interface RetroAchievementsSummary {
  profile: RAProfile;
  recentlyPlayed: RARecentlyPlayedGame[];
  recentAchievements: RARecentAchievement[];
}

export interface RAGameAchievement {
  achievementId: number;
  title: string;
  description: string | null;
  badgeUrl: string | null;
  points: number;
  trueRatio: number;
  displayOrder: number;
  numAwarded: number;
  dateEarned: string | null;
  dateEarnedHardcore: string | null;
}

export interface RAGameUserProgress {
  gameId: number;
  title: string;
  consoleName: string;
  imageIconUrl: string | null;
  imageBoxArtUrl: string | null;
  numAchieved: number;
  numPossibleAchievements: number;
  scoreAchieved: number;
  possibleScore: number;
  achievements: RAGameAchievement[];
}

export async function getRetroAchievementsStatus(): Promise<RetroAchievementsStatus> {
  const response = await apiClient.get<RetroAchievementsStatus>("/api/achievements/status");
  return response.data;
}

export async function updateRetroAchievementsSettings(
  username: string | null,
  apiKey?: string | null,
): Promise<RetroAchievementsStatus> {
  const response = await apiClient.put<RetroAchievementsStatus>("/api/achievements/settings", {
    username,
    // Undefined omits the key entirely (keeps the saved one); "" clears it.
    ...(apiKey === undefined ? {} : { apiKey }),
  });
  return response.data;
}

export async function getRetroAchievementsSummary(
  refresh = false,
): Promise<RetroAchievementsSummary> {
  const response = await apiClient.get<RetroAchievementsSummary>("/api/achievements/summary", {
    params: refresh ? { refresh: true } : undefined,
  });
  return response.data;
}

export async function getRetroAchievementsGameProgress(
  gameId: number,
  refresh = false,
): Promise<RAGameUserProgress> {
  const response = await apiClient.get<RAGameUserProgress>(
    `/api/achievements/game/${gameId}`,
    { params: refresh ? { refresh: true } : undefined },
  );
  return response.data;
}
