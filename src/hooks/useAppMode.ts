import { useEffect, useState } from "react";

export type AppMode = "mix" | "video";
const KEY = "mixrdjs.mode";

export function useAppMode(): [AppMode, (m: AppMode) => void] {
  const [mode, setModeState] = useState<AppMode>(() => {
    if (typeof window === "undefined") return "mix";
    return (localStorage.getItem(KEY) as AppMode) || "mix";
  });
  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem(KEY, mode);
  }, [mode]);
  return [mode, setModeState];
}
