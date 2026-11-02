import React from 'react';
import { AbsoluteFill, interpolate, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { Backdrop, Browser, Chapter, clamp01, fade, mulberry32, Pill, Tag } from '../components/kit';
import { Shot } from '../components/Shot';
import { SHOT } from '../shots';
import { C, EASE_CAM, EASE_OUT, GRAD, SPRING, UI } from '../theme';
import { BAR_S, S, sec, voAt } from '../timeline';

/** Local frame of bar k inside a scene (bars are counted from the scene start). */
export const B = (k: number) => Math.round(k * BAR_S * 30);
const v = (id: string, idx: number) => voAt(id, idx) - S[id].from;

/** Lays out a feature scene: chapter card for bar 0, then footage shots. */
const Feature: React.FC<{ id: string; num: string; title: string; kicker: string; icon: string; children: React.ReactNode }> = ({ id, num, title, kicker, icon, children }) => (
  <AbsoluteFill>
    <Backdrop drift={S[id].from} />
    <Sequence durationInFrames={B(1) + 2} layout="none">
      <Chapter num={num} title={title} kicker={kicker} icon={icon} dur={B(1) + 2} />
    </Sequence>
    {children}
    <Sequence from={B(1)} layout="none">
      <Tag num={num} title={title} />
    </Sequence>
  </AbsoluteFill>
);

/** Shot placed between bars a..b with local frames. */
const At: React.FC<{ a: number; b: number; children: React.ReactNode }> = ({ a, b, children }) => (
  <Sequence from={B(a)} durationInFrames={B(b) - B(a)}>{children}</Sequence>
);

// ======================= 01 URL SHORTENING =======================
export const Shorten: React.FC = () => {
  const id = 'shorten';
  const o = (idx: number, a: number) => v(id, idx) - B(a); // vo time local to a shot starting at bar a
  return (
    <Feature id={id} num="01" title="URL Shortening" kicker="Share smarter" icon="url_shortener">
      <At a={1} b={4}>
        <Shot id="shorten" path="/shorten" dur={B(4) - B(1)} enter="rise"
          cam={[{ f: 0, x: 0.5, y: 0, z: 1 }, { f: 26, x: 0.5, y: 0, z: 1 }, { f: 70, x: 0.3, y: 0.4, z: 1.6 }, { f: 120, x: 0.3, y: 0.44, z: 1.6 }, { f: 165, x: 0.5, y: 0.3, z: 1.05 }]}
          stage={[{ f: 0, ry: 0 }, { f: 165, ry: -4 }]}>
          <Pill at={o(1, 1)} text="Custom alias · node-authentication" x={1350} y={360} />
          <Pill at={o(2, 1)} text="Starts at 0:45:00" icon="⏱" x={1350} y={470} />
        </Shot>
      </At>
      <At a={4} b={6}>
        <Shot id="shorten-links" path="/shorten" dur={B(6) - B(4)}
          cam={[{ f: 0, x: 0.5, y: 0.78, z: 1.25 }, { f: 110, x: 0.45, y: 0.86, z: 1.45 }]} stage={[{ f: 0, rx: 6, ry: 8 }, { f: 116, rx: 2, ry: 2 }]}>
          <LinkMorph at={4} />
          <Pill at={Math.max(66, o(3, 4))} text="QR code" icon="▦" x={1520} y={300} variant="solid" />
          <Pill at={Math.max(66, o(3, 4)) + 14} text="Click analytics" icon="📈" x={1560} y={410} />
        </Shot>
      </At>
      <At a={6} b={9}>
        <Shot id="shorten-bulk" path="/shorten" dur={B(9) - B(6)} exit="none"
          cam={[{ f: 0, x: 0.5, y: 0.42, z: 1.35 }, { f: 120, x: 0.5, y: 0.5, z: 1.5 }, { f: 174, x: 0.5, y: 0.45, z: 1.2 }]} stage={[{ f: 0, ry: -12, rx: 4 }, { f: 174, ry: -4, rx: 0, s: 0.97 }]}>
          <Pill at={o(4, 6)} text="Optional expiry date" icon="📅" x={420} y={330} />
          <Pill at={o(6, 6)} text="Bulk mode · one URL per line" x={1430} y={330} variant="solid" />
        </Shot>
      </At>
    </Feature>
  );
};

/** A long YouTube URL collapses into a short ytmate link pill. */
const LinkMorph: React.FC<{ at: number }> = () => {
  const frame = useCurrentFrame();
  const t = interpolate(frame, [12, 40], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE_CAM });
  const outT = fade(frame, 60, 74);
  const long = 'https://www.youtube.com/watch?v=OWeruyqhiTo&list=PLinedj3B30sDby4Al-i13hQJGQoRQDfPo&t=2700s';
  const shortU = 'ytmate.co/node-auth';
  const shown = Math.round(long.length - (long.length - 0) * t);
  return (
    <div style={{ position: 'absolute', left: 960, top: 500, transform: `translate(-50%, -50%) scale(${1.25 - outT * 0.25})`, opacity: fade(frame, 2, 10) * (1 - outT) }}>
      <div style={{ fontFamily: UI, fontWeight: 600, fontSize: 30, padding: '20px 32px', borderRadius: 20, background: t < 1 ? '#fff' : GRAD, color: t < 1 ? C.ink2 : '#fff', boxShadow: '0 30px 60px -20px rgba(124,45,18,0.45)', border: `1.5px solid ${C.line}`, whiteSpace: 'nowrap', display: 'flex', gap: 14, alignItems: 'center' }}>
        <span>🔗</span>
        <span>{t < 1 ? long.slice(0, shown) : shortU}</span>
      </div>
    </div>
  );
};

