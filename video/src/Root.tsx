import React from 'react';
import { AbsoluteFill, Composition, continueRender, delayRender, Sequence, staticFile } from 'remotion';
import { Captions } from './components/kit';
import { Downloads, Playlists, Plans, Rag, Shorten, Stream, Transcript } from './scenes/Features';
import { Intro } from './scenes/Intro';
import { Outro } from './scenes/Outro';
import { Sound } from './Sound';
import { CAPTIONS, FPS, S, SCENES, TOTAL } from './timeline';

// Load the product's own display fonts (once per render tab).
let fontsPromise: Promise<void> | null = null;
const loadFonts = () => {
  if (!fontsPromise) {
    fontsPromise = Promise.all([
      new FontFace('Bileha', `url(${staticFile('fonts/Bileha.otf')})`).load(),
      new FontFace('Mestika', `url(${staticFile('fonts/Mestika.otf')})`).load(),
    ]).then((fs) => fs.forEach((f) => document.fonts.add(f)));
  }
  return fontsPromise;
};
const useFonts = () => {
  const [handle] = React.useState(() => delayRender('fonts', { timeoutInMilliseconds: 120000 }));
  React.useEffect(() => {
    loadFonts().catch((e) => console.warn('font load failed', e)).finally(() => continueRender(handle));
  }, [handle]);
};

const SCENE_COMPONENTS: Record<string, React.FC> = {
  intro: Intro, shorten: Shorten, transcript: Transcript, rag: Rag, stream: Stream,
  playlists: Playlists, downloads: Downloads, plans: Plans, outro: Outro,
};

// Captions: the intro's first four phrases and the outro's words are already on screen as type.
const CAPTION_SKIP: Record<string, number[]> = { intro: [0, 1, 2, 3, 5], outro: [0, 1, 2, 3, 4] };

export const Demo: React.FC<{ bgm: boolean }> = ({ bgm }) => {
  useFonts();
  return (
  <AbsoluteFill style={{ background: '#FFF7F1' }}>
    {SCENES.map((s) => {
      const C = SCENE_COMPONENTS[s.id];
      return (
        <Sequence key={s.id} from={s.from} durationInFrames={s.dur} name={s.id}>
          <C />
        </Sequence>
      );
    })}
    {SCENES.map((s) => (
      <Captions key={`cap-${s.id}`} from={s.voFrom} chunks={CAPTIONS[s.vo].chunks.filter((_, i) => !(CAPTION_SKIP[s.id] ?? []).includes(i))} />
    ))}
    <Sound bgm={bgm} />
  </AbsoluteFill>
  );
};

export const Root: React.FC = () => (
  <>
    <Composition id="YouTubeMateDemo" component={Demo} durationInFrames={TOTAL} fps={FPS} width={1920} height={1080} defaultProps={{ bgm: true }} />
    {SCENES.map((s) => (
      <Composition key={s.id} id={`scene-${s.id}`} component={() => <Sequence from={-s.from}><Demo bgm={false} /></Sequence>} durationInFrames={s.dur} fps={FPS} width={1920} height={1080} />
    ))}
  </>
);

export const _S = S;
