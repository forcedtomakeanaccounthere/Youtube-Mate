/**
 * test-url-shortener.js — URL Shortening API Tests
 *
 * Covers:
 *   POST /api/urls/shorten         — create short URL, custom alias, duplicate alias
 *   POST /api/urls/bulk-shorten    — bulk operation with summary
 *   GET  /api/urls/my-urls         — user URL listing + pagination
 *   GET  /api/urls/:id             — single URL detail
 *   PUT  /api/urls/:id             — update tags/notes/alias
 *   DELETE /api/urls/:id           — soft delete
 *
 * Usage:
 *   node tests/test-url-shortener.js
 */

'use strict'

const axios = require('axios')
const log   = require('./helpers/logger')
const { authedClient, BASE_URL } = require('./helpers/auth')

const SAMPLE_YT_URL = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
const CUSTOM_ALIAS  = `test-alias-${Date.now()}`

const http = axios.create({ baseURL: BASE_URL, timeout: 30000 })

let createdUrlId   = null
let createdShortUrl = null

// ─── tests ───────────────────────────────────────────────────────────────────

async function testShortenUrl() {
  log.section('POST /api/urls/shorten')

  // 1. Basic shorten (no auth required)
  try {
    const res = await http.post('/api/urls/shorten', {
      originalUrl: SAMPLE_YT_URL,
    })
    const d = res.data.data
    if (d?.shortUrl && d?.shortCode) {
      createdUrlId    = d.id
      createdShortUrl = d.shortUrl
      log.pass('Create short URL returns shortUrl + shortCode', `code: ${d.shortCode}`)
      log.info(`QR code present: ${!!d.qrCode}`)
      log.info(`Video metadata present: ${!!d.videoData?.title}`)
    } else {
      log.fail('Create short URL', new Error('Missing shortUrl/shortCode in response'))
    }
  } catch (err) {
    log.fail('Create short URL', err)
  }

  // 2. Custom alias
  try {
    const res = await http.post('/api/urls/shorten', {
      originalUrl: SAMPLE_YT_URL,
      customAlias: CUSTOM_ALIAS,
    })
    const d = res.data.data
    if (d?.customAlias === CUSTOM_ALIAS) {
      log.pass('Custom alias is honoured', `alias: ${CUSTOM_ALIAS}`)
    } else {
      log.fail('Custom alias', new Error(`Expected alias ${CUSTOM_ALIAS}, got ${d?.customAlias}`))
    }
  } catch (err) {
    log.fail('Custom alias creation', err)
  }

  // 3. Duplicate alias → 400
  try {
    await http.post('/api/urls/shorten', {
      originalUrl: SAMPLE_YT_URL,
      customAlias: CUSTOM_ALIAS,
    })
    log.fail('Duplicate alias should return 400', new Error('Expected 400'))
  } catch (err) {
    if (err.response?.status === 400) {
      log.pass('Duplicate alias returns 400 with suggestion')
      log.info(`Suggestion: ${err.response?.data?.suggestion}`)
    } else {
      log.fail('Duplicate alias should return 400', err)
    }
  }

  // 4. Missing originalUrl → 4xx
  try {
    await http.post('/api/urls/shorten', {})
    log.fail('Missing originalUrl should return 4xx', new Error('Expected error'))
  } catch (err) {
    if (err.response?.status >= 400 && err.response?.status < 500) {
      log.pass('Missing originalUrl returns 4xx validation error')
    } else {
      log.fail('Missing originalUrl should return 4xx', err)
    }
  }

  // 5. Timestamp embedding
  try {
    const res = await http.post('/api/urls/shorten', {
      originalUrl: SAMPLE_YT_URL,
      timestamp: { hours: 0, minutes: 1, seconds: 30 },
    })
    const d = res.data.data
    if (d?.timestamp?.start === 90) {
      log.pass('Timestamp embedding works (90 s offset)')
    } else {
      log.fail('Timestamp embedding', new Error(`Expected start=90, got ${d?.timestamp?.start}`))
    }
  } catch (err) {
    log.fail('Timestamp embedding', err)
  }
}