// ======================= 02 TRANSCRIPT & SUMMARY =======================
export const Transcript: React.FC = () => {
  const id = 'transcript';
  const o = (idx: number, a: number) => v(id, idx) - B(a);
  return (
    <Feature id={id} num="02" title="Transcript & Summary" kicker="Read it in seconds" icon="Transcription_generator">
      <At a={1} b={3}>
        <Shot id="transcript-input" path="/transcript" dur={B(3) - B(1)} enter="rise"
          cam={[{ f: 0, x: 0.5, y: 0, z: 1 }, { f: 30, x: 0.5, y: 0, z: 1 }, { f: 110, x: 0.45, y: 0.45, z: 1.55 }]}>
          <Pill at={o(1, 1)} text="Timestamps" icon="⏱" x={1440} y={330} />
          <Pill at={o(1, 1) + 12} text="Speaker labels" icon="🎙" x={1480} y={440} />
        </Shot>
      </At>
      <At a={3} b={6}>
        <Shot id="transcript-result" path="/transcript" dur={B(6) - B(3)}
          cam={[{ f: 0, x: 0.35, y: 0.25, z: 1.35 }, { f: 90, x: 0.35, y: 0.78, z: 1.6 }, { f: 174, x: 0.4, y: 0.82, z: 1.5 }]} stage={[{ f: 0, ry: 10 }, { f: 174, ry: 3 }]}>
          <ModeCycle at={o(3, 3)} />
        </Shot>
      </At>
      <At a={6} b={8}>
        <Shot id="transcript-result" path="/transcript" dur={B(8) - B(6)} exit="none"
          cam={[{ f: 0, x: 0.85, y: 0.7, z: 1.6 }, { f: 116, x: 0.82, y: 0.8, z: 1.7 }]} stage={[{ f: 0, ry: -10 }, { f: 116, ry: -4 }]}>
          <ExportDeck at={o(4, 6)} />
        </Shot>
      </At>
    </Feature>
  );
};

const ModeCycle: React.FC<{ at: number }> = ({ at }) => {
  const frame = useCurrentFrame();
  const modes = ['Brief', 'Detailed', 'Key points'];
  const step = Math.max(0, Math.min(2, Math.floor((frame - at) / 22)));
  const t = fade(frame, at - 8, at + 6);
  const x = interpolate(frame - at, [0, 10, 22, 32, 44, 54], [0, 0, 0, 1, 1, 2], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE_OUT });
  return (
    <div style={{ position: 'absolute', left: 960, top: 170, transform: 'translateX(-50%)', opacity: t }}>
      <div style={{ fontFamily: UI, fontWeight: 700, fontSize: 24, letterSpacing: '0.18em', color: C.orange, textAlign: 'center', marginBottom: 12 }}>AI SUMMARY</div>
      <div style={{ position: 'relative', display: 'flex', background: '#fff', borderRadius: 999, padding: 8, boxShadow: '0 30px 60px -20px rgba(124,45,18,0.45)', border: `1.5px solid ${C.line}` }}>
        <div style={{ position: 'absolute', top: 8, left: 8 + x * 240, width: 240, height: 70, borderRadius: 999, background: GRAD }} />
        {modes.map((m, i) => (
          <div key={m} style={{ position: 'relative', width: 240, height: 70, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: UI, fontWeight: 700, fontSize: 30, color: i === step ? '#fff' : C.ink2 }}>{m}</div>
        ))}
      </div>
    </div>
  );
};

