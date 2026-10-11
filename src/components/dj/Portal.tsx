import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Renders children straight into <body> so full-screen overlays (library,
 * settings) are never clipped or stacked below decks, jog wheels or drawers.
 * SSR-safe: renders nothing until mounted in the browser.
 */
export function Portal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted || typeof document === "undefined") return null;
  return createPortal(children, document.body);
}
