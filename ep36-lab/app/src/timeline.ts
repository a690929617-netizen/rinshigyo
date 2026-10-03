// EP36 lab timeline: only the S0 test plates. Boundaries are anchored to lyric lines and snapped to the
// beat grid exactly like the MV will be (pdoom's cut rule), so the plates move to the real timings as soon
// as data/*.json is replaced with the analysis built on the local PC.
import type { TimelineEntry } from './engine/engine';
import type { SceneClass } from './engine/scene';
import type { Lyrics } from './engine/lyrics';
import type { AudioData } from './engine/audio';

const modules = import.meta.glob<{ default: SceneClass }>('./scenes/*.ts');
const scene = (name: string) => () => {
  const m = modules[`./scenes/${name}.ts`];
  return m ? m() : Promise.reject(new Error(`scene module not found: scenes/${name}.ts`));
};

export function makeTimeline(ly: Lyrics, au: AudioData): TimelineEntry[] {
  /** Cut on the last beat at/before the first sung mora of the matching line (never after it). */
  const cut = (q: string, nth = 0, tol = 0.02) => {
    const s = ly.get(q, nth).words[0]!.start;
    return au.timeOfBeat(Math.floor(au.beatAt(s + tol)));
  };
  const E = (id: string, file: string, start: number, end: number, extra: Partial<TimelineEntry> = {}): TimelineEntry =>
    ({ id, load: scene(file), start, end, ...extra });

  // the bar before 「指紋が近づく」 belongs to `judge` in the MV; the lab starts the thumb half a bar early
  const thumb0 = cut('指紋が') - (60 / au.bpm) * 2;
  return [
    E('thumb', 'thumb', thumb0, cut('親指さんよ')),
    E('deep', 'deep', cut('百万本'), cut('一万')),
  ];
}