const ExportDeck: React.FC<{ at: number }> = ({ at }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fmts = ['TXT', 'JSON', 'SRT', 'VTT'];
  return (
    <div style={{ position: 'absolute', left: 300, top: 300, width: 900, height: 500 }}>
      {fmts.map((f, i) => {
        const sp = spring({ frame: frame - at - i * 5, fps, config: SPRING });
        if (frame < at + i * 5) return null;
        return (
          <div key={f} style={{ position: 'absolute', left: i * 190, top: 60 + (i % 2) * 30, width: 170, height: 210, borderRadius: 22, background: '#fff', border: `1.5px solid ${C.line}`, boxShadow: '0 30px 50px -20px rgba(124,45,18,0.5)', transform: `translate(${(1 - sp) * -500}px, ${(1 - sp) * 200}px) rotate(${(1 - sp) * -30 + (i - 1.5) * 3}deg)`, opacity: clamp01(sp * 1.5), display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
            <div style={{ width: 70, height: 84, borderRadius: 10, background: GRAD, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 10, color: '#fff', fontFamily: UI, fontWeight: 800, fontSize: 18 }}>.{f.toLowerCase()}</div>
            <div style={{ fontFamily: UI, fontWeight: 800, fontSize: 36, color: C.ink }}>{f}</div>
          </div>
        );
      })}
    </div>
  );
};

// ======================= 03 ASK THE VIDEO (RAG) =======================
export const Rag: React.FC = () => {
  const id = 'rag';
  const o = (idx: number, a: number) => v(id, idx) - B(a);
  return (
    <Feature id={id} num="03" title="Ask the Video" kicker="AI · RAG pipeline" icon="Video_Summarization">
      <At a={1} b={5}>
        <RagDiagram t0={o(1, 1)} retrieveAt={o(2, 1)} answerAt={o(3, 1)} dur={B(5) - B(1)} />
      </At>
      <At a={5} b={10}>
        <Shot id="qa" path="/transcript" dur={B(10) - B(5)} exit="none"
          cam={[{ f: 0, x: 0.7, y: 0.32, z: 1.6 }, { f: 60, x: 0.7, y: 0.34, z: 1.6 }, { f: 160, x: 0.62, y: 0.82, z: 1.65 }, { f: 240, x: 0.3, y: 0.6, z: 1.35 }, { f: 290, x: 0.5, y: 0.5, z: 1.05 }]}
          stage={[{ f: 0, ry: 8, rx: 4 }, { f: 290, ry: -6, rx: 2 }]}>
          <Pill at={o(4, 5)} text="[2:47] → jump to the moment" icon="⏱" x={430} y={300} variant="solid" />
          <Pill at={o(5, 5)} text="Premium · Gemini analyzes the video" icon="✦" x={1440} y={290} />
          <Pill at={o(6, 5)} text="Attach up to 2 images" icon="🖼" x={1440} y={400} />
          <Pill at={o(5, 5) - 20} text="Streaming answers (SSE)" icon="⚡" x={460} y={410} />
        </Shot>
      </At>
    </Feature>
  );
};

const NODES = [
  { k: 'Transcript', d: 'YouTube captions', ic: '📄' },
  { k: 'Chunk + embed', d: 'semantic vectors', ic: '🧩' },
  { k: 'Pinecone', d: 'vector database', ic: '🗄' },
  { k: 'Retrieve', d: 'top-k moments', ic: '🔎' },
  { k: 'LLM', d: 'Mistral · Gemini', ic: '✦' },
  { k: 'Answer', d: 'streamed + timestamps', ic: '💬' },
];

const RagDiagram: React.FC<{ t0: number; retrieveAt: number; answerAt: number; dur: number }> = ({ t0, retrieveAt, answerAt, dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const nodeAt = (i: number) => (i < 3 ? t0 + i * 22 : i < 5 ? retrieveAt + (i - 3) * 20 : answerAt);
  const enter = interpolate(frame, [0, 14], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE_OUT });
  const exit = interpolate(frame, [dur - 9, dur], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE_CAM });
  const xs = NODES.map((_, i) => 210 + i * 300);
  const y = 560;
  const qT = fade(frame, retrieveAt - 30, retrieveAt - 10);
  const qDrop = interpolate(frame, [retrieveAt - 10, retrieveAt + 4], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE_CAM });
  const question = 'What mistakes did the candidates make?';
  const typed = question.slice(0, Math.max(0, Math.floor((frame - (retrieveAt - 40)) * 1.6)));
  const answer = 'The first candidate rambled about Terraform for 6 minutes [2:47] instead of answering directly…';
  const ans = answer.slice(0, Math.max(0, Math.floor((frame - answerAt - 6) * 1.5)));
  return (
    <AbsoluteFill style={{ opacity: enter, transform: `translateX(${exit * -1700}px)`, filter: exit > 0.01 ? `blur(${exit * 26}px)` : undefined }}>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 150, textAlign: 'center', fontFamily: UI, fontWeight: 800, fontSize: 54, letterSpacing: '-0.03em', color: C.ink, opacity: fade(frame, 4, 20) }}>
        Retrieval-augmented answers, grounded in the video
      </div>
      <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0 }}>
        <defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stopColor={C.orange} /><stop offset="1" stopColor={C.red} /></linearGradient></defs>
        {xs.slice(0, -1).map((x, i) => {
          const t = interpolate(frame, [nodeAt(i) + 6, nodeAt(i + 1)], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
          const x2 = xs[i + 1];
          return (
            <g key={i}>
              <line x1={x + 105} y1={y} x2={x + 105 + (x2 - x - 210) * t} y2={y} stroke="url(#g)" strokeWidth={5} strokeLinecap="round" />
              {t >= 1 && [0, 1, 2].map((p) => {
                const ph = ((frame * 0.035 + p / 3 + i * 0.13) % 1);
                return <circle key={p} cx={x + 105 + (x2 - x - 210) * ph} cy={y} r={7} fill="#fff" stroke={C.orange} strokeWidth={3} opacity={Math.sin(ph * Math.PI)} />;
              })}
            </g>
          );
        })}
      </svg>
      {NODES.map((n, i) => {
        const sp = spring({ frame: frame - nodeAt(i), fps, config: SPRING });
        if (frame < nodeAt(i)) return null;
        const hot = i === 2 || i === 4;
        return (
          <div key={n.k} style={{ position: 'absolute', left: xs[i] - 105, top: y - 105, width: 210, height: 210, borderRadius: 34, background: hot ? GRAD : '#fff', border: hot ? 'none' : `2px solid ${C.line}`, boxShadow: '0 30px 60px -24px rgba(124,45,18,0.5)', transform: `scale(${0.6 + 0.4 * sp}) translateY(${(1 - sp) * 40}px)`, opacity: clamp01(sp * 1.5), display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, color: hot ? '#fff' : C.ink }}>
            <div style={{ fontSize: 58 }}>{n.ic}</div>
            <div style={{ fontFamily: UI, fontWeight: 800, fontSize: 28, letterSpacing: '-0.02em' }}>{n.k}</div>
            <div style={{ fontFamily: UI, fontWeight: 500, fontSize: 18, opacity: 0.8, textAlign: 'center', padding: '0 10px' }}>{n.d}</div>
          </div>
        );
      })}
      {/* the user's question drops into the retriever */}
      {frame >= retrieveAt - 40 && (
        <div style={{ position: 'absolute', left: xs[3], top: 300 + qDrop * 160, transform: `translate(-50%, 0) scale(${1 - qDrop * 0.6})`, opacity: qT * (1 - qDrop), fontFamily: UI, fontWeight: 600, fontSize: 32, color: '#fff', background: C.ink, padding: '16px 28px', borderRadius: '22px 22px 6px 22px', whiteSpace: 'nowrap' }}>
          {typed}<span style={{ opacity: frame % 16 < 8 ? 1 : 0 }}>▍</span>
        </div>
      )}
      {/* streamed answer */}
      {frame >= answerAt && (
        <div style={{ position: 'absolute', left: 960, top: 740, transform: 'translateX(-50%)', width: 1300, fontFamily: UI, fontWeight: 500, fontSize: 32, lineHeight: 1.35, color: C.ink, background: '#fff', borderRadius: 22, padding: '22px 30px', border: `1.5px solid ${C.line}`, boxShadow: '0 30px 60px -24px rgba(124,45,18,0.45)', opacity: fade(frame, answerAt, answerAt + 10) }}>
          {ans}<span style={{ color: C.orange }}>▍</span>
        </div>
      )}
    </AbsoluteFill>
  );
};

