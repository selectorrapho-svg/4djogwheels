import { useLayoutEffect, useState } from "react";
import { Portal } from "./Portal";

/** Deck-local overlays escape clipped strips without covering the mixer. */
export function DeckDrawer({ deckId, children, className = "", label, layer = 310, side, reachTop = false }: {reachTop?: boolean; side?: "left" | "right";  deckId: string; children: React.ReactNode; className?: string; label: string; layer?: number }) {
  const [bounds, setBounds] = useState<{ left: number; top: number; width: number; maxHeight: number } | null>(null);
  useLayoutEffect(() => {
    const panel = document.querySelector(`[data-deck-panel="${deckId}"]`);
    const update = () => {
      const r = panel?.getBoundingClientRect();
      const width = Math.min(320, r ? r.width - 12 : window.innerWidth - 24);
      const header = document.querySelector("[data-dj-topbar]")?.getBoundingClientRect();
      const top = reachTop ? (header?.bottom ?? 44) : r ? r.top + 34 : 58;
      setBounds({ left: r ? (side === "left" ? r.left + 4 : side === "right" ? r.right - width - 4 : r.left + (r.width - width) / 2) : (window.innerWidth - width) / 2, top, width, maxHeight: Math.max(100, (r ? r.bottom - 54 : window.innerHeight - 58) - top) });
    };
    update();
    const observer = new ResizeObserver(update);
    if (panel) observer.observe(panel);
    window.addEventListener("resize", update);
    return () => { observer.disconnect(); window.removeEventListener("resize", update); };
  }, [deckId, side, reachTop]);
  if (!bounds) return null;
  return <Portal><section role="dialog" aria-label={label} className={`deck-drawer fixed flex flex-col overflow-hidden rounded-md border border-border bg-popover text-foreground shadow-lg ${className}`} style={{ ...bounds, height: reachTop ? bounds.maxHeight : undefined, zIndex: layer }}>{children}</section></Portal>;
}