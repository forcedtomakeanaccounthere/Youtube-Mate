import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { SHOT, ShotId } from '../shots';
import { EASE_CAM, EASE_OUT } from '../theme';
import { Browser, CamKey, Stage, StageKey } from './kit';

const APP = 'youtube-mate-mu.vercel.app';

/**
 * One screenshot "shot": a browser window on a 2.5D stage with an in-window
 * camera. Entry/exit are whip-pans (horizontal travel + directional blur) so
 * consecutive shots read as one continuous camera move across the cut.
 */
export const Shot: React.FC<{
  id: ShotId; path: string; dur: number; cam: CamKey[]; stage?: StageKey[];
  enter?: 'whip' | 'rise' | 'none'; exit?: 'whip' | 'none'; w?: number; h?: number; dark?: boolean;
  children?: React.ReactNode; // screen-space overlays (1920x1080)
  inWindow?: React.ReactNode; // overlays in image space (use % units)
}> = ({ id, path, dur, cam, stage = [{ f: 0 }], enter = 'whip', exit = 'whip', w = 1500, h = 860, dark, children, inWindow }) => {
  const frame = useCurrentFrame();
  const s = SHOT[id];
  let tx = 0, ty = 0, rx = 0, blur = 0, op = 1, sc = 1;
  if (enter === 'whip') {
    const t = interpolate(frame, [0, 12], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE_OUT });
    tx += (1 - t) * 1700; blur += (1 - t) * 26;
  } else if (enter === 'rise') {
    const t = interpolate(frame, [0, 26], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE_OUT });
    ty += (1 - t) * 760; rx += (1 - t) * 38; sc *= 0.86 + 0.14 * t; op = Math.min(1, t * 2);
  }
  if (exit === 'whip') {
    const t = interpolate(frame, [dur - 9, dur], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE_CAM });
    tx -= t * 1700; blur += t * 26;
  }
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ transform: `translate(${tx}px, ${ty}px)`, filter: blur > 0.5 ? `blur(${blur}px)` : undefined, opacity: op }}>
        <Stage keys={stage}>
          <div style={{ transform: `perspective(2000px) rotateX(${rx}deg) scale(${sc})`, transformOrigin: '50% 100%' }}>
            <Browser src={s.src} imgW={s.w} imgH={s.h} url={`${APP}${path}`} cam={cam} w={w} h={h} dark={dark}>
              {inWindow}
            </Browser>
          </div>
        </Stage>
        {children}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
