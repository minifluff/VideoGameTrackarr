import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { SEED_COLOR_HEX } from "./m3Colors";
import { getAppearance, updateAppearance } from "../api/appearance";

export const DEFAULT_APP_TITLE = "VideoGameTrackarr";
export const DEFAULT_APP_ICON = "default";
export const DEFAULT_ICON_SRC = "/icon-master.svg";
export const DEFAULT_CARD_SIZE = 1.0;

export const APP_ICON_CHOICES = [
  "default", "🎮", "🏆", "⭐", "🎯", "👾", "🕹️",
  "🎲", "🎪", "🚀", "💎", "🔥", "⚡",
] as const;

interface AppearanceContextValue {
  accentColor: string;
  setAccentColor: (hex: string) => void;
  appTitle: string;
  setAppTitle: (title: string) => void;
  appIcon: string;
  setAppIcon: (icon: string) => void;
  cardSize: number;
  setCardSize: (size: number) => void;
  resetAppearance: () => void;
}

const AppearanceContext = createContext<AppearanceContextValue>({
  accentColor: SEED_COLOR_HEX,
  setAccentColor: () => {},
  appTitle: DEFAULT_APP_TITLE,
  setAppTitle: () => {},
  appIcon: DEFAULT_APP_ICON,
  setAppIcon: () => {},
  cardSize: DEFAULT_CARD_SIZE,
  setCardSize: () => {},
  resetAppearance: () => {},
});

export const useAppearance = () => useContext(AppearanceContext);

const ACCENT_STORAGE_KEY = "vgt.accentColor";
const TITLE_STORAGE_KEY = "vgt.appTitle";
const ICON_STORAGE_KEY = "vgt.appIcon";
const CARD_SIZE_STORAGE_KEY = "vgt.cardSize";

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
  if (!stored) return DEFAULT_APP_ICON;
  // Accept preset choices, "default", or data URLs (custom uploads)
  if ((APP_ICON_CHOICES as readonly string[]).includes(stored)) return stored;
  if (stored.startsWith("data:image/")) return stored;
  return DEFAULT_APP_ICON;
}

export function isCustomIconDataUrl(icon: string): boolean {
  return icon.startsWith("data:image/");
}

export function resolveIconSrc(icon: string): string {
  if (icon === "default") return DEFAULT_ICON_SRC;
  if (isCustomIconDataUrl(icon)) return icon;
  return DEFAULT_ICON_SRC; // emoji icons use favicon only, title bar shows SVG fallback
}

function readStoredCardSize(): number {
  const stored = localStorage.getItem(CARD_SIZE_STORAGE_KEY);
  const parsed = stored ? parseFloat(stored) : NaN;
  return !isNaN(parsed) && parsed >= 0.5 && parsed <= 2.0 ? parsed : DEFAULT_CARD_SIZE;
}

function clampCardSize(size: number): number {
  return Math.max(0.5, Math.min(2.0, size));
}

function updateFavicon(icon: string) {
  // Remove existing favicon links
  document.querySelectorAll("link[rel='icon']").forEach((el) => el.remove());

  const link = document.createElement("link");
  link.rel = "icon";

  if (icon === "default") {
    link.type = "image/svg+xml";
    link.href = DEFAULT_ICON_SRC;
  } else if (isCustomIconDataUrl(icon)) {
    // Custom uploaded image — use directly
    link.href = icon;
  } else {
    // Emoji — render as SVG favicon
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">${icon}</text></svg>`;
    link.type = "image/svg+xml";
    link.href = `data:image/svg+xml,${encodeURIComponent(svg)}`;
  }
  document.head.appendChild(link);
}

function updateThemeColor(hex: string) {
  // Keep the browser chrome (Android address bar, PWA status bar) in sync with
  // the user's accent color instead of the hardcoded default.
  let meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute("name", "theme-color");
    document.head.appendChild(meta);
  }
  meta.setAttribute("content", hex);
}

export const AppearanceProvider = ({ children }: { children: ReactNode }) => {
  const [accentColor, setAccentColorState] = useState<string>(readStoredAccent);
  const [appTitle, setAppTitleState] = useState<string>(readStoredTitle);
  const [appIcon, setAppIconState] = useState<string>(readStoredIcon);
  const [cardSize, setCardSizeState] = useState<number>(readStoredCardSize);
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
        if (
          (APP_ICON_CHOICES as readonly string[]).includes(settings.appIcon) ||
          settings.appIcon.startsWith("data:image/")
        ) {
          setAppIconState(settings.appIcon);
          localStorage.setItem(ICON_STORAGE_KEY, settings.appIcon);
        }
        if (typeof settings.cardSize === "number") {
          const clamped = clampCardSize(settings.cardSize);
          setCardSizeState(clamped);
          localStorage.setItem(CARD_SIZE_STORAGE_KEY, String(clamped));
        }
        setLoadedFromServer(true);
      })
      .catch(() => {
        // Offline or not logged in — keep localStorage values
        setLoadedFromServer(true);
      });
  }, []);

  const persist = (patch: { accentColor?: string; appTitle?: string; appIcon?: string; cardSize?: number }) => {
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
    const isValid =
      (APP_ICON_CHOICES as readonly string[]).includes(icon) || isCustomIconDataUrl(icon);
    if (!isValid) return;
    setAppIconState(icon);
    localStorage.setItem(ICON_STORAGE_KEY, icon);
    persist({ appIcon: icon });
  };

  const setCardSize = (size: number) => {
    const clamped = clampCardSize(size);
    setCardSizeState(clamped);
    localStorage.setItem(CARD_SIZE_STORAGE_KEY, String(clamped));
    persist({ cardSize: clamped });
  };

  const resetAppearance = () => {
    setAccentColorState(SEED_COLOR_HEX);
    setAppTitleState(DEFAULT_APP_TITLE);
    setAppIconState(DEFAULT_APP_ICON);
    setCardSizeState(DEFAULT_CARD_SIZE);
    localStorage.removeItem(ACCENT_STORAGE_KEY);
    localStorage.removeItem(TITLE_STORAGE_KEY);
    localStorage.removeItem(ICON_STORAGE_KEY);
    localStorage.removeItem(CARD_SIZE_STORAGE_KEY);
    persist({
      accentColor: SEED_COLOR_HEX,
      appTitle: DEFAULT_APP_TITLE,
      appIcon: DEFAULT_APP_ICON,
      cardSize: DEFAULT_CARD_SIZE,
    });
  };

  useEffect(() => {
    document.title = appTitle;
  }, [appTitle]);

  useEffect(() => {
    updateFavicon(appIcon);
  }, [appIcon]);

  useEffect(() => {
    updateThemeColor(accentColor);
  }, [accentColor]);

  return (
    <AppearanceContext.Provider
      value={{ accentColor, setAccentColor, appTitle, setAppTitle, appIcon, setAppIcon, cardSize, setCardSize, resetAppearance }}
    >
      {children}
    </AppearanceContext.Provider>
  );
};
