import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createPlatform, deletePlatform, listLibraryPlatforms, listPlatforms, massMoveGames, updatePlatform } from "../api/platforms";

export function usePlatforms() {
  return useQuery({ queryKey: ["platforms"], queryFn: listPlatforms });
}

// Keyed under ["games", ...] (unlike the plain platform list above): the counts change
// whenever a library copy is added, moved or removed, and every one of those mutations
// already invalidates ["games"] (see hooks/useGames.ts).
export function useLibraryPlatforms() {
  return useQuery({ queryKey: ["games", "platforms-library"], queryFn: listLibraryPlatforms });
}

export function useCreatePlatform() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ name, abbreviation }: { name: string; abbreviation?: string | null }) =>
      createPlatform(name, abbreviation),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["platforms"] }),
  });
}

export function useUpdatePlatform() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      platformId,
      name,
      abbreviation,
      slug,
      igdbId,
    }: {
      platformId: number;
      name: string;
      abbreviation?: string | null;
      slug?: string | null;
      igdbId?: number | null;
    }) => updatePlatform(platformId, name, abbreviation, slug, igdbId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platforms"] });
      // A rename changes the platform's name embedded in cached game data — drop the
      // games cache so cards and detail pages reflect the new name.
      queryClient.invalidateQueries({ queryKey: ["games"] });
    },
  });
}

export function useMassMoveGames() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ sourceId, targetId }: { sourceId: number; targetId: number }) =>
      massMoveGames(sourceId, targetId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platforms"] });
      queryClient.invalidateQueries({ queryKey: ["games"] });
      queryClient.invalidateQueries({ queryKey: ["library"] });
    },
  });
}

export function useDeletePlatform() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (platformId: number) => deletePlatform(platformId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platforms"] });
      // Deleting a platform unlinks it from library items — drop cached game data so
      // the change is reflected everywhere.
      queryClient.invalidateQueries({ queryKey: ["games"] });
    },
  });
}
