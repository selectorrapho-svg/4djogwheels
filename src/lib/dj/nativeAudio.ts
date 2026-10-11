// Bridge to the native Oboe engine (AAudio / OpenSL ES) when running inside
// the Android app. In the browser preview this is a no-op.
type Plugin = {
  load(o: { deck: number; data: string }): Promise<unknown>;
  play(o: { deck: number; pos: number; rate: number }): Promise<void>;
  pause(o: { deck: number }): Promise<void>;
  seek(o: { deck: number; pos: number }): Promise<void>;
  rate(o: { deck: number; rate: number }): Promise<void>;
  target(o: { deck: number; pos: number; vel: number }): Promise<void>;
  gain(o: { deck: number; vol?: number; x?: number }): Promise<void>;
  position(o: { deck: number }): Promise<{ pos: number }>;
};

function plugin(): Plugin | null {
  if (typeof window === "undefined") return null;
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean; Plugins?: { NativeDj?: Plugin } } }).Capacitor;
  return cap?.isNativePlatform?.() && cap.Plugins?.NativeDj ? cap.Plugins.NativeDj : null;
}

export const isNative = () => plugin() !== null;
const idx = (id: string) => "ABCD".indexOf(id);
const safe = (p: Promise<unknown> | undefined) => void p?.catch(() => {});

async function toBase64(ab: ArrayBuffer) {
  const blob = new Blob([ab]);
  const url: string = await new Promise((res) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.readAsDataURL(blob);
  });
  return url.slice(url.indexOf(",") + 1);
}

export const native = {
  async load(id: string, ab: ArrayBuffer) {
    const p = plugin();
    if (p) await p.load({ deck: idx(id), data: await toBase64(ab) }).catch(() => {});
  },
  play: (id: string, pos: number, rate: number) => safe(plugin()?.play({ deck: idx(id), pos, rate })),
  pause: (id: string) => safe(plugin()?.pause({ deck: idx(id) })),
  seek: (id: string, pos: number) => safe(plugin()?.seek({ deck: idx(id), pos })),
  rate: (id: string, rate: number) => safe(plugin()?.rate({ deck: idx(id), rate })),
  target: (id: string, pos: number, vel: number) => safe(plugin()?.target({ deck: idx(id), pos, vel })),
  volume: (id: string, vol: number) => safe(plugin()?.gain({ deck: idx(id), vol })),
  xfade: (id: string, x: number) => safe(plugin()?.gain({ deck: idx(id), x })),
  position: async (id: string) => (await plugin()?.position({ deck: idx(id) }).catch(() => null))?.pos ?? null,
};
