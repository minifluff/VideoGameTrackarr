// One shared "Show Hidden" preference for the Games, Bookshelf and List
// pages — hidden means hide_from_public (the Hide checkbox on a game's page).
// Off by default: hidden games stay out of the private lists unless the user
// asks to see them. Stored in localStorage so the choice survives reloads
// and follows the user across the three pages (same pattern as the
// bookshelf's Mixed switch).
export const SHOW_HIDDEN_GAMES_KEY = "vgt.showHiddenGames";

export function readStoredShowHidden(): boolean {
  return localStorage.getItem(SHOW_HIDDEN_GAMES_KEY) === "true";
}

export function storeShowHidden(value: boolean): void {
  localStorage.setItem(SHOW_HIDDEN_GAMES_KEY, String(value));
}

// A collection/series is all-hidden when every counted (owned) game in it is
// hidden — a zero-game entry is never all-hidden, so it stays visible.
export function isAllHiddenCatalogRef(entry: { gameCount: number; hiddenGameCount: number }): boolean {
  return entry.gameCount > 0 && entry.hiddenGameCount >= entry.gameCount;
}

// A platform card is all-hidden when every game with a copy on it (owned or
// wishlisted) is hidden.
export function isAllHiddenPlatform(entry: {
  ownedCount: number;
  wishlistedCount: number;
  hiddenGameCount: number;
}): boolean {
  const total = entry.ownedCount + entry.wishlistedCount;
  return total > 0 && entry.hiddenGameCount >= total;
}
