/**
 * Redis / Valkey Configuration
 *
 * - Development: run `docker compose up -d redis` and set REDIS_URL=redis://localhost:6379
 * - Production: set REDIS_URL to a managed instance (e.g. Aiven Valkey —
 *   use the rediss:// connection string it provides; TLS is applied automatically).
 *
 * Redis is OPTIONAL infrastructure: when REDIS_URL is absent the app runs
 * fully on MongoDB + in-memory fallbacks (single instance). Redis unlocks:
 *   ephemeral caches, distributed rate limiting / counters, BullMQ queues,
 *   and the Socket.IO adapter for horizontal scaling.
 */

const { Redis } = require("ioredis")

let client = null
let subscriber = null
let publisher = null

function buildOptions(url) {
  return {
    lazyConnect: true,
    maxRetriesPerRequest: 2,
    enableAutoPipelining: true,
    // Aiven Valkey and other managed providers use TLS with rediss://
    tls: url.startsWith("rediss://") ? { rejectUnauthorized: false } : undefined,
    retryStrategy: (times) => Math.min(times * 500, 10000),
  }
}

/**
 * Get the shared Redis client, or null when Redis is not configured.
 * Connection errors never crash the app — Redis is an accelerator.
 */
function getRedis() {
  const url = (process.env.REDIS_URL || "").trim()
  if (!url) return null

  if (!client) {
    client = new Redis(url, buildOptions(url))
    client.on("error", (err) => {
      console.error("Redis client error:", err.message)
    })
    client.on("connect", () => {
      console.log("✅ Redis connected")
    })
  }
  return client
}

/**
 * Dedicated connection for pub/sub subscriptions (Socket.IO adapter, workers).
 */
function getSubscriber() {
  const url = (process.env.REDIS_URL || "").trim()
  if (!url) return null

  if (!subscriber) {
    subscriber = new Redis(url, buildOptions(url))
    subscriber.on("error", (err) => {
      console.error("Redis subscriber error:", err.message)
    })
  }
  return subscriber
}

/**
 * Dedicated connection for publishing (Socket.IO adapter, cross-process emit).
 */
function getPublisher() {
  const url = (process.env.REDIS_URL || "").trim()
  if (!url) return null

  if (!publisher) {
    publisher = new Redis(url, buildOptions(url))
    publisher.on("error", (err) => {
      console.error("Redis publisher error:", err.message)
    })
  }
  return publisher
}

/**
 * True when Redis is configured (regardless of current connection state —
 * ioredis retries in the background).
 */
function isRedisEnabled() {
  return Boolean((process.env.REDIS_URL || "").trim())
}

/**
 * Close all Redis connections (graceful shutdown).
 */
async function closeRedis() {
  const conns = [client, subscriber, publisher].filter(Boolean)
  client = subscriber = publisher = null
  await Promise.allSettled(conns.map((c) => c.quit()))
}

module.exports = { getRedis, getSubscriber, getPublisher, isRedisEnabled, closeRedis }
