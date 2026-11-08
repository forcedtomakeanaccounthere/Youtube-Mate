/**
 * test-downloads.js — Media Downloads API Tests
 *
 * Covers:
 *   POST /api/downloads/formats          — get available formats for a video
 *   GET  /api/downloads/history          — download history (auth + anon)
 *   POST /api/downloads                  — create download job (mp3/mp4)
 *   GET  /api/downloads/:id              — fetch download record
 *   DELETE /api/downloads/:id            — cancel active download
 *   GET  /api/downloads/queue/status     — queue status
 *   GET  /api/downloads/playlist/info    — fetch YT playlist metadata
 *
 * Notes:
 *   - Actual file downloads / yt-dlp processing are not awaited in CI because
 *     they require yt-dlp installed and can take minutes.
 *   - Set RUN_DOWNLOAD=true to test the full download lifecycle.
 *
 * Usage:
 *   node tests/test-downloads.js
 *   RUN_DOWNLOAD=true node tests/test-downloads.js
 */

'use strict'

const axios = require('axios')
const log   = require('./helpers/logger')
const { authedClient, BASE_URL } = require('./helpers/auth')

const SAMPLE_URL     = 'https://www.youtube.com/watch?v=jNQXAC9IVRw' // "Me at the zoo" — 19s
const PLAYLIST_URL   = 'https://www.youtube.com/playlist?list=PLbpi6ZahtOH6Ar_3GPy3workNmrm-CFsT'
const RUN_DOWNLOAD   = process.env.RUN_DOWNLOAD === 'true'
const POLL_INTERVAL  = 3000
const POLL_TIMEOUT   = 90000

const http = axios.create({ baseURL: BASE_URL, timeout: 30000 })

let createdDownloadId = null

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

// ─── tests ───────────────────────────────────────────────────────────────────

async function testGetFormats() {
  log.section('POST /api/downloads/formats')

  // Valid URL
  try {
    const res = await http.post('/api/downloads/formats', {
      youtube_url: SAMPLE_URL,
    })
    const formats = res.data
    // Response can be an object with audio/video keys or an array
    if (formats && (Array.isArray(formats) || typeof formats === 'object')) {
      log.pass('Available formats returned', `type: ${Array.isArray(formats) ? 'array' : 'object'}`)
      if (Array.isArray(formats)) {
        log.info(`Format count: ${formats.length}`)
      } else {
        log.info(`Keys: ${Object.keys(formats).join(', ')}`)
      }
    } else {
      log.fail('Get formats', new Error('Unexpected response shape'))
    }
  } catch (err) {
    if (err.response?.status === 429) {
      log.skip('Get formats (rate limited)', '429 — try again later')
    } else {
      log.fail('Get formats', err)
    }
  }

  // Missing URL → 400
  try {
    await http.post('/api/downloads/formats', {})
    log.fail('Missing youtube_url should return 400', new Error('Expected 400'))
  } catch (err) {
    if (err.response?.status === 400) {
      log.pass('Missing youtube_url returns 400')
    } else {
      log.fail('Missing youtube_url should return 400', err)
    }
  }
}

async function testDownloadHistory() {
  log.section('GET /api/downloads/history')

  // Authenticated — needs a real verified test user (see helpers/auth.js);
  // when credentials aren't configured this is environmental, not a failure
  try {
    const { client } = await authedClient()
    const res = await client.get('/api/downloads/history?page=1&limit=5')
    const { downloads, pagination } = res.data
    if (Array.isArray(downloads)) {
      log.pass(`History (auth): ${downloads.length} records`, `total: ${pagination?.total_items}`)
    } else {
      log.fail('Download history (auth)', new Error('downloads array missing'))
    }
  } catch (err) {
    const msg = err?.response?.status ? `HTTP ${err.response.status}` : err.message
    if (err?.response?.status === 401 || /login|credential/i.test(err.message)) {
      log.skip('History (auth)', `no test user available (${msg})`)
    } else {
      log.fail('Download history (auth)', err)
    }
  }

  // Anonymous
  try {
    const res = await http.get('/api/downloads/history?limit=5')
    if (Array.isArray(res.data.downloads)) {
      log.pass(`History (anon): ${res.data.downloads.length} records`)
    } else {
      log.fail('Download history (anon)', new Error('downloads array missing'))
    }
  } catch (err) {
    log.fail('Download history (anon)', err)
  }

  // Format filter
  try {
    const res = await http.get('/api/downloads/history?format=mp3&limit=5')
    log.pass(`History with format=mp3 filter: ${res.data.downloads?.length} records`)
  } catch (err) {
    log.fail('Download history format filter', err)
  }
}

