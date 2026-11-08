const { getRedis, isRedisEnabled } = require("../config/redis")
const crypto = require("crypto")

/**
 * Cache Service
 *
 * A thin, namespaced cache abstraction with two backends:
 * - Redis/Valkey (shared, distributed, ephemeral) when REDIS_URL is set
 * - In-process Map fallback (single instance) when it is not
 *
 * Philosophy (matches the project's data doctrine):
 *   Redis  = fast, ephemeral, DERIVED data only (safe to lose)
 *   MongoDB = durable, authoritative, recoverable
 *
 * Everything stored here must be recomputable — never store the only copy
 * of anything in this cache.
 */

const KEY_PREFIX = "ytm:"
const DEFAULT_TTL_SECONDS = 300

// In-memory fallback store: key -> { value, expiresAt }
const memoryStore = new Map()

// Lazy periodic sweep so the fallback store doesn't grow unbounded
let sweepTimer = null
function ensureSweep() {
  if (sweepTimer) return
  sweepTimer = setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of memoryStore) {
      if (entry.expiresAt && entry.expiresAt <= now) memoryStore.delete(key)
    }
    if (memoryStore.size === 0) {
      clearInterval(sweepTimer)
      sweepTimer = null
    }
  }, 60_000)
  sweepTimer.unref?.()
}

function key(...parts) {
  return KEY_PREFIX + parts.join(":")
}

/**
 * Get a JSON value from cache. Returns null on miss, expiry, or any backend
 * error (caches must never break the request path).
 */
async function get(...parts) {
  const k = key(...parts)
  try {
    if (isRedisEnabled()) {
      const redis = getRedis()
      if (redis) {
        const raw = await redis.get(k)
        return raw ? JSON.parse(raw) : null
      }
    }
    const entry = memoryStore.get(k)
    if (!entry) return null
    if (entry.expiresAt && entry.expiresAt <= Date.now()) {
      memoryStore.delete(k)
      return null
    }
    return entry.value
  } catch (error) {
    console.error("Cache get error:", error.message)
    return null
  }
}

/**
 * Set a JSON value with a TTL in seconds.
 */
async function set(value, ttlSeconds = DEFAULT_TTL_SECONDS, ...parts) {
  const k = key(...parts)
  try {
    if (isRedisEnabled()) {
      const redis = getRedis()
      if (redis) {
        await redis.set(k, JSON.stringify(value), "EX", ttlSeconds)
        return true
      }
    }
    ensureSweep()
    memoryStore.set(k, { value, expiresAt: Date.now() + ttlSeconds * 1000 })
    return true
  } catch (error) {
    console.error("Cache set error:", error.message)
    return false
  }
}

/**
 * Delete one or more keys (by their parts).
 */
async function del(...parts) {
  const k = key(...parts)
  try {
    if (isRedisEnabled()) {
      const redis = getRedis()
      if (redis) {
        await redis.del(k)
        return true
      }
    }
    memoryStore.delete(k)
    return true
  } catch (error) {
    console.error("Cache del error:", error.message)
    return false
  }
}

/**
 * Get-through helper: return cached value or compute, store, and return it.
 * @param {Number} ttlSeconds
 * @param {Array} keyParts
 * @param {Function} compute - async () => value (null results are NOT cached)
 */
async function remember(ttlSeconds, keyParts, compute) {
  const cached = await get(...keyParts)
  if (cached !== null && cached !== undefined) return cached

  const value = await compute()
  if (value !== null && value !== undefined) {
    await set(value, ttlSeconds, ...keyParts)
  }
  return value
}

/**
 * Increment a counter and return the new value. Counters are ephemeral
 * (rate limiting, click buffers); when Redis is off this falls back to an
 * unTTL'd memory counter valid for the process lifetime.
 * @param {Number} ttlSeconds - refresh TTL on each increment (Redis mode)
 */
async function incr(ttlSeconds = DEFAULT_TTL_SECONDS, ...parts) {
  const k = key(...parts)
  try {
    if (isRedisEnabled()) {
      const redis = getRedis()
      if (redis) {
        const value = await redis.incr(k)
        if (value === 1) await redis.expire(k, ttlSeconds)
        return value
      }
    }
    const entry = memoryStore.get(k)
    const next = (entry?.value || 0) + 1
    memoryStore.set(k, { value: next, expiresAt: entry?.expiresAt || Date.now() + ttlSeconds * 1000 })
    ensureSweep()
    return next
  } catch (error) {
    console.error("Cache incr error:", error.message)
    return 0
  }
}

/**
 * Read a counter's value without incrementing (0 when missing).
 */
async function getCount(...parts) {
  const value = await get(...parts)
  return typeof value === "number" ? value : 0
}

/**
 * Stable short hash of a string (for cache keys derived from long payloads).
 */
function hashKey(input) {
  return crypto.createHash("sha1").update(String(input)).digest("hex").slice(0, 20)
}

module.exports = { get, set, del, remember, incr, getCount, hashKey }
