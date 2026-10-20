import { useQuery } from "@tanstack/react-query";
import { getPublicGame, listPublicAccessories, listPublicCollections, listPublicDevices, listPublicFranchises, listPublicGameModes, listPublicGames, listPublicGenres, listPublicPlatforms, listPublicTags, type PublicGameFilters } from "../api/public";
import type { GameSortOption } from "../api/types";

export function usePublicGames(token: string | undefined, filters: PublicGameFilters) {
  return useQuery({
    queryKey: ["public", token, "games", filters],
    queryFn: () => listPublicGames(token!, filters),
    enabled: !!token,
  });
}

export function usePublicTags(token: string | undefined) {
  return useQuery({
    queryKey: ["public", token, "tags"],
    queryFn: () => listPublicTags(token!),
    enabled: !!token,
  });
}

export function usePublicGenres(token: string | undefined) {
  return useQuery({
    queryKey: ["public", token, "genres"],
    queryFn: () => listPublicGenres(token!),
    enabled: !!token,
  });
}

export function usePublicGameModes(token: string | undefined) {
  return useQuery({
    queryKey: ["public", token, "game-modes"],
    queryFn: () => listPublicGameModes(token!),
    enabled: !!token,
  });
}

export function usePublicCollections(token: string | undefined) {
  return useQuery({
    queryKey: ["public", token, "collections"],
    queryFn: () => listPublicCollections(token!),
    enabled: !!token,
  });
}

export function usePublicFranchises(token: string | undefined) {
  return useQuery({
    queryKey: ["public", token, "franchises"],
    queryFn: () => listPublicFranchises(token!),
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
