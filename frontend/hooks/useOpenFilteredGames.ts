import { useNavigate } from "react-router-dom";
import type { MatchAllFilters } from "../api/games";
import type { GameCategory, MediaFormat, PlayStatus, ReleaseStatus } from "../api/types";
import type { OwnershipStatus, TimeToBeatRange } from "../components/GameListToolbar";
import { writeSessionValue } from "../utils/sessionViewState";

// Every filter a game list remembers, at its cleared value (the sort is left as it is).
// Mirrors the fields GameList keeps in session state (see components/GameList.tsx) —
// upstream's version has sources/screensaver/includeAddons instead of the fork's
// genre/gameModes fields, which is why this lives here instead of being a verbatim port.
const CLEARED_FILTERS = {
  searchKeyword: "",
  ownershipStatuses: [] as OwnershipStatus[],
  ownershipExclude: false,
  platformIds: [] as number[],
  platformScopes: [] as string[],
  platformExclude: false,
  tagIds: [] as number[],
  tagExclude: false,
  genreIds: [] as number[],
  genreExclude: false,
  releaseStatuses: [] as ReleaseStatus[],
  releaseYearFrom: null as number | null,
  releaseYearTo: null as number | null,
  localPlayersMin: null as number | null,
  onlineMultiplayerOnly: false,
  coopOnly: false,
  timeToBeat: null as TimeToBeatRange | null,
  ratingMin: null as number | null,
  gameModes: [] as string[],
  gameModeExclude: false,
  collectionIds: [] as number[],
  collectionExclude: false,
  franchiseIds: [] as number[],
  franchiseExclude: false,
  gameTypes: [] as GameCategory[],
  gameTypeExclude: false,
  formats: [] as MediaFormat[],
  formatExclude: false,
  storefronts: [] as string[],
  storefrontExclude: false,
  playStatuses: [] as PlayStatus[],
  playStatusExclude: false,
  matchAll: {} as MatchAllFilters,
  steelbookOnly: false,
};

export type GameListPreset = Partial<typeof CLEARED_FILTERS>;

// Replaces a game list's remembered filters with just `preset`, before opening it —
// the same as setting that one filter by hand on a cleared list.
export function presetGameListFilters(prefix: string, preset: GameListPreset): void {
  for (const [name, cleared] of Object.entries(CLEARED_FILTERS)) {
    writeSessionValue(`${prefix}.${name}`, (preset as Record<string, unknown>)[name] ?? cleared);
  }
}

// Opens the Games list with just this filter set, replacing the session's remembered filters
// (Insights' breakdown rows).
export function useOpenFilteredGames() {
  const navigate = useNavigate();
  return (preset: GameListPreset) => {
    presetGameListFilters("games", preset);
    navigate("/games");
  };
}