// ======================= 04 GROUP STREAMING =======================
export const Stream: React.FC = () => {
  const id = 'stream';
  const o = (idx: number, a: number) => v(id, idx) - B(a);
  return (
    <Feature id={id} num="04" title="Group Streaming" kicker="Watch together, in sync" icon="Shared_Streaming">
      <At a={1} b={3}>
        <Shot id="stream-lobby" path="/stream" dur={B(3) - B(1)} enter="rise"
          cam={[{ f: 0, x: 0.5, y: 0.1, z: 1 }, { f: 30, x: 0.5, y: 0.1, z: 1 }, { f: 110, x: 0.5, y: 0.32, z: 1.5 }]}>
          <Pill at={o(1, 1) + 20} text="Room code · A1356Z" icon="🔑" x={1500} y={330} variant="solid" />
        </Shot>
      </At>
      <At a={3} b={7}>
        <Shot id="stream-room" path="/stream/dhurandhar-night/A1356Z" dur={B(7) - B(3)} exit="none" w={1640} h={830}
          cam={[{ f: 0, x: 0.3, y: 0.3, z: 1.5 }, { f: 90, x: 0.3, y: 0.3, z: 1.35 }, { f: 160, x: 0.72, y: 0.4, z: 1.45 }, { f: 232, x: 0.5, y: 0.4, z: 1.0 }]}
          stage={[{ f: 0, ry: 16, rx: 6 }, { f: 232, ry: 4, rx: 2 }]}>
          <SyncBadge at={o(2, 3)} />
          <Reactions at={o(3, 3)} />
          <Pill at={o(3, 3) + 8} text="Shared queue" icon="☰" x={1500} y={290} />
          <Pill at={o(3, 3) + 20} text="Live chat" icon="💬" x={1540} y={400} />
          <Pill at={o(4, 3)} text="Host controls · lock playback" icon="🔒" x={1460} y={510} variant="solid" />
        </Shot>
      </At>
    </Feature>
  );
};

