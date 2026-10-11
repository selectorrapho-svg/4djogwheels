import { useState } from "react";
import { Mixer } from "@/lib/dj/engine";
import { Music } from "lucide-react";
import { TrackLibraryOverlay } from "./TrackLibraryOverlay";

export function LibraryPanel({ mixer }: { mixer: Mixer }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 rounded-sm border border-border bg-secondary px-2 py-1 text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground"
      >
        <Music className="w-3 h-3" />
        Library
      </button>
      <TrackLibraryOverlay open={open} onClose={() => setOpen(false)} mixer={mixer} />
    </>
  );
}