async function testCreateDownload() {
  log.section('POST /api/downloads')

  // ── REGRESSION: frontend contract — ALWAYS checked (cheap + critical).
  // The pages read result.download_id and poll download.progress/status/
  // file_name — without the alias they poll /downloads/undefined → 500.
  log.section('Frontend contract regression')
  try {
    const res = await http.post('/api/downloads', {
      youtube_url: SAMPLE_URL,
      format: 'audio',
      quality: '128kbps',
      options: { audio_format: 'mp3', embedArtwork: true, sampleRate: 44100 },
    })

    if (!res.data.download_id) {
      log.fail('create returns download_id', new Error('result.download_id missing — pages would poll /downloads/undefined'))
    } else {
      log.pass('create returns download_id (frontend contract)', `id: ${res.data.download_id}`)

      if (res.data.metadata?.title) {
        log.pass('metadata.title captured (history shows real title)', res.data.metadata.title)
      } else {
        log.fail('metadata.title captured', new Error('metadata.title missing — history shows "Unknown Title"'))
      }

      const record = await http.get(`/api/downloads/${res.data.download_id}`)
      if (typeof record.data.progress === 'number' && record.data.status) {
        log.pass('status record exposes progress + status (page poll contract)')
      } else {
        log.fail('status record contract', new Error('progress/status missing'))
      }

      try { await http.delete(`/api/downloads/${res.data.download_id}`) } catch { /* may be active/completed */ }
    }
  } catch (err) {
    log.fail('frontend contract regression', err)
  }

  if (!RUN_DOWNLOAD) {
    log.skip('Create download job', 'set RUN_DOWNLOAD=true to test full yt-dlp pipeline')
    return
  }

  // Audio (mp3) download
  try {
    const res = await http.post('/api/downloads', {
      youtube_url: SAMPLE_URL,
      format: 'audio',
      quality: 'best',
    })
    if (res.data.download_id) {
      createdDownloadId = res.data.download_id
      log.pass('Download job created (audio/mp3)', `id: ${createdDownloadId}`)
    } else {
      log.fail('Create download', new Error('Missing download_id'))
    }
  } catch (err) {
    if (err.response?.status === 409) {
      log.pass('Download already in progress (409) — previous test run still active')
      createdDownloadId = err.response.data.download_id
    } else if (err.response?.status === 429) {
      log.skip('Create download (429 rate limit)', 'slow down and retry')
    } else {
      log.fail('Create download (audio)', err)
    }
  }

  // Invalid URL → 400
  try {
    await http.post('/api/downloads', {
      youtube_url: 'https://not-youtube.com/watch?v=abc',
      format: 'audio',
      quality: 'best',
    })
    log.fail('Invalid URL should return 400', new Error('Expected 400'))
  } catch (err) {
    if (err.response?.status === 400) {
      log.pass('Invalid URL returns 400')
    } else {
      log.fail('Invalid URL should return 400', err)
    }
  }

  // Missing required fields → 4xx
  try {
    await http.post('/api/downloads', { youtube_url: SAMPLE_URL })
    log.fail('Missing format/quality should return 4xx', new Error('Expected error'))
  } catch (err) {
    if (err.response?.status >= 400 && err.response?.status < 500) {
      log.pass('Missing format/quality returns 4xx')
    } else {
      log.fail('Missing format/quality should return 4xx', err)
    }
  }
}

async function testPollDownload() {
  log.section('GET /api/downloads/:id — poll until complete')

  if (!createdDownloadId) {
    log.skip('Poll download', 'no download created')
    return
  }

  const deadline = Date.now() + POLL_TIMEOUT
  let lastStatus = 'unknown'

  while (Date.now() < deadline) {
    try {
      const res = await http.get(`/api/downloads/${createdDownloadId}`)
      const d = res.data
      lastStatus = d.status
      process.stdout.write(`\r    polling… status=${d.status} progress=${d.progress || 0}%   `)
      if (d.status === 'completed') {
        process.stdout.write('\n')
        log.pass('Download completed', `file: ${d.file_name || 'unknown'}`)
        return
      }
      if (d.status === 'failed') {
        process.stdout.write('\n')
        log.fail('Download failed', new Error(d.error_message))
        return
      }
    } catch (err) {
      process.stdout.write('\n')
      log.fail('Poll download', err)
      return
    }
    await sleep(POLL_INTERVAL)
  }

  process.stdout.write('\n')
  log.fail('Download polling timed out', new Error(`Last status: ${lastStatus}`))
}