const SyncBadge: React.FC<{ at: number }> = ({ at }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sp = spring({ frame: frame - at, fps, config: SPRING });
  if (frame < at) return null;
  const ring = ((frame - at) % 30) / 30;
  const names = ['A', 'R', 'K'];
  return (
    <div style={{ position: 'absolute', left: 480, top: 300, transform: `translate(-50%,-50%) scale(${0.7 + 0.3 * sp})`, opacity: clamp01(sp * 1.5), display: 'flex', alignItems: 'center', gap: 18, background: 'rgba(17,24,39,0.88)', color: '#fff', padding: '18px 28px', borderRadius: 999, fontFamily: UI, fontWeight: 700, fontSize: 30, boxShadow: '0 20px 50px -16px rgba(0,0,0,0.6)' }}>
      <div style={{ position: 'relative', width: 16, height: 16 }}>
        <div style={{ position: 'absolute', inset: 0, borderRadius: 99, background: '#22c55e' }} />
        <div style={{ position: 'absolute', inset: -ring * 14, borderRadius: 99, border: '2px solid #22c55e', opacity: 1 - ring }} />
      </div>
      In sync · 1:29
      <div style={{ display: 'flex' }}>
        {names.map((n, i) => (
          <div key={n} style={{ width: 46, height: 46, borderRadius: 99, marginLeft: i ? -12 : 0, background: [C.orange, C.red, '#a855f7'][i], border: '3px solid #111827', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>{n}</div>
        ))}
      </div>
    </div>
  );
};

const Reactions: React.FC<{ at: number }> = ({ at }) => {
  const frame = useCurrentFrame();
  const em = ['❤️', '😂', '🔥', '👏', '😮', '🎉'];
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      {Array.from({ length: 16 }).map((_, i) => {
        const r = mulberry32(i * 31 + 5);
        const start = at + i * 5 + Math.floor(r() * 6);
        const life = 60;
        const t = (frame - start) / life;
        if (t < 0 || t > 1) return null;
        const x = 260 + r() * 520 + Math.sin(t * 6 + i) * 20;
        const y = 820 - t * 520;
        return <div key={i} style={{ position: 'absolute', left: x, top: y, fontSize: 54 + r() * 20, opacity: Math.sin(t * Math.PI), transform: `scale(${0.6 + Math.min(1, t * 4) * 0.4})` }}>{em[i % em.length]}</div>;
      })}
    </AbsoluteFill>
  );
};

// ======================= 05 COLLABORATIVE PLAYLISTS =======================
export const Playlists: React.FC = () => {
  const id = 'playlists';
  const o = (idx: number, a: number) => v(id, idx) - B(a);
  return (
    <Feature id={id} num="05" title="Collaborative Playlists" kicker="Curate as a team" icon="Collaborative_Playlist">
      <At a={1} b={2}>
        <Shot id="playlists" path="/playlists" dur={B(2) - B(1)} enter="rise"
          cam={[{ f: 0, x: 0.5, y: 0.3, z: 1.05 }, { f: 58, x: 0.5, y: 0.55, z: 1.15 }]}>
          <Pill at={Math.max(10, o(1, 1))} text="Import any YouTube playlist" icon="⤓" x={1460} y={300} variant="solid" />
        </Shot>
      </At>
      <At a={2} b={3}>
        <Shot id="playlist-detail" path="/playlists/operating-systems" dur={B(3) - B(2)}
          cam={[{ f: 0, x: 0.5, y: 0.64, z: 1.55 }, { f: 58, x: 0.5, y: 0.66, z: 1.6 }]} stage={[{ f: 0, ry: -8 }, { f: 58, ry: -3 }]}
          inWindow={<DragRows />}>
          <Pill at={6} text="Drag & drop reorder" icon="↕" x={1500} y={280} />
        </Shot>
      </At>
      <At a={3} b={5}>
        <Shot id="playlist-collab" path="/playlists/operating-systems" dur={B(5) - B(3)}
          cam={[{ f: 0, x: 0.5, y: 0.6, z: 1.45 }, { f: 116, x: 0.5, y: 0.66, z: 1.6 }]} stage={[{ f: 0, ry: 8 }, { f: 116, ry: 3 }]}>
          <RoleChips at={Math.max(6, o(3, 3))} />
        </Shot>
      </At>
      <At a={5} b={8}>
        <Shot id="playlist-detail" path="/playlists/operating-systems" dur={B(8) - B(5)} exit="none"
          cam={[{ f: 0, x: 0.45, y: 0.3, z: 1.6 }, { f: 120, x: 0.5, y: 0.25, z: 1.35 }, { f: 174, x: 0.5, y: 0.22, z: 1.2 }]}>
          <Pill at={Math.max(4, o(4, 5))} text="Comments" icon="💬" x={480} y={330} />
          <Pill at={Math.max(4, o(4, 5)) + 12} text="Activity log" icon="🕒" x={480} y={440} />
        </Shot>
      </At>
    </Feature>
  );
};

/** Lifts the second video row and swaps it above the first (image-space %). */
const DragRows: React.FC = () => {
  const frame = useCurrentFrame();
  const lift = interpolate(frame, [4, 12], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE_OUT });
  const move = interpolate(frame, [12, 36], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE_CAM });
  const drop = interpolate(frame, [38, 46], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE_OUT });
  // row bboxes in the 2160x1350 capture
  const W = 2160, H = 1350;
  const r1 = { x: 160, y: 868, w: 1690, h: 215 }, r2 = { x: 160, y: 1112, w: 1690, h: 215 };
  const crop = (r: typeof r1, dy: number, lifted: number, key: string) => (
    <div key={key} style={{ position: 'absolute', left: `${(r.x / W) * 100}%`, top: `${((r.y + dy) / H) * 100}%`, width: `${(r.w / W) * 100}%`, height: `${(r.h / H) * 100}%`, backgroundImage: `url(${staticFile(SHOT['playlist-detail'].src)})`, backgroundSize: `${(W / r.w) * 100}% ${(H / r.h) * 100}%`, backgroundPosition: `${(r.x / (W - r.w)) * 100}% ${(r.y / (H - r.h)) * 100}%`, borderRadius: 14, transform: `scale(${1 + lifted * 0.03}) rotate(${lifted * -1.2}deg)`, boxShadow: lifted > 0.01 ? `0 ${30 * lifted}px ${60 * lifted}px -20px rgba(124,45,18,${0.55 * lifted})` : undefined, outline: lifted > 0.01 ? `3px solid rgba(249,115,22,${lifted})` : undefined }} />
  );
  const dyDrag = -(r2.y - r1.y) * move;
  const dyOther = (r2.y - r1.y) * move;
  const lifted = lift * (1 - drop);
  return (
    <>
      <div style={{ position: 'absolute', left: `${(r1.x / W) * 100}%`, top: `${(r1.y / H) * 100}%`, width: `${(r1.w / W) * 100}%`, height: `${((r2.y + r2.h - r1.y) / H) * 100}%`, background: '#fdf8f5' }} />
      {crop(r1, dyOther, 0, 'a')}
      {crop(r2, dyDrag, lifted, 'b')}
    </>
  );
};