async function testBulkShorten() {
  log.section('POST /api/urls/bulk-shorten')

  try {
    const res = await http.post('/api/urls/bulk-shorten', {
      urls: [
        { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
        { url: 'https://www.youtube.com/watch?v=jNQXAC9IVRw' },
      ],
    })
    const { summary, results } = res.data
    if (summary?.total === 2) {
      log.pass(`Bulk shorten: total=${summary.total} successful=${summary.successful} failed=${summary.failed}`)
    } else {
      log.fail('Bulk shorten summary', new Error(`Expected total=2, got ${summary?.total}`))
    }
    results.forEach((r, i) => {
      if (r.status === 'success') {
        log.pass(`  URL ${i + 1}: ${r.shortUrl}`)
      } else {
        log.fail(`  URL ${i + 1} failed`, new Error(r.error))
      }
    })
  } catch (err) {
    log.fail('Bulk shorten', err)
  }

  // Empty array → 4xx
  try {
    await http.post('/api/urls/bulk-shorten', { urls: [] })
    log.fail('Empty urls array should return 4xx', new Error('Expected error'))
  } catch (err) {
    if (err.response?.status >= 400 && err.response?.status < 500) {
      log.pass('Empty urls array returns 4xx')
    } else {
      log.fail('Empty urls array should return 4xx', err)
    }
  }
}

async function testGetMyUrls() {
  log.section('GET /api/urls/my-urls')

  try {
    const { client } = await authedClient()
    const res = await client.get('/api/urls/my-urls?page=1&limit=5')
    const { data, pagination } = res.data
    if (Array.isArray(data?.urls)) {
      log.pass(`Listed user URLs — count on page: ${data.urls.length}`, `total: ${pagination?.total}`)
    } else {
      log.fail('List user URLs', new Error('urls array missing'))
    }
  } catch (err) {
    log.fail('List user URLs', err)
  }

  // Search query
  try {
    const { client } = await authedClient()
    const res = await client.get('/api/urls/my-urls?search=rick')
    log.pass(`Search returns ${res.data.data?.urls?.length ?? 0} results for "rick"`)
  } catch (err) {
    log.fail('Search in my-urls', err)
  }
}

async function testGetSingleUrl() {
  log.section('GET /api/urls/:id')

  if (!createdUrlId) {
    log.skip('GET single URL', 'no URL created in previous step')
    return
  }

  try {
    const res = await http.get(`/api/urls/${createdUrlId}`)
    if (res.data.data?.shortCode) {
      log.pass('Fetch single URL by ID', `shortCode: ${res.data.data.shortCode}`)
    } else {
      log.fail('Fetch single URL', new Error('Missing shortCode'))
    }
  } catch (err) {
    log.fail('Fetch single URL', err)
  }

  // Non-existent ID
  try {
    await http.get('/api/urls/000000000000000000000000')
    log.fail('Non-existent URL should return 404', new Error('Expected 404'))
  } catch (err) {
    if (err.response?.status === 404) {
      log.pass('Non-existent URL ID returns 404')
    } else {
      log.fail('Non-existent URL ID should return 404', err)
    }
  }
}

async function testUpdateUrl() {
  log.section('PUT /api/urls/:id')

  if (!createdUrlId) {
    log.skip('Update URL', 'no URL created in previous step')
    return
  }

  try {
    const { client } = await authedClient()
    const res = await client.put(`/api/urls/${createdUrlId}`, {
      tags: ['test', 'ytmate'],
      notes: 'Updated by automated test',
    })
    if (res.data.data?.tags?.includes('test')) {
      log.pass('Update URL tags + notes succeeds')
    } else {
      log.fail('Update URL', new Error('Tags not updated'))
    }
  } catch (err) {
    log.fail('Update URL', err)
  }
}

async function testDeleteUrl() {
  log.section('DELETE /api/urls/:id')

  if (!createdUrlId) {
    log.skip('Delete URL', 'no URL created in previous step')
    return
  }

  try {
    const { client } = await authedClient()
    const res = await client.delete(`/api/urls/${createdUrlId}`)
    if (res.data.success) {
      log.pass('Delete URL soft-deletes and returns success: true')
    } else {
      log.fail('Delete URL', new Error('success not true'))
    }
  } catch (err) {
    log.fail('Delete URL', err)
  }
}

// ─── runner ──────────────────────────────────────────────────────────────────

;(async () => {
  log.header('URL Shortener API Tests')

  await testShortenUrl()
  await testBulkShorten()
  await testGetMyUrls()
  await testGetSingleUrl()
  await testUpdateUrl()
  await testDeleteUrl()

  const allPassed = log.summary()
  process.exit(allPassed ? 0 : 1)
})()
