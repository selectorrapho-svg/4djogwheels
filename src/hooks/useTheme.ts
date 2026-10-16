import { useEffect, useSyncExternalStore } from "react";

export type ThemeMode = "gray" | "light";
export const THEMES: ThemeMode[] = ["gray", "light"];
export const normalizeTheme = (value: unknown): ThemeMode => value === "light" ? "light" : "gray";
const KEY = "dj-theme";
const listeners = new Set<() => void>();
let current: ThemeMode = "gray";
let restored = false;
export function useTheme() {
  const theme = useSyncExternalStore(l => { listeners.add(l); return () => { listeners.delete(l); }; }, () => current, () => "gray" as ThemeMode);
  const setTheme = (value: ThemeMode) => { current = normalizeTheme(value); listeners.forEach(l => l()); };
  useEffect(() => {
    if (!restored) {
      restored = true;
      try { current = normalizeTheme(localStorage.getItem(KEY)); } catch { current = "gray"; }
      listeners.forEach(l => l());
    }
    const root = document.documentElement;
    root.classList.remove("dark", ...["dark", "gray", "light", "army", "olive", "carbon", "gold"].map(t => `theme-${t}`));
    root.classList.add(`theme-${current}`);
    try { localStorage.setItem(KEY, current); } catch { /* unavailable storage */ }
  }, [theme]);
  return { theme, setTheme };
}
