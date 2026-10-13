import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { SEED_COLOR_HEX } from "./m3Colors";
import { apiClient } from "../api/client";
import { publicClient } from "../api/publicClient";

export const DEFAULT_APP_TITLE = "VideoGameTrackarr";

interface AppearanceContextValue {
  accentColor: string;
  setAccentColor: (hex: string) => void;
  appTitle: string;
  setAppTitle: (title: string) => void;
  resetAppearance: () => void;
}

const AppearanceContext = createContext<AppearanceContextValue>({
  accentColor: SEED_COLOR_HEX,
  setAccentColor: () => {},
  appTitle: DEFAULT_APP_TITLE,
  setAppTitle: () => {},
  resetAppearance: () => {},
});

export const useAppearance = () => useContext(AppearanceContext);

const ACCENT_STORAGE_KEY = "vgt.accentColor";
const TITLE_STORAGE_KEY = "vgt.appTitle";

const HEX_PATTERN = /^#[0-9a-fA-F]{6}$/;

function readStoredAccent(): string {
  const stored = localStorage.getItem(ACCENT_STORAGE_KEY);
  return stored && HEX_PATTERN.test(stored) ? stored : SEED_COLOR_HEX;
}

function readStoredTitle(): string {
  const stored = localStorage.getItem(TITLE_STORAGE_KEY);
  return stored && stored.trim() ? stored : DEFAULT_APP_TITLE;
}

interface AppearanceResponse {
  accentColor: string | null;
  appTitle: string | null;
}

async function fetchAppearance(): Promise<AppearanceResponse | null> {
  try {
    const response = await apiClient.get<AppearanceResponse>("/api/appearance");
    return response.data;
  } catch {
    return null;
  }
}

async function saveAppearance(accentColor: string | null, appTitle: string | null): Promise<void> {
  try {
    await apiClient.put("/api/appearance", {
      accentColor,
      appTitle,
    });
  } catch {
    // Silently fail — localStorage is the fallback
  }
}

export const AppearanceProvider = ({ children }: { children: ReactNode }) => {
  const [accentColor, setAccentColorState] = useState<string>(readStoredAccent);
  const [appTitle, setAppTitleState] = useState<string>(readStoredTitle);
  const [isPublicPage] = useState(() => window.location.pathname.startsWith("/public/"));

  // Fetch from backend on mount (authenticated pages only)
  const { data: serverAppearance } = useQuery({
    queryKey: ["appearance"],
    queryFn: fetchAppearance,
    enabled: !isPublicPage,
    staleTime: 5 * 60 * 1000,
  });

  // Apply server values when they arrive
  useEffect(() => {
    if (serverAppearance) {
      if (serverAppearance.accentColor && HEX_PATTERN.test(serverAppearance.accentColor)) {
        setAccentColorState(serverAppearance.accentColor);
        localStorage.setItem(ACCENT_STORAGE_KEY, serverAppearance.accentColor);
      }
      if (serverAppearance.appTitle && serverAppearance.appTitle.trim()) {
        setAppTitleState(serverAppearance.appTitle);
        localStorage.setItem(TITLE_STORAGE_KEY, serverAppearance.appTitle);
      }
    }
  }, [serverAppearance]);

  // For public pages, fetch the owner's appearance via the share token
  useEffect(() => {
    if (!isPublicPage) return;
    const match = window.location.pathname.match(/^\/public\/([^/]+)/);
    const token = match?.[1];
    if (!token) return;
    publicClient
      .get<{ accentColor: string | null; appTitle: string | null }>(`/api/public/${token}/appearance`)
      .then((response) => {
        const { accentColor: serverAccent, appTitle: serverTitle } = response.data;
        if (serverAccent && HEX_PATTERN.test(serverAccent)) {
          setAccentColorState(serverAccent);
        }
        if (serverTitle && serverTitle.trim()) {
          setAppTitleState(serverTitle);
        }
      })
      .catch(() => {});
  }, [isPublicPage]);

  const setAccentColor = (hex: string) => {
    if (!HEX_PATTERN.test(hex)) return;
    setAccentColorState(hex);
    localStorage.setItem(ACCENT_STORAGE_KEY, hex);
    if (!isPublicPage) {
      saveAppearance(hex, appTitle === DEFAULT_APP_TITLE ? null : appTitle);
    }
  };

  const setAppTitle = (title: string) => {
    const trimmed = title.trim();
    const next = trimmed ? trimmed : DEFAULT_APP_TITLE;
    setAppTitleState(next);
    if (trimmed) {
      localStorage.setItem(TITLE_STORAGE_KEY, trimmed);
    } else {
      localStorage.removeItem(TITLE_STORAGE_KEY);
    }
    if (!isPublicPage) {
      saveAppearance(accentColor === SEED_COLOR_HEX ? null : accentColor, trimmed || null);
    }
  };

  const resetAppearance = () => {
    setAccentColorState(SEED_COLOR_HEX);
    setAppTitleState(DEFAULT_APP_TITLE);
    localStorage.removeItem(ACCENT_STORAGE_KEY);
    localStorage.removeItem(TITLE_STORAGE_KEY);
    if (!isPublicPage) {
      saveAppearance(null, null);
    }
  };

  useEffect(() => {
    document.title = appTitle;
  }, [appTitle]);

  return (
    <AppearanceContext.Provider
      value={{ accentColor, setAccentColor, appTitle, setAppTitle, resetAppearance }}
    >
      {children}
    </AppearanceContext.Provider>
  );
};
