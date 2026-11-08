/**
 * test-auth-security.js — INTEGRATION TESTS (requires a running server)
 *
 * Verifies the security hardening behaviors end-to-end:
 *   - "Bearer null" / "Bearer undefined" → clean 401 (the jwt-malformed fix)
 *   - garbage bearer token → 401 (never 500)
 *   - httpOnly cookie auth works without an Authorization header
 *   - Stripe checkout requires authentication (client userId no longer trusted)
 *   - /test-update-user is gone (404)
 *   - /downloads static filesystem exposure is gone (404)
 *
 * Run: node tests/test-auth-security.js   (with the server running)
 */

'use strict'

const axios = require('axios')
const jwt = require('jsonwebtoken')
const { header, section, pass, fail, skip, summary } = require('./helpers/logger')

const BASE_URL = process.env.BACKEND_URL || 'http://localhost:5000'

async function run() {
  header('Auth & Security Hardening — Integration Tests')

  // Probe the server first
  try {
    await axios.get(`${BASE_URL}/health`, { timeout: 3000 })
  } catch {
    skip('all integration tests', `server not reachable at ${BASE_URL} — start it with: node server.js`)
    summary()
    return
  }

  section('Bearer token handling (jwt-malformed fix)')

  try {
    const res = await axios.get(`${BASE_URL}/api/auth/me`, { headers: { Authorization: 'Bearer null' }, validateStatus: () => true })
    assert.strictEqual(res.status, 401, `expected 401, got ${res.status}`)
    assert.strictEqual(res.data.error, 'Access token required')
    pass('Bearer null → 401 "Access token required" (was 403 jwt malformed)')
  } catch (err) { fail('Bearer null handled', err) }

  try {
    const res = await axios.get(`${BASE_URL}/api/auth/me`, { headers: { Authorization: 'Bearer undefined' }, validateStatus: () => true })
    assert.strictEqual(res.status, 401)
    pass('Bearer undefined → 401')
  } catch (err) { fail('Bearer undefined handled', err) }

  try {
    const res = await axios.get(`${BASE_URL}/api/auth/me`, { headers: { Authorization: 'Bearer garbage.token.here' }, validateStatus: () => true })
    assert.strictEqual(res.status, 401, `expected 401, got ${res.status}`)
    assert.strictEqual(res.data.error, 'Invalid or expired token')
    pass('garbage token → 401 (never 500)')
  } catch (err) { fail('garbage token handled', err) }

  section('httpOnly cookie authentication')

  // Build a real token for the seed test user (or skip when unavailable).
  // Reuses the shared test-user contract from tests/helpers/auth.js.
  let testToken = null
  try {
    const { getAuthToken } = require('./helpers/auth')
    const auth = await getAuthToken()
    testToken = auth.token
  } catch {
    skip('cookie auth test', 'no test user credentials available (set TEST_EMAIL/TEST_PASSWORD)')
  }

  if (testToken) {
    try {
      const res = await axios.get(`${BASE_URL}/api/auth/me`, {
        headers: { Cookie: `token=${testToken}` }, // cookie only — no Authorization header
        validateStatus: () => true,
      })
      assert.strictEqual(res.status, 200, `expected 200, got ${res.status}`)
      assert(res.data.user && res.data.user.id, 'user payload missing')
      pass('httpOnly cookie authenticates without a header')
    } catch (err) { fail('cookie auth', err) }
  }

  section('Stripe identity hardening')

  try {
    const res = await axios.post(
      `${BASE_URL}/api/stripe/create-checkout-session`,
      { planId: 'pro', userId: 'forged-user-id', email: 'attacker@example.com', idempotencyKey: 'test-key-1' },
      { validateStatus: () => true }
    )
    assert.strictEqual(res.status, 401, `unauthenticated checkout should be 401, got ${res.status}`)
    pass('checkout without auth → 401 (client userId no longer trusted)')
  } catch (err) { fail('stripe unauth 401', err) }

  try {
    const res = await axios.get(`${BASE_URL}/api/stripe/verify-session/cs_test_fake`, { validateStatus: () => true })
    assert.strictEqual(res.status, 401, `verify-session should require auth, got ${res.status}`)
    pass('verify-session requires authentication')
  } catch (err) { fail('verify-session auth', err) }

  section('Removed attack surface')

  try {
    const res = await axios.post(`${BASE_URL}/api/stripe/test-update-user`, { userId: 'x', planId: 'pro' }, { validateStatus: () => true })
    assert.strictEqual(res.status, 404, `test-update-user should be gone, got ${res.status}`)
    pass('/api/stripe/test-update-user removed (404)')
  } catch (err) { fail('test-update-user removed', err) }

  try {
    const res = await axios.get(`${BASE_URL}/downloads/`, { validateStatus: () => true, maxRedirects: 0 })
    assert.strictEqual(res.status, 404, `/downloads static should be gone, got ${res.status}`)
    pass('/downloads static filesystem exposure removed (404)')
  } catch (err) { fail('/downloads removed', err) }

  summary()
}

run().catch((err) => {
  console.error('Test runner crashed:', err)
  process.exit(1)
})
