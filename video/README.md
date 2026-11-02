# YouTube Mate: demo video source

The product demo video is built from code with [Remotion](https://remotion.dev) (React → MP4). It uses real screenshots of the app, 2.5D camera moves, spring-animated overlays, captions, narration, background music and sound effects.

Rendered output: [`docs/demo/youtube-mate-demo.mp4`](../docs/demo/youtube-mate-demo.mp4) (and a no-music version, `youtube-mate-demo-nobgm.mp4`).

## Render

```bash
cd video
npm install
npm run studio          # live preview in the browser
npm run render          # out/youtube-mate-demo.mp4 (with music)
npm run render:nobgm    # out/youtube-mate-demo-nobgm.mp4 (narration + SFX only)
```

If Remotion can't download its headless Chrome, point it at a local one with `REMOTION_CHROME=/path/to/chrome-headless-shell`.

## How it is put together

| Path | What it holds |
|---|---|
| `src/timeline.ts` | The single source of truth for timing. Each scene starts on a bar of the music (123.9 BPM). The brand reveal lands on the kick drop at 11.5 s. |
| `src/scenes/Intro.tsx` | The hook ("a dozen tabs"), the cards collapsing on a riser, then the wordmark slam and hero page rise. |
| `src/scenes/Features.tsx` | Seven feature chapters. Each opens with a chapter card (the app's 3D icon plus a kinetic title), then cuts to screenshot shots with whip-pan transitions and callout pills. |
| `src/scenes/Outro.tsx` | A tilted wall of every page, the four tagline words, then the final lockup. |
| `src/components/kit.tsx` | Browser window with an in-window camera, 2.5D stage, pills, chapter cards, captions. |
| `src/Sound.tsx` | The BGM (ducked under the narration), narration clips, and the SFX cue sheet (every cue is written relative to a scene or narration line). |
| `src/captions.json` | Caption timings generated from narration pauses by `script/make_captions.py`. |
| `script/narration.json` | The narration script. |
| `public/shots/` | Screenshots captured with `scripts/capture-screenshots.js` (Playwright, mocked API) plus the existing app captures. |

Visual tokens come from the app itself: the cream page wash, the orange→red gradient (`#F97316 → #DC2626`), Inter for UI text, Bileha for the wordmark, and the app's own 3D feature icons.

## Script and storyboard (≈ 2:15)

| # | Time | Visual | Narration |
|---|---|---|---|
| 1 | 0:00 | The play-logo is drawn. Four "everyday job" cards pop in, then 12 real app tabs scatter, collapse on a riser and slam into the **YouTube Mate** wordmark on the music drop. The hero page rises in. | *Sharing links. Reading transcripts. Watching with friends. Saving videos for later. Your YouTube workflow lives in a dozen different tabs. Meet YouTube Mate: one workspace for everything you do with YouTube.* |
| 2 | 0:17 | **01 URL Shortening.** Camera pushes into the form (custom alias, start time). A long URL collapses into a `ytmate.co` short link. Pills show QR code, click analytics and expiry, then bulk mode. | *Start with sharing. Paste any YouTube link, give it a custom alias, and even set the exact second it should start playing. Every short link comes with a QR code, click analytics, and an optional expiry date. Got a whole list? Shorten them all at once, in bulk.* |
| 3 | 0:35 | **02 Transcript & Summary.** Input settings, then a scroll through timestamped segments. The Brief, Detailed and Key points switch cycles, and TXT, JSON, SRT and VTT export cards deal in. | *Short on time? Generate a full transcript with timestamps and speakers, then let AI summarize it. Brief, detailed, or just the key points. Search inside it, copy it, or export it as text, SRT, or VTT.* |
| 4 | 0:50 | **03 Ask the Video (RAG).** An animated pipeline: Transcript → Chunk + embed → Pinecone → Retrieve → LLM → streamed answer, with a question dropping into the retriever. Then the real Q&A chat with pills for timestamps, SSE streaming, Gemini premium and image attachments. | *Or simply ask the video. YouTube Mate indexes the transcript into a vector database, retrieves the most relevant moments, and streams back an answer, with timestamps you can jump straight to. In premium mode, Gemini watches the video itself, and you can even attach screenshots to your question.* |
| 5 | 1:10 | **04 Group Streaming.** The lobby and room code, then the live room on a tilted 2.5D plane with an "In sync" badge, floating emoji reactions and pills for the queue, chat and host controls. | *Better together? Create a watch party, share the room code, and everyone's playback stays perfectly in sync. Build a shared queue, chat live, send emoji reactions, and let the host stay in control.* |
| 6 | 1:23 | **05 Collaborative Playlists.** The playlist grid with import, a row dragged to reorder, Viewer/Editor/Admin role cards, then comments and the activity log. | *Curate as a team. Import any YouTube playlist, reorder it with drag and drop, and invite collaborators as viewers, editors, or admins, with comments and an activity log to keep everyone on the same page.* |
| 7 | 1:39 | **06 MP4 · MP3 · Playlists.** A 3D carousel turns through Video → Audio → Playlist, then video selection, then batch progress bars filling. | *And when you need it offline, download videos as MP4 in up to 4K, extract crisp MP3 audio, or pick the videos you want from an entire playlist, and grab them in one batch, with live progress for every file.* |
| 8 | 1:54 | **07 Plans & Subscriptions.** The pricing page with a spotlight on Pro and a Stripe Checkout pill. | *Start for free. When you need more, upgrade to Pro or Exclusive in seconds, with secure Stripe checkout.* |
| 9 | 2:02 | A tilted wall of pages with "Share it. Understand it. Watch it together. Keep it.", then riser → impact → sparkle into the final lockup with the URL and GitHub. | *Share it. Understand it. Watch it together. Keep it. YouTube Mate. Your ultimate companion for YouTube.* |

## Narration

The narration in `public/vo/*.mp3` was generated locally with [Kokoro](https://github.com/thewh1teagle/kokoro-onnx) (voice `af_heart`) using `script/tts_kokoro.py`. To use an ElevenLabs (or any other) voice instead:

1. Generate one clip per entry in `script/narration.json`.
2. Save the clips as `public/vo/<id>.mp3`, using the same file names.
3. Run `python3 script/make_captions.py` to re-time the captions, then re-render. Scene lengths are fixed to the music bars, so keep each clip within about ±1 s of the current length (`src/captions.json` lists the durations).

## Audio credits

The background music (`bgm-tech-house`) and sound effects come from the free-for-commercial-use library bundled with the video-shotcraft skill. See `public/audio/ATTRIBUTION.md`.
