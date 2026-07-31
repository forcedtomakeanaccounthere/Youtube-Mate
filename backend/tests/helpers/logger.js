/**
 * Minimal pretty-printer for test output.
 */

const RESET  = '\x1b[0m'
const GREEN  = '\x1b[32m'
const RED    = '\x1b[31m'
const YELLOW = '\x1b[33m'
const CYAN   = '\x1b[36m'
const BOLD   = '\x1b[1m'
const DIM    = '\x1b[2m'

let passed = 0
let failed = 0
let skipped = 0
const failures = []

function header(title) {
  const line = '═'.repeat(60)
  console.log(`\n${CYAN}${BOLD}${line}${RESET}`)
  console.log(`${CYAN}${BOLD}  ${title}${RESET}`)
  console.log(`${CYAN}${BOLD}${line}${RESET}\n`)
}

function section(title) {
  console.log(`\n${YELLOW}${BOLD}▶ ${title}${RESET}`)
}

function pass(label, info = '') {
  passed++
  console.log(`  ${GREEN}✔${RESET}  ${label}${info ? `  ${DIM}${info}${RESET}` : ''}`)
}

function fail(label, err) {
  failed++
  const detail = err?.response?.data
    ? JSON.stringify(err.response.data)
    : err?.message || String(err)
  console.log(`  ${RED}✖${RESET}  ${label}`)
  console.log(`     ${RED}↳ ${detail}${RESET}`)
  failures.push({ label, detail })
}

function skip(label, reason = '') {
  skipped++
  console.log(`  ${DIM}⊘  ${label}${reason ? ` — ${reason}` : ''}${RESET}`)
}

function info(msg) {
  console.log(`  ${DIM}ℹ  ${msg}${RESET}`)
}

function summary() {
  const line = '─'.repeat(60)
  console.log(`\n${BOLD}${line}${RESET}`)
  console.log(`${GREEN}${BOLD}  Passed : ${passed}${RESET}`)
  if (failed)  console.log(`${RED}${BOLD}  Failed : ${failed}${RESET}`)
  if (skipped) console.log(`${DIM}  Skipped: ${skipped}${RESET}`)
  console.log(`${BOLD}${line}${RESET}\n`)

  if (failures.length) {
    console.log(`${RED}${BOLD}Failures:${RESET}`)
    failures.forEach(({ label, detail }) => {
      console.log(`  ${RED}✖ ${label}${RESET}`)
      console.log(`    ${DIM}${detail}${RESET}`)
    })
    console.log()
  }

  return failed === 0
}

module.exports = { header, section, pass, fail, skip, info, summary }