const RoleChips: React.FC<{ at: number }> = ({ at }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const roles = [{ r: 'Viewer', d: 'watch & comment' }, { r: 'Editor', d: 'add & reorder' }, { r: 'Admin', d: 'invite & manage' }];
  return (
    <div style={{ position: 'absolute', left: 960, top: 200, transform: 'translateX(-50%)', display: 'flex', gap: 24 }}>
      {roles.map((x, i) => {
        const sp = spring({ frame: frame - at - i * 8, fps, config: SPRING });
        if (frame < at + i * 8) return null;
        return (
          <div key={x.r} style={{ width: 300, padding: '22px 26px', borderRadius: 24, background: i === 2 ? GRAD : '#fff', color: i === 2 ? '#fff' : C.ink, border: i === 2 ? 'none' : `1.5px solid ${C.line}`, boxShadow: '0 30px 60px -24px rgba(124,45,18,0.5)', transform: `translateY(${(1 - sp) * 60}px) scale(${0.8 + 0.2 * sp})`, opacity: clamp01(sp * 1.5), fontFamily: UI }}>
            <div style={{ fontWeight: 800, fontSize: 38 }}>{x.r}</div>
            <div style={{ fontWeight: 500, fontSize: 22, opacity: 0.8, marginTop: 4 }}>{x.d}</div>
          </div>
        );
      })}
    </div>
  );
};

