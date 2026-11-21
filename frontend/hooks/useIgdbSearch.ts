import { useQuery } from "@tanstack/react-query";
import { getIgdbGamePreview, searchIgdb } from "../api/igdb";

// A bare IGDB id (or an igdb:123 paste) is an exact lookup — it needs no
// minimum length, unlike a fuzzy name search. Mirrors the backend's
// _IGDB_ID_QUERY_PATTERN (app/api/routes/igdb.py); the Add Game page and the
// link dialog use this to decide when a short query is already searchable.
export const IGDB_ID_QUERY_PATTERN = /^(?:igdb:)?\d+$/i;

export function isIgdbIdQuery(query: string): boolean {
  return IGDB_ID_QUERY_PATTERN.test(query.trim());
}

export function useIgdbSearch(query: string, categoryScope: "game" | "addon" = "game") {
  return useQuery({
    queryKey: ["igdb-search", query, categoryScope],
    queryFn: ({ signal }) => searchIgdb(query, signal, categoryScope),
    enabled: query.trim().length > 2 || isIgdbIdQuery(query),
    staleTime: 60_000,
  });
}

export function useIgdbGamePreview(igdbId: number) {
  return useQuery({
    queryKey: ["igdb-preview", igdbId],
    queryFn: () => getIgdbGamePreview(igdbId),
    enabled: Number.isFinite(igdbId),
    // IGDB data for a game barely changes within a session; don't refetch on every visit.
    staleTime: 10 * 60_000,
    retry: false,
  });
}
