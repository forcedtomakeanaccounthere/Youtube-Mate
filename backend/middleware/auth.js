const jwt = require("jsonwebtoken")
const User = require("../models/User")
const { getJwtSecret } = require("../config/env")

/**
 * Extract the bearer token from the Authorization header.
 * Returns null for missing, empty, or placeholder values ("null"/"undefined")
 * that browsers and stale clients sometimes send — those must NOT reach
 * jwt.verify (which would throw JsonWebTokenError: jwt malformed).
 */
function extractBearerToken(req) {
  const authHeader = req.headers["authorization"]
  if (!authHeader || typeof authHeader !== "string") return null

  const parts = authHeader.split(" ")
  if (parts.length !== 2 || !/^Bearer$/i.test(parts[0])) return null

  const token = parts[1].trim()
  if (!token || token === "null" || token === "undefined") return null

  return token
}

/**
 * Resolve the auth token: Authorization header first, then the httpOnly
 * auth cookie (set at login / Google callback). The header is kept for
 * API clients; browsers should rely on the cookie.
 */
function resolveAuthToken(req) {
  return extractBearerToken(req) || (req.cookies && req.cookies.token) || null
}

async function resolveUserFromToken(token) {
  const decoded = jwt.verify(token, getJwtSecret())
  const user = await User.findById(decoded.id)
  return user && user.isActive ? user : null
}

const authenticateToken = async (req, res, next) => {
  try {
    const token = resolveAuthToken(req)

    if (!token) {
      return res.status(401).json({ error: "Access token required" })
    }

    const user = await resolveUserFromToken(token)

    if (!user) {
      return res.status(401).json({ error: "Invalid or expired token" })
    }

    req.user = user
    next()
  } catch (error) {
    console.error("Auth error:", error.message)
    return res.status(401).json({ error: "Invalid or expired token" })
  }
}

const optionalAuth = async (req, res, next) => {
  try {
    const token = resolveAuthToken(req)

    if (token) {
      const user = await resolveUserFromToken(token)
      if (user) {
        req.user = user
      }
    }

    next()
  } catch (error) {
    // Continue without authentication
    next()
  }
}

module.exports = { authenticateToken, optionalAuth }
