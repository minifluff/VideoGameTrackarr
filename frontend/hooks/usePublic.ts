import { useQuery } from "@tanstack/react-query";
import { getPublicGame, listPublicAccessories, listPublicDevices, listPublicGames, listPublicPlatforms } from "../api/public";
import type { GameSortOption } from "../api/types";

export function usePublicGames(token: string | undefined, search?: string, sort?: GameSortOption, platformIds?: number[]) {
  return useQuery({
    queryKey: ["public", token, "games", search, sort, platformIds],
    queryFn: () => listPublicGames(token!, search, sort, platformIds),
    enabled: !!token,
  });
}

export function usePublicPlatforms(token: string | undefined) {
  return useQuery({
    queryKey: ["public", token, "platforms"],
    queryFn: () => listPublicPlatforms(token!),
    enabled: !!token,
  });
}

export function usePublicGame(token: string | undefined, gameId: number) {
  return useQuery({
    queryKey: ["public", token, "game", gameId],
    queryFn: () => getPublicGame(token!, gameId),
    enabled: !!token && Number.isFinite(gameId),
  });
}

export function usePublicDevices(token: string | undefined, search?: string) {
  return useQuery({
    queryKey: ["public", token, "devices", search],
    queryFn: () => listPublicDevices(token!, search),
    enabled: !!token,
  });
}

export function usePublicAccessories(token: string | undefined, search?: string) {
  return useQuery({
    queryKey: ["public", token, "accessories", search],
    queryFn: () => listPublicAccessories(token!, search),
    enabled: !!token,
  });
}
