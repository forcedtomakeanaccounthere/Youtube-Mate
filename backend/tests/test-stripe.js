/**
 * test-stripe.js — Stripe / Payments API Tests
 *
 * Covers:
 *   POST /api/stripe/create-checkout-session   — valid plans, free plan guard, invalid plan
 *   GET  /api/stripe/verify-session/:sessionId — verify session status
 *   POST /api/stripe/test-update-user          — dev helper to upgrade plan directly
 *
 * Notes:
 *   - Real Stripe Checkout sessions cannot be completed in automated tests
 *     (they require a browser redirect). These tests only validate the API
 *     contract: request validation, plan guards, and response shape.
 *   - The webhook endpoint is NOT tested here because it requires signed
 *     Stripe payloads. Use `stripe listen --forward-to localhost:5000/api/stripe/webhook`
 *     for manual webhook testing.
 *   - Tests run in DEVELOPMENT mode expectations (no reCAPTCHA enforced).
 *
 * Usage:
 *   node tests/test-stripe.js
 */

'use strict'

const axios = require('axios')
const { v4: uuidv4 } = require('uuid')
const log   = require('./helpers/logger')
const { authedClient, BASE_URL } = require('./helpers/auth')

const http = axios.create({ baseURL: BASE_URL, timeout: 15000 })

let testUserId  = null
let testEmail   = null

// ─── tests ───────────────────────────────────────────────────────────────────

async function getTestUser() {
  try {
    const { client, user } = await authedClient()
    testUserId = user.id
    testEmail  = user.email
    return { client, user }
  } catch (err) {
    log.fail('Could not authenticate test user', err)
    return {}
  }
}

async function testCreateCheckoutSession() {
  log.section('POST /api/stripe/create-checkout-session')

  const { client, user } = await getTestUser()
  if (!client) return

  // 1. Pro plan checkout
  try {
    const res = await http.post('/api/stripe/create-checkout-session', {
      planId: 'pro',
      userId: testUserId,
      email: testEmail,
      idempotencyKey: uuidv4(),
    })
    if (res.data.sessionId && res.data.url) {
      log.pass('Pro plan checkout session created', `sessionId: ${res.data.sessionId}`)
      log.info(`Checkout URL (truncated): ${res.data.url.substring(0, 60)}…`)
    } else {
      log.fail('Pro plan checkout', new Error('Missing sessionId or url'))
    }
  } catch (err) {
    if (err.response?.status === 500 && err.response?.data?.error?.includes('Stripe')) {
      log.skip('Pro plan checkout', 'Stripe API key not configured in test env')
    } else {
      log.fail('Pro plan checkout', err)
    }
  }

  // 2. Exclusive plan
  try {
    const res = await http.post('/api/stripe/create-checkout-session', {
      planId: 'exclusive',
      userId: testUserId,
      email: testEmail,
      idempotencyKey: uuidv4(),
    })
    if (res.data.sessionId) {
      log.pass('Exclusive plan checkout session created')
    } else {
      log.fail('Exclusive plan checkout', new Error('Missing sessionId'))
    }
  } catch (err) {
    if (err.response?.status === 500) {
      log.skip('Exclusive plan checkout', 'Stripe not configured')
    } else {
      log.fail('Exclusive plan checkout', err)
    }
  }

  // 3. Free plan → 400
  try {
    await http.post('/api/stripe/create-checkout-session', {
      planId: 'free',
      userId: testUserId,
      email: testEmail,
      idempotencyKey: uuidv4(),
    })
    log.fail('Free plan should return 400', new Error('Expected 400'))
  } catch (err) {
    if (err.response?.status === 400) {
      log.pass('Free plan correctly returns 400 (no payment needed)')
    } else {
      log.fail('Free plan should return 400', err)
    }
  }

  // 4. Invalid plan → 400
  try {
    await http.post('/api/stripe/create-checkout-session', {
      planId: 'ultra-premium-xyz',
      userId: testUserId,
      email: testEmail,
      idempotencyKey: uuidv4(),
    })
    log.fail('Invalid plan should return 400', new Error('Expected 400'))
  } catch (err) {
    if (err.response?.status === 400) {
      log.pass('Invalid plan ID returns 400')
    } else {
      log.fail('Invalid plan should return 400', err)
    }
  }

  // 5. Missing required fields
  try {
    await http.post('/api/stripe/create-checkout-session', {
      planId: 'pro',
    })
    log.fail('Missing userId/email should return 400', new Error('Expected 400'))
  } catch (err) {
    if (err.response?.status === 400) {
      log.pass('Missing required fields returns 400')
    } else {
      log.fail('Missing required fields should return 400', err)
    }
  }
}

async function testVerifySession() {
  log.section('GET /api/stripe/verify-session/:sessionId')

  // Non-existent Stripe session ID → Stripe will return an error
  try {
    await http.get('/api/stripe/verify-session/cs_test_nonexistent_session_xyz_000')
    log.fail('Non-existent session should return error', new Error('Expected error'))
  } catch (err) {
    if (err.response?.status === 500 || err.response?.status === 400) {
      log.pass('Non-existent Stripe session returns server-side error (expected)')
      log.info(err.response?.data?.error)
    } else {
      log.fail('Non-existent session error handling', err)
    }
  }

  // Missing session ID in path — Express won't match to this route but still test
  log.info('Real session verification requires completing Stripe checkout — skipping live test')
}

async function testDevPlanUpdate() {
  log.section('POST /api/stripe/test-update-user (dev helper)')

  if (!testUserId) {
    log.skip('Dev plan update', 'no test user')
    return
  }

  // Upgrade to pro
  try {
    const res = await http.post('/api/stripe/test-update-user', {
      userId: testUserId,
      planId: 'pro',
    })
    if (res.data.success && res.data.user?.plan === 'pro') {
      log.pass('Dev plan upgrade to pro succeeds')
      log.info(`User ${res.data.user.email} plan: ${res.data.user.plan}`)
    } else {
      log.fail('Dev plan upgrade', new Error('plan not updated to pro'))
    }
  } catch (err) {
    log.fail('Dev plan upgrade', err)
  }

  // Restore to free
  try {
    const res = await http.post('/api/stripe/test-update-user', {
      userId: testUserId,
      planId: 'free',
    })
    if (res.data.success && res.data.user?.plan === 'free') {
      log.pass('Dev plan restore to free succeeds')
    } else {
      log.fail('Dev plan restore', new Error('plan not restored to free'))
    }
  } catch (err) {
    log.fail('Dev plan restore to free', err)
  }

  // Non-existent user
  try {
    await http.post('/api/stripe/test-update-user', {
      userId: '000000000000000000000000',
      planId: 'pro',
    })
    log.fail('Non-existent user should return 404', new Error('Expected 404'))
  } catch (err) {
    if (err.response?.status === 404) {
      log.pass('Non-existent user returns 404')
    } else {
      log.fail('Non-existent user should return 404', err)
    }
  }
}

// ─── runner ──────────────────────────────────────────────────────────────────

;(async () => {
  log.header('Stripe / Payments API Tests')

  await testCreateCheckoutSession()
  await testVerifySession()
  await testDevPlanUpdate()

  const allPassed = log.summary()
  process.exit(allPassed ? 0 : 1)
})()
