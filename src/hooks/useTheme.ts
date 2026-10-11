import { useEffect, useState } from "react";

export type ThemeMode = "dark" | "gray" | "light" | "army" | "olive" | "carbon" | "gold";
export const THEMES: ThemeMode[] = ["dark", "gray", "light", "army", "olive", "carbon", "gold"];
const KEY = "dj-theme";

export function useTheme() {
  const [theme, setTheme] = useState<ThemeMode>(() => {
    if (typeof window === "undefined") return "dark";
    return (localStorage.getItem(KEY) as ThemeMode) || "dark";
  });
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove(...THEMES.map((t) => `theme-${t}`));
    root.classList.add(`theme-${theme}`);
    localStorage.setItem(KEY, theme);
  }, [theme]);
  return { theme, setTheme };
}
