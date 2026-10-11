// OS-style frosted glass hardware button with rounded caps (theme aware).
export function SyncButton({
  onClick,
  active,
  label = "SYNC",
  width = 62,
  height = 26,
  accent,
  bpm,
}: {
  onClick: () => void;
  active?: boolean;
  label?: string;
  width?: number;
  height?: number;
  accent?: string;
  /** Effective (tempo-adjusted) BPM shown djay-style while synced. */
  bpm?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center leading-none active:scale-[0.97] transition-transform ${
        active ? "dj-glass-on" : "dj-glass"
      }`}
      style={{
        width,
        height,
        borderRadius: 7,
        boxShadow: active && accent ? `0 0 12px ${accent}88, var(--glass-shadow)` : undefined,
      }}
    >
      <span
        className="font-semibold"
        style={{
          fontSize: Math.max(8, height * 0.38),
          letterSpacing: "0.12em",
          color: active && accent ? accent : "var(--foreground)",
        }}
      >
        {active && bpm ? "SYNCED" : label}
      </span>
      {active && bpm ? (
        <span className="tabular-nums font-bold leading-none" style={{ fontSize: Math.max(9, height * 0.4), color: accent ?? "var(--foreground)" }}>
          {bpm.toFixed(1)}
        </span>
      ) : null}
    </button>
  );
}
