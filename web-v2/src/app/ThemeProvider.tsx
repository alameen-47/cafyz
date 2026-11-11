import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { storageGet, storageSet } from "../utils/safeStorage";
import { applyStatusBarLook } from "../utils/statusBarLook";

export type ThemeMode = "dark" | "light";

/** The dark themes. Each is the same interface in another colour family (see theme-palettes.css). */
export type DarkPalette = "violet" | "ocean" | "emerald" | "ember";

/** What the person picks on the Account screen: one of the dark themes, or the light one. */
export type ThemeId = DarkPalette | "daylight";

export interface ThemeOption {
  id: ThemeId;
  name: string;
  description: string;
  /** Colours for the picker's preview: ground, card, accent start and end, text. */
  preview: { bg: string; card: string; from: string; to: string; text: string; muted: string };
}

export const THEME_OPTIONS: ThemeOption[] = [
  {
    id: "violet", name: "Violet Night", description: "Midnight navy with violet light. The Cafyz default.",
    preview: { bg: "#080619", card: "#171239", from: "#a020f0", to: "#6c35ff", text: "#f5f2ff", muted: "#a6a0c7" },
  },
  {
    id: "ocean", name: "Midnight Blue", description: "Deep sea navy with electric blue.",
    preview: { bg: "#071018", card: "#142737", from: "#1f67e7", to: "#3191f6", text: "#f3f8fe", muted: "#a0b6c7" },
  },
  {
    id: "emerald", name: "Emerald", description: "Dark forest green with a gold accent.",
    preview: { bg: "#081710", card: "#163527", from: "#159472", to: "#0db273", text: "#f3fefa", muted: "#a2c5b8" },
  },
  {
    id: "ember", name: "Ember", description: "Warm espresso with a copper glow.",
    preview: { bg: "#180a07", card: "#371a14", from: "#d95c1c", to: "#f15024", text: "#fef5f3", muted: "#c7a9a1" },
  },
  {
    id: "daylight", name: "Daylight", description: "Bright and clean, for well-lit rooms.",
    preview: { bg: "#f4f2fb", card: "#ffffff", from: "#a020f0", to: "#6c35ff", text: "#160f33", muted: "#5b5580" },
  },
];

/**
 * The app opens in the dark palette. The mode key is new with that redesign: the old one held
 * "light" for everyone, because the old default was saved on first launch.
 */
const MODE_KEY = "cafyz_theme_mode";
const PALETTE_KEY = "cafyz_theme_palette";
const DARK_PALETTES: DarkPalette[] = ["violet", "ocean", "emerald", "ember"];

interface ThemeCtx {
  /** Light or dark, for code that only cares about that. */
  theme: ThemeMode;
  setTheme: (mode: ThemeMode) => void;
  /** Switches between the light theme and the dark theme last used. */
  toggleTheme: () => void;
  /** The theme picked on the Account screen. */
  themeId: ThemeId;
  setThemeId: (id: ThemeId) => void;
}

const Ctx = createContext<ThemeCtx | null>(null);

/** Dark is the default; light only when the user has picked it. */
function readStoredMode(): ThemeMode {
  if (typeof window === "undefined") return "dark";
  return storageGet(MODE_KEY) === "light" ? "light" : "dark";
}

function readStoredPalette(): DarkPalette {
  if (typeof window === "undefined") return "violet";
  const stored = storageGet(PALETTE_KEY) as DarkPalette | null;
  return stored && DARK_PALETTES.includes(stored) ? stored : "violet";
}

function applyThemeToDocument(mode: ThemeMode, palette: DarkPalette) {
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  root.classList.add(mode);
  root.dataset.theme = mode;
  root.dataset.palette = palette;
  root.style.colorScheme = mode;
  storageSet(MODE_KEY, mode);
  storageSet(PALETTE_KEY, palette);
  // Status bar and browser theme colour follow the theme, unless a screen
  // with its own top colour (the sign-in photo) is showing.
  applyStatusBarLook();
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(readStoredMode);
  const [palette, setPalette] = useState<DarkPalette>(readStoredPalette);

  useEffect(() => {
    applyThemeToDocument(mode, palette);
  }, [mode, palette]);

  const setTheme = useCallback((next: ThemeMode) => setMode(next), []);
  const toggleTheme = useCallback(() => {
    setMode(prev => (prev === "dark" ? "light" : "dark"));
  }, []);
  const setThemeId = useCallback((id: ThemeId) => {
    if (id === "daylight") {
      setMode("light");
      return;
    }
    setPalette(id);
    setMode("dark");
  }, []);

  const value = useMemo<ThemeCtx>(() => ({
    theme: mode,
    setTheme,
    toggleTheme,
    themeId: mode === "light" ? "daylight" : palette,
    setThemeId,
  }), [mode, palette, setTheme, toggleTheme, setThemeId]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useThemeMode() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useThemeMode must be used within ThemeProvider");
  return ctx;
}
