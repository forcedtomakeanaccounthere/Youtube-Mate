/**
 * test-transcript.js — Transcript / Summarisation API Tests
 *
 * Covers:
 *   POST /api/transcript              — kick off transcript job
 *   GET  /api/transcript/:id/status   — poll until done or timeout
 *   GET  /api/transcript/:id          — fetch completed transcript
 *   GET  /api/transcript/history      — user's transcript list
 *   GET  /api/transcript/:id/export/:fmt — export as txt/json/srt/vtt
 *   POST /api/transcript/regenerate-summary
 *   GET  /api/transcript/cache/stats
 *   DELETE /api/transcript/:id
 *
 * Usage:
 *   node tests/test-transcript.js [youtube-url]
 *
 *   Defaults to a short public video if no URL is provided.
 */

'use strict'

const axios = require('axios')
const log   = require('./helpers/logger')
const { authedClient, BASE_URL } = require('./helpers/auth')

// Short video (≈60 s) with known English captions — Rickroll
const VIDEO_URL = process.argv[2] || 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
const POLL_INTERVAL_MS = 4000
const POLL_TIMEOUT_MS  = 120000 // 2 min

let createdTranscriptId = null

// ─── helpers ─────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function pollStatus(client, id) {
  const deadline = Date.now() + POLL_TIMEOUT_MS
  while (Date.now() < deadline) {
    const res = await client.get(`/api/transcript/${id}/status`)
    const { status, progress, error, summaryError } = res.data
    process.stdout.write(`\r    polling… status=${status} progress=${progress}%   `)
    if (status === 'completed') { process.stdout.write('\n'); return { status, summaryError } }
    if (status === 'failed')    { process.stdout.write('\n'); return { status, error } }
    await sleep(POLL_INTERVAL_MS)
  }
  process.stdout.write('\n')
  return { status: 'timeout' }
}

// ─── tests ───────────────────────────────────────────────────────────────────

async function testCreateTranscript() {
  log.section('POST /api/transcript')

  const { client } = await authedClient()

  // 1. Valid request
  try {
    const res = await client.post('/api/transcript', {
      youtubeUrl: VIDEO_URL,
      language: 'en',
      summaryType: 'brief',
    })
    if (res.data.transcriptId) {
      createdTranscriptId = res.data.transcriptId
      log.pass('Transcript job created', `id: ${createdTranscriptId}`)
    } else {
      log.fail('Create transcript', new Error('Missing transcriptId'))
    }
  } catch (err) {
    if (err.response?.status === 202 && err.response?.data?.transcriptId) {
      createdTranscriptId = err.response.data.transcriptId
      log.pass('Transcript job accepted (202)', `id: ${createdTranscriptId}`)
    } else {
      log.fail('Create transcript', err)
    }
  }

  // 2. Invalid URL → 400
  try {
    await client.post('/api/transcript', {
      youtubeUrl: 'https://not-a-youtube-url.com/watch?v=abc',
    })
    log.fail('Invalid URL should return 400', new Error('Expected 400'))
  } catch (err) {
    if (err.response?.status === 400) {
      log.pass('Invalid YouTube URL returns 400')
    } else {
      log.fail('Invalid URL should return 400', err)
    }
  }

  // 3. Missing youtubeUrl → 4xx
  try {
    await client.post('/api/transcript', {})
    log.fail('Missing youtubeUrl should return 4xx', new Error('Expected error'))
  } catch (err) {
    if (err.response?.status >= 400 && err.response?.status < 500) {
      log.pass('Missing youtubeUrl returns 4xx')
    } else {
      log.fail('Missing youtubeUrl should return 4xx', err)
    }
  }

  // 4. No auth → 401
  const anonHttp = axios.create({ baseURL: BASE_URL, timeout: 15000 })
  try {
    await anonHttp.post('/api/transcript', { youtubeUrl: VIDEO_URL })
    log.fail('Unauthenticated request should return 401', new Error('Expected 401'))
  } catch (err) {
    if (err.response?.status === 401) {
      log.pass('Unauthenticated transcript request returns 401')
    } else {
      log.fail('Unauthenticated transcript should return 401', err)
    }
  }
}

async function testPollAndFetch() {
  log.section('GET /api/transcript/:id/status + GET /api/transcript/:id')

  if (!createdTranscriptId) {
    log.skip('Poll & fetch', 'no transcriptId from previous step')
    return
  }

  const { client } = await authedClient()

  log.info(`Polling transcript ${createdTranscriptId} (up to ${POLL_TIMEOUT_MS / 1000}s)…`)
  const { status, error, summaryError } = await pollStatus(client, createdTranscriptId)

  if (status === 'completed') {
    log.pass('Transcript job completed')
    if (summaryError) {
      log.info(`Summary had a non-fatal error: ${summaryError}`)
    }

    // Fetch full transcript
    try {
      const res = await client.get(`/api/transcript/${createdTranscriptId}`)
      const t = res.data
      const hasContent = Array.isArray(t.content) && t.content.length > 0
      log.pass('Fetch completed transcript', `segments: ${t.content?.length}`)
      log.info(`Has summary: ${!!t.summary}`)
      log.info(`Video: ${t.videoInfo?.title || 'unknown'}`)
      if (!hasContent) log.fail('Transcript content empty', new Error('content array is empty'))
    } catch (err) {
      log.fail('Fetch completed transcript', err)
    }

  } else if (status === 'failed') {
    log.fail('Transcript job failed', new Error(error || 'Unknown failure'))
  } else {
    log.fail('Transcript polling timed out', new Error(`Final status: ${status}`))
  }
}

