import { Activity, Check, ChevronDown, Minus, Rows2, Rows3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { useDjSettings } from "@/hooks/useDjSettings";

const DIRECTIONS = [["horizontal", "Horizontal"], ["vertical", "Vertical"]] as const;

/** Serato-style glassy Display Mode popup: direction, background, spectrum, lanes and zoom. */
export function WaveformOptions({ topVisible, onTopVisible }: { topVisible?: boolean; onTopVisible?: (visible: boolean) => void }) {
  const [settings, update] = useDjSettings();
  return <Popover>
    <PopoverTrigger asChild><Button variant="ghost" size="icon" className="dj-glass size-7 rounded-full" aria-label="Waveform settings"><ChevronDown /></Button></PopoverTrigger>
    <PopoverContent className="wave-options reference-menu w-72 rounded-3xl p-3" side="bottom" align="start" style={{ background: "var(--popover)", border: "1px solid var(--glass-border)", backdropFilter: "blur(24px)" }}>
      <div className="flex items-center gap-2 px-1 pb-2 text-sm font-semibold"><Activity className="size-4" />Display Mode<ChevronDown className="ml-auto size-4 text-muted-foreground" /></div>
      <div className="border-t border-[var(--glass-border)] py-1">
        {DIRECTIONS.map(([value, label]) => (
          <button
            key={value}
            onClick={() => update({ waveOrientation: value })}
            aria-pressed={settings.waveOrientation === value}
            className="flex h-11 w-full items-center gap-3 rounded-2xl px-3 text-sm"
            style={settings.waveOrientation === value ? { background: "var(--glass-strong)" } : undefined}
          >
            <Check className={`size-4 ${settings.waveOrientation === value ? "" : "opacity-0"}`} />{label}
          </button>
        ))}
      </div>
      <div className="space-y-2 border-t border-[var(--glass-border)] py-2">
        <label className="flex items-center justify-between px-1 text-sm">Dark background<Switch aria-label="Dark waveform background" checked={settings.waveBg === "dark"} onCheckedChange={dark => update({ waveBg: dark ? "dark" : "light" })} /></label>
        {onTopVisible && <label className="flex items-center justify-between px-1 text-sm">Top waveforms<Switch aria-label="Show top waveforms" checked={topVisible} onCheckedChange={onTopVisible} /></label>}
        <label className="block px-1 text-sm">Spectrum
          <select aria-label="Waveform spectrum" className="mt-1.5 w-full rounded-2xl border border-[var(--glass-border)] bg-secondary p-2" value={settings.waveColor} onChange={e => update({ waveColor: e.target.value })}>
            <option value="rgb3">Full RGB spectrum</option>
            <option value="all">Original multicolor</option>
            <option value="blue">Blue</option>
          </select>
        </label>
        <div className="grid grid-cols-3 gap-1 px-1">{([1, 2, 3] as const).map((n) => <Button key={n} variant={settings.waveTracks === n ? "default" : "secondary"} aria-label={`${n} waveform lanes`} aria-pressed={settings.waveTracks === n} className="rounded-2xl" onClick={() => update({ waveTracks: n })}>{n === 1 ? <Minus /> : n === 2 ? <Rows2 /> : <Rows3 />}</Button>)}</div>
        <div className="px-1">
          <label className="block text-sm">Zoom · {Math.round(settings.waveZoom * 100)}%</label>
          <div className="mt-1 flex items-center gap-2">
            <input aria-label="Waveform zoom" type="range" min={0.25} max={4} step={0.25} value={settings.waveZoom} onChange={e => update({ waveZoom: Number(e.target.value) })} className="min-w-0 flex-1 accent-primary" />
            <Button variant="secondary" className="h-7 rounded-full px-2 text-[11px] tabular-nums" aria-label="Reset waveform zoom to 100%" onClick={() => update({ waveZoom: 1 })}>100%</Button>
          </div>
        </div>
      </div>
    </PopoverContent>
  </Popover>;
}
