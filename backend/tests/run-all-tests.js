/**
 * run-all-tests.js — Master Test Runner
 *
 * Runs all test suites sequentially and prints a final report.
 * Each suite is spawned as a child process so failures in one
 * suite don't prevent the others from running.
 *
 * Usage:
 *   node tests/run-all-tests.js
 *
 * Environment variables forwarded to every suite:
 *   BACKEND_URL     — override backend base URL  (default: http://localhost:5000)
 *   TEST_EMAIL      — pre-verified test user email
 *   TEST_PASSWORD   — test user password
 *   RUN_DOWNLOAD    — set "true" to run full yt-dlp download lifecycle
 *   RUN_PREMIUM     — set "true" to run Gemini premium Q&A tests
 *
 * Suites run in this order:
 *   1. health-and-rate-limits  (infra first — if this fails, everything will fail)
 *   2. auth
 *   3. url-shortener
 *   4. transcript
 *   5. playlists
 *   6. stream-rooms
 *   7. video-qa
 *   8. downloads
 *   9. stripe
 *   10. analytics
 */

'use strict'

const { spawnSync } = require('child_process')
const path = require('path')

const RESET  = '\x1b[0m'
const GREEN  = '\x1b[32m'
const RED    = '\x1b[31m'
const YELLOW = '\x1b[33m'
const CYAN   = '\x1b[36m'
const BOLD   = '\x1b[1m'
const DIM    = '\x1b[2m'

const SUITES = [
  { name: 'Health & Rate Limits', file: 'test-health-and-rate-limits.js' },
  { name: 'Authentication',       file: 'test-auth.js'                   },
  { name: 'URL Shortener',        file: 'test-url-shortener.js'          },
  { name: 'Transcripts',          file: 'test-transcript.js'             },
  { name: 'Playlists',            file: 'test-playlists.js'              },
  { name: 'Stream Rooms',         file: 'test-stream-rooms.js'           },
  { name: 'Video Q&A',            file: 'test-video-qa.js'               },
  { name: 'Downloads',            file: 'test-downloads.js'              },
  { name: 'Stripe / Payments',    file: 'test-stripe.js'                 },
  { name: 'Analytics',            file: 'test-analytics.js'              },
]

const TESTS_DIR = __dirname

function pad(str, len) {
  return str + ' '.repeat(Math.max(0, len - str.length))
}

function banner() {
  const line = '═'.repeat(64)
  console.log(`\n${CYAN}${BOLD}${line}${RESET}`)
  console.log(`${CYAN}${BOLD}  YouTube Mate — Full API Test Suite${RESET}`)
  console.log(`${CYAN}${BOLD}  Backend: ${process.env.BACKEND_URL || 'http://localhost:5000'}${RESET}`)
  console.log(`${CYAN}${BOLD}${line}${RESET}\n`)
}

function runSuite(suite) {
  const label = pad(`[${suite.name}]`, 30)
  process.stdout.write(`${YELLOW}${BOLD}▶ ${label}${RESET} running… `)

  const start = Date.now()

  const result = spawnSync('node', [path.join(TESTS_DIR, suite.file)], {
    env: { ...process.env },
    encoding: 'utf8',
    timeout: 5 * 60 * 1000, // 5-minute per-suite timeout
  })

  const elapsed = ((Date.now() - start) / 1000).toFixed(1)

  if (result.status === 0) {
    console.log(`${GREEN}${BOLD}PASS${RESET}  ${DIM}(${elapsed}s)${RESET}`)
  } else {
    console.log(`${RED}${BOLD}FAIL${RESET}  ${DIM}(${elapsed}s)${RESET}`)
  }

  return {
    name:    suite.name,
    file:    suite.file,
    passed:  result.status === 0,
    elapsed,
    stdout:  result.stdout || '',
    stderr:  result.stderr || '',
    timedOut: result.error?.code === 'ETIMEDOUT',
  }
}

function printSuiteOutput(results) {
  results.forEach(r => {
    if (!r.passed) {
      console.log(`\n${RED}${BOLD}── ${r.name} (${r.file}) ──${RESET}`)
      if (r.timedOut) {
        console.log(`${RED}  Suite timed out after 5 minutes.${RESET}`)
      }
      // Print the last ~60 lines of stdout to show the failure details
      const lines = r.stdout.split('\n')
      const tail  = lines.slice(Math.max(0, lines.length - 60)).join('\n')
      if (tail.trim()) console.log(tail)
      if (r.stderr.trim()) {
        console.log(`${RED}STDERR:${RESET}`)
        console.log(r.stderr.substring(0, 2000))
      }
    }
  })
}

function finalReport(results) {
  const total   = results.length
  const passed  = results.filter(r => r.passed).length
  const failed  = total - passed
  const allOk   = failed === 0

  const line = '═'.repeat(64)
  console.log(`\n${BOLD}${line}${RESET}`)
  console.log(`${BOLD}  RESULTS${RESET}`)
  console.log(`${BOLD}${line}${RESET}`)

  results.forEach(r => {
    const icon   = r.passed ? `${GREEN}✔${RESET}` : `${RED}✖${RESET}`
    const label  = pad(r.name, 28)
    const timing = `${DIM}${r.elapsed}s${RESET}`
    console.log(`  ${icon}  ${label}  ${timing}`)
  })

  console.log(`\n${BOLD}${line}${RESET}`)

  if (allOk) {
    console.log(`${GREEN}${BOLD}  All ${total} suites passed.${RESET}`)
  } else {
    console.log(`${GREEN}${BOLD}  Passed : ${passed}/${total}${RESET}`)
    console.log(`${RED}${BOLD}  Failed : ${failed}/${total}${RESET}`)
  }
  console.log(`${BOLD}${line}${RESET}\n`)

  return allOk
}

// ─── main ────────────────────────────────────────────────────────────────────

banner()

// Quick connectivity check before running suites
const axios = require('axios')
const BASE  = process.env.BACKEND_URL || 'http://localhost:5000'

;(async () => {
  try {
    await axios.get(`${BASE}/health`, { timeout: 5000 })
    console.log(`${GREEN}✔ Backend reachable at ${BASE}${RESET}\n`)
  } catch (_) {
    console.log(`${RED}${BOLD}✖ Cannot reach backend at ${BASE}${RESET}`)
    console.log(`${RED}  Make sure the server is running: npm run dev (from backend/)${RESET}\n`)
    process.exit(1)
  }

  const results = []

  for (const suite of SUITES) {
    const result = runSuite(suite)
    results.push(result)
  }

  // Print details for failed suites
  printSuiteOutput(results)

  const allPassed = finalReport(results)
  process.exit(allPassed ? 0 : 1)
})()
