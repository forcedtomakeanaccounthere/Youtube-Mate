import React from 'react';
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { Backdrop, Browser, clamp01, fade, Logo, mulberry32 } from '../components/kit';
import { SHOT, ShotId } from '../shots';
import { C, DISPLAY, EASE_CAM, EASE_IO, EASE_OUT, GRAD, SPRING, UI } from '../theme';
import { DROP_S, S, sec, voAt } from '../timeline';

const L = (abs: number) => abs - S.intro.from;

const PHRASES = [
  { text: 'Sharing links', icon: 'url_shortener' },
  { text: 'Reading transcripts', icon: 'Transcription_generator' },
  { text: 'Watching with friends', icon: 'Shared_Streaming' },
  { text: 'Saving videos', icon: 'YouTube_Downloader' },
];

const TAB_SHOTS: ShotId[] = ['shorten', 'transcript-result', 'stream-room', 'download-video', 'playlists', 'qa', 'download-audio', 'subscription', 'transcript-input', 'playlist-detail', 'download-hub', 'stream-lobby'];

export const Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const drop = sec(DROP_S);
  const tabsAt = L(voAt('intro', 4));
  const suckStart = drop - 34;

  // --- opening: logo stroke draws itself, then steps aside for the phrases
  const firstPhrase = L(voAt('intro', 0));
  const draw = interpolate(frame, [6, firstPhrase - 4], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE_IO });
  const logoOut = fade(frame, firstPhrase - 6, firstPhrase + 6);

  // --- phrase grid collapse before the tabs beat
  const gridOut = fade(frame, tabsAt - 4, tabsAt + 10);
  // --- everything sucked into the centre before the drop
  const suck = interpolate(frame, [suckStart, drop], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing2 });
  const flash = interpolate(frame, [drop - 2, drop, drop + 10], [0, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // --- wordmark + hero
  const wm = spring({ frame: frame - drop, fps, config: { damping: 13, mass: 1, stiffness: 120 } });
  const heroAt = drop + 70;
  const hero = interpolate(frame, [heroAt, heroAt + 40], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE_OUT });
  const end = S.intro.dur;
  const heroPush = interpolate(frame, [heroAt + 40, end], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE_CAM });

  return (
    <AbsoluteFill>
      <Backdrop />

      {/* opening logo draw */}
      {frame < firstPhrase + 8 && (
        <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', opacity: 1 - logoOut, transform: `scale(${1 + logoOut * 0.4})` }}>
          <svg width={220} height={220} viewBox="0 0 24 24" fill="none">
            <path d="M6 3.5v17l14-8.5z" stroke={C.orange} strokeWidth={1.6} strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - draw} />
          </svg>
        </AbsoluteFill>
      )}

      {/* four everyday jobs, one per spoken phrase */}
      {frame >= firstPhrase - 2 && frame < tabsAt + 12 && (
        <AbsoluteFill style={{ opacity: 1 - gridOut, transform: `scale(${1 - gridOut * 0.15})` }}>
          {PHRASES.map((p, i) => {
            const at = L(voAt('intro', i));
            const sp = spring({ frame: frame - at, fps, config: SPRING });
            if (frame < at) return null;
            const col = i % 2, row = Math.floor(i / 2);
            const x = 180 + col * 820, y = 190 + row * 380;
            return (
              <div key={i} style={{ position: 'absolute', left: x, top: y, width: 760, height: 320, display: 'flex', alignItems: 'center', gap: 26, opacity: clamp01(sp * 1.5), transform: `translateY(${(1 - sp) * 60}px) scale(${0.8 + 0.2 * sp})` }}>
                <Img src={staticFile(`icons/${p.icon}.png`)} style={{ width: 280, height: 280, objectFit: 'contain', transform: `translateY(${Math.sin((frame + i * 20) / 16) * 6}px)`, filter: 'drop-shadow(0 30px 30px rgba(154,27,27,0.28))' }} />
                <div style={{ fontFamily: UI, fontWeight: 800, fontSize: 64, lineHeight: 1.02, letterSpacing: '-0.035em', color: C.ink, width: 440 }}>{p.text}.</div>
              </div>
            );
          })}
        </AbsoluteFill>
      )}

      {/* a dozen tabs: real pages deal in chaotically, then collapse to a point */}
      {frame >= tabsAt && frame < drop + 2 && (
        <AbsoluteFill style={{ transform: `scale(${1 - suck * 0.96}) rotate(${suck * 40}deg)`, opacity: 1 - clamp01((suck - 0.85) * 6) }}>
          {TAB_SHOTS.map((id, i) => {
            const r = mulberry32(i * 7 + 3);
            const at = tabsAt + i * 4;
            const t = interpolate(frame, [at, at + 16], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE_OUT });
            if (frame < at) return null;
            const s = SHOT[id];
            const x = (r() - 0.5) * 1300, y = (r() - 0.5) * 620, rot = (r() - 0.5) * 22;
            return (
              <div key={id} style={{ position: 'absolute', left: 960 - 330, top: 540 - 200, transform: `translate(${x * t + (1 - t) * (i % 2 ? 1400 : -1400)}px, ${y * t}px) rotate(${rot * t}deg) scale(${0.95})`, opacity: t }}>
                <Browser src={s.src} imgW={s.w} imgH={s.h} url={`youtube-mate · tab ${i + 1}`} w={660} h={400} />
              </div>
            );
          })}
          <TabCounter at={tabsAt} />
        </AbsoluteFill>
      )}

      {/* white flash on the drop */}
      <AbsoluteFill style={{ background: '#fff', opacity: flash }} />

      {/* wordmark */}
      {frame >= drop && (
        <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', transform: `translateY(${-hero * 330}px) scale(${1 - hero * 0.45})` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 34, transform: `scale(${0.6 + 0.4 * wm})`, opacity: clamp01(wm * 2) }}>
            <div style={{ transform: `rotate(${(1 - wm) * -90}deg)` }}><Logo size={190} /></div>
            <div style={{ fontFamily: DISPLAY, fontSize: 230, lineHeight: 1, backgroundImage: GRAD, WebkitBackgroundClip: 'text', color: 'transparent', letterSpacing: `${(1 - wm) * 0.4}em`, paddingBottom: 18 }}>YouTube Mate</div>
          </div>
          <div style={{ marginTop: 26, fontFamily: UI, fontWeight: 500, fontSize: 44, color: C.ink2, opacity: fade(frame, drop + 22, drop + 40) * (1 - hero), transform: `translateY(${(1 - fade(frame, drop + 22, drop + 40)) * 20}px)` }}>
            One workspace for everything you do with YouTube.
          </div>
        </AbsoluteFill>
      )}

      {/* hero page rises in under the wordmark */}
      {frame >= heroAt && (
        <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', perspective: 2400 }}>
          <div style={{ transform: `translateY(${(1 - hero) * 900 + 150 - heroPush * 40}px) rotateX(${(1 - hero) * 40 + 12 - heroPush * 8}deg) scale(${0.78 + heroPush * 0.06})`, transformOrigin: '50% 100%' }}>
            <Browser src={SHOT.hero.src} imgW={SHOT.hero.w} imgH={SHOT.hero.h} url="youtube-mate-mu.vercel.app" w={1500} h={800} />
          </div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};

const Easing2 = (t: number) => t * t * t; // accelerate into the drop

const TabCounter: React.FC<{ at: number }> = ({ at }) => {
  const frame = useCurrentFrame();
  const n = Math.min(12, Math.max(1, Math.floor((frame - at) / 4) + 1));
  const t = fade(frame, at, at + 10);
  return (
    <div style={{ position: 'absolute', left: '50%', top: 80, transform: `translateX(-50%) scale(${0.9 + 0.1 * t})`, opacity: t, fontFamily: UI, fontWeight: 800, fontSize: 40, color: '#fff', background: C.ink, padding: '14px 30px', borderRadius: 999, boxShadow: '0 20px 40px -14px rgba(0,0,0,0.5)' }}>
      {n} tabs open
    </div>
  );
};
