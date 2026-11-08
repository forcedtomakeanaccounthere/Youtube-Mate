/**
 * test-cache.js — UNIT TESTS (no server required)
 *
 * Verifies the cache service (in-memory fallback mode when REDIS_URL is not
 * set — the same contract runs on Redis when it is):
 *   - set / get / del round-trip
 *   - TTL expiry
 *   - remember() get-through helper (null results are not cached)
 *   - counters (incr / getCount)
 *   - hashKey stability
 *
 * Run: node tests/test-cache.js
 */

'use strict'

const assert = require('assert')
const { header, section, pass, fail, summary } = require('./helpers/logger')

const cache = require('../services/cacheService')
const { isRedisEnabled } = require('../config/redis')

async function run() {
  header(`Cache Service — Unit Tests (backend: ${isRedisEnabled() ? 'redis' : 'in-memory fallback'})`)

  section('Round-trip')

  try {
    await cache.set({ hello: 'world', n: 42 }, 60, 'test', 'key1')
    const value = await cache.get('test', 'key1')
    assert.deepStrictEqual(value, { hello: 'world', n: 42 })
    pass('set → get returns the stored JSON value')
  } catch (err) { fail('set/get round-trip', err) }

  try {
    await cache.del('test', 'key1')
    const value = await cache.get('test', 'key1')
    assert.strictEqual(value, null)
    pass('del removes the key')
  } catch (err) { fail('del', err) }

  try {
    const missing = await cache.get('test', 'never-set')
    assert.strictEqual(missing, null)
    pass('get on a missing key returns null')
  } catch (err) { fail('missing key', err) }

  section('TTL expiry')

  try {
    await cache.set('ephemeral', 1, 'test', 'ttl')
    await new Promise((r) => setTimeout(r, 1100))
    const value = await cache.get('test', 'ttl')
    assert.strictEqual(value, null)
    pass('entries expire after their TTL')
  } catch (err) { fail('ttl expiry', err) }

  section('remember() get-through helper')

  try {
    let computeRuns = 0
    const compute = async () => {
      computeRuns += 1
      return { computed: true }
    }
    const first = await cache.remember(60, ['test', 'remember'], compute)
    const second = await cache.remember(60, ['test', 'remember'], compute)
    assert.strictEqual(computeRuns, 1, `compute ran ${computeRuns} times`)
    assert.deepStrictEqual(first, second)
    pass('computes once, then serves from cache')
    await cache.del('test', 'remember')
  } catch (err) { fail('remember caching', err) }

  try {
    let computeRuns = 0
    const compute = async () => {
      computeRuns += 1
      return null // nothing to cache
    }
    await cache.remember(60, ['test', 'nullcase'], compute)
    await cache.remember(60, ['test', 'nullcase'], compute)
    assert.strictEqual(computeRuns, 2, 'null result was cached')
    pass('null results are never cached')
  } catch (err) { fail('null not cached', err) }

  section('Counters')

  try {
    const a = await cache.incr(60, 'test', 'counter')
    const b = await cache.incr(60, 'test', 'counter')
    assert.strictEqual(b, a + 1)
    pass('incr increments and returns the new value')
    await cache.del('test', 'counter')
  } catch (err) { fail('incr', err) }

  try {
    const value = await cache.getCount('test', 'no-such-counter')
    assert.strictEqual(value, 0)
    pass('getCount on a missing counter returns 0')
  } catch (err) { fail('getCount', err) }

  section('hashKey')

  try {
    const h1 = cache.hashKey('a long question ' + 'x'.repeat(200))
    const h2 = cache.hashKey('a long question ' + 'x'.repeat(200))
    assert.strictEqual(h1, h2, 'hash is not deterministic')
    assert.strictEqual(h1.length, 20)
    pass('produces stable 20-char hashes for long inputs')
  } catch (err) { fail('hashKey', err) }

  summary()
}

run().catch((err) => {
  console.error('Test runner crashed:', err)
  process.exit(1)
})
