// Single source of truth for timing. Every scene boundary sits on a bar line
// of the BGM (123.87 BPM), measured from the kick drop that lands at DROP_S.
import captions from './captions.json';

export const FPS = 30;
export const BEAT_S = 0.48438;
export const BAR_S = BEAT_S * 4;
export const DROP_S = 11.5; // brand reveal = BGM kick drop

export const sec = (s: number) => Math.round(s * FPS);
/** Video frame of bar `n` counted from the drop (n can be negative). */
export const barF = (n: number) => sec(DROP_S + n * BAR_S);
export const beatF = (n: number) => sec(DROP_S + n * BEAT_S);

type SceneDef = { id: string; fromBar: number; bars: number; vo: keyof typeof captions; voLead: number };

// fromBar is relative to the drop. Scene 1 starts at frame 0 (before the drop).
const DEFS: SceneDef[] = [
  { id: 'intro', fromBar: -999, bars: 3, vo: 's01-intro', voLead: 0 },
  { id: 'shorten', fromBar: 3, bars: 9, vo: 's02-shorten', voLead: 0.45 },
  { id: 'transcript', fromBar: 12, bars: 8, vo: 's03-transcript', voLead: 0.45 },
  { id: 'rag', fromBar: 20, bars: 10, vo: 's04-rag', voLead: 0.45 },
  { id: 'stream', fromBar: 30, bars: 7, vo: 's05-stream', voLead: 0.45 },
  { id: 'playlists', fromBar: 37, bars: 8, vo: 's06-playlists', voLead: 0.45 },
  { id: 'downloads', fromBar: 45, bars: 8, vo: 's07-downloads', voLead: 0.45 },
  { id: 'plans', fromBar: 53, bars: 4, vo: 's08-plans', voLead: 0.4 },
  { id: 'outro', fromBar: 57, bars: 7, vo: 's09-outro', voLead: 0 },
];

export type Scene = { id: string; from: number; dur: number; vo: keyof typeof captions; voFrom: number };

// The intro voice line is placed so that "Meet YouTube Mate" starts exactly on the drop.
const INTRO_MEET_S = (captions['s01-intro'].chunks.find((c) => c.text.startsWith('Meet'))?.start ?? 9) + 0.25;

export const SCENES: Scene[] = DEFS.map((d) => {
  const from = d.fromBar === -999 ? 0 : barF(d.fromBar);
  const to = barF(d.fromBar === -999 ? d.bars : d.fromBar + d.bars);
  let voFrom = from + sec(d.voLead);
  if (d.id === 'intro') voFrom = sec(DROP_S - INTRO_MEET_S);
  if (d.id === 'outro') voFrom = from + sec(BAR_S * 1); // after the wall montage starts
  return { id: d.id, from, dur: to - from, vo: d.vo, voFrom };
});

export const S = Object.fromEntries(SCENES.map((s) => [s.id, s])) as Record<string, Scene>;
export const TOTAL = SCENES[SCENES.length - 1].from + SCENES[SCENES.length - 1].dur;

/** Absolute frame where caption chunk `idx` of a scene's narration begins. */
export const voAt = (sceneId: string, idx: number) => {
  const s = S[sceneId];
  return s.voFrom + sec(captions[s.vo].chunks[idx].start);
};

export const CAPTIONS = captions;
