// Serato-style dark glass oval button. When synced it blinks blue and shows
// just "SYNC" — no tempo readout.
export function SyncButton({
  onClick,
  active,
  label = "SYNC",
  width = 62,
  height = 26,
  accent,
}: {
  onClick: () => void;
  active?: boolean;
  label?: string;
  width?: number;
  height?: number;
  accent?: string;
  /** Kept for API compatibility; the tempo is no longer shown while synced. */
  bpm?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-center leading-none rounded-full active:scale-[0.97] transition-transform ${
        active ? "dj-glass-on sync-blinking" : "dj-glass"
      }`}
      style={{
        width,
        height,
        boxShadow: active && accent ? `0 0 12px ${accent}88, var(--glass-shadow)` : undefined,
      }}
    >
      <span
        className="font-semibold"
        style={{
          fontSize: Math.max(8, height * 0.38),
          letterSpacing: "0.12em",
          color: active ? "var(--control-blue)" : "var(--foreground)",
        }}
      >
        {label}
      </span>
    </button>
  );
}
