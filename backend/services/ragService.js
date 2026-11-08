const { queryTranscriptRAG, indexTranscriptInPinecone } = require("./pineconeService")
const { remember, hashKey } = require("./cacheService")

/**
 * RAG Service — hybrid transcript retrieval
 *
 * Combines two cheap retrievers and fuses them with Reciprocal Rank Fusion,
 * followed by a lexical-coverage rerank. No extra AI calls — the whole
 * pipeline costs one Pinecone query (cached) plus local computation.
 *
 *   Arm 1 (semantic): Pinecone vector search over the indexed transcript
 *          (result cached ~10 min per video+question).
 *   Arm 2 (keyword):  BM25-lite scoring over the raw transcript segments —
 *          catches exact names, numbers, code terms that embeddings miss.
 *   Fusion:  RRF (k=60) over both rankings, mapped onto time spans.
 *   Rerank:  + 0.25 × query-term coverage per span (lexical precision boost).
 *   Assemble: top spans expanded to sentence boundaries, capped by budget.
 *
 * Fallbacks (degradation, never failure):
 *   - Pinecone unavailable/empty → pure keyword retrieval
 *   - No transcript → empty context
 */

const RRF_K = 60
const DEFAULT_TOP_K = 8
const DEFAULT_CHAR_BUDGET = 30000
const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "is", "are", "was", "were", "be", "been",
  "to", "of", "in", "on", "at", "for", "with", "about", "as", "by", "that", "it",
  "this", "these", "those", "from", "what", "which", "who", "whom", "how", "when",
  "where", "why", "does", "do", "did", "can", "could", "will", "would", "should",
  "i", "you", "he", "she", "we", "they", "my", "your", "his", "her", "its", "our",
  "their", "me", "him", "them", "us", "not", "no", "yes", "if", "then", "so",
])

// ─── Tokenization ───────────────────────────────────────────────────────────

function tokenize(text) {
  return String(text || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t))
}

// ─── Arm 2: BM25-lite keyword scoring over segments ─────────────────────────

function scoreSegmentsByKeywords(segments, queryTerms) {
  if (!Array.isArray(segments) || segments.length === 0 || queryTerms.length === 0) {
    return []
  }

  // Document frequency per term
  const df = new Map()
  const segTokens = segments.map((seg) => {
    const tokens = tokenize(seg.text)
    const unique = new Set(tokens)
    for (const t of unique) df.set(t, (df.get(t) || 0) + 1)
    return tokens
  })

  const n = segments.length
  const avgLen = segTokens.reduce((s, t) => s + t.length, 0) / n || 1

  const scored = segments.map((seg, idx) => {
    const tokens = segTokens[idx]
    const len = tokens.length || 1
    const tf = new Map()
    for (const t of tokens) tf.set(t, (tf.get(t) || 0) + 1)

    let score = 0
    for (const term of queryTerms) {
      const termTf = tf.get(term) || 0
      if (termTf === 0) continue
      const idf = Math.log(1 + n / (df.get(term) || 0))
      score += ((termTf * 2.2) / (termTf + 1.2)) * idf
    }
    // Length normalization (BM25-style)
    score = score / (1 - 0.75 + 0.75 * (len / avgLen))

    return { seg, idx, score }
  })

  return scored.filter((s) => s.score > 0)
}

/**
 * Merge highly-scored segments into contiguous spans (adjacency gap ≤ 2).
 * @returns {Array<{startIdx, endIdx, start, end, text, score}>}
 */
function buildKeywordSpans(scored, maxSpans) {
  if (scored.length === 0) return []

  const top = scored.sort((a, b) => b.score - a.score).slice(0, maxSpans * 2)
  top.sort((a, b) => a.idx - b.idx)

  const spans = []
  let current = null

  for (const item of top) {
    if (current && item.idx - current.endIdx <= 2) {
      current.endIdx = item.idx
      current.score += item.score
    } else {
      if (current) spans.push(current)
      current = { startIdx: item.idx, endIdx: item.idx, score: item.score }
    }
  }
  if (current) spans.push(current)

  return spans
}

// ─── Fusion + rerank ────────────────────────────────────────────────────────

/**
 * Assemble the final context from ranked candidates.
 * @param {Array} candidates - [{start, end, text, semanticRank|null, keywordRank|null, coverage}]
 */
function assembleContext(candidates, { charBudget, segments, queryTerms }) {
  // RRF score: contributions from both arms
  for (const c of candidates) {
    c.rrf = 0
    if (c.semanticRank !== null && c.semanticRank !== undefined) {
      c.rrf += 1 / (RRF_K + c.semanticRank + 1)
    }
    if (c.keywordRank !== null && c.keywordRank !== undefined) {
      c.rrf += 1 / (RRF_K + c.keywordRank + 1)
    }
    // Cheap rerank: lexical precision boost for spans covering query terms
    const spanTokens = new Set(tokenize(c.text))
    let covered = 0
    for (const term of queryTerms) if (spanTokens.has(term)) covered += 1
    c.coverage = queryTerms.length ? covered / queryTerms.length : 0
    c.finalScore = c.rrf + 0.25 * c.coverage
  }

  const ordered = [...candidates].sort((a, b) => b.finalScore - a.finalScore)

  const lines = []
  let used = 0
  const sources = []

  for (const c of ordered) {
    if (used >= charBudget) break

    const entries = (segments || [])
      .slice(Math.max(0, c.startIdx ?? 0), (c.endIdx ?? 0) + 1)
      .filter((seg) => seg && typeof seg.text === "string")
    const chunkText = c.text || entries.map((seg) => seg.text.trim()).join(" ")
    if (!chunkText) continue

    const truncated = chunkText.slice(0, charBudget - used)
    const startTime = c.start ?? entries[0]?.start ?? 0
    lines.push(`[${formatTime(startTime)}] ${truncated}`)
    used += truncated.length + 1

    sources.push({
      start: startTime,
      end: c.end ?? entries[entries.length - 1]?.end,
      score: Number(c.finalScore.toFixed(4)),
      via: [c.semanticRank !== null && c.semanticRank !== undefined && "semantic", c.keywordRank !== null && c.keywordRank !== undefined && "keyword"].filter(Boolean).join("+") || "keyword",
    })
  }

  return { contextText: lines.join("\n\n"), sources }
}

