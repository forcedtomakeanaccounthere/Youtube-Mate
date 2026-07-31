/**
 * test-video-qa.js — Video Q&A (RAG Pipeline) API Tests
 *
 * Covers:
 *   GET  /api/video-qa/usage                    — daily quota status
 *   POST /api/video-qa/session/create            — create Q&A session
 *   GET  /api/video-qa/sessions/:videoId         — sessions list for a video
 *   GET  /api/video-qa/session/:sessionId        — fetch session with messages
 *   POST /api/video-qa/ask                       — ask a standard question
 *   DELETE /api/video-qa/session/:sessionId      — delete session
 *
 * Notes:
 *   - Premium (Gemini) questions are NOT auto-tested to preserve daily quota.
 *     Set RUN_PREMIUM=true env var to include them.
 *   - reCAPTCHA is assumed disabled in local dev (RECAPTCHA_SECRET_KEY unset).
 *   - Actual AI response quality is not asserted — only structure is validated.
 *
 * Usage:
 *   node tests/test-video-qa.js
 *   RUN_PREMIUM=true node tests/test-video-qa.js
 */

'use strict'

const axios = require('axios')
const log   = require('./helpers/logger')
const { authedClient, BASE_URL } = require('./helpers/auth')

const VIDEO_ID  = 'dQw4w9WgXcQ'
const VIDEO_URL = `https://www.youtube.com/watch?v=${VIDEO_ID}`

const RUN_PREMIUM = process.env.RUN_PREMIUM === 'true'

let sessionId = null

// ─── tests ───────────────────────────────────────────────────────────────────

async function testGetUsage() {
  log.section('GET /api/video-qa/usage')

  try {
    const { client } = await authedClient()
    const res = await client.get('/api/video-qa/usage')
    const u = res.data
    if (typeof u.premiumRemaining === 'number' && typeof u.standardRemaining === 'number') {
      log.pass('Usage returned', `premium remaining: ${u.premiumRemaining}  standard remaining: ${u.standardRemaining}`)
      log.info(`Image uploads remaining: ${u.imagesRemaining}  resets at: ${u.resetAt}`)
    } else {
      log.fail('Usage response', new Error('Missing premiumRemaining / standardRemaining'))
    }
  } catch (err) {
    log.fail('Get usage', err)
  }

  // Unauthenticated → 401
  const anonHttp = axios.create({ baseURL: BASE_URL, timeout: 10000 })
  try {
    await anonHttp.get('/api/video-qa/usage')
    log.fail('Unauthenticated usage should return 401', new Error('Expected 401'))
  } catch (err) {
    if (err.response?.status === 401) {
      log.pass('Unauthenticated usage returns 401')
    } else {
      log.fail('Unauthenticated usage should return 401', err)
    }
  }
}

async function testCreateSession() {
  log.section('POST /api/video-qa/session/create')

  try {
    const { client } = await authedClient()
    const res = await client.post('/api/video-qa/session/create', {
      videoId: VIDEO_ID,
      videoUrl: VIDEO_URL,
      videoMetadata: {
        title: 'Rick Astley — Never Gonna Give You Up',
        duration: '3:32',
      },
    })
    if (res.data.sessionId) {
      sessionId = res.data.sessionId
      log.pass('Session created', `sessionId: ${sessionId}`)
    } else {
      log.fail('Create session', new Error('Missing sessionId'))
    }
  } catch (err) {
    log.fail('Create session', err)
  }

  // Missing videoId → 400
  try {
    const { client } = await authedClient()
    await client.post('/api/video-qa/session/create', {
      videoUrl: VIDEO_URL,
    })
    log.fail('Missing videoId should return 400', new Error('Expected 400'))
  } catch (err) {
    if (err.response?.status === 400) {
      log.pass('Missing videoId returns 400')
    } else {
      log.fail('Missing videoId should return 400', err)
    }
  }
}

async function testGetSessions() {
  log.section('GET /api/video-qa/sessions/:videoId')

  try {
    const { client } = await authedClient()
    const res = await client.get(`/api/video-qa/sessions/${VIDEO_ID}`)
    const { sessions, hasTranscript } = res.data
    if (Array.isArray(sessions)) {
      log.pass(`Sessions for ${VIDEO_ID}: ${sessions.length}`, `hasTranscript: ${hasTranscript}`)
      if (sessions.length > 0) {
        const s = sessions[0]
        log.info(`Latest session: ${s.sessionId}  messages: ${s.messageCount}`)
      }
    } else {
      log.fail('Get sessions', new Error('sessions array missing'))
    }
  } catch (err) {
    log.fail('Get sessions', err)
  }
}

async function testGetSession() {
  log.section('GET /api/video-qa/session/:sessionId')

  if (!sessionId) {
    log.skip('Get session', 'no session created')
    return
  }

  try {
    const { client } = await authedClient()
    const res = await client.get(`/api/video-qa/session/${sessionId}`)
    const { session } = res.data
    if (session?.sessionId === sessionId && Array.isArray(session?.messages)) {
      log.pass('Get session by ID', `messages: ${session.messages.length}`)
    } else {
      log.fail('Get session', new Error('session object incomplete'))
    }
  } catch (err) {
    log.fail('Get session', err)
  }

  // Non-existent session → 404
  try {
    const { client } = await authedClient()
    await client.get('/api/video-qa/session/nonexistent-session-id-xyz')
    log.fail('Non-existent session should return 404', new Error('Expected 404'))
  } catch (err) {
    if (err.response?.status === 404) {
      log.pass('Non-existent session returns 404')
    } else {
      log.fail('Non-existent session should return 404', err)
    }
  }
}

