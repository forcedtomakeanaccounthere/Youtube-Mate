# YouTube Mate — Backend Test Suite

All test scripts live in `backend/tests/` and run against a **live local server** (no mocking).
They use plain Node.js + axios — no external test framework required.

---

## Prerequisites

| Requirement | Details |
|---|---|
| Backend running | `npm run dev` inside `backend/` |
| MongoDB running | local or Atlas |
| Pre-verified test user | run `node scripts/create-test-user.js` once |
| `axios` installed | included in `devDependencies` |

---

## Quick Start

```bash
# From the backend/ directory

# 1. Start the server (separate terminal)
npm run dev

# 2. Run every suite
node tests/run-all-tests.js

# 3. Or run a single suite
node tests/test-auth.js
node tests/test-url-shortener.js
node tests/test-transcript.js
node tests/test-playlists.js
node tests/test-stream-rooms.js
node tests/test-video-qa.js
node tests/test-downloads.js
node tests/test-stripe.js
node tests/test-analytics.js
node tests/test-health-and-rate-limits.js
```

---

## Environment Variables

All variables are optional. Defaults work for a standard local setup.

| Variable | Default | Purpose |
|---|---|---|
| `BACKEND_URL` | `http://localhost:5000` | Backend base URL |
| `TEST_EMAIL` | `testuser_ytmate@example.com` | Pre-verified test user email |
| `TEST_PASSWORD` | `TestPassword123` | Test user password |
| `RUN_DOWNLOAD` | `false` | Enable full yt-dlp download lifecycle tests |
| `RUN_PREMIUM` | `false` | Enable Gemini premium Q&A tests (uses daily quota) |

```bash
# Example — custom user + full download test
TEST_EMAIL=myuser@gmail.com TEST_PASSWORD=MyPass123 RUN_DOWNLOAD=true node tests/run-all-tests.js
```

---

## Test Suites

### `test-health-and-rate-limits.js`
**Infrastructure sanity checks — run this first.**

- `GET /health` — server health check
- Swagger UI at `/api-docs/` and OpenAPI spec at `/api-docs.json`
- CORS preflight headers
- 404 handler for unknown routes
- Rate limiter burst tests for transcript (5/15min) and Q&A (10/min) endpoints

### `test-auth.js`
**Authentication flows.**

- Login with valid credentials → token + user object
- Login with wrong password → 401
- Non-existent email → 401
- `GET /api/auth/me` with valid / invalid / missing token
- Logout
- Forgot password — no user enumeration (unknown email returns generic success)
- Duplicate email registration guard

### `test-url-shortener.js`
**URL shortening CRUD.**

- Create short URL (basic, custom alias, timestamp embedding)
- Duplicate alias → 400 with suggestion
- Bulk shorten — summary stats
- List user URLs with pagination + search
- Fetch single URL by ID
- Update tags/notes
- Soft-delete

### `test-transcript.js`
**Async transcript + summarisation pipeline.**

- Start transcript job → get `transcriptId`
- Poll `GET /api/transcript/:id/status` until `completed` or `failed`
- Fetch full transcript object (content array + summary)
- Export as `txt`, `json`, `srt`, `vtt`
- Regenerate summary with custom segments
- Cache stats
- Delete transcript

> **Tip:** Pass a different video URL as a CLI arg:
> ```bash
> node tests/test-transcript.js https://youtu.be/YOUR_VIDEO_ID
> ```

### `test-playlists.js`
**Collaborative playlist management.**

- Auth sanity check
- Public listing with filter/sort/search
- Create playlist (normal + draft mode)
- My playlists with stats
- Favourites list
- Get single playlist (videos + collaborators + comments)
- Update name/description
- Invite collaborator by email (unknown email → 404 expected)
- Delete playlist

### `test-stream-rooms.js`
**Watch party / synchronized streaming.**

- Create open and approval-mode rooms
- Custom room code and bad format validation
- Fetch room by code
- Update playback state, loop, queue via PATCH
- Full join-request flow (submit → list → approve → poll decision)
- End stream → 410 Gone on subsequent fetch

### `test-video-qa.js`
**RAG-powered Video Q&A.**

- Daily usage quota check
- Create session
- List sessions for video (with `hasTranscript` flag)
- Fetch session messages
- Ask standard question (Mistral + Pinecone RAG)
- Question length guard (>500 chars → 400)
- Delete session + verify 404

> Standard questions consume your **3/day free quota**.
> Set `RUN_PREMIUM=true` to also test Gemini premium mode (uses 2/day quota).

### `test-downloads.js`
**Media download pipeline.**

- Get available formats for a video
- Download history (auth + anon + format filter)
- Queue status
- Playlist info (metadata + video list)
- **Full download lifecycle** (only with `RUN_DOWNLOAD=true`):
  - Create audio/mp3 job → poll until completed → fetch record → cancel

### `test-stripe.js`
**Subscription / payment flows.**

- Checkout session creation for `pro` and `exclusive` plans
- Free plan checkout correctly blocked (400)
- Invalid plan ID → 400
- Missing required fields → 400
- Dev plan upgrade helper (`POST /api/stripe/test-update-user`)
  - Upgrades test user to `pro` then restores to `free`

> Real Stripe Checkout sessions require a browser and cannot be completed
> in automated tests. Use `stripe listen` for webhook testing.

### `test-analytics.js`
**URL click analytics and redirect.**

- Redirect endpoint (301/302) with click tracking
- Non-existent short code → 404
- Click history, summary, geo breakdown, device breakdown
- Aggregate overview
- Access control (auth enforcement)

---

## Shared Helpers

### `helpers/auth.js`
Provides `getAuthToken()` and `authedClient()` — authenticate once and reuse.

### `helpers/logger.js`
Colour-coded test output: `pass`, `fail`, `skip`, `info`, `section`, `header`, `summary`.

---

## Summary Generation (Fallback Chain)

The transcript test exercises the full summarisation pipeline:

```
POST /api/transcript
  └─ Pinecone RAG + Gemini
       └─ (fallback) Pinecone RAG + Mistral
            └─ (fallback) Full-text Gemini
                 └─ (fallback) Full-text Mistral
                      └─ (fallback) Metadata-only
                           └─ summaryError (non-fatal)
```

A completed transcript with `summaryError !== null` is still a **pass** —
the transcript content is valid even if AI summary generation failed.

---

## Rate Limits Reference

| Endpoint group | Limit | Tested in |
|---|---|---|
| General API | 100 req / 15 min / IP | — |
| Downloads | 10 req / 1 min / IP | `test-health-and-rate-limits.js` |
| Transcript generation | 5 req / 15 min / IP | `test-health-and-rate-limits.js` |
| Video Q&A | 10 req / 1 min / IP | `test-health-and-rate-limits.js` |

---

## Adding New Tests

1. Create `backend/tests/test-<feature>.js`
2. Import helpers: `require('./helpers/logger')` and `require('./helpers/auth')`
3. Add the suite entry to `run-all-tests.js` `SUITES` array

---

Last Updated: July 31, 2026
