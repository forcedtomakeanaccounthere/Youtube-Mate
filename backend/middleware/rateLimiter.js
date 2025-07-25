const { RateLimiterMongo } = require("rate-limiter-flexible")
const mongoose = require("mongoose")

const rateLimiter = new RateLimiterMongo({
  storeClient: mongoose.connection,
  keyPrefix: "middleware",
  points: process.env.NODE_ENV === 'development' ? 1000 : 100, // Number of requests
  duration: 60, // Per 60 seconds
})

const rateLimiterMiddleware = async (req, res, next) => {
  try {
    const key = req.ip
    await rateLimiter.consume(key)
    next()
  } catch (rejRes) {
    const secs = Math.round(rejRes.msBeforeNext / 1000) || 1
    res.set("Retry-After", String(secs))
    res.status(429).json({
      error: "Too many requests",
      message: `Rate limit exceeded. Try again in ${secs} seconds.`,
    })
  }
}

module.exports = { rateLimiter: rateLimiterMiddleware }