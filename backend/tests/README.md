# Test Scripts for YouTube Mate Backend

This directory contains test scripts for debugging and validating various backend features.

## Available Tests

### 1. `test-transcript-extraction.js`
Tests the raw transcript extraction from YouTube videos using the `youtube-transcript` package.

**Usage:**
```bash
node tests/test-transcript-extraction.js <video-id>
```

**Example:**
```bash
node tests/test-transcript-extraction.js gfoqygqCW38
```

**What it tests:**
- Fetching transcript without language specification
- Fetching transcript with English language
- Package version information
- Error handling

**Output:**
- ✅ Success: Shows segment count and sample data
- ❌ Failure: Shows error details (name, message, code, status)

---

### 2. `test-api-endpoint.js`
Tests the full `/api/transcript` endpoint including authentication and processing.

**Usage:**
```bash
# Server must be running on port 5000
node tests/test-api-endpoint.js
```

**What it tests:**
- Authentication flow
- POST /api/transcript endpoint
- Status polling
- Error responses

**Configuration:**
Edit the `VIDEO_URL` constant in the file to test different videos.

**Note:** Requires valid JWT token. The script will guide you on how to obtain one if authentication fails.

---

## Summary Generation Changes (Latest Updates)

### Overview
The summary generation system now uses a **layered fallback chain** to ensure maximum reliability:

**When real captions exist:**
1. **Pinecone RAG + Gemini** - Vector search for relevant context, then Gemini summarization
2. **Pinecone RAG + Mistral** - If Gemini fails, try Mistral with Pinecone context
3. **Full-text Gemini** - If Pinecone fails, use full transcript with Gemini
4. **Full-text Mistral** - If Gemini fails, try Mistral with full transcript
5. **Metadata-only fallback** - Generate summary from video title/channel/duration only
6. **Error state** - If all fail, return `summaryError` to frontend

**When no real captions (AI-generated transcript):**
1. **Full-text Gemini**
2. **Full-text Mistral**
3. **Metadata-only fallback**
4. **Error state**

### Key Features

- **Non-fatal summary errors**: Transcript processing completes successfully even if summary generation fails
- **`summaryError` field**: New field in Transcript model to store error details
- **Frontend error UI**: Summary tab shows user-friendly error message with retry hints
- **Provider fallback**: Automatic fallback from Gemini → Mistral if either fails
- **Context optimization**: Uses Pinecone vector search when real captions exist for better summaries

### API Changes

**POST /api/transcript/regenerate-summary**
```json
// Request
{
  "segments": [...],
  "summaryType": "brief",
  "language": "en",
  "videoInfo": {...},
  "hasActualCaptions": true,
  "videoId": "abc123"
}

// Response (success)
{
  "summary": {
    "brief": "...",
    "detailed": "...",
    "bulletPoints": [...],
    "keyMoments": [...]
  },
  "summaryError": null
}

// Response (all providers failed)
{
  "summary": null,
  "summaryError": "Summary generation failed: Gemini: 503 Service Unavailable; Mistral: Rate limit exceeded"
}
```

**GET /api/transcript/:id/status**
```json
{
  "status": "completed",
  "progress": 100,
  "error": null,
  "summaryError": null  // New field
}
```

### Testing Summary Generation

```bash
# Test with a video that has captions
node tests/test-api-endpoint.js

# Check the logs to see which provider was used
# Look for lines like:
# ✅ Pinecone returned 10 chunks for brief summary
# 🤖 Trying Gemini for brief summary (Pinecone context)...
# ✅ brief summary generated via gemini
```

---

## Development Notes

### Caption Extraction Issue (Fixed)
**Problem:** Videos with available captions were falling back to AI-generated summaries.

**Root Cause:** 
1. Gemini API 503 errors during summary generation were crashing the entire transcript job
2. The job was marked as `failed` even though caption extraction succeeded

**Solution:**
1. Wrapped `generateSummary` in try-catch in `processTranscriptAsync`
2. Made summary generation non-fatal
3. Added `summaryError` field to communicate failures to frontend
4. Implemented Gemini → Mistral fallback chain

### Files Modified
- `backend/models/Transcript.js` - Added `summaryError` field
- `backend/utils/transcriptProcessor.js` - Rewrote `generateSummary` with fallback chain
- `backend/routes/transcript.js` - Made summary non-fatal, updated endpoints
- `frontend/src/app/transcript/page.tsx` - Added error UI on summary tab

---

## Future Test Ideas

- **Load testing**: Test multiple concurrent transcript requests
- **Error simulation**: Mock API failures to test fallback chains
- **Language testing**: Test non-English transcripts and summaries
- **Long video testing**: Test videos > 1 hour with many segments
- **Rate limit testing**: Verify rate limiter behavior under load

---

## Troubleshooting

### "No captions available" for videos with captions
- Check server logs for actual error from youtube-transcript package
- Error might be network/API issue, not missing captions
- Look for log line: "⚠️ This might be an API issue, not missing captions!"

### Summary always fails
- Check `.env` for valid `GEMINI_API_KEY` and `MISTRAL_API_KEY`
- Check API quota/rate limits
- Review `summaryError` field in database for specific error
- Check Pinecone configuration if using vector search

### Tests fail with authentication errors
- Ensure MongoDB is running
- Verify `.env` has correct `JWT_SECRET`
- Check that at least one user exists with `isEmailVerified: true`

---

Last Updated: July 30, 2026
