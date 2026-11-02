import React from 'react';
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { Backdrop, clamp01, fade, Logo } from '../components/kit';
import { SHOT, ShotId } from '../shots';
import { C, DISPLAY, EASE_OUT, GRAD, UI } from '../theme';
import { S, voAt } from '../timeline';

const L = (abs: number) => abs - S.outro.from;
const WALL: ShotId[] = ['shorten', 'qa', 'stream-room', 'playlists', 'download-progress', 'transcript-result', 'subscription', 'playlist-detail', 'download-audio', 'shorten-links', 'stream-lobby', 'features', 'download-video', 'transcript-input', 'playlist-collab', 'login', 'dark-landing', 'download-hub'];
const WORDS = ['Share it.', 'Understand it.', 'Watch it together.', 'Keep it.'];

export const Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const lock = L(voAt('outro', 4)) - 4; // wordmark lands with "YouTube Mate"
  const wallOut = fade(frame, lock - 8, lock + 6);
  const wm = spring({ frame: frame - lock, fps, config: { damping: 12, mass: 1, stiffness: 130 } });
  const end = S.outro.dur;
  const fadeEnd = interpolate(frame, [end - 18, end], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill>
      <Backdrop drift={S.outro.from} />
      {/* tilted wall of real pages scrolling past */}
      {frame < lock + 8 && (
        <AbsoluteFill style={{ perspective: 2000, opacity: 1 - wallOut }}>
          <AbsoluteFill style={{ transform: `rotateX(28deg) rotateZ(-14deg) scale(1.25) translateY(${-frame * 3.2}px)`, transformStyle: 'preserve-3d' }}>
            {WALL.map((id, i) => {
              const s = SHOT[id];
              const col = i % 4, row = Math.floor(i / 4);
              const t = fade(frame, i * 1.5, i * 1.5 + 18);
              return (
                <div key={i} style={{ position: 'absolute', left: -260 + col * 640 + (row % 2) * 120, top: 120 + row * 400 + (col % 2) * 60, width: 600, height: 370, borderRadius: 16, overflow: 'hidden', boxShadow: '0 30px 60px -20px rgba(124,45,18,0.45)', opacity: t, transform: `translateY(${(1 - t) * 120}px)`, background: '#fff' }}>
                  <Img src={staticFile(s.src)} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }} />
                </div>
              );
            })}
          </AbsoluteFill>
          <AbsoluteFill style={{ background: 'radial-gradient(60% 55% at 50% 50%, rgba(255,247,241,0.92), rgba(255,247,241,0.35) 75%)' }} />
        </AbsoluteFill>
      )}
      {/* spoken words, one per line */}
      {frame < lock && WORDS.map((w, i) => {
        const at = L(voAt('outro', i));
        const nxt = i < 3 ? L(voAt('outro', i + 1)) : lock;
        if (frame < at - 2 || frame >= nxt) return null;
        const t = fade(frame, at - 2, at + 8);
        return (
          <AbsoluteFill key={w} style={{ alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ fontFamily: UI, fontWeight: 800, fontSize: 150, letterSpacing: '-0.045em', color: C.ink, opacity: t, transform: `scale(${1.15 - 0.15 * t})`, filter: `blur(${(1 - t) * 10}px)` }}>
              {w.split(' ').map((x, j, arr) => (
                <span key={j} style={j === arr.length - 1 ? { backgroundImage: GRAD, WebkitBackgroundClip: 'text', color: 'transparent' } : undefined}>{x}{j < arr.length - 1 ? ' ' : ''}</span>
              ))}
            </div>
          </AbsoluteFill>
        );
      })}
      {/* lockup */}
      {frame >= lock && (
        <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 30, transform: `scale(${0.55 + 0.45 * wm})`, opacity: clamp01(wm * 2) }}>
            <Logo size={170} />
            <div style={{ fontFamily: DISPLAY, fontSize: 210, lineHeight: 1, backgroundImage: GRAD, WebkitBackgroundClip: 'text', color: 'transparent', paddingBottom: 16 }}>YouTube Mate</div>
          </div>
          <div style={{ marginTop: 24, fontFamily: UI, fontWeight: 500, fontSize: 44, color: C.ink2, opacity: fade(frame, lock + 16, lock + 32) }}>Your ultimate companion for YouTube.</div>
          <div style={{ marginTop: 50, display: 'flex', gap: 22, opacity: fade(frame, lock + 34, lock + 50), transform: `translateY(${(1 - fade(frame, lock + 34, lock + 50)) * 20}px)` }}>
            <div style={{ fontFamily: UI, fontWeight: 700, fontSize: 32, color: '#fff', background: GRAD, padding: '16px 32px', borderRadius: 999 }}>youtube-mate-mu.vercel.app</div>
            <div style={{ fontFamily: UI, fontWeight: 600, fontSize: 32, color: C.ink, background: '#fff', border: `1.5px solid ${C.line}`, padding: '16px 32px', borderRadius: 999 }}>github.com/forcedtomakeanaccounthere/Youtube-Mate</div>
          </div>
        </AbsoluteFill>
      )}
      <AbsoluteFill style={{ background: C.bg, opacity: fadeEnd }} />
    </AbsoluteFill>
  );
};

export const EASE = EASE_OUT;
