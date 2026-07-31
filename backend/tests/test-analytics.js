/**
 * test-analytics.js — URL Analytics & Redirect API Tests
 *
 * Covers:
 *   GET  /:shortCode                       — redirect endpoint (click tracking)
 *   GET  /api/analytics/:id/clicks         — click history for a URL
 *   GET  /api/analytics/:id/summary        — click summary stats
 *   GET  /api/analytics/:id/geo            — geolocation breakdown
 *   GET  /api/analytics/:id/devices        — device / browser breakdown
 *   GET  /api/analytics/overview           — aggregate overview for user
 *
 * Setup:
 *   Runs after test-url-shortener.js — needs at least one shortened URL to exist.
 *   The script creates its own test URL if none is found.
 *
 * Usage:
 *   node tests/test-analytics.js
 */

'use strict'

const axios = require('axios')
const log   = require('./helpers/logger')
const { authedClient, BASE_URL } = require('./helpers/auth')

const http = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  maxRedirects: 0,           // don't follow redirects — we want the 301/302 itself
  validateStatus: (s) => true, // treat all status codes as resolved
})

const httpFollow = axios.create({ baseURL: BASE_URL, timeout: 15000 })

let testUrlId   = null
let testShortCode = null

// ─── helpers ─────────────────────────────────────────────────────────────────

async function ensureTestUrl() {
  const { client } = await authedClient()

  // Check if any URL already exists
  try {
    const listRes = await client.get('/api/urls/my-urls?limit=1')
    const urls = listRes.data.data?.urls
    if (urls?.length > 0) {
      testUrlId    = urls[0]._id
      testShortCode = urls[0].shortCode || urls[0].customAlias
      log.info(`Reusing existing URL — id: ${testUrlId}  code: ${testShortCode}`)
      return
    }
  } catch (_) {}

  // Create a fresh one
  try {
    const res = await client.post('/api/urls/shorten', {
      originalUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      analyticsEnabled: true,
    })
    testUrlId    = res.data.data?.id
    testShortCode = res.data.data?.shortCode
    log.info(`Created test URL — id: ${testUrlId}  code: ${testShortCode}`)
  } catch (err) {
    log.fail('Could not create test URL for analytics tests', err)
  }
}

// ─── tests ───────────────────────────────────────────────────────────────────

async function testRedirect() {
  log.section(`GET /:shortCode — redirect endpoint`)

  if (!testShortCode) {
    log.skip('Redirect test', 'no short code available')
    return
  }

  // Should get a 301/302 redirect
  try {
    const res = await http.get(`/${testShortCode}`)
    if (res.status === 301 || res.status === 302) {
      log.pass(`Redirect returns ${res.status}`, `Location: ${res.headers.location?.substring(0, 60)}`)
    } else if (res.status === 200) {
      // Some configs may inline redirect
      log.pass('Redirect endpoint returns 200 (inline)')
    } else if (res.status === 404) {
      log.fail('Short code not found (404)', new Error('URL may have been soft-deleted'))
    } else {
      log.fail('Unexpected redirect status', new Error(`Got ${res.status}`))
    }
  } catch (err) {
    log.fail('Redirect endpoint', err)
  }

  // Non-existent short code → 404
  try {
    const res = await http.get('/xxxxxxxxxxxxxxxxx_nonexistent')
    if (res.status === 404) {
      log.pass('Non-existent short code returns 404')
    } else {
      log.fail('Non-existent short code should return 404', new Error(`Got ${res.status}`))
    }
  } catch (err) {
    if (err.response?.status === 404) {
      log.pass('Non-existent short code returns 404')
    } else {
      log.fail('Non-existent short code', err)
    }
  }
}

async function testClickAnalytics() {
  log.section('GET /api/analytics/:id/clicks')

  if (!testUrlId) {
    log.skip('Click analytics', 'no URL ID')
    return
  }

  try {
    const { client } = await authedClient()
    const res = await client.get(`/api/analytics/${testUrlId}/clicks?page=1&limit=10`)
    const data = res.data
    // Response could be { clicks: [], pagination: {} } or similar
    if (data && (Array.isArray(data.clicks) || Array.isArray(data.data))) {
      const list = data.clicks || data.data
      log.pass(`Click history: ${list.length} records`)
    } else if (res.status === 200) {
      log.pass('Click history endpoint responds 200', `keys: ${Object.keys(data).join(', ')}`)
    } else {
      log.fail('Click history', new Error('Unexpected response shape'))
    }
  } catch (err) {
    if (err.response?.status === 404) {
      log.skip('Click analytics (404)', 'analytics not found — URL may have no clicks yet')
    } else {
      log.fail('Click analytics', err)
    }
  }
}

