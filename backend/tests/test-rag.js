/**
 * test-rag.js — UNIT TESTS (no server required)
 *
 * Verifies the hybrid RAG service:
 *   - keyword fallback retrieval when Pinecone has no index for the video
 *   - relevant span selection (keyword arm finds exact-match content)
 *   - empty / missing transcript handling
 *   - context assembly respects the character budget and formats timestamps
 *
 * Run: node tests/test-rag.js
 */

'use strict'

const assert = require('assert')
const { header, section, pass, fail, summary } = require('./helpers/logger')

const rag = require('../services/ragService')

// Deterministic mock transcript: 60 ten-second segments; two relevant ones
function buildTranscript() {
  const segments = []
  for (let i = 0; i < 60; i++) {
    segments.push({
      start: i * 10,
      end: i * 10 + 10,
      text:
        i === 30
          ? 'the quarterly revenue reached 2.3 million dollars this quarter'
          : i === 31
            ? 'revenue growth was driven by enterprise customers'
            : `filler sentence number ${i} about other topics entirely`,
    })
  }
  return segments
}

async function run() {
  header('Hybrid RAG Service — Unit Tests')

  section('Keyword fallback retrieval (no Pinecone index for test video)')

  let result = null
  try {
    result = await rag.retrieveContext({
      videoId: 'unittestvid0001',
      question: 'quarterly revenue',
      transcript: { content: buildTranscript() },
    })
    assert(result.contextText && result.contextText.length > 0, 'no context produced')
    pass('produces context for a keyword-matchable question')
  } catch (err) { fail('produces context', err) }

  try {
    assert(result && result.contextText.includes('quarterly revenue reached'), 'relevant span missing from context')
    pass('selects the relevant transcript span')
  } catch (err) { fail('relevant span selected', err) }

  try {
    // Method depends on whether Pinecone is configured and the namespace got
    // indexed (the fire-and-forget indexer may have run) — any retrieval mode
    // is valid; what matters is that the relevant content was selected.
    assert(
      ['keyword', 'semantic', 'hybrid', 'keyword-head-fallback'].includes(result && result.method),
      `unexpected method: ${result && result.method}`
    )
    pass(`retrieval method reported: ${result && result.method}`)
  } catch (err) { fail('method reporting', err) }

  section('Empty / missing transcript')

  try {
    const empty = await rag.retrieveContext({ videoId: 'unittestvid0001', question: 'anything', transcript: null })
    assert.strictEqual(empty.method, 'none')
    assert.strictEqual(empty.contextText, '')
    pass('returns empty context for a missing transcript')
  } catch (err) { fail('empty transcript handled', err) }

  try {
    const blank = await rag.retrieveContext({ videoId: 'unittestvid0001', question: 'anything', transcript: { content: [] } })
    assert.strictEqual(blank.contextText, '')
    pass('returns empty context for an empty segment list')
  } catch (err) { fail('blank segments handled', err) }

  section('Context assembly')

  try {
    const long = []
    for (let i = 0; i < 2000; i++) {
      long.push({ start: i, end: i + 1, text: `revenue update segment ${i} with more words to pad the length for the budget test` })
    }
    const big = await rag.retrieveContext({
      videoId: 'unittestvid0002',
      question: 'revenue',
      transcript: { content: long },
      charBudget: 5000,
    })
    assert(big.contextText.length <= 5200, `context exceeded budget: ${big.contextText.length}`)
    pass(`respects the character budget (${big.contextText.length} chars ≤ ~5200)`)
  } catch (err) { fail('char budget respected', err) }

  try {
    assert(result && /^\[\d+:\d+\]/.test(result.contextText), 'timestamps missing from context')
    pass('formats context with [MM:SS] timestamps')
  } catch (err) { fail('timestamp formatting', err) }

  summary()
}

run().catch((err) => {
  console.error('Test runner crashed:', err)
  process.exit(1)
})