// ======================= 06 DOWNLOADS =======================
export const Downloads: React.FC = () => {
  const id = 'downloads';
  const o = (idx: number, a: number) => v(id, idx) - B(a);
  return (
    <Feature id={id} num="06" title="MP4 · MP3 · Playlists" kicker="Download anything" icon="YouTube_Downloader">
      <At a={1} b={3.5}>
        <Carousel turn1={o(2, 1) - 8} turn2={o(3, 1) - 8} dur={B(3.5) - B(1)} />
      </At>
      <At a={3.5} b={5.5}>
        <Shot id="download-select" path="/download/playlist" dur={B(5.5) - B(3.5)}
          cam={[{ f: 0, x: 0.5, y: 0.35, z: 1.2 }, { f: 116, x: 0.62, y: 0.55, z: 1.55 }]} stage={[{ f: 0, ry: -10 }, { f: 116, ry: -3 }]}>
          <Pill at={14} text="8 / 8 videos selected" icon="☑" x={420} y={300} variant="solid" />
          <Pill at={30} text="1080p · MP4" x={420} y={410} />
        </Shot>
      </At>
      <At a={5.5} b={8}>
        <Shot id="download-progress" path="/download/playlist" dur={B(8) - B(5.5)} exit="none"
          cam={[{ f: 0, x: 0.62, y: 0.3, z: 1.45 }, { f: 100, x: 0.6, y: 0.45, z: 1.5 }, { f: 145, x: 0.4, y: 0.75, z: 1.6 }]} stage={[{ f: 0, ry: 10 }, { f: 145, ry: 4 }]}>
          <ProgressCard at={6} />
          <Pill at={Math.max(10, o(5, 5.5))} text="Live progress for every file" icon="⚡" x={1500} y={300} variant="solid" />
        </Shot>
      </At>
    </Feature>
  );
};

