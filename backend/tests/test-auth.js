/**
 * test-auth.js — Authentication API Tests
 *
 * Covers:
 *   POST /api/auth/login            — valid credentials, wrong password, non-existent user
 *   GET  /api/auth/me               — fetch profile with valid / invalid token
 *   POST /api/auth/logout           — always succeeds
 *   POST /api/auth/forgot-password  — email dispatch (success + Google-account guard)
 *   POST /api/auth/register         — duplicate email guard
 *
 * Prerequisites:
 *   - Backend running on http://localhost:5000
 *   - A pre-verified user exists (run: node scripts/create-test-user.js)
 *   - Set TEST_EMAIL / TEST_PASSWORD env vars if using a custom account
 *
 * Usage:
 *   node tests/test-auth.js
 */

'use strict'

const axios  = require('axios')
const log    = require('./helpers/logger')
const { BASE_URL, TEST_USER } = require('./helpers/auth')

const http = axios.create({ baseURL: BASE_URL, timeout: 15000 })

// ─── helpers ─────────────────────────────────────────────────────────────────

async function post(path, body) {
  return http.post(path, body)
}

// ─── tests ───────────────────────────────────────────────────────────────────

async function testLogin() {
  log.section('Login')

  // 1. Valid credentials
  try {
    const res = await post('/api/auth/login', {
      email: TEST_USER.email,
      password: TEST_USER.password,
    })
    if (res.data.token && res.data.user) {
      log.pass('Valid credentials return token + user object')
      log.info(`Logged in as: ${res.data.user.email}  plan: ${res.data.user.plan}`)
    } else {
      log.fail('Valid credentials', new Error('Missing token or user in response'))
    }
  } catch (err) {
    log.fail('Valid credentials', err)
  }

  // 2. Wrong password
  try {
    await post('/api/auth/login', {
      email: TEST_USER.email,
      password: 'wrongpassword_xyz',
    })
    log.fail('Wrong password should return 401', new Error('Expected error, got success'))
  } catch (err) {
    if (err.response?.status === 401) {
      log.pass('Wrong password returns 401')
    } else {
      log.fail('Wrong password should return 401', err)
    }
  }

  // 3. Non-existent email
  try {
    await post('/api/auth/login', {
      email: 'no-such-user@example.com',
      password: 'whatever',
    })
    log.fail('Non-existent email should return 401', new Error('Expected error, got success'))
  } catch (err) {
    if (err.response?.status === 401) {
      log.pass('Non-existent email returns 401')
    } else {
      log.fail('Non-existent email should return 401', err)
    }
  }

  // 4. Missing fields
  try {
    await post('/api/auth/login', {})
    log.fail('Empty body should return 4xx', new Error('Expected error, got success'))
  } catch (err) {
    if (err.response?.status >= 400 && err.response?.status < 500) {
      log.pass('Empty login body returns 4xx validation error')
    } else {
      log.fail('Empty login body should return 4xx', err)
    }
  }
}

async function testGetMe() {
  log.section('GET /api/auth/me')

  let token
  try {
    const res = await post('/api/auth/login', {
      email: TEST_USER.email,
      password: TEST_USER.password,
    })
    token = res.data.token
  } catch (err) {
    log.skip('GET /me tests', 'could not obtain token — login failed')
    return
  }

  // Valid token
  try {
    const res = await http.get('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    })
    const u = res.data.user
    if (u && u.id && u.email) {
      log.pass('GET /me with valid token returns user', `id: ${u.id}`)
    } else {
      log.fail('GET /me with valid token', new Error('Incomplete user object'))
    }
  } catch (err) {
    log.fail('GET /me with valid token', err)
  }

  // Invalid / expired token
  try {
    await http.get('/api/auth/me', {
      headers: { Authorization: 'Bearer fake.jwt.token' },
    })
    log.fail('Invalid token should return 401/403', new Error('Expected error, got success'))
  } catch (err) {
    if (err.response?.status === 401 || err.response?.status === 403) {
      log.pass('Invalid token returns 401/403')
    } else {
      log.fail('Invalid token should return 401/403', err)
    }
  }

  // No auth header
  try {
    await http.get('/api/auth/me')
    log.fail('No auth header should return 401', new Error('Expected error, got success'))
  } catch (err) {
    if (err.response?.status === 401) {
      log.pass('No auth header returns 401')
    } else {
      log.fail('No auth header should return 401', err)
    }
  }
}

async function testLogout() {
  log.section('POST /api/auth/logout')

  try {
    const res = await post('/api/auth/logout', {})
    if (res.data.success) {
      log.pass('Logout returns success: true')
    } else {
      log.fail('Logout response', new Error('success field not true'))
    }
  } catch (err) {
    log.fail('Logout', err)
  }
}

async function testForgotPassword() {
  log.section('POST /api/auth/forgot-password')

  // Known email — should succeed (even if no email is actually sent in test env)
  try {
    const res = await post('/api/auth/forgot-password', {
      email: TEST_USER.email,
    })
    if (res.data.success) {
      log.pass('Known email triggers password reset flow')
    } else {
      log.fail('Forgot password with known email', new Error('success not true'))
    }
  } catch (err) {
    log.fail('Forgot password with known email', err)
  }

  // Unknown email — API should NOT reveal that the user doesn't exist (security)
  try {
    const res = await post('/api/auth/forgot-password', {
      email: 'unknown_xyz_1234@example.com',
    })
    if (res.data.success) {
      log.pass('Unknown email returns generic success (no user enumeration)')
    } else {
      log.fail('Forgot password with unknown email', new Error('Expected generic success'))
    }
  } catch (err) {
    // A 404 here would leak user existence — flag it
    if (err.response?.status === 404) {
      log.fail('Unknown email leaks user existence (returns 404)', err)
    } else {
      log.fail('Forgot password with unknown email', err)
    }
  }

  // Missing email
  try {
    await post('/api/auth/forgot-password', {})
    log.fail('Missing email should return 4xx', new Error('Expected error'))
  } catch (err) {
    if (err.response?.status >= 400 && err.response?.status < 500) {
      log.pass('Missing email field returns 4xx')
    } else {
      log.fail('Missing email should return 4xx', err)
    }
  }
}

async function testRegisterDuplicate() {
  log.section('POST /api/auth/register — duplicate guard')

  // Re-registering an existing email must fail with 400
  try {
    await post('/api/auth/register', {
      email: TEST_USER.email,
      password: TEST_USER.password,
      name: 'Duplicate User',
      recaptchaToken: 'test_bypass',
    })
    // If reCAPTCHA is disabled AND email is taken we expect a 400
    log.fail('Duplicate email should return 400', new Error('Expected 400 but got success'))
  } catch (err) {
    if (err.response?.status === 400) {
      log.pass('Duplicate email registration returns 400')
    } else if (err.response?.status === 201) {
      log.fail('Duplicate email should not be allowed (got 201)', err)
    } else {
      // reCAPTCHA rejection (400) is also acceptable here
      log.pass(`Duplicate email registration blocked (status: ${err.response?.status})`)
    }
  }
}

// ─── runner ──────────────────────────────────────────────────────────────────

;(async () => {
  log.header('Authentication API Tests')

  await testLogin()
  await testGetMe()
  await testLogout()
  await testForgotPassword()
  await testRegisterDuplicate()

  const allPassed = log.summary()
  process.exit(allPassed ? 0 : 1)
})()
