/**
 * Shared auth helper — creates or reuses a test user and returns a JWT token.
 * Run only while the server is running on http://localhost:5000
 */

const axios = require('axios')

const BASE_URL = process.env.BACKEND_URL || 'http://localhost:5000'

const TEST_USER = {
  email: process.env.TEST_EMAIL || 'testuser_ytmate@example.com',
  password: process.env.TEST_PASSWORD || 'TestPassword123',
  name: 'YTMate Test User',
}

/**
 * Attempt login. If the user does not exist this helper cannot auto-register
 * (registration requires email verification), so provide a pre-verified user
 * via TEST_EMAIL / TEST_PASSWORD env vars, or use the seed script:
 *   node backend/scripts/create-test-user.js
 *
 * @returns {{ token: string, user: object }}
 */
async function getAuthToken() {
  try {
    const res = await axios.post(`${BASE_URL}/api/auth/login`, {
      email: TEST_USER.email,
      password: TEST_USER.password,
    })
    return { token: res.data.token, user: res.data.user }
  } catch (err) {
    const msg = err.response?.data?.error || err.message
    throw new Error(
      `Auth helper: login failed — ${msg}\n` +
      `Make sure a verified test user exists:\n` +
      `  email: ${TEST_USER.email}\n` +
      `  password: ${TEST_USER.password}\n` +
      `Run: node backend/scripts/create-test-user.js`
    )
  }
}

/**
 * Build an axios instance pre-configured with a Bearer token.
 */
async function authedClient() {
  const { token, user } = await getAuthToken()
  const client = axios.create({
    baseURL: BASE_URL,
    headers: { Authorization: `Bearer ${token}` },
    timeout: 30000,
  })
  return { client, token, user }
}

module.exports = { getAuthToken, authedClient, BASE_URL, TEST_USER }