const Carousel: React.FC<{ turn1: number; turn2: number; dur: number }> = ({ turn1, turn2, dur }) => {
  const frame = useCurrentFrame();
  const items = [
    { id: 'download-video' as const, label: 'MP4 video · up to 4K', path: '/download/video' },
    { id: 'download-audio' as const, label: 'MP3 audio · pick your bitrate', path: '/download/audio' },
    { id: 'download-select' as const, label: 'Whole playlists · batch', path: '/download/playlist' },
  ];
  const step = interpolate(frame, [turn1, turn1 + 18, turn2, turn2 + 18], [0, 1, 1, 2], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE_CAM });
  const enter = interpolate(frame, [0, 22], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE_OUT });
  const exit = interpolate(frame, [dur - 9, dur], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE_CAM });
  const R = 900;
  return (
    <AbsoluteFill style={{ perspective: 2400, perspectiveOrigin: '50% 45%', opacity: enter, transform: `translateX(${exit * -1700}px)`, filter: exit > 0.01 ? `blur(${exit * 26}px)` : undefined }}>
      <AbsoluteFill style={{ transformStyle: 'preserve-3d', transform: `translateZ(${-R - 200 + enter * 200}px) rotateY(${-step * 40}deg)` }}>
        {items.map((it, i) => {
          const a = i * 40;
          const front = 1 - Math.min(1, Math.abs(step - i));
          return (
            <div key={it.id} style={{ position: 'absolute', left: 960 - 560, top: 540 - 340, transformStyle: 'preserve-3d', transform: `rotateY(${a}deg) translateZ(${R}px)`, opacity: 0.45 + 0.55 * front }}>
              <BrowserMini id={it.id} path={it.path} label={it.label} focus={front} />
            </div>
          );
        })}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const BrowserMini: React.FC<{ id: 'download-video' | 'download-audio' | 'download-select'; path: string; label: string; focus: number }> = ({ id, path, label, focus }) => {
  const s = SHOT[id];
  return (
    <div style={{ position: 'relative' }}>
      <Browser src={s.src} imgW={s.w} imgH={s.h} url={`youtube-mate-mu.vercel.app${path}`} w={1120} h={680} cam={[{ f: 0, x: 0.5, y: 0.25, z: id === 'download-select' ? 1.15 : 1.25 }]} />
      <div style={{ position: 'absolute', left: '50%', bottom: -40, transform: `translate(-50%, 0) scale(${0.85 + 0.15 * focus})`, opacity: focus, fontFamily: UI, fontWeight: 800, fontSize: 40, color: '#fff', background: GRAD, padding: '16px 34px', borderRadius: 999, whiteSpace: 'nowrap', boxShadow: '0 24px 50px -16px rgba(220,38,38,0.6)' }}>{label}</div>
    </div>
  );
};

const ProgressCard: React.FC<{ at: number }> = ({ at }) => {
  const frame = useCurrentFrame();
  const files = ['Seaborn | Boxplot', 'Seaborn | Barplots', 'Seaborn | Heatmaps'];
  const t = fade(frame, at, at + 12);
  return (
    <div style={{ position: 'absolute', left: 140, top: 560, width: 640, padding: 26, borderRadius: 24, background: 'rgba(255,255,255,0.94)', border: `1.5px solid ${C.line}`, boxShadow: '0 30px 60px -24px rgba(124,45,18,0.5)', opacity: t, transform: `translateY(${(1 - t) * 40}px)`, fontFamily: UI }}>
      <div style={{ fontWeight: 800, fontSize: 28, color: C.ink, marginBottom: 14 }}>Batch download · 3 files</div>
      {files.map((f, i) => {
        const p = clamp01((frame - at - 10 - i * 26) / 60);
        return (
          <div key={f} style={{ marginTop: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 22, fontWeight: 600, color: C.ink2 }}>
              <span>{f}</span><span style={{ color: p >= 1 ? '#16a34a' : C.orange }}>{p >= 1 ? '✓ Done' : `${Math.round(p * 100)}%`}</span>
            </div>
            <div style={{ height: 10, borderRadius: 6, background: '#FDE7D6', marginTop: 6, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${p * 100}%`, background: GRAD, borderRadius: 6 }} />
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ======================= 07 PLANS =======================
export const Plans: React.FC = () => {
  const id = 'plans';
  const o = (idx: number, a: number) => v(id, idx) - B(a);
  const frame = useCurrentFrame();
  const spot = fade(frame, B(1) + o(2, 1) - 6, B(1) + o(2, 1) + 14);
  return (
    <Feature id={id} num="07" title="Plans & Subscriptions" kicker="Start free" icon="1">
      <At a={1} b={4}>
        <Shot id="subscription" path="/subscription" dur={B(4) - B(1)} enter="rise" exit="none"
          cam={[{ f: 0, x: 0.5, y: 0.2, z: 1 }, { f: 60, x: 0.5, y: 0.45, z: 1.1 }, { f: 174, x: 0.5, y: 0.55, z: 1.3 }]}>
          <AbsoluteFill style={{ background: `radial-gradient(22% 46% at 50% 56%, transparent 60%, rgba(18,11,10,${0.55 * spot}) 100%)`, pointerEvents: 'none' }} />
          <Pill at={o(0, 1) + 8} text="Free · ₹0" x={330} y={380} />
          <Pill at={o(2, 1)} text="Pro · ₹799 / month" icon="★" x={960} y={170} variant="solid" />
          <Pill at={o(2, 1) + 14} text="Exclusive · ₹1999 / month" x={1580} y={380} />
          <Pill at={o(3, 1)} text="Secure Stripe Checkout" icon="🔒" x={960} y={920} size={34} />
        </Shot>
      </At>
    </Feature>
  );
};

