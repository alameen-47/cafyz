import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { Capacitor } from "@capacitor/core";
import { StatusBar, Style } from "@capacitor/status-bar";

export type ThemeMode = "dark" | "light";

const STORAGE_KEY = "cafyz_theme";

interface ThemeCtx {
  theme: ThemeMode;
  setTheme: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

const Ctx = createContext<ThemeCtx | null>(null);

function readStoredTheme(): ThemeMode {
  if (typeof window === "undefined") return "dark";
  return localStorage.getItem(STORAGE_KEY) === "light" ? "light" : "dark";
}

function applyThemeToDocument(mode: ThemeMode) {
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  root.classList.add(mode);
  root.dataset.theme = mode;
  root.style.colorScheme = mode;
  localStorage.setItem(STORAGE_KEY, mode);

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", mode === "dark" ? "#06091a" : "#e8edf4");

  if (Capacitor.isNativePlatform()) {
    void StatusBar.setStyle({ style: mode === "dark" ? Style.Dark : Style.Light });
    void StatusBar.setBackgroundColor({ color: mode === "dark" ? "#06091a" : "#e8edf4" });
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>(readStoredTheme);

  useEffect(() => {
    applyThemeToDocument(theme);
  }, [theme]);

  const setTheme = useCallback((mode: ThemeMode) => setThemeState(mode), []);
  const toggleTheme = useCallback(() => {
    setThemeState(prev => (prev === "dark" ? "light" : "dark"));
  }, []);

  return (
    <Ctx.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </Ctx.Provider>
  );
}

export function useThemeMode() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useThemeMode must be used within ThemeProvider");
  return ctx;
}
