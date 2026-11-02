import React from 'react';
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { C, EASE_CAM, EASE_OUT, GRAD, SPRING, UI } from '../theme';

// ---------- deterministic helpers ----------
export const mulberry32 = (a: number) => () => {
  a |= 0; a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

export type Key = { f: number } & Record<string, number>;
/** Interpolate numeric property `p` across keyframes (frames local to caller). */
export const kf = (frame: number, keys: Key[], p: string, ease = EASE_CAM, fallback = 0) => {
  const ks = keys.filter((k) => k[p] !== undefined);
  if (!ks.length) return fallback;
  if (frame <= ks[0].f) return ks[0][p];
  for (let i = 0; i < ks.length - 1; i++) {
    const a = ks[i], b = ks[i + 1];
    if (frame <= b.f) return interpolate(frame, [a.f, b.f], [a[p], b[p]], { easing: ease, extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  }
  return ks[ks.length - 1][p];
};

export const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
export const fade = (frame: number, a: number, b: number) =>
  interpolate(frame, [a, b], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE_OUT });

// ---------- backdrop ----------
export const Backdrop: React.FC<{ tone?: 'cream' | 'night'; drift?: number }> = ({ tone = 'cream', drift = 0 }) => {
  const frame = useCurrentFrame();
  const t = frame + drift;
  const x1 = 22 + Math.sin(t / 90) * 6, y1 = 18 + Math.cos(t / 110) * 5;
  const x2 = 82 + Math.cos(t / 120) * 6, y2 = 86 + Math.sin(t / 100) * 5;
  if (tone === 'night')
    return (
      <AbsoluteFill style={{ background: `radial-gradient(60% 70% at ${x1}% ${y1}%, rgba(249,115,22,0.35), transparent 70%), radial-gradient(55% 60% at ${x2}% ${y2}%, rgba(220,38,38,0.35), transparent 70%), ${C.night}` }} />
    );
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(55% 60% at ${x1}% ${y1}%, rgba(251,146,60,0.22), transparent 70%), radial-gradient(50% 55% at ${x2}% ${y2}%, rgba(239,68,68,0.16), transparent 70%), linear-gradient(180deg, ${C.bg} 0%, ${C.bg2} 100%)`,
      }}
    >
      <AbsoluteFill
        style={{
          opacity: 0.35,
          backgroundImage: 'radial-gradient(rgba(154,27,27,0.16) 1.2px, transparent 1.2px)',
          backgroundSize: '28px 28px',
          maskImage: 'radial-gradient(70% 70% at 50% 50%, black, transparent 90%)',
          WebkitMaskImage: 'radial-gradient(70% 70% at 50% 50%, black, transparent 90%)',
        }}
      />
    </AbsoluteFill>
  );
};

// ---------- browser window with an in-window camera ----------
export type CamKey = { f: number; x?: number; y?: number; z?: number };
/**
 * A macOS-style browser window showing a screenshot. Inside the viewport a
 * camera pans/zooms over the image: (x, y) is the image point (0..1) kept at
 * the viewport centre; z = 1 fits image width to the window.
 */
export const Browser: React.FC<{
  src: string; imgW: number; imgH: number; url: string;
  w?: number; h?: number; cam?: CamKey[]; frame?: number; dark?: boolean; children?: React.ReactNode;
}> = ({ src, imgW, imgH, url, w = 1500, h = 860, cam = [{ f: 0, x: 0.5, y: 0, z: 1 }], frame: fr, dark, children }) => {
  const own = useCurrentFrame();
  const frame = fr ?? own;
  const bar = 54;
  const vw = w, vh = h - bar;
  const z = kf(frame, cam as Key[], 'z', EASE_CAM, 1);
  const scale = (vw / imgW) * z;
  const dispW = imgW * scale, dispH = imgH * scale;
  let x = kf(frame, cam as Key[], 'x', EASE_CAM, 0.5) * dispW - vw / 2;
  let y = kf(frame, cam as Key[], 'y', EASE_CAM, 0) * dispH - vh / 2;
  x = Math.max(0, Math.min(dispW - vw, x));
  y = Math.max(0, Math.min(Math.max(0, dispH - vh), y));
  return (
    <div
      style={{
        width: w, height: h, borderRadius: 20, overflow: 'hidden', background: dark ? '#111' : '#fff',
        boxShadow: '0 50px 120px -30px rgba(120,30,10,0.45), 0 18px 40px -20px rgba(0,0,0,0.25), 0 0 0 1px rgba(154,52,18,0.10)',
        position: 'relative',
      }}
    >
      <div style={{ height: bar, display: 'flex', alignItems: 'center', gap: 10, padding: '0 22px', background: dark ? '#1c1917' : '#FBF7F4', borderBottom: `1px solid ${dark ? '#292524' : '#F3E3D8'}` }}>
        {['#FF5F57', '#FEBC2E', '#28C840'].map((c) => (
          <div key={c} style={{ width: 14, height: 14, borderRadius: 7, background: c }} />
        ))}
        <div
          style={{
            marginLeft: 24, flex: 1, maxWidth: 720, height: 32, borderRadius: 10, background: dark ? '#292524' : '#fff',
            border: `1px solid ${dark ? '#3f3f46' : '#F1E2D6'}`, display: 'flex', alignItems: 'center', gap: 10, padding: '0 14px',
            fontFamily: UI, fontSize: 17, color: dark ? '#d6d3d1' : C.muted,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2.4"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
          <span>{url}</span>
        </div>
      </div>
      <div style={{ position: 'absolute', top: bar, left: 0, width: vw, height: vh, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', left: -x, top: -y, width: dispW, height: dispH }}>
          <Img src={staticFile(src)} style={{ width: dispW, height: dispH, display: 'block' }} />
          {children}
        </div>
      </div>
    </div>
  );
};

// ---------- 2.5D stage: places a child on a tilted plane ----------
export type StageKey = { f: number; rx?: number; ry?: number; rz?: number; s?: number; tx?: number; ty?: number; o?: number };
export const Stage: React.FC<{ keys: StageKey[]; frame?: number; persp?: number; children: React.ReactNode; ease?: (t: number) => number }> = ({ keys, frame: fr, persp = 2200, children, ease = EASE_CAM }) => {
  const own = useCurrentFrame();
  const frame = fr ?? own;
  const k = keys as Key[];
  const g = (p: string, d: number) => kf(frame, k, p, ease, d);
  return (
    <AbsoluteFill style={{ perspective: persp, perspectiveOrigin: '50% 45%', alignItems: 'center', justifyContent: 'center' }}>
      <div
        style={{
          transform: `translate(${g('tx', 0)}px, ${g('ty', 0)}px) rotateX(${g('rx', 0)}deg) rotateY(${g('ry', 0)}deg) rotateZ(${g('rz', 0)}deg) scale(${g('s', 1)})`,
          opacity: g('o', 1), transformStyle: 'preserve-3d',
        }}
      >
        {children}
      </div>
    </AbsoluteFill>
  );
};

// ---------- callout pill ----------
export const Pill: React.FC<{ at: number; text: string; x: number; y: number; icon?: string; out?: number; variant?: 'solid' | 'glass'; size?: number }> = ({ at, text, x, y, icon, out, variant = 'glass', size = 30 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sp = spring({ frame: frame - at, fps, config: SPRING });
  const o = out !== undefined ? 1 - fade(frame, out, out + 10) : 1;
  if (frame < at) return null;
  const solid = variant === 'solid';
  return (
    <div
      style={{
        position: 'absolute', left: x, top: y, transform: `translate(-50%, -50%) translateY(${(1 - sp) * 26}px) scale(${0.7 + 0.3 * sp})`,
        opacity: clamp01(sp * 1.4) * o, display: 'flex', alignItems: 'center', gap: 12, whiteSpace: 'nowrap',
        padding: `${size * 0.45}px ${size * 0.8}px`, borderRadius: 999, fontFamily: UI, fontWeight: 650, fontSize: size,
        color: solid ? '#fff' : C.ink, background: solid ? GRAD : 'rgba(255,255,255,0.86)',
        border: solid ? 'none' : `1.5px solid ${C.line}`, backdropFilter: 'blur(14px)',
        boxShadow: solid ? '0 18px 40px -12px rgba(220,38,38,0.55)' : '0 18px 40px -16px rgba(124,45,18,0.35)',
      }}
    >
      {icon ? <span style={{ fontSize: size * 1.0 }}>{icon}</span> : <span style={{ width: size * 0.36, height: size * 0.36, borderRadius: 99, background: solid ? '#fff' : GRAD }} />}
      {text}
    </div>
  );
};

// ---------- chapter title card ----------
export const Chapter: React.FC<{ num: string; title: string; kicker: string; icon: string; dur: number }> = ({ num, title, kicker, icon, dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const iconS = spring({ frame: frame - 2, fps, config: { damping: 12, mass: 0.9, stiffness: 120 } });
  const out = interpolate(frame, [dur - 12, dur], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE_CAM });
  const words = title.split(' ');
  return (
    <AbsoluteFill style={{ opacity: 1 - out, transform: `scale(${1 + out * 0.35})`, filter: `blur(${out * 10}px)` }}>
      <div style={{ position: 'absolute', left: 250, top: 300, width: 480, height: 480, transform: `translateY(${Math.sin(frame / 14) * 8 + (1 - iconS) * 120}px) scale(${0.5 + 0.5 * iconS}) rotate(${(1 - iconS) * -18}deg)`, opacity: clamp01(iconS * 1.5) }}>
        <Img src={staticFile(`icons/${icon}.png`)} style={{ width: '100%', height: '100%', objectFit: 'contain', filter: 'drop-shadow(0 40px 50px rgba(154,27,27,0.35))' }} />
      </div>
      <div style={{ position: 'absolute', left: 820, top: 330, width: 1000 }}>
        <div style={{ fontFamily: UI, fontWeight: 700, fontSize: 30, letterSpacing: '0.22em', color: C.orange, opacity: fade(frame, 4, 16), transform: `translateX(${(1 - fade(frame, 4, 18)) * -30}px)` }}>
          {num} — {kicker.toUpperCase()}
        </div>
        <div style={{ marginTop: 18, display: 'flex', flexWrap: 'wrap', gap: '0 26px' }}>
          {words.map((w, i) => {
            const t = fade(frame, 8 + i * 4, 26 + i * 4);
            return (
              <span key={i} style={{ fontFamily: UI, fontWeight: 800, fontSize: 118, lineHeight: 1.05, letterSpacing: '-0.035em', backgroundImage: GRAD, WebkitBackgroundClip: 'text', color: 'transparent', opacity: t, transform: `translateY(${(1 - t) * 40}px)`, filter: `blur(${(1 - t) * 12}px)`, display: 'inline-block' }}>
                {w}
              </span>
            );
          })}
        </div>
        <div style={{ marginTop: 22, height: 6, width: 220 * fade(frame, 18, 40), background: GRAD, borderRadius: 3 }} />
      </div>
    </AbsoluteFill>
  );
};

// ---------- captions ----------
const display = (t: string) => t.replace(/S R T/g, 'SRT').replace(/V T T/g, 'VTT').replace(/M P 4/g, 'MP4').replace(/M P 3/g, 'MP3').replace(/4 K/g, '4K').replace('Or simply, ask', 'Or simply ask');
export const Captions: React.FC<{ chunks: { text: string; start: number; end: number }[]; from: number; dark?: boolean }> = ({ chunks, from, dark }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = (frame - from) / fps;
  const c = chunks.find((c) => t >= c.start && t < c.end + 0.15);
  if (!c) return null;
  const local = t - c.start;
  const inT = clamp01(local / 0.18);
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 54, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
      <div
        style={{
          fontFamily: UI, fontWeight: 600, fontSize: 44, lineHeight: 1.2, letterSpacing: '-0.01em', color: dark ? '#fff' : C.ink,
          padding: '14px 30px', borderRadius: 18, background: dark ? 'rgba(20,12,10,0.62)' : 'rgba(255,255,255,0.80)',
          backdropFilter: 'blur(16px)', boxShadow: '0 12px 40px -18px rgba(124,45,18,0.45)', border: `1px solid ${dark ? 'rgba(255,255,255,0.08)' : 'rgba(253,186,116,0.55)'}`,
          opacity: inT, transform: `translateY(${(1 - inT) * 10}px)`, maxWidth: 1780, textAlign: 'center',
        }}
      >
        {display(c.text)}
      </div>
    </div>
  );
};

// ---------- small chapter tag shown during feature footage ----------
export const Tag: React.FC<{ num: string; title: string; at?: number }> = ({ num, title, at = 0 }) => {
  const frame = useCurrentFrame();
  const t = fade(frame, at, at + 14);
  return (
    <div style={{ position: 'absolute', left: 64, top: 52, display: 'flex', alignItems: 'center', gap: 14, opacity: t, transform: `translateX(${(1 - t) * -24}px)` }}>
      <div style={{ fontFamily: UI, fontWeight: 800, fontSize: 24, color: '#fff', background: GRAD, borderRadius: 10, padding: '6px 12px' }}>{num}</div>
      <div style={{ fontFamily: UI, fontWeight: 700, fontSize: 28, color: C.ink, letterSpacing: '-0.01em' }}>{title}</div>
    </div>
  );
};

export const Logo: React.FC<{ size: number; color?: string }> = ({ size, color = C.orange }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2} strokeLinejoin="round">
    <path d="M6 3.5v17l14-8.5z" />
  </svg>
);