// ─── Helper: format seconds as clock label ──────────────────────────────────

function formatTime(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const secs = total % 60
  const pad = (v) => String(v).padStart(2, "0")
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(secs)}` : `${minutes}:${pad(secs)}`
}

// ─── Main entry point ───────────────────────────────────────────────────────

/**
 * Retrieve the most relevant transcript context for a question.
 * @param {Object} params - { videoId, question, transcript, topK?, charBudget? }
 * @returns {Promise<{contextText: String, sources: Array, method: String}>}
 */
async function retrieveContext({ videoId, question, transcript, topK = DEFAULT_TOP_K, charBudget = DEFAULT_CHAR_BUDGET }) {
  const segments = (transcript && Array.isArray(transcript.content)) ? transcript.content : []
  const queryTerms = tokenize(question)

  if (segments.length === 0) {
    return { contextText: "", sources: [], method: "none" }
  }

  // ── Arm 1: semantic (cached) ────────────────────────────────────────────
  let semanticChunks = null
  try {
    semanticChunks = await remember(600, ["pinecone", videoId, hashKey(question)], async () => {
      const chunks = await queryTranscriptRAG(videoId, question, topK)
      return chunks || []
    })
  } catch (error) {
    console.warn("Pinecone retrieval failed, using keyword fallback:", error.message)
    semanticChunks = null
  }

  // Fire-and-forget: if Pinecone has nothing for this video yet, index it
  if (!semanticChunks || semanticChunks.length === 0) {
    indexTranscriptInPinecone(videoId, segments).catch(() => {})
  }

  // ── Arm 2: keyword spans ────────────────────────────────────────────────
  const scored = scoreSegmentsByKeywords(segments, queryTerms)
  const keywordSpans = buildKeywordSpans(scored, topK)

  // ── Fusion ──────────────────────────────────────────────────────────────
  const candidates = []
  const claimed = new Set() // segment indices claimed by semantic chunks

  if (semanticChunks && semanticChunks.length > 0) {
    semanticChunks.forEach((chunk, rank) => {
      // Map the semantic chunk onto the segment index range it overlaps
      const startIdx = segments.findIndex((seg) => Math.abs((seg.start || 0) - (chunk.startTime || 0)) < 15)
      const endIdx = startIdx === -1 ? -1 : segments.findIndex(
        (seg, i) => i >= startIdx && Math.abs((seg.end || 0) - (chunk.endTime || chunk.startTime || 0)) < 20
      )

      candidates.push({
        text: chunk.text,
        start: chunk.startTime,
        end: chunk.endTime,
        startIdx: startIdx === -1 ? null : startIdx,
        endIdx: endIdx === -1 ? startIdx : endIdx,
        semanticRank: rank,
        keywordRank: null,
      })

      if (startIdx !== -1) {
        for (let i = startIdx; i <= (endIdx === -1 ? startIdx : endIdx); i++) claimed.add(i)
      }
    })
  }

  keywordSpans.forEach((span, rank) => {
    // Skip keyword spans fully covered by an already-added semantic chunk
    let covered = true
    for (let i = span.startIdx; i <= span.endIdx; i++) {
      if (!claimed.has(i)) { covered = false; break }
    }
    if (covered && semanticChunks && semanticChunks.length > 0) return

    const spanSegments = segments.slice(span.startIdx, span.endIdx + 1)
    candidates.push({
      text: spanSegments.map((s) => s.text).join(" "),
      start: spanSegments[0]?.start ?? 0,
      end: spanSegments[spanSegments.length - 1]?.end,
      startIdx: span.startIdx,
      endIdx: span.endIdx,
      semanticRank: null,
      keywordRank: rank,
    })
  })

  if (candidates.length === 0) {
    // Nothing matched — degrade to the head of the transcript like the
    // original full-transcript fallback, capped by budget.
    const head = segments.slice(0, 40)
    const text = head.map((s) => `[${formatTime(s.start)}] ${s.text}`).join("\n").slice(0, charBudget)
    return { contextText: text, sources: [], method: "keyword-head-fallback" }
  }

  const { contextText, sources } = assembleContext(candidates, { charBudget, segments, queryTerms })

  const method = semanticChunks && semanticChunks.length > 0
    ? (sources.some((s) => s.via.includes("keyword")) ? "hybrid" : "semantic")
    : "keyword"

  console.log(`🔎 RAG: method=${method}, ${sources.length} spans, ${contextText.length} chars (video ${videoId})`)

  return { contextText, sources, method }
}

module.exports = { retrieveContext }
