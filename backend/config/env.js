/**
 * Environment & Secret Validation
 *
 * Fails fast on missing required configuration in production and generates
 * ephemeral secrets with a loud warning in development — no silent insecure
 * defaults anywhere.
 */

const crypto = require("crypto")

const REQUIRED_IN_PRODUCTION = ["MONGODB_URI", "JWT_SECRET", "SESSION_SECRET"]

/**
 * Resolve a secret: use the configured value, or (development only) generate
 * an ephemeral random one with a warning. Throws in production when missing.
 */
function resolveSecret(name, { devFallback = true } = {}) {
  const value = process.env[name]
  if (value && value.trim()) return value.trim()

  if (process.env.NODE_ENV === "production" || !devFallback) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
      `Refusing to start with an insecure default.`
    )
  }

  const generated = crypto.randomBytes(32).toString("hex")
  console.warn(
    `⚠️  ${name} is not set — generated an EPHEMERAL secret for this development session. ` +
    `Sessions/tokens will be invalidated on restart. Set ${name} in .env for stable local dev.`
  )
  return generated
}

let jwtSecret = null
let sessionSecret = null

/**
 * Validate required env at boot. Called once from server.js before anything
 * that needs secrets initializes.
 */
function validateEnv() {
  const problems = []

  if (process.env.NODE_ENV === "production") {
    for (const name of REQUIRED_IN_PRODUCTION) {
      if (!process.env[name] || !process.env[name].trim()) {
        problems.push(name)
      }
    }
    if (problems.length) {
      throw new Error(`Missing required environment variables: ${problems.join(", ")}`)
    }
    if ((process.env.JWT_SECRET || "").length < 32) {
      console.warn("⚠️  JWT_SECRET is shorter than 32 chars — use a long random value in production.")
    }
  }

  jwtSecret = resolveSecret("JWT_SECRET")
  sessionSecret = resolveSecret("SESSION_SECRET")

  return { jwtSecret, sessionSecret }
}

function getJwtSecret() {
  if (!jwtSecret) validateEnv()
  return jwtSecret
}

function getSessionSecret() {
  if (!sessionSecret) validateEnv()
  return sessionSecret
}

module.exports = { validateEnv, getJwtSecret, getSessionSecret }
