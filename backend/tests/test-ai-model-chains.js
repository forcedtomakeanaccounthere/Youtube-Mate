/**
 * test-ai-model-chains.js — UNIT TESTS (no server required)
 *
 * Verifies the AI model fallback chains:
 *   - chains are ordered newest-first with 3+ fallbacks
 *   - retired models (gemini-2.0-flash) are never the primary
 *   - Mistral "latest" aliases are used so vendor updates apply automatically
 *   - vision chains include OCR-capable models
 *   - streamMistral walks its chain (mocked axios: first model 404s, second works)
 *
 * Run: node tests/test-ai-model-chains.js
 */

'use strict'

const assert = require('assert')
const path = require('path')

const { header, section, pass, fail, summary } = require('./helpers/logger')

const chains = require('../services/aiModels')

async function run() {
  header('AI Model Chains — Unit Tests')

  section('Chain definitions')

  try {
    assert(Array.isArray(chains.GEMINI_TEXT_CHAIN) && chains.GEMINI_TEXT_CHAIN.length >= 4, 'text chain too short')
    assert(!/2\.0-flash$/.test(chains.GEMINI_TEXT_CHAIN[0]), 'retired gemini-2.0-flash is the primary')
    assert.strictEqual(chains.GEMINI_TEXT_CHAIN[0], 'gemini-3.8-flash', 'primary should be the latest recommended model')
    pass(`Gemini text chain newest-first: ${chains.GEMINI_TEXT_CHAIN.join(' → ')}`)
  } catch (err) { fail('gemini text chain', err) }

  try {
    assert(chains.GEMINI_VISION_CHAIN.length >= 3, 'vision chain too short')
    assert(chains.GEMINI_VISION_CHAIN.some((m) => /2\.5-flash$/.test(m)), 'vision chain lacks the OCR-strong 2.5 tier')
    pass(`Gemini vision chain: ${chains.GEMINI_VISION_CHAIN.join(' → ')}`)
  } catch (err) { fail('gemini vision chain', err) }

  try {
    assert(chains.MISTRAL_TEXT_CHAIN.length >= 3)
    assert(chains.MISTRAL_TEXT_CHAIN.every((m) => m.endsWith('-latest')), 'text chain should use -latest aliases')
    pass(`Mistral text chain: ${chains.MISTRAL_TEXT_CHAIN.join(' → ')}`)
  } catch (err) { fail('mistral text chain', err) }

  try {
    assert(chains.MISTRAL_VISION_CHAIN[0].startsWith('pixtral'), 'vision chain should lead with pixtral')
    assert(chains.MISTRAL_VISION_CHAIN.length >= 3)
    pass(`Mistral vision chain: ${chains.MISTRAL_VISION_CHAIN.join(' → ')}`)
  } catch (err) { fail('mistral vision chain', err) }

  section('streamMistral chain walk (mocked HTTP)')

  try {
    // Mock axios so the first model returns 404 and the second succeeds with
    // a one-chunk SSE stream — proving the chain moves on instead of failing.
    const axiosPath = require.resolve('axios')
    const calls = []
    const realAxios = require(axiosPath)
    require.cache[axiosPath].exports = {
      default: realAxios,
      ...realAxios,
      post: async (url, body) => {
        calls.push(body.model)
        if (body.model === chains.MISTRAL_VISION_CHAIN[0]) {
          const err = new Error('Request failed with status code 404')
          err.response = { status: 404 }
          throw err
        }
        return {
          data: {
            on: (event, handler) => {
              if (event === 'data') {
                setImmediate(() => handler(Buffer.from('data: {"choices":[{"delta":{"content":"hello"}}]}\n\ndata: [DONE]\n\n')))
              } else if (event === 'end') {
                setImmediate(handler)
              }
            },
          },
        }
      },
    }

    // Fresh require so the mock is picked up
    delete require.cache[require.resolve('../services/videoQAProviders')]
    const providers = require('../services/videoQAProviders')

    let answer = ''
    await providers.streamMistral('mockvideoid01', 'test question', { content: [] }, ['data:image/png;base64,iVBORw0KGgo='], (chunk) => {
      answer += chunk
    })

    assert.deepStrictEqual(calls, [chains.MISTRAL_VISION_CHAIN[0], chains.MISTRAL_VISION_CHAIN[1]], `chain calls: ${calls.join(',')}`)
    assert.strictEqual(answer, 'hello')
    pass(`first model 404 → chain walked to ${calls[1]}, answer streamed`)
  } catch (err) { fail('streamMistral chain walk', err) }

  summary()
}

run().catch((err) => {
  console.error('Test runner crashed:', err)
  process.exit(1)
})
