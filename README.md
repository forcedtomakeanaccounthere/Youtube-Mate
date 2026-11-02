# YouTube Mate

A full-stack YouTube content management platform. YouTube Mate combines Synchronized group streaming, AI-powered transcription and summarization, Video Q&A via a RAG pipeline, URL shortening, mp3/mp4 media downloading with option to batch download playlist, Collaborative playlist management, and Stripe-based subscription billing into a single cohesive application.

**API Documentation**: https://youtube-mate-backend.onrender.com/api-docs/

---

## Demo Video

[![YouTube Mate demo video](docs/demo/youtube-mate-demo-poster.jpg)](docs/demo/youtube-mate-demo.mp4)

A 2-minute product walkthrough covering URL shortening, transcripts and AI summaries, RAG-powered video Q&A, synchronized group streaming, collaborative playlists, MP3/MP4/playlist downloads, and subscriptions. Click the poster to open the MP4 ([no-music version](docs/demo/youtube-mate-demo-nobgm.mp4)). The video is generated from code with Remotion; source and narration script live in [`video/`](video/).

---

## Screenshots

### Landing and onboarding

| | |
|---|---|
| <img src="docs/screenshots/landing-hero.jpg" alt="Landing page hero" /> | <img src="docs/screenshots/landing-features.jpg" alt="Powerful Features section with a tab for each tool" /> |
| **Landing page.** Animated 3D hero with the YouTube Mate wordmark and calls to action. | **Feature explorer.** Tabbed showcase of every tool: URL Shortener, Ask the Video, Shared Playlists, Downloader, Group Streaming, Timestamp Share and Summarizer. |
| <img src="docs/screenshots/nav-features-menu.jpg" alt="Navbar features dropdown" /> | <img src="docs/screenshots/landing-faq.jpg" alt="FAQ accordion" /> |
| **Navigation.** The Features menu jumps straight to any tool. | **FAQ.** Accordion answers to common questions. |
| <img src="docs/screenshots/login.jpg" alt="Login and sign-up page" /> | <img src="docs/screenshots/landing-features-collab.jpg" alt="Collaborative playlists feature tab" /> |
| **Authentication.** Email/password sign-in and sign-up, Google OAuth, password reset. | **Feature detail.** Each tab explains the tool and links to it. |

### URL shortening

| | |
|---|---|
| <img src="docs/screenshots/shorten-single.jpg" alt="Single URL shortener with live video preview" /> | <img src="docs/screenshots/shorten-links.jpg" alt="Generated short links list with QR and analytics" /> |
| **Shorten a link.** Paste a YouTube URL, set a custom alias, a start timestamp, analytics and an expiry date, with a live video preview. | **Your short links.** Every link shows its thumbnail, timestamp, click count, a QR code button and a copy button. |
| <img src="docs/screenshots/shorten-bulk.jpg" alt="Bulk URL shortening" /> | <img src="docs/screenshots/dark-shorten.jpg" alt="URL shortener in dark mode" /> |
| **Bulk mode.** Shorten many URLs at once, one per line. | **Dark mode.** Every page supports a dark theme. |

### Transcripts, summaries and AI video Q&A (RAG)

| | |
|---|---|
| <img src="docs/screenshots/transcript-input.jpg" alt="Transcript generator input and settings" /> | <img src="docs/screenshots/transcript-result.jpg" alt="Generated transcript with statistics" /> |
| **Transcript settings.** Pick the language, summary type (brief, detailed, key points) and display options such as speakers, timestamps and keyword highlighting. | **Transcript and summary.** Timestamped, speaker-labelled segments with search, statistics, copy actions and TXT/JSON/SRT/VTT export. |
| <img src="docs/screenshots/video-qa-chat.jpg" alt="Ask questions about a video chat" /> | <img src="docs/screenshots/mobile-transcript.jpg" alt="Transcript page on mobile" width="300" /> |
| **Ask the Video.** RAG-powered Q&A with answers streamed over SSE and timestamped references. Premium mode uses Gemini, and chat history is kept per session. | **Responsive.** The tools work on mobile too. |

### Synchronized group streaming

| | |
|---|---|
| <img src="docs/screenshots/stream-lobby.jpg" alt="Group streaming lobby" /> | <img src="docs/screenshots/stream-room.jpg" alt="Watch party room with queue and live chat" /> |
| **Watch party lobby.** Create a room or join one with a code or invite link. | **Live room.** Synced playback over Socket.IO, a shared video queue, live chat, emoji reactions and host controls. |

### Collaborative playlists

| | |
|---|---|
| <img src="docs/screenshots/playlists-manager.jpg" alt="Playlist manager grid" /> | <img src="docs/screenshots/playlist-detail.jpg" alt="Playlist detail view" /> |
| **Playlist manager.** Browse all, mine, shared and favourite playlists with search, filters and sorting. | **Playlist view.** Play all, share, export, favourite, and reorder videos with drag and drop. |
| <img src="docs/screenshots/playlist-collaborators.jpg" alt="Playlist collaborators with roles" /> | <img src="docs/screenshots/playlist-create.jpg" alt="Create playlist form" /> |
| **Collaborators.** Invite people by email as viewer, editor or admin. | **Create or import.** Start from scratch or import a whole YouTube playlist by URL. |

### Media downloads (MP4, MP3, playlists)

| | |
|---|---|
| <img src="docs/screenshots/download-hub.jpg" alt="Media downloader hub" /> | <img src="docs/screenshots/download-video.jpg" alt="Video download settings" /> |
| **Downloader hub.** Choose video, audio or playlist downloads. | **Video (MP4).** Quality up to 4K (depending on plan), format, subtitles, thumbnail and metadata options, with an estimated file size. |
| <img src="docs/screenshots/download-audio.jpg" alt="Audio download with preview player" /> | <img src="docs/screenshots/download-playlist-select.jpg" alt="Playlist download with video selection" /> |
| **Audio (MP3).** Preview player, bitrate, format, sample rate, normalization and silence trimming. | **Playlist (batch).** Load a playlist, then pick the videos, quality and format you want. |
| <img src="docs/screenshots/download-playlist-progress.jpg" alt="Playlist batch download in progress" /> | <img src="docs/screenshots/subscription.jpg" alt="Subscription plans" /> |
| **Live progress.** Per-file status and overall progress for batch downloads. | **Subscriptions.** Free, Pro (₹799/mo) and Exclusive (₹1999/mo) plans with Stripe Checkout. |

### More

| | | |
|---|---|---|
| <img src="docs/screenshots/dark-landing.jpg" alt="Landing page in dark mode" /> | <img src="docs/screenshots/about.jpg" alt="About page" /> | <img src="docs/screenshots/blog.jpg" alt="Blog page" /> |
| **Dark theme** | **About** | **Blog** with tips and tutorials |

<p align="center"><img src="docs/screenshots/mobile-landing.jpg" alt="Landing page on mobile" width="300" /><br/><em>Mobile landing page</em></p>

---

## Architecture Overview

```
Client (Next.js 15)
       |
       | REST + Socket.IO
       v
API Server (Express.js)
       |
       |-- MongoDB (Mongoose)         - users, playlists, transcripts, sessions
       |-- Cloudinary                 - thumbnail and avatar storage
       |-- Pinecone                   - vector embeddings for RAG pipeline
       |-- Gemini API                 - premium video Q&A + summarization
       |-- Mistral API (pixtral)      - standard Q&A with transcript context
       |-- Stripe                     - subscription checkout + webhooks
       |-- yt-dlp                     - media downloading
       |-- youtube-transcript         - caption extraction
       |-- Nodemailer (MJML)          - transactional email
       |-- Socket.IO                  - real-time streaming sync
```

---

## Features

### Transcription and Summarization
- Extract captions directly from YouTube when available
- Speech-to-text fallback for uncaptioned videos
- Chapter detection and timestamp-aligned segments
- AI summaries in three modes: brief, detailed, key points (Gemini)
- Export transcripts as TXT, JSON, SRT, or VTT
- 12-hour transcript cache with hit-rate tracking

### Video Q&A (RAG Pipeline)
- Standard mode: transcript indexed in Pinecone, questions answered by Mistral with semantic retrieval
- Premium mode: Gemini multimodal, analyzes video directly without requiring a transcript
- Vision support: attach up to 2 images per question (pixtral-large-2411 for OCR accuracy)
- Streaming responses via SSE for real-time token output
- Per-session conversation history
- Daily usage quotas with automatic Gemini → Mistral fallback

### Media Downloads
- Download YouTube videos in MP4 at up to 4K (plan-gated)
- Download audio as MP3
- Playlist bulk downloading
- Live progress streaming via Server-Sent Events
- Queue management with pause, resume, and cancel

### Collaborative Playlists
- Create public or private playlists
- Invite collaborators by email with role-based permissions (viewer, editor, admin)
- Import an entire YouTube playlist by URL
- Drag-and-drop video reordering in playlist order
- Comments, activity logs, and favorites
- Draft mode for unpublished playlists

### Synchronized Group Streaming
- Create watch party rooms with auto-generated or custom room codes
- Real-time playback synchronization via Socket.IO
- Video queue management
- Open or approval-based join policy
- Host controls: lock playback, loop, end stream
- Join request approval flow with live notifications
- Email invites for rooms

### URL Shortening
- Shorten any YouTube URL with an optional custom alias
- Embed video timestamps directly in the short link
- Per-link analytics: click counts, geolocation, device, referrer, UTM parameters
- QR code generation for every link
- Expiry dates and bulk shortening

### Authentication
- Email/password registration with email verification
- Google OAuth 2.0
- JWT-based session management
- Password reset via email
- Avatar upload via Cloudinary
- reCAPTCHA v2 on registration, login, subscription and video Q&A endpoints

### Subscription and Payments
- Free, Pro (INR 799/month), and Exclusive (INR 1999/month) plans
- Stripe Checkout with idempotency key support
- Webhook-driven plan activation (checkout.session.completed, invoice events, cancellation)
- Subscription upgrade email via MJML template

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend framework | Next.js 15 (App Router), React 19 |
| Language | TypeScript |
| Styling | Tailwind CSS, Radix UI, shadcn/ui |
| Animations | GSAP |
| Drag and drop | dnd-kit |
| Real-time client | Socket.IO client |
| Backend framework | Node.js, Express.js |
| Database | MongoDB via Mongoose |
| Real-time server | Socket.IO |
| Auth | Passport.js (JWT + Google OAuth) |
| AI / LLM | Google Gemini, Mistral (pixtral-large-2411) |
| Vector DB | Pinecone |
| Media processing | yt-dlp, @distube/ytdl-core, youtube-transcript |
| Storage | Cloudinary |
| Payments | Stripe |
| Email | Nodemailer + MJML |
| API documentation | Swagger (OpenAPI 3.0) |
| Rate limiting | express-rate-limit, rate-limiter-flexible |
| Cron jobs | node-cron |

---

## Project Structure

```
youtube-mate/
├── backend/
│   ├── config/
│   │   ├── cloudinary.js          # Multer-Cloudinary storage config
│   │   ├── passport.js            # JWT + Google OAuth strategies
│   │   └── swagger.js             # OpenAPI 3.0 spec and component schemas
│   ├── jobs/
│   │   ├── cleanupTranscripts.js  # Hourly expired-transcript purge
│   │   └── cleanupVideoQA.js      # Daily Q&A session cleanup
│   ├── middleware/
│   │   ├── auth.js                # authenticateToken, optionalAuth
│   │   ├── rateLimiter.js         # Per-route rate limiting
│   │   ├── validation.js          # Joi/express-validator schemas
│   │   └── videoQAValidation.js   # Q&A request validation
│   ├── models/                    # Mongoose schemas
│   ├── routes/
│   │   ├── auth.js
│   │   ├── downloads.js
│   │   ├── playlists.js
│   │   ├── playlistItems.js
│   │   ├── stream.js
│   │   ├── stripe.js
│   │   ├── transcript.js
│   │   ├── urls.js
│   │   ├── videoQA.js
│   │   └── youtube.js
│   ├── services/
│   │   ├── emailService.js        # MJML transactional email
│   │   └── pineconeService.js     # Vector indexing + RAG query
│   ├── socket/
│   │   └── streamSocket.js        # Socket.IO room event handlers
│   ├── swagger/
│   │   ├── auth-docs.js
│   │   ├── downloads-docs.js
│   │   ├── urls-docs.js
│   │   └── advanced-docs.js       # Transcripts, Q&A, playlists, streaming, payments
│   └── server.js
├── frontend/
│   └── src/
│       ├── app/
│       │   ├── download/          # Media downloader
│       │   ├── playlists/         # Collaborative playlists
│       │   ├── shorten/           # URL shortener
│       │   ├── stream/            # Watch party rooms
│       │   ├── subscription/      # Plan selection + Stripe checkout
│       │   └── transcript/        # Transcription + Video Q&A
│       ├── components/
│       └── hooks/
├── .env.example
└── README.md
```

---

## Getting Started

### Prerequisites

- Node.js v18 or higher
- Python 3.8 or higher (for yt-dlp)
- MongoDB (local or Atlas)
- Accounts required for full feature set: Cloudinary, Pinecone, Google Cloud (OAuth + Gemini), Mistral, Stripe

### Backend

```bash
cd backend
npm install
cp .env.example .env
# Fill in .env (see Environment Variables section)
npm run dev
```

### Frontend

```bash
cd frontend
npm install
# Create frontend/.env.local (see Environment Variables section)
npm run dev
```

### Access

| Service | URL |
|---|---|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:5000 |
| API Documentation | http://localhost:5000/api-docs |
| Health Check | http://localhost:5000/health |

---

## Environment Variables

### Backend (`backend/.env`)

```env
# Core
MONGODB_URI=mongodb://localhost:27017/youtube-mate
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
JWT_SECRET=your-jwt-secret
SESSION_SECRET=your-session-secret

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback

# AI Services
GEMINI_API_KEY=your-gemini-api-key
MISTRAL_API_KEY=your-mistral-api-key

# Vector Database
PINECONE_API_KEY=your-pinecone-api-key
PINECONE_INDEX=your-index-name

# Storage
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-cloudinary-api-key
CLOUDINARY_API_SECRET=your-cloudinary-secret

# Payments
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# reCAPTCHA (optional - disables bot protection if omitted)
RECAPTCHA_SECRET_KEY=your-recaptcha-secret

# YouTube API (optional - enhances metadata)
YOUTUBE_API_KEY=your-youtube-api-key

# Email
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password

# Domain
DEFAULT_DOMAIN=ytmate.co
```

### Frontend (`frontend/.env.local`)

```env
NEXT_PUBLIC_BACKEND_URL=http://localhost:5000
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
NEXT_PUBLIC_RECAPTCHA_SITE_KEY=your-recaptcha-site-key
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-google-client-id
```

---

## API Documentation

Full interactive documentation is available at:

- **Production**: https://youtube-mate-backend.onrender.com/api-docs/
- **Local**: http://localhost:5000/api-docs

The documentation covers all 74 endpoints across 11 modules: Authentication, URL Shortening, Downloads, Transcripts, Video Q&A, Playlists, Playlist Items, YouTube Info, Streaming, Payments, and Redirects.

A machine-readable OpenAPI 3.0 JSON spec is served at `/api-docs.json`.

---

## Deployment

### Backend (Render)

1. Connect your GitHub repository
2. Build command: `npm install`
3. Start command: `node server.js`
4. Add all backend environment variables from the section above

For yt-dlp on Render, add an install script or use the provided `backend/scripts/install-ytdlp.sh` as a pre-deploy step.

### Frontend (Vercel)

1. Connect your GitHub repository
2. Set root directory to `frontend`
3. Framework preset: Next.js
4. Add frontend environment variables

### Database (MongoDB Atlas)

1. Create a free M0 cluster
2. Whitelist `0.0.0.0/0` for Render's dynamic IPs or use Atlas Data API
3. Copy the connection string into `MONGODB_URI`

### Stripe Webhooks

After deploying the backend, register the webhook endpoint in your Stripe dashboard:

```
https://your-backend.onrender.com/api/stripe/webhook
```

Events to subscribe to: `checkout.session.completed`, `invoice.payment_succeeded`, `invoice.payment_failed`, `customer.subscription.deleted`.

---

## Rate Limits

| Endpoint group | Limit |
|---|---|
| General API | 100 requests / 15 min per IP |
| Downloads | 10 requests / 1 min per IP |
| Transcript generation | 5 requests / 15 min per IP |
| Video Q&A | 10 requests / 1 min per IP |

Daily Q&A quotas per user (free plan):

| Mode | Daily quota |
|---|---|
| Premium (Gemini) | 2 questions |
| Standard (Mistral) | 3 questions |
| Image uploads | 2 images |

---

## License

ISC License. See LICENSE for details.

## Author

Abhishek Anand — [GitHub](https://github.com/forcedtomakeanaccounthere) — abhishekanandvii@gmail.com