async function testAskQuestion() {
  log.section('POST /api/video-qa/ask (standard mode)')

  if (!sessionId) {
    log.skip('Ask question', 'no session created — skipping to preserve quota')
    return
  }

  // Check remaining quota first
  let standardRemaining = 0
  try {
    const { client } = await authedClient()
    const usageRes = await client.get('/api/video-qa/usage')
    standardRemaining = usageRes.data.standardRemaining || 0
    log.info(`Standard questions remaining today: ${standardRemaining}`)
  } catch (_) { /* ignore */ }

  if (standardRemaining === 0) {
    log.skip('Ask question', 'daily standard quota exhausted — skipping')
    return
  }

  // Standard question
  try {
    const { client } = await authedClient()
    const res = await client.post('/api/video-qa/ask', {
      videoId: VIDEO_ID,
      videoUrl: VIDEO_URL,
      sessionId,
      question: 'What is this video about? Give a one-sentence answer.',
      questionType: 'standard',
    })
    const a = res.data
    if (a.answer && typeof a.answer === 'string') {
      log.pass('Standard question answered', `response type: ${a.responseType}`)
      log.info(`Answer preview: "${a.answer.substring(0, 80)}…"`)
      log.info(`Quota after: standard=${a.usage?.standardRemaining}  premium=${a.usage?.premiumRemaining}`)
    } else if (a.standardDisabled) {
      log.pass('Standard mode disabled — no transcript available (acceptable)')
      log.info(a.message)
    } else {
      log.fail('Ask standard question', new Error('Missing answer field'))
    }
  } catch (err) {
    if (err.response?.status === 429) {
      log.skip('Ask question (429 — daily limit)', err.response.data?.message)
    } else if (err.response?.status === 400 && err.response?.data?.standardDisabled) {
      log.pass('Standard mode returns 400 standardDisabled when no transcript (acceptable)')
    } else {
      log.fail('Ask standard question', err)
    }
  }

  // Premium question (opt-in)
  if (RUN_PREMIUM) {
    let premiumRemaining = 0
    try {
      const { client } = await authedClient()
      const usageRes = await client.get('/api/video-qa/usage')
      premiumRemaining = usageRes.data.premiumRemaining || 0
    } catch (_) {}

    if (premiumRemaining === 0) {
      log.skip('Premium question', 'daily premium quota exhausted')
    } else {
      try {
        const { client } = await authedClient()
        const res = await client.post('/api/video-qa/ask', {
          videoId: VIDEO_ID,
          videoUrl: VIDEO_URL,
          sessionId,
          question: 'Describe the first 10 seconds of this video in one sentence.',
          questionType: 'premium',
        })
        if (res.data.answer) {
          log.pass('Premium question answered', `type: ${res.data.responseType}`)
        } else {
          log.fail('Premium question', new Error('No answer returned'))
        }
      } catch (err) {
        if (err.response?.status === 429) {
          log.skip('Premium question (429)', err.response.data?.message)
        } else {
          log.fail('Premium question', err)
        }
      }
    }
  } else {
    log.skip('Premium (Gemini) question', 'set RUN_PREMIUM=true to enable')
  }

  // Validation: question too long
  try {
    const { client } = await authedClient()
    await client.post('/api/video-qa/ask', {
      videoId: VIDEO_ID,
      videoUrl: VIDEO_URL,
      sessionId,
      question: 'a'.repeat(600),
      questionType: 'standard',
    })
    log.fail('Oversized question should return 400', new Error('Expected 400'))
  } catch (err) {
    if (err.response?.status === 400) {
      log.pass('Oversized question (>500 chars) returns 400')
    } else {
      log.fail('Oversized question should return 400', err)
    }
  }

  // Validation: missing fields
  try {
    const { client } = await authedClient()
    await client.post('/api/video-qa/ask', {
      videoId: VIDEO_ID,
    })
    log.fail('Missing fields should return 400', new Error('Expected 400'))
  } catch (err) {
    if (err.response?.status >= 400 && err.response?.status < 500) {
      log.pass('Missing ask fields returns 4xx')
    } else {
      log.fail('Missing ask fields should return 4xx', err)
    }
  }
}

async function testDeleteSession() {
  log.section('DELETE /api/video-qa/session/:sessionId')

  if (!sessionId) {
    log.skip('Delete session', 'no session to delete')
    return
  }

  try {
    const { client } = await authedClient()
    const res = await client.delete(`/api/video-qa/session/${sessionId}`)
    if (res.data.message?.toLowerCase().includes('deleted')) {
      log.pass('Delete session succeeds')
    } else {
      log.fail('Delete session', new Error('Unexpected response: ' + JSON.stringify(res.data)))
    }
  } catch (err) {
    log.fail('Delete session', err)
  }

  // Verify deletion
  try {
    const { client } = await authedClient()
    await client.get(`/api/video-qa/session/${sessionId}`)
    log.fail('Deleted session should return 404', new Error('Expected 404'))
  } catch (err) {
    if (err.response?.status === 404) {
      log.pass('Deleted session now returns 404')
    } else {
      log.fail('Deleted session should return 404', err)
    }
  }
}

// ─── runner ──────────────────────────────────────────────────────────────────

;(async () => {
  log.header(`Video Q&A (RAG) API Tests  [Premium=${RUN_PREMIUM}]`)

  await testGetUsage()
  await testCreateSession()
  await testGetSessions()
  await testGetSession()
  await testAskQuestion()
  await testDeleteSession()

  const allPassed = log.summary()
  process.exit(allPassed ? 0 : 1)
})()
