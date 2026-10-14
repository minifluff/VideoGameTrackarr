import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { SEED_COLOR_HEX } from "./m3Colors";
import { getAppearance, updateAppearance } from "../api/appearance";

export const DEFAULT_APP_TITLE = "VideoGameTrackarr";
export const DEFAULT_APP_ICON = "🎮";

export const APP_ICON_CHOICES = [
  "🎮", "🏆", "⭐", "🎯", "👾", "🕹️",
  "🎲", "🎪", "🚀", "💎", "🔥", "⚡",
] as const;

interface AppearanceContextValue {
  accentColor: string;
  setAccentColor: (hex: string) => void;
  appTitle: string;
  setAppTitle: (title: string) => void;
  appIcon: string;
  setAppIcon: (icon: string) => void;
  resetAppearance: () => void;
}

const AppearanceContext = createContext<AppearanceContextValue>({
  accentColor: SEED_COLOR_HEX,
  setAccentColor: () => {},
  appTitle: DEFAULT_APP_TITLE,
  setAppTitle: () => {},
  appIcon: DEFAULT_APP_ICON,
  setAppIcon: () => {},
  resetAppearance: () => {},
});

export const useAppearance = () => useContext(AppearanceContext);

const ACCENT_STORAGE_KEY = "vgt.accentColor";
const TITLE_STORAGE_KEY = "vgt.appTitle";
const ICON_STORAGE_KEY = "vgt.appIcon";

const HEX_PATTERN = /^#[0-9a-fA-F]{6}$/;

function readStoredAccent(): string {
  const stored = localStorage.getItem(ACCENT_STORAGE_KEY);
  return stored && HEX_PATTERN.test(stored) ? stored : SEED_COLOR_HEX;
}

function readStoredTitle(): string {
  const stored = localStorage.getItem(TITLE_STORAGE_KEY);
  return stored && stored.trim() ? stored : DEFAULT_APP_TITLE;
}

function readStoredIcon(): string {
  const stored = localStorage.getItem(ICON_STORAGE_KEY);
  return stored && (APP_ICON_CHOICES as readonly string[]).includes(stored)
    ? stored
    : DEFAULT_APP_ICON;
}

function updateFavicon(icon: string) {
  // Render emoji as SVG favicon
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">${icon}</text></svg>`;
  const url = `data:image/svg+xml,${encodeURIComponent(svg)}`;

  let link = document.querySelector<HTMLLinkElement>("link[rel='icon'][type='image/svg+xml']");
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    link.type = "image/svg+xml";
    document.head.appendChild(link);
  }
  link.href = url;
}

export const AppearanceProvider = ({ children }: { children: ReactNode }) => {
  const [accentColor, setAccentColorState] = useState<string>(readStoredAccent);
  const [appTitle, setAppTitleState] = useState<string>(readStoredTitle);
  const [appIcon, setAppIconState] = useState<string>(readStoredIcon);
  const [loadedFromServer, setLoadedFromServer] = useState(false);

  // Load from server on mount (overrides localStorage if different)
  useEffect(() => {
    getAppearance()
      .then((settings) => {
        if (HEX_PATTERN.test(settings.accentColor)) {
          setAccentColorState(settings.accentColor);
          localStorage.setItem(ACCENT_STORAGE_KEY, settings.accentColor);
        }
        if (settings.appTitle.trim()) {
          setAppTitleState(settings.appTitle);
          localStorage.setItem(TITLE_STORAGE_KEY, settings.appTitle);
        }
        if ((APP_ICON_CHOICES as readonly string[]).includes(settings.appIcon)) {
          setAppIconState(settings.appIcon);
          localStorage.setItem(ICON_STORAGE_KEY, settings.appIcon);
        }
        setLoadedFromServer(true);
      })
      .catch(() => {
        // Offline or not logged in — keep localStorage values
        setLoadedFromServer(true);
      });
  }, []);

  const persist = (patch: { accentColor?: string; appTitle?: string; appIcon?: string }) => {
    if (!loadedFromServer) return; // don't overwrite server before we've loaded
    updateAppearance(patch).catch(() => {
      // Server save failed — localStorage already updated, will retry next change
    });
  };

  const setAccentColor = (hex: string) => {
    if (!HEX_PATTERN.test(hex)) return;
    setAccentColorState(hex);
    localStorage.setItem(ACCENT_STORAGE_KEY, hex);
    persist({ accentColor: hex });
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
    persist({ appTitle: next });
  };

  const setAppIcon = (icon: string) => {
    if (!(APP_ICON_CHOICES as readonly string[]).includes(icon)) return;
    setAppIconState(icon);
    localStorage.setItem(ICON_STORAGE_KEY, icon);
    persist({ appIcon: icon });
  };

  const resetAppearance = () => {
    setAccentColorState(SEED_COLOR_HEX);
    setAppTitleState(DEFAULT_APP_TITLE);
    setAppIconState(DEFAULT_APP_ICON);
    localStorage.removeItem(ACCENT_STORAGE_KEY);
    localStorage.removeItem(TITLE_STORAGE_KEY);
    localStorage.removeItem(ICON_STORAGE_KEY);
    persist({
      accentColor: SEED_COLOR_HEX,
      appTitle: DEFAULT_APP_TITLE,
      appIcon: DEFAULT_APP_ICON,
    });
  };

  useEffect(() => {
    document.title = appTitle;
  }, [appTitle]);

  useEffect(() => {
    updateFavicon(appIcon);
  }, [appIcon]);

  return (
    <AppearanceContext.Provider
      value={{ accentColor, setAccentColor, appTitle, setAppTitle, appIcon, setAppIcon, resetAppearance }}
    >
      {children}
    </AppearanceContext.Provider>
  );
};
