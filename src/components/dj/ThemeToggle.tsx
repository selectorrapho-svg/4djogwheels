import { useTheme, THEMES } from "@/hooks/useTheme";
import { Sun, Moon, Contrast } from "lucide-react";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const next = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];
  const Icon = theme === "dark" ? Moon : theme === "gray" ? Contrast : Sun;
  return (
    <button
      onClick={() => setTheme(next)}
      className="w-8 h-8 rounded-full flex items-center justify-center border border-[--border] bg-[--card] text-[--foreground] hover:opacity-80"
      title={`Theme: ${theme} (tap to switch)`}
    >
      <Icon className="w-4 h-4" />
    </button>
  );
}
