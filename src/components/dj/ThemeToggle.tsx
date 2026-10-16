import { useTheme, THEMES } from "@/hooks/useTheme";
import { Sun, Contrast } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const next = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];
  const Icon = theme === "gray" ? Contrast : Sun;
  return (
    <Button variant="ghost" size="icon"
      onClick={() => setTheme(next)}
      className="size-8 rounded-full border border-border bg-card text-foreground"
      aria-label={`Switch to ${next} theme`}
      title={`Theme: ${theme} (tap to switch)`}
    >
      <Icon className="w-4 h-4" />
    </Button>
  );
}
