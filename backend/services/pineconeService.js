const { Pinecone } = require("@pinecone-database/pinecone")
const axios = require("axios")

let pineconeClient = null

// Initialize Pinecone Client
function getPineconeClient() {
  if (!pineconeClient) {
    const apiKey = process.env.PINECONE_API_KEY
    if (!apiKey) {
      console.warn("⚠️ PINECONE_API_KEY is not configured in .env")
      return null
    }
    pineconeClient = new Pinecone({ apiKey })
  }
  return pineconeClient
}

// Index configuration
const INDEX_NAME = process.env.PINECONE_INDEX_NAME || "youtube-mate-transcripts"
const EMBEDDING_DIM = 1024 // Dimension for mistral-embed

// Get or ensure Index exists
async function getPineconeIndex() {
  const pc = getPineconeClient()
  if (!pc) return null

  try {
    // List existing indexes
    const indexesObj = await pc.listIndexes()
    const indexNames = indexesObj.indexes ? indexesObj.indexes.map(i => i.name) : []

    if (!indexNames.includes(INDEX_NAME)) {
      console.log(`🌲 Creating Pinecone serverless index '${INDEX_NAME}'...`)
      await pc.createIndex({
        name: INDEX_NAME,
        dimension: EMBEDDING_DIM,
        metric: "cosine",
        spec: {
          serverless: {
            cloud: "aws",
            region: "us-east-1"
          }
        }
      })
      console.log(`✅ Pinecone index '${INDEX_NAME}' created successfully`)
    }

    return pc.index(INDEX_NAME)
  } catch (error) {
    console.error("Error accessing/creating Pinecone index:", error.message)
    try {
      return pc.index(INDEX_NAME)
    } catch (err) {
      return null
    }
  }
}

// Helper to generate text embeddings using Mistral Embeddings API
async function generateEmbeddings(textArray) {
  const apiKey = process.env.MISTRAL_API_KEY
  if (!apiKey) {
    throw new Error("MISTRAL_API_KEY is missing")
  }

  // Handle batching if textArray is large (max 50 inputs per request)
  const BATCH_SIZE = 50
  let allEmbeddings = []

  for (let i = 0; i < textArray.length; i += BATCH_SIZE) {
    const batch = textArray.slice(i, i + BATCH_SIZE)
    const response = await axios.post(
      "https://api.mistral.ai/v1/embeddings",
      {
        model: "mistral-embed",
        input: batch,
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        timeout: 30000,
      }
    )

    if (response.data && response.data.data) {
      const embeddings = response.data.data.map((item) => item.embedding)
      allEmbeddings.push(...embeddings)
    } else {
      throw new Error("Invalid response from Mistral Embeddings API")
    }
  }

  return allEmbeddings
}

// Chunk transcript segments into 500-800 char semantic windows with timestamps
function createTranscriptChunks(segments, maxChunkChars = 800) {
  if (!segments || !Array.isArray(segments) || segments.length === 0) {
    return []
  }

  const chunks = []
  let currentText = ""
  let currentStart = segments[0].start || 0
  let currentEnd = segments[0].end || 0
  let currentSegmentIds = []

  for (const seg of segments) {
    const segText = seg.text ? seg.text.trim() : ""
    if (!segText) continue

    if (currentText.length + segText.length > maxChunkChars && currentText.length > 0) {
      chunks.push({
        text: currentText.trim(),
        start: currentStart,
        end: currentEnd,
        segmentCount: currentSegmentIds.length,
      })
      currentText = segText
      currentStart = seg.start || currentEnd
      currentEnd = seg.end || currentStart
      currentSegmentIds = [seg.id]
    } else {
      currentText = currentText ? `${currentText} ${segText}` : segText
      currentEnd = seg.end || currentEnd
      currentSegmentIds.push(seg.id)
    }
  }

  if (currentText.length > 0) {
    chunks.push({
      text: currentText.trim(),
      start: currentStart,
      end: currentEnd,
      segmentCount: currentSegmentIds.length,
    })
  }

  return chunks
}

// Index a transcript in Pinecone (upsert vector embeddings)
async function indexTranscriptInPinecone(videoId, segments) {
  try {
    const index = await getPineconeIndex()
    if (!index) {
      console.warn("⚠️ Pinecone index unavailable, skipping vector indexing.")
      return false
    }

    const chunks = createTranscriptChunks(segments)
    if (chunks.length === 0) return false

    console.log(`🌲 Generating vector embeddings for ${chunks.length} transcript chunks of video ${videoId}...`)
    const chunkTexts = chunks.map((c) => c.text)
    const embeddings = await generateEmbeddings(chunkTexts)

    const vectors = chunks.map((chunk, idx) => ({
      id: `${videoId}_chunk_${idx}`,
      values: embeddings[idx],
      metadata: {
        videoId: videoId,
        chunkIndex: idx,
        startTime: Math.round(chunk.start),
        endTime: Math.round(chunk.end),
        text: chunk.text,
      },
    }))

    // Upsert into namespace: video_${videoId}
    const namespace = index.namespace(`video_${videoId}`)
    await namespace.upsert({ records: vectors })

    console.log(`✅ Successfully indexed ${vectors.length} vectors in Pinecone namespace video_${videoId}`)
    return true
  } catch (error) {
    console.error(`❌ Error indexing transcript in Pinecone for video ${videoId}:`, error.message)
    return false
  }
}

// Query Pinecone for relevant transcript chunks for a user question
async function queryTranscriptRAG(videoId, question, topK = 5) {
  try {
    const index = await getPineconeIndex()
    if (!index) {
      console.warn("⚠️ Pinecone index unavailable, returning null for RAG fallback.")
      return null
    }

    // Embed question using Mistral Embeddings
    const [questionEmbedding] = await generateEmbeddings([question])

    // Query namespace for this video
    const namespace = index.namespace(`video_${videoId}`)
    const queryResponse = await namespace.query({
      vector: questionEmbedding,
      topK: topK,
      includeMetadata: true,
    })

    if (!queryResponse || !queryResponse.matches || queryResponse.matches.length === 0) {
      console.log(`ℹ️ No Pinecone matches found in namespace video_${videoId}`)
      return null
    }

    // Filter matches and sort by startTime
    const chunks = queryResponse.matches
      .map((match) => match.metadata)
      .filter((meta) => meta && meta.text)
      .sort((a, b) => (a.startTime || 0) - (b.startTime || 0))

    return chunks
  } catch (error) {
    console.error(`❌ Error querying Pinecone RAG for video ${videoId}:`, error.message)
    return null
  }
}

module.exports = {
  indexTranscriptInPinecone,
  queryTranscriptRAG,
  createTranscriptChunks,
  getPineconeIndex,
}
