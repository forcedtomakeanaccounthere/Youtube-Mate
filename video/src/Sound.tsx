import React from 'react';
import { Audio, interpolate, Sequence, staticFile } from 'remotion';
import { DROP_S, S, SCENES, sec, TOTAL, voAt, CAPTIONS } from './timeline';
import { B } from './scenes/Features';

// ---------------- SFX cue sheet (relative frame expressions only) ----------------
type Cue = { from: number; src: string; volume: number; dur?: number; note: string };
const drop = sec(DROP_S);
const at = (id: string, bars: number) => S[id].from + B(bars);
const FEATURES = ['shorten', 'transcript', 'rag', 'stream', 'playlists', 'downloads', 'plans'];
const CUTS: Record<string, number[]> = {
  shorten: [4, 6], transcript: [3, 6], rag: [5], stream: [3], playlists: [2, 3, 5], downloads: [3.5, 5.5], plans: [],
};

export const CUES: Cue[] = [
  // intro: one soft pop per everyday-job card, alternating samples & stepping down
  ...[0, 1, 2, 3].map((i) => ({ from: voAt('intro', i), src: i % 2 ? 'switch-click-quick' : 'pop', volume: 0.42 - i * 0.04, note: `intro card ${i + 1}` })),
  { from: voAt('intro', 4), src: 'whoosh-big', volume: 0.5, note: 'tabs deal in' },
  ...Array.from({ length: 6 }).map((_, i) => ({ from: voAt('intro', 4) + 8 + i * 8, src: i % 2 ? 'paper-slide' : 'swoosh-quick', volume: 0.22 - i * 0.02, note: 'tab windows landing' })),
  { from: drop - 140, src: 'riser-cine', volume: 0.55, dur: 142, note: 'tabs collapse into the centre' },
  { from: drop, src: 'impact-cine-big', volume: 0.75, dur: 110, note: 'BIG SLAM 1 — wordmark on the drop' },
  { from: drop + 10, src: 'sparkle-touch', volume: 0.35, note: 'wordmark sparkle' },
  { from: drop + 70, src: 'air-woosh-quick', volume: 0.4, note: 'hero page rises' },
  // features: chapter in, footage in, beat-synced cuts
  ...FEATURES.flatMap((id) => [
    { from: S[id].from, src: 'whoosh-fast', volume: 0.42, note: `${id} chapter card` },
    { from: at(id, 1) - 6, src: 'zoom-air-fast', volume: 0.38, note: `${id} chapter → footage` },
    ...CUTS[id].map((b) => ({ from: at(id, b) - 6, src: 'swoosh-quick', volume: 0.4, note: `${id} whip cut @bar ${b}` })),
  ]),
  { from: at('shorten', 4) + 34, src: 'sweep-digital', volume: 0.4, note: 'long URL collapses to short link' },
  { from: voAt('transcript', 3), src: 'switch-click-quick', volume: 0.3, note: 'summary mode switch' },
  { from: voAt('transcript', 3) + 22, src: 'switch-click-quick', volume: 0.26, note: 'summary mode switch' },
  { from: voAt('transcript', 4), src: 'paper-slide', volume: 0.4, note: 'export files deal in' },
  ...[1, 2, 3].map((i) => ({ from: voAt('rag', i), src: 'sweep-digital', volume: 0.26, note: `rag pipeline step ${i}` })),
  { from: voAt('stream', 3), src: 'pop', volume: 0.3, note: 'emoji reactions' },
  { from: at('playlists', 2) + 12, src: 'paper-slide', volume: 0.38, note: 'row drag' },
  { from: at('downloads', 1) + 44, src: 'transition-tech-slide', volume: 0.55, note: 'carousel turn 1' },
  { from: at('downloads', 1) + 95, src: 'transition-tech-slide', volume: 0.55, note: 'carousel turn 2' },
  { from: voAt('plans', 2) - 6, src: 'shimmer-sparkle-sweep', volume: 0.4, note: 'spotlight on Pro' },
  // outro: riser → impact → sparkle
  { from: S.outro.from, src: 'whoosh-big', volume: 0.45, note: 'wall of pages' },
  { from: voAt('outro', 4) - 4 - 140, src: 'riser-cine', volume: 0.5, dur: 140, note: 'build to the lockup' },
  { from: voAt('outro', 4) - 4, src: 'impact-cine-big', volume: 0.7, dur: 120, note: 'BIG SLAM 2 — final lockup' },
  { from: voAt('outro', 4) + 8, src: 'sparkle', volume: 0.5, dur: 120, note: 'lockup sparkle tail' },
];

// ---------------- BGM ducking under narration ----------------
const VO_SPANS = SCENES.map((s) => [s.voFrom, s.voFrom + sec(CAPTIONS[s.vo].duration)] as const);
const bgmVolume = (f: number) => {
  const near = VO_SPANS.some(([a, b]) => f >= a - 8 && f <= b + 8);
  const base = near ? 0.13 : 0.3;
  const fadeIn = interpolate(f, [0, 30], [0, 1], { extrapolateRight: 'clamp' });
  const fadeOut = interpolate(f, [TOTAL - 60, TOTAL], [1, 0], { extrapolateLeft: 'clamp' });
  return base * fadeIn * fadeOut;
};

export const Sound: React.FC<{ bgm: boolean }> = ({ bgm }) => (
  <>
    {bgm && <Audio src={staticFile('audio/bgm-cut.mp3')} volume={bgmVolume} />}
    {SCENES.map((s) => (
      <Sequence key={s.id} from={s.voFrom} layout="none">
        <Audio src={staticFile(`vo/${s.vo}.mp3`)} volume={1} />
      </Sequence>
    ))}
    {CUES.map((c, i) => (
      <Sequence key={i} from={Math.max(0, c.from)} durationInFrames={c.dur} layout="none">
        <Audio src={staticFile(`audio/sfx/${c.src}.mp3`)} volume={c.volume} />
      </Sequence>
    ))}
  </>
);