async function testTranscriptHistory() {
  log.section('GET /api/transcript/history')

  try {
    const { client } = await authedClient()
    const res = await client.get('/api/transcript/history?page=1&limit=5')
    const { transcripts, pagination } = res.data
    if (Array.isArray(transcripts)) {
      log.pass(`History returned ${transcripts.length} records`, `total: ${pagination?.total}`)
    } else {
      log.fail('History', new Error('transcripts array missing'))
    }
  } catch (err) {
    log.fail('Transcript history', err)
  }
}

async function testExportFormats() {
  log.section('GET /api/transcript/:id/export/:format')

  if (!createdTranscriptId) {
    log.skip('Export formats', 'no transcript available')
    return
  }

  const { client } = await authedClient()
  const formats = ['txt', 'json', 'srt', 'vtt']

  for (const fmt of formats) {
    try {
      const res = await client.get(`/api/transcript/${createdTranscriptId}/export/${fmt}`, {
        responseType: fmt === 'json' ? 'json' : 'text',
      })
      if (res.status === 200) {
        const sizeHint = typeof res.data === 'string'
          ? `${res.data.length} chars`
          : `JSON object`
        log.pass(`Export as ${fmt}`, sizeHint)
      } else {
        log.fail(`Export as ${fmt}`, new Error(`Status ${res.status}`))
      }
    } catch (err) {
      // 400 is returned when transcript is not yet completed — acceptable
      if (err.response?.status === 400) {
        log.skip(`Export as ${fmt}`, 'transcript not yet completed')
      } else {
        log.fail(`Export as ${fmt}`, err)
      }
    }
  }

  // Invalid format → 400
  try {
    await client.get(`/api/transcript/${createdTranscriptId}/export/docx`)
    log.fail('Invalid export format should return 400', new Error('Expected 400'))
  } catch (err) {
    if (err.response?.status === 400) {
      log.pass('Invalid export format returns 400')
    } else {
      log.fail('Invalid export format should return 400', err)
    }
  }
}

async function testRegenerateSummary() {
  log.section('POST /api/transcript/regenerate-summary')

  try {
    const { client } = await authedClient()

    const sampleSegments = [
      { text: 'Hello and welcome to this tutorial.', start: 0, duration: 3 },
      { text: 'Today we will learn about Node.js and Express.', start: 3, duration: 4 },
      { text: 'We will cover routing, middleware, and more.', start: 7, duration: 4 },
    ]

    const res = await client.post('/api/transcript/regenerate-summary', {
      segments: sampleSegments,
      summaryType: 'brief',
      language: 'en',
      videoInfo: { title: 'Test Tutorial Video', channel: 'Test Channel' },
      hasActualCaptions: true,
    })

    if (res.data.summary || res.data.summaryError) {
      log.pass('Regenerate summary returns summary or summaryError')
      if (res.data.summary) log.info(`Summary type: ${typeof res.data.summary}`)
      if (res.data.summaryError) log.info(`summaryError: ${res.data.summaryError}`)
    } else {
      log.fail('Regenerate summary', new Error('Neither summary nor summaryError in response'))
    }
  } catch (err) {
    log.fail('Regenerate summary', err)
  }
}

async function testCacheStats() {
  log.section('GET /api/transcript/cache/stats')

  try {
    const { client } = await authedClient()
    const res = await client.get('/api/transcript/cache/stats')
    const s = res.data
    if (typeof s.total === 'number') {
      log.pass('Cache stats returned', `total=${s.total} active=${s.active} expired=${s.expired}`)
      log.info(`Cache hit rate: ${s.cacheHitRate}`)
    } else {
      log.fail('Cache stats', new Error('Missing total field'))
    }
  } catch (err) {
    log.fail('Cache stats', err)
  }
}

async function testDeleteTranscript() {
  log.section('DELETE /api/transcript/:id')

  if (!createdTranscriptId) {
    log.skip('Delete transcript', 'no transcript to delete')
    return
  }

  try {
    const { client } = await authedClient()
    const res = await client.delete(`/api/transcript/${createdTranscriptId}`)
    if (res.data.message?.toLowerCase().includes('deleted')) {
      log.pass('Delete transcript returns success message')
    } else {
      log.fail('Delete transcript', new Error('Unexpected response: ' + JSON.stringify(res.data)))
    }
  } catch (err) {
    log.fail('Delete transcript', err)
  }
}

// ─── runner ──────────────────────────────────────────────────────────────────

;(async () => {
  log.header(`Transcript API Tests  (video: ${VIDEO_URL})`)

  await testCreateTranscript()
  await testPollAndFetch()
  await testTranscriptHistory()
  await testExportFormats()
  await testRegenerateSummary()
  await testCacheStats()
  await testDeleteTranscript()

  const allPassed = log.summary()
  process.exit(allPassed ? 0 : 1)
})()
