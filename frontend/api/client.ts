import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";
import { tokenStorage } from "./tokenStorage";

const isDevelopmentServer =
  window.location.hostname === "localhost" && window.location.port === "3000";

// Dev: Vite serves the frontend on :3000, FastAPI runs separately on :8000. Prod: FastAPI
// serves the built frontend itself, so they're the same origin (see "Deploying with
// Docker" in the root README).
export const API_BASE_URL = isDevelopmentServer ? "http://localhost:8000" : window.location.origin;

export const apiClient = axios.create({ baseURL: API_BASE_URL });

// Locally-uploaded covers/images are stored as a relative `/uploads/...` path (see
// upload_service.py) — fine in prod where the frontend and API share an origin, but in dev
// the frontend runs on :3000 while the API (and its static /uploads mount) is on :8000, so a
// bare relative path 404s against the dev server. IGDB covers are already absolute https
// URLs and pass through unchanged.
export function resolveAssetUrl(url: string | null): string | null {
  if (!url || /^https?:\/\//i.test(url)) {
    return url;
  }
  // Protocol-relative (//images.igdb.com/...) — rows stored before the backend started
  // normalizing IGDB URLs to https still carry this form, and prepending the API origin
  // below would turn them into a same-origin 404 ({origin}//images.igdb.com/...).
  // Same treatment as the backend's _normalize_image_url.
  if (url.startsWith("//")) {
    return `https:${url}`;
  }
  return url.startsWith("/") ? `${API_BASE_URL}${url}` : `${API_BASE_URL}/${url}`;
}

apiClient.interceptors.request.use((config) => {
  const token = tokenStorage.getAccessToken();
  if (token) {
    config.headers.set("Authorization", `Bearer ${token}`);
  }
  return config;
});

interface RetryableConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

interface PendingRequest {
  config: RetryableConfig;
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
}

let isRefreshing = false;
let pendingRequests: PendingRequest[] = [];

function isPublicRoute(): boolean {
  return window.location.pathname.startsWith("/public/");
}

// Only the login and refresh endpoints themselves must never trigger a refresh:
// a 401 there means bad credentials or an already-dead refresh token, and
// retrying would loop. Every other endpoint refreshes normally — including
// /api/auth/me, which the Dashboard calls on every cold start. The old blanket
// skip for all of /api/auth/* meant an expired access token on that first /me
// call signed the user out on every return after 15 idle minutes, throwing
// away a perfectly valid refresh token instead of using it.
export function shouldSkipTokenRefresh(url: string | undefined): boolean {
  return url?.startsWith("/api/auth/login") === true || url?.startsWith("/api/auth/refresh") === true;
}

function redirectToLogin(): void {
  // Never redirect away from public share pages — they're deliberately unauthenticated.
  if (isPublicRoute()) {
    return;
  }
  tokenStorage.clear();
  if (window.location.pathname !== "/login") {
    window.location.assign("/login");
  }
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetryableConfig | undefined;

    if (error.response?.status !== 401 || !originalRequest || originalRequest._retry) {
      return Promise.reject(error);
    }

    // Public routes are deliberately unauthenticated (gated by share token) — never
    // redirect to login for them. A 401 here means a bad/expired share token.
    if (originalRequest.url?.startsWith("/api/public/")) {
      return Promise.reject(error);
    }

    if (shouldSkipTokenRefresh(originalRequest.url)) {
      redirectToLogin();
      return Promise.reject(error);
    }

    const refreshToken = tokenStorage.getRefreshToken();
    if (!refreshToken) {
      redirectToLogin();
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        pendingRequests.push({ config: originalRequest, resolve, reject });
      });
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      const response = await axios.post<{ accessToken: string; refreshToken: string }>(
        `${API_BASE_URL}/api/auth/refresh`,
        { refreshToken }
      );
      const { accessToken, refreshToken: newRefreshToken } = response.data;
      tokenStorage.setTokens(accessToken, newRefreshToken);

      pendingRequests.forEach(({ config, resolve, reject }) => {
        config.headers.set("Authorization", `Bearer ${accessToken}`);
        apiClient.request(config).then(resolve).catch(reject);
      });
      pendingRequests = [];

      originalRequest.headers.set("Authorization", `Bearer ${accessToken}`);
      return apiClient.request(originalRequest);
    } catch (refreshError) {
      pendingRequests.forEach(({ reject }) => reject(refreshError));
      pendingRequests = [];
      redirectToLogin();
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);
