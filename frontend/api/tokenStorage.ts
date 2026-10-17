import { clearSessionViewState } from "../utils/sessionViewState";

const ACCESS_TOKEN_KEY = "vgt.accessToken";
const REFRESH_TOKEN_KEY = "vgt.refreshToken";
// Marker kept in localStorage (never in sessionStorage) so the app always knows
// which store holds the tokens, even in a fresh tab.
const REMEMBER_ME_KEY = "vgt.rememberMe";
const REMEMBERED_USERNAME_KEY = "vgt.rememberedUsername";

// localStorage, not an httpOnly cookie — the backend (M3) returns tokens in the JSON
// response body rather than setting cookies, so this is the matching client-side half.
// Reasonable for a self-hosted single-admin app; revisit if this ever becomes multi-tenant.
function isRememberMe(): boolean {
  // Default true so sessions issued before the Remember-me checkbox existed keep
  // working out of localStorage instead of being silently dropped.
  return localStorage.getItem(REMEMBER_ME_KEY) !== "0";
}

function tokenStore(): Storage {
  return isRememberMe() ? localStorage : sessionStorage;
}

export const tokenStorage = {
  getAccessToken(): string | null {
    return tokenStore().getItem(ACCESS_TOKEN_KEY);
  },
  getRefreshToken(): string | null {
    return tokenStore().getItem(REFRESH_TOKEN_KEY);
  },
  setTokens(accessToken: string, refreshToken: string, rememberMe: boolean = isRememberMe()): void {
    localStorage.setItem(REMEMBER_ME_KEY, rememberMe ? "1" : "0");
    const store = rememberMe ? localStorage : sessionStorage;
    store.setItem(ACCESS_TOKEN_KEY, accessToken);
    store.setItem(REFRESH_TOKEN_KEY, refreshToken);
  },
  clear(): void {
    // Tokens may live in either store (e.g. the user toggled Remember me between
    // logins), so clear both. The remember-me preference and remembered username
    // deliberately survive a logout — that's what prefills the next login form.
    for (const store of [localStorage, sessionStorage]) {
      store.removeItem(ACCESS_TOKEN_KEY);
      store.removeItem(REFRESH_TOKEN_KEY);
    }
    // A logout (or an expired session) also forgets remembered search/filter/sort state.
    clearSessionViewState();
  },
  isRememberMe,
  getRememberedUsername(): string | null {
    return localStorage.getItem(REMEMBERED_USERNAME_KEY);
  },
  setRememberedUsername(username: string | null): void {
    if (username) {
      localStorage.setItem(REMEMBERED_USERNAME_KEY, username);
    } else {
      localStorage.removeItem(REMEMBERED_USERNAME_KEY);
    }
  },
};