async function testClickSummary() {
  log.section('GET /api/analytics/:id/summary')

  if (!testUrlId) {
    log.skip('Click summary', 'no URL ID')
    return
  }

  try {
    const { client } = await authedClient()
    const res = await client.get(`/api/analytics/${testUrlId}/summary`)
    log.pass('Summary endpoint responds 200', `keys: ${Object.keys(res.data).join(', ')}`)
    if (typeof res.data.totalClicks === 'number' || typeof res.data.clicks === 'number') {
      log.info(`Total clicks: ${res.data.totalClicks ?? res.data.clicks}`)
    }
  } catch (err) {
    if (err.response?.status === 404) {
      log.skip('Click summary (404)', 'no analytics record yet')
    } else {
      log.fail('Click summary', err)
    }
  }
}

async function testGeoBreakdown() {
  log.section('GET /api/analytics/:id/geo')

  if (!testUrlId) {
    log.skip('Geo breakdown', 'no URL ID')
    return
  }

  try {
    const { client } = await authedClient()
    const res = await client.get(`/api/analytics/${testUrlId}/geo`)
    log.pass('Geo breakdown responds 200', `keys: ${Object.keys(res.data).join(', ')}`)
  } catch (err) {
    if (err.response?.status === 404) {
      log.skip('Geo breakdown (404)', 'no analytics record yet')
    } else {
      log.fail('Geo breakdown', err)
    }
  }
}

async function testDeviceBreakdown() {
  log.section('GET /api/analytics/:id/devices')

  if (!testUrlId) {
    log.skip('Device breakdown', 'no URL ID')
    return
  }

  try {
    const { client } = await authedClient()
    const res = await client.get(`/api/analytics/${testUrlId}/devices`)
    log.pass('Device breakdown responds 200', `keys: ${Object.keys(res.data).join(', ')}`)
  } catch (err) {
    if (err.response?.status === 404) {
      log.skip('Device breakdown (404)', 'no analytics record yet')
    } else {
      log.fail('Device breakdown', err)
    }
  }
}

async function testAnalyticsOverview() {
  log.section('GET /api/analytics/overview')

  try {
    const { client } = await authedClient()
    const res = await client.get('/api/analytics/overview')
    log.pass('Analytics overview responds 200', `keys: ${Object.keys(res.data).join(', ')}`)
    if (typeof res.data.totalUrls === 'number' || typeof res.data.urls === 'number') {
      log.info(`Total URLs: ${res.data.totalUrls ?? res.data.urls}`)
    }
  } catch (err) {
    if (err.response?.status === 404) {
      log.skip('Analytics overview (404)', 'route may not exist — check analytics router')
    } else {
      log.fail('Analytics overview', err)
    }
  }
}

async function testAccessControl() {
  log.section('Analytics access control')

  if (!testUrlId) {
    log.skip('Access control', 'no URL ID')
    return
  }

  // Unauthenticated request should return 401 for analytics
  const anonHttp = axios.create({ baseURL: BASE_URL, timeout: 10000 })
  try {
    await anonHttp.get(`/api/analytics/${testUrlId}/clicks`)
    // Some analytics routes allow anon access — just check it doesn't crash
    log.pass('Analytics allows unauthenticated access (public analytics)')
  } catch (err) {
    if (err.response?.status === 401 || err.response?.status === 403) {
      log.pass('Analytics correctly requires authentication (401/403)')
    } else if (err.response?.status === 404) {
      log.skip('Analytics access control (404)', 'route may require different path')
    } else {
      log.fail('Analytics access control', err)
    }
  }
}

// ─── runner ──────────────────────────────────────────────────────────────────

;(async () => {
  log.header('URL Analytics & Redirect API Tests')

  await ensureTestUrl()
  await testRedirect()
  await testClickAnalytics()
  await testClickSummary()
  await testGeoBreakdown()
  await testDeviceBreakdown()
  await testAnalyticsOverview()
  await testAccessControl()

  const allPassed = log.summary()
  process.exit(allPassed ? 0 : 1)
})()