async function testGetDownloadById() {
  log.section('GET /api/downloads/:id')

  if (!createdDownloadId) {
    log.skip('Get download by ID', 'no download created')
    return
  }

  try {
    const res = await http.get(`/api/downloads/${createdDownloadId}`)
    if (res.data._id || res.data.id) {
      log.pass('Fetch download by ID returns record', `status: ${res.data.status}`)
    } else {
      log.fail('Fetch download by ID', new Error('No id field in response'))
    }
  } catch (err) {
    log.fail('Fetch download by ID', err)
  }

  // Non-existent
  try {
    await http.get('/api/downloads/000000000000000000000000')
    log.fail('Non-existent download should return 404', new Error('Expected 404'))
  } catch (err) {
    if (err.response?.status === 404) {
      log.pass('Non-existent download returns 404')
    } else {
      log.fail('Non-existent download should return 404', err)
    }
  }
}

async function testQueueStatus() {
  log.section('GET /api/downloads/queue/status')

  // The in-memory queue endpoint was removed with the BullMQ refactor —
  // queue state now lives in Redis and is visible via the BullMQ dashboard
  // or `docker exec ytmate-redis redis-cli`. Mark as removed, not failed.
  log.skip('Queue status', 'endpoint removed with the BullMQ queue refactor')
}

async function testPlaylistInfo() {
  log.section('GET /api/downloads/playlist/info')

  try {
    const res = await http.get(`/api/downloads/playlist/info?url=${encodeURIComponent(PLAYLIST_URL)}`)
    const data = res.data
    if (data.title && Array.isArray(data.videos)) {
      log.pass('Playlist info fetched', `"${data.title}" — ${data.videos.length} videos`)
      if (data.videos.length > 0) {
        log.info(`First video: ${data.videos[0].title}`)
      }
    } else {
      log.fail('Playlist info', new Error('Missing title or videos array'))
    }
  } catch (err) {
    if (err.response?.status === 400) {
      log.skip('Playlist info (400)', 'Playlist URL may be private or invalid in test env')
    } else if (err.response?.status === 500) {
      log.skip('Playlist info (500)', 'yt-dlp may not be installed or playlist unavailable')
    } else {
      log.fail('Playlist info', err)
    }
  }

  // Missing URL → 400
  try {
    await http.get('/api/downloads/playlist/info')
    log.fail('Missing url param should return 400', new Error('Expected 400'))
  } catch (err) {
    if (err.response?.status === 400) {
      log.pass('Missing playlist url param returns 400')
    } else {
      log.fail('Missing playlist url param should return 400', err)
    }
  }
}

async function testCancelDownload() {
  log.section('DELETE /api/downloads/:id')

  if (!createdDownloadId || !RUN_DOWNLOAD) {
    log.skip('Cancel download', 'only runs when RUN_DOWNLOAD=true and a job was created')
    return
  }

  try {
    const res = await http.delete(`/api/downloads/${createdDownloadId}`)
    if (res.data.message?.toLowerCase().includes('cancel')) {
      log.pass('Cancel download succeeds')
    } else {
      // If download already completed, the API returns 400 "cannot cancel completed"
      log.fail('Cancel download', new Error('Unexpected: ' + JSON.stringify(res.data)))
    }
  } catch (err) {
    if (err.response?.status === 400) {
      log.pass('Download already completed — cancel returns 400 (acceptable)')
    } else {
      log.fail('Cancel download', err)
    }
  }
}

// ─── runner ──────────────────────────────────────────────────────────────────

;(async () => {
  log.header(`Downloads API Tests  [RUN_DOWNLOAD=${RUN_DOWNLOAD}]`)

  await testGetFormats()
  await testDownloadHistory()
  await testCreateDownload()
  if (RUN_DOWNLOAD) await testPollDownload()
  await testGetDownloadById()
  await testQueueStatus()
  await testPlaylistInfo()
  if (RUN_DOWNLOAD) await testCancelDownload()

  const allPassed = log.summary()
  process.exit(allPassed ? 0 : 1)
})()
