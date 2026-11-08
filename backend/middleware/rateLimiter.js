const mongoose = require("mongoose")
const {
  RateLimiterRedis,
  RateLimiterMemory,
  RateLimiterMongo,
} = require("rate-limiter-flexible")
const { getRedis, isRedisEnabled } = require("../config/redis")

/**
 * Rate Limiter
 *
 * Backend priority:
 *   1. Redis (RateLimiterRedis)  — distributed, fast, shared across instances
 *   2. In-memory insurance limiter — covers Redis outages so requests never
 *      fail because the limiter backend is down
 *   3. Mongo (RateLimiterMongo)  — original behavior when Redis is not
 *      configured (single instance)
 *
 * The HTTP contract is unchanged: 429 + Retry-After + same body.
 */

const keyPrefix = "middleware"
const points = process.env.NODE_ENV === "development" ? 100000 : 1000
const duration = 60 // per 60 seconds

let primaryLimiter = null
let insuranceLimiter = null
let mongoLimiter = null

function getLimiters() {
  if (insuranceLimiter === null) {
    insuranceLimiter = new RateLimiterMemory({ keyPrefix: `${keyPrefix}_mem`, points, duration })
  }

  if (primaryLimiter === null) {
    if (isRedisEnabled()) {
      primaryLimiter = new RateLimiterRedis({
        storeClient: getRedis(),
        keyPrefix,
        points,
        duration,
        insuranceLimiter,
      })
    } else {
      primaryLimiter = new RateLimiterMongo({
        storeClient: mongoose.connection,
        keyPrefix,
        points,
        duration,
      })
    }
  }

  return primaryLimiter
}

const rateLimiterMiddleware = async (req, res, next) => {
  // Temporarily disable rate limiting for development
  if (process.env.NODE_ENV === "development") {
    return next()
  }

  try {
    const limiter = getLimiters()
    await limiter.consume(req.ip)
    next()
  } catch (rejRes) {
    if (rejRes instanceof Error) {
      // Limiter backend failure — fail open rather than break traffic
      console.error("Rate limiter error:", rejRes.message)
      return next()
    }
    const secs = Math.round(rejRes.msBeforeNext / 1000) || 1
    res.set("Retry-After", String(secs))
    res.status(429).json({
      error: "Too many requests",
      message: `Rate limit exceeded. Try again in ${secs} seconds.`,
    })
  }
}

module.exports = { rateLimiter: rateLimiterMiddleware }
