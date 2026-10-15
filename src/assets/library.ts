import t1 from "./tracks/ALL_THE_HITS.mp3.asset.json";
import t2 from "./tracks/AUD-20180507-WA0014.aac.asset.json";
import t3 from "./tracks/BIG_TUNES.mp3.asset.json";
import t4 from "./tracks/Bring_the_shiet_back_again.mp3.asset.json";
import t5 from "./tracks/CRIME_SCENE.mp3.asset.json";
import t6 from "./tracks/Cant_be_like_me.mp3.asset.json";
import t7 from "./tracks/Certtified_banger.mp3.asset.json";
import t8 from "./tracks/banging_real_hiphop_and_rnb.mp3.asset.json";
import t9 from "./tracks/best_in_swahili.mp3.asset.json";
import d1 from "./demo/demo_hiphop_92.mp3?url";
import d2 from "./demo/demo_rnb_100.mp3?url";
import d3 from "./demo/demo_afro_112.mp3?url";
import d4 from "./demo/demo_house_124.mp3?url";
import d5 from "./demo/demo_house_128.mp3?url";

export interface LibraryTrack {
  title: string;
  url: string;
  filename: string;
}

const pretty = (s: string) =>
  s.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();

const stubs: LibraryTrack[] = [t1, t2, t3, t4, t5, t6, t7, t8, t9].map((a) => ({
  title: pretty(a.original_filename),
  url: a.url,
  filename: a.original_filename,
}));

/** Full-length demo tracks with exact tempos, so scratch, sync and beat grids can be tested. */
const demos: LibraryTrack[] = [
  [d1, "Demo Hip Hop 92 BPM"],
  [d2, "Demo RnB 100 BPM"],
  [d3, "Demo Afro 112 BPM"],
  [d4, "Demo House 124 BPM"],
  [d5, "Demo House 128 BPM"],
].map(([url, title]) => ({ title, url, filename: title.toLowerCase().replace(/\s+/g, "_") + ".mp3" }));

export const LIBRARY: LibraryTrack[] = [...demos, ...stubs];
