const { GoogleGenerativeAI } = require("@google/generative-ai")
const youtubeService = require("../services/youtubeService")
const { YoutubeTranscript } = require("youtube-transcript")
const { exec } = require("child_process")
const { promisify } = require("util")
const fs = require("fs").promises
const path = require("path")

const execAsync = promisify(exec)

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)

// Extract video ID from YouTube URL
function extractVideoId(url) {
  const regex = /(?:youtube\.com\/(?:shorts\/|watch\?v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  const match = url.match(regex)
  return match ? match[1] : null
}

// Check if video has captions available
async function checkCaptionsAvailable(videoId) {
  try {
    // Try to fetch transcript to see if any are available
    // The youtube-transcript package will throw if no captions exist
    const transcriptData = await YoutubeTranscript.fetchTranscript(videoId)
    
    if (!transcriptData || transcriptData.length === 0) {
      console.log(`Video ${videoId} returned empty transcript data`)
      return {
        available: false,
        manual: false,
        auto: false,
        error: "Empty transcript returned"
      }
    }
    
    console.log(`Captions confirmed available for video ${videoId} (${transcriptData.length} segments)`)
    return {
      available: true,
      manual: true,
      auto: true,
      segmentCount: transcriptData.length
    }
  } catch (error) {
    // Log detailed error information for debugging
    console.log(`Caption check failed for video ${videoId}:`)
    console.log(`   Error type: ${error.name}`)
    console.log(`   Error message: ${error.message}`)
    console.log(`   Error stack: ${error.stack?.split('\n')[0]}`)
    
    // Check if it's a real "no captions" error vs API/network issue
    const errorMessage = error.message?.toLowerCase() || ""
    const isNoCaptionsError = 
      errorMessage.includes("transcript") && 
      (errorMessage.includes("disabled") || 
       errorMessage.includes("not available") ||
       errorMessage.includes("no transcript"))
    
    if (!isNoCaptionsError) {
      console.log(`  This might be an API issue, not missing captions!`)
    }
    
    return {
      available: false,
      manual: false,
      auto: false,
      error: error.message,
      errorType: error.name,
      isPotentialApiIssue: !isNoCaptionsError
    }
  }
}

// Method 1: Try to fetch transcript using youtube-transcript API
async function fetchTranscriptViaAPI(videoId, language = "en") {
  try {
    console.log(`📝 Attempting to fetch transcript via YouTube Transcript API for ${videoId}${language ? ` (lang: ${language})` : ' (any language)'}...`)
    
    let transcriptData
    
    if (language) {
      // Try with specified language
      try {
        transcriptData = await YoutubeTranscript.fetchTranscript(videoId, {
          lang: language
        })
      } catch (langError) {
        console.log(`   Language ${language} not available, trying without language restriction...`)
        // If language-specific request fails, try without language restriction
        transcriptData = await YoutubeTranscript.fetchTranscript(videoId)
      }
    } else {
      // No language specified, get whatever is available
      transcriptData = await YoutubeTranscript.fetchTranscript(videoId)
    }
    
    if (!transcriptData || transcriptData.length === 0) {
      throw new Error("No transcript data returned")
    }

    console.log(`✅ Successfully fetched ${transcriptData.length} transcript segments via API`)
    
    // Convert to our format - the package returns { text, duration, offset }
    const segments = transcriptData.map((item, index) => ({
      id: `segment_${index + 1}`,
      start: parseFloat(item.offset / 1000), // Convert milliseconds to seconds
      end: parseFloat((item.offset + item.duration) / 1000),
      text: item.text.trim(),
      speaker: "Speaker",
      confidence: 0.98, // High confidence for actual transcripts
    }))

    return {
      success: true,
      segments,
      method: "youtube-transcript-api"
    }
  } catch (error) {
    console.log(`❌ YouTube Transcript API failed:`, error.message)
    console.log(`   Error details:`, {
      name: error.name,
      code: error.code,
      statusCode: error.statusCode
    })
    return {
      success: false,
      error: error.message,
      errorDetails: {
        name: error.name,
        code: error.code
      }
    }
  }
}

// Method 2: Fallback to yt-dlp for transcript extraction
async function fetchTranscriptViaYtDlp(videoId, language = "en") {
  try {
    console.log(`📝 Attempting to fetch transcript via yt-dlp for ${videoId}...`)
    
    const tempDir = path.join(__dirname, '..', 'downloads', 'temp')
    await fs.mkdir(tempDir, { recursive: true })
    
    const outputPath = path.join(tempDir, `${videoId}.${language}`)
    
    // Try to download subtitles using yt-dlp
    const command = `yt-dlp --write-auto-sub --sub-lang ${language} --convert-subs srt --skip-download --output "${outputPath}" "https://www.youtube.com/watch?v=${videoId}"`
    
    await execAsync(command)
    
    // Look for the generated subtitle file
    const srtPath = `${outputPath}.${language}.srt`
    
    try {
      const srtContent = await fs.readFile(srtPath, 'utf-8')
      
      // Parse SRT format
      const segments = parseSRT(srtContent)
      
      // Clean up temp file
      await fs.unlink(srtPath).catch(() => {})
      
      if (segments.length === 0) {
        throw new Error("No segments parsed from SRT file")
      }
      
      console.log(`✅ Successfully fetched ${segments.length} transcript segments via yt-dlp`)
      
      return {
        success: true,
        segments,
        method: "yt-dlp"
      }
    } catch (readError) {
      console.log(`❌ Failed to read or parse SRT file:`, readError.message)
      throw readError
    }
  } catch (error) {
    console.log(`❌ yt-dlp transcript fetch failed:`, error.message)
    return {
      success: false,
      error: error.message
    }
  }
}

// Method 3: Generate fake transcript using Gemini (fallback)
async function generateFakeTranscript(videoInfo, language = "en") {
  try {
    console.log(`  Generating AI-based transcript content for video...`)

    const languageInstructions = getLanguageInstructions(language)
    
    const durationInSeconds = videoInfo.durationSeconds || 180
    const segmentCount = Math.min(Math.max(Math.floor(durationInSeconds / 45), 8), 15)
    
    const transcriptPrompt = `I need you to help me understand the content structure of this YouTube video.

Video Information:
- Title: "${videoInfo.title}"
- Channel: ${videoInfo.channel.name || videoInfo.channel}
- Duration: ${videoInfo.duration} (${durationInSeconds} seconds)

${languageInstructions}

IMPORTANT INSTRUCTIONS:
- I understand you cannot actually watch videos or access their audio content
- Instead, based on the video title, channel, and context, provide a structured outline of the content
- Create realistic time segments that would be appropriate for this content length and type
- Focus on creating a logical flow that matches the video title and typical content structure
- Generate exactly ${segmentCount} segments with varying lengths (some longer, some shorter for realism)
- Make segments between 15-60 seconds each with realistic timestamps
- Ensure the LAST segment ends exactly at ${durationInSeconds} seconds (the video's actual duration)
- Make the content coherent and relevant to the video title and channel

Please provide your response in this exact JSON format (no additional text):
{
  "segments": [
    {
      "start": 0.0,
      "end": 25.0,
      "text": "[Content segment text here]"
    },
    {
      "start": 25.0,
      "end": 58.0,
      "text": "[Next content segment text here]"
    }
  ]
}

Requirements:
- Create exactly ${segmentCount} segments total
- Each segment should be 15-60 seconds (varying lengths for realism)
- Content should be relevant to the video title: "${videoInfo.title}"
- Make it sound natural and coherent
- Ensure timestamps are sequential and logical
- CRITICAL: Last segment must end at exactly ${durationInSeconds} seconds`

    // Walk the Gemini model chain (newest first) for the AI-transcript fallback
    const { GEMINI_TEXT_CHAIN } = require("../services/aiModels")
    let transcriptText = null
    let lastModelError = null
    for (const modelName of GEMINI_TEXT_CHAIN) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName })
        const result = await model.generateContent(transcriptPrompt)
        const response = await result.response
        transcriptText = response.text()
        break
      } catch (modelError) {
        lastModelError = modelError
        console.log(`  Gemini ${modelName} unavailable for transcript generation, trying next...`)
      }
    }
    if (!transcriptText) {
      throw lastModelError || new Error("All Gemini models failed for transcript generation")
    }

    // Parse the JSON response
    let transcriptData
    try {
      const jsonMatch = transcriptText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        transcriptData = JSON.parse(jsonMatch[0])
      } else {
        transcriptData = JSON.parse(transcriptText)
      }
    } catch (parseError) {
      throw new Error("Failed to parse AI-generated transcript")
    }

    const segments = transcriptData.segments.map((item, index) => ({
      id: `segment_${index + 1}`,
      start: parseFloat(item.start),
      end: parseFloat(item.end),
      text: item.text.trim(),
      speaker: "Speaker",
      confidence: 0.70, // Lower confidence for AI-generated content
    }))

    console.log(`✅ Successfully generated AI-based transcript with ${segments.length} segments`)

    return {
      success: true,
      segments,
      method: "ai-generated"
    }
  } catch (error) {
    console.log(`❌ AI transcript generation failed:`, error.message)
    return {
      success: false,
      error: error.message
    }
  }
}

// Main function to generate transcript with multi-tiered approach
async function generateTranscript(youtubeUrl, language = "en") {
  try {
    const videoId = extractVideoId(youtubeUrl)
    if (!videoId) {
      throw new Error("Invalid YouTube URL")
    }

    console.log(`🎬 Generating transcript for video ${videoId} in language ${language}`)

    // Get video metadata
    const videoInfo = await youtubeService.getVideoInfo(youtubeUrl)
    console.log(`📺 Video: "${videoInfo.title}" by ${videoInfo.channel.name || videoInfo.channel}`)
    console.log(`⏱️ Video duration: ${videoInfo.duration}`)

    // Fetch chapters if available
    const chapters = await youtubeService.getVideoChapters(youtubeUrl)
    if (chapters.length > 0) {
      console.log(`📚 Video has ${chapters.length} chapters`)
    }

    // Try extracting real captions first (don't pre-check, just try)
    console.log(`🔍 Attempting to extract captions/transcript...`)
    
    let transcriptResult
    let transcriptMethod = "none"

    // Try Method 1: youtube-transcript API with default language
    transcriptResult = await fetchTranscriptViaAPI(videoId, language)
    
    if (!transcriptResult.success) {
      console.log(`  Primary language (${language}) failed, trying without language restriction...`)
      // Try without language restriction - get any available captions
      transcriptResult = await fetchTranscriptViaAPI(videoId, null)
    }
    
    if (!transcriptResult.success) {
      // Method 1 failed, try Method 2: yt-dlp
      console.log(`  Falling back to yt-dlp method...`)
      transcriptResult = await fetchTranscriptViaYtDlp(videoId, language)
    }
    
    if (!transcriptResult.success) {
      // Both real caption methods failed
      // Check if captions might exist but we can't access them
      console.log(`🔍 Performing final caption availability check...`)
      const captionsCheck = await checkCaptionsAvailable(videoId)
      
      if (captionsCheck.isPotentialApiIssue) {
        console.log(`  WARNING: Caption extraction failed but might be API/network issue!`)
        console.log(`   Error: ${captionsCheck.error}`)
        console.log(`   Falling back to AI generation (captions may actually exist)`)
        transcriptMethod = "ai-generated-fallback"
      } else if (!captionsCheck.available) {
        console.log(`✓ Confirmed: No captions available for this video`)
        transcriptMethod = "ai-generated-no-captions"
      } else {
        console.log(`  Unexpected state: Captions seem available but extraction failed`)
        transcriptMethod = "ai-generated-fallback"
      }
      
      // Use Method 3: AI-generated
      console.log(`  Generating AI-based content...`)
      transcriptResult = await generateFakeTranscript(videoInfo, language)
    } else {
      transcriptMethod = transcriptResult.method
      console.log(`✅ Successfully extracted real captions using: ${transcriptMethod}`)
    }

    if (!transcriptResult.success) {
      throw new Error("All transcript extraction methods failed")
    }

    console.log(`✅ Successfully generated transcript using method: ${transcriptMethod}`)
    
    // Determine if we got actual captions or AI-generated content
    const hasActualCaptions = !transcriptMethod.includes("ai-generated")

    return {
      videoInfo,
      segments: transcriptResult.segments,
      chapters: chapters || [],
      transcriptMethod,
      hasActualCaptions
    }
  } catch (error) {
    console.error("Error generating transcript:", error)
    throw new Error(`Failed to generate transcript: ${error.message}`)
  }
}

// Parse SRT subtitle format
function parseSRT(srtContent) {
  const segments = []
  const blocks = srtContent.trim().split(/\n\s*\n/)
  
  for (const block of blocks) {
    const lines = block.split('\n')
    if (lines.length < 3) continue
    
    // Parse timestamp line (format: 00:00:10,500 --> 00:00:13,000)
    const timestampLine = lines[1]
    const timestampMatch = timestampLine.match(/(\d{2}):(\d{2}):(\d{2}),(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2}),(\d{3})/)
    
    if (timestampMatch) {
      const startHours = parseInt(timestampMatch[1])
      const startMinutes = parseInt(timestampMatch[2])
      const startSeconds = parseInt(timestampMatch[3])
      const startMs = parseInt(timestampMatch[4])
      
      const endHours = parseInt(timestampMatch[5])
      const endMinutes = parseInt(timestampMatch[6])
      const endSeconds = parseInt(timestampMatch[7])
      const endMs = parseInt(timestampMatch[8])
      
      const start = startHours * 3600 + startMinutes * 60 + startSeconds + startMs / 1000
      const end = endHours * 3600 + endMinutes * 60 + endSeconds + endMs / 1000
      
      // Text is everything after the timestamp line
      const text = lines.slice(2).join(' ').trim()
      
      segments.push({
        id: `segment_${segments.length + 1}`,
        start,
        end,
        text,
        speaker: "Speaker",
        confidence: 0.98
      })
    }
  }
  
  return segments
}

// ─────────────────────────────────────────────────────────────
// Summary generation — layered fallback chain
//
// When real captions exist:
//   1. Pinecone RAG + Gemini
//   2. Pinecone RAG + Mistral
//   3. Full-text Gemini (no Pinecone)
//   4. Full-text Mistral (no Pinecone)
//   5. Metadata-only fallback (title / channel / duration)
//
// When no real captions (ai-generated transcript):
//   1. Full-text Gemini
//   2. Full-text Mistral
//   3. Metadata-only fallback
//
// All layers: if everything fails → return summaryError string
// ─────────────────────────────────────────────────────────────

// Build prompts for each summary type
function buildPrompts(summaryType, contextText, languageInstructions, videoContext, segments) {
  if (summaryType === "brief") {
    return `${videoContext}Summarise the following transcript from a YouTube video.\n\n${languageInstructions}\n\nTRANSCRIPT:\n${contextText.substring(0, 8000)}\n\nIMPORTANT - Output formatting rules:\n- Write in plain text only\n- NO markdown formatting (no **, no *, no _, no #)\n- NO special characters for emphasis\n- Just clean, professional prose\n- 2-3 sentences\n\nSummary:`
  }
  if (summaryType === "detailed") {
    return `${videoContext}Provide a comprehensive summary of the following transcript.\n\n${languageInstructions}\n\nTRANSCRIPT:\n${contextText.substring(0, 8000)}\n\nIMPORTANT - Output formatting rules:\n- Write in plain text only\n- NO markdown formatting (no **, no *, no _, no #)\n- NO special characters for emphasis\n- Just clean, professional prose\n- 4-6 sentences covering main points\n\nDetailed Summary:`
  }
  if (summaryType === "bullets") {
    return `${videoContext}Extract key points from the following transcript.\n\n${languageInstructions}\n\nTRANSCRIPT:\n${contextText.substring(0, 8000)}\n\nIMPORTANT - Output formatting rules:\n- 5-7 key points\n- Each point must be ONE complete standalone sentence\n- NO sub-points or explanations with colons\n- NO markdown formatting (no **, no *, no _, no #)\n- Start each point with "• " (bullet and space)\n- Example format:\n• First complete point here as one sentence\n• Second complete point here as one sentence\n\nKey Points:`
  }
  if (summaryType === "keyMoments") {
    // Build time ranges instead of single timestamps
    const timestampedText = segments.slice(0, 50).map(seg => `[${formatTime(seg.start)}-${formatTime(seg.end)}] ${seg.text}`).join('\n')
    return `${videoContext}Identify key moments from the following transcript.\n\n${languageInstructions}\n\nTRANSCRIPT WITH TIME RANGES:\n${timestampedText}\n\nIMPORTANT - Output formatting rules:\n- Identify 5-7 most important moments\n- Format EXACTLY as: [START_TIME-END_TIME] Description\n- Use time ranges from the transcript above (e.g., [2:15-3:42])\n- Description should be 15-30 words, plain text only\n- NO markdown formatting (no **, no *, no _, no #)\n- NO numbering (1., 2., etc.)\n- Example format:\n[0:32-1:45] Introduction to the main topic being discussed\n[2:15-3:42] Explanation of the first key concept\n\nImportant Moments:`
  }
  return null
}

// Call Gemini for a single summary type — walks the model fallback chain
// (newest first) so a retired model never breaks summary generation
async function callGemini(prompt) {
  const { GEMINI_TEXT_CHAIN } = require("../services/aiModels")
  let lastError = null

  for (const modelName of GEMINI_TEXT_CHAIN) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName })
      const result = await model.generateContent(prompt)
      return result.response.text().trim()
    } catch (error) {
      lastError = error
      const detail = error?.message || "unknown"
      // Deprecated/missing models are expected chain movement — log quietly
      if (/404|not found|no longer available/i.test(detail)) {
        console.log(`  Gemini model ${modelName} unavailable, trying next in chain...`)
      } else {
        console.warn(`  Gemini ${modelName} failed: ${detail.slice(0, 120)}`)
      }
    }
  }
  throw lastError || new Error("All Gemini models failed")
}

// Call Mistral chat for a single summary type — walks the model chain
async function callMistral(prompt) {
  const axios = require("axios")
  const { MISTRAL_TEXT_CHAIN } = require("../services/aiModels")
  const apiKey = process.env.MISTRAL_API_KEY
  if (!apiKey) throw new Error("MISTRAL_API_KEY not configured")

  let lastError = null
  for (const modelName of MISTRAL_TEXT_CHAIN) {
    try {
      const response = await axios.post(
        "https://api.mistral.ai/v1/chat/completions",
        {
          model: modelName,
          messages: [{ role: "user", content: prompt }],
          temperature: 0.3,
          max_tokens: 1000,
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          timeout: 30000,
        }
      )
      return response.data.choices[0].message.content.trim()
    } catch (error) {
      lastError = error
      const status = error?.response?.status
      console.warn(`  Mistral ${modelName} failed${status ? ` (${status})` : ""}, trying next in chain...`)
    }
  }
  throw lastError || new Error("All Mistral models failed")
}

// Parse raw LLM text into the structured summary field
function parseRawToSummary(summaryType, rawText, segments) {
  // Clean markdown artifacts from all outputs
  const cleanText = (text) => {
    return text
      .replace(/\*\*\*\*/g, '')  // Remove ****
      .replace(/\*\*/g, '')      // Remove **
      .replace(/\*/g, '')        // Remove *
      .replace(/_/g, '')         // Remove _
      .trim()
  }

  if (summaryType === "brief") {
    return { brief: cleanText(rawText) }
  }
  if (summaryType === "detailed") {
    return { detailed: cleanText(rawText) }
  }
  if (summaryType === "bullets") {
    const points = rawText
      .split(/\n/)
      .map(p => cleanText(p.replace(/^[•\-*]\s*/, '')))  // Remove bullet/dash/asterisk at start
      .filter(p => {
        // Filter out empty lines, headers, and malformed points
        if (p.length < 10) return false
        if (p.toLowerCase().startsWith('key point')) return false
        // Reject if it's just a colon continuation (starts with lowercase after cleaning)
        if (p.match(/^[a-z]/)) return false
        return true
      })
      .slice(0, 7)
    return { bulletPoints: points }
  }
  if (summaryType === "keyMoments") {
    const lines = rawText.split('\n').filter(l => l.includes('[') && l.includes(']'))
    const keyMoments = lines.slice(0, 7).map((line, idx) => {
      // Match time range format: [START-END] or fallback to [TIMESTAMP]
      const rangeMatch = line.match(/\[(\d+:\d+(?::\d+)?)-(\d+:\d+(?::\d+)?)\]/)
      const singleMatch = !rangeMatch ? line.match(/\[(\d+:\d+(?::\d+)?)\]/) : null
      
      let startTime = 0
      let endTime = 0
      let timeLabel = "0:00"
      
      if (rangeMatch) {
        // Parse start time
        const startParts = rangeMatch[1].split(':').map(Number)
        startTime = startParts.length === 3
          ? startParts[0] * 3600 + startParts[1] * 60 + startParts[2]
          : startParts[0] * 60 + startParts[1]
        
        // Parse end time
        const endParts = rangeMatch[2].split(':').map(Number)
        endTime = endParts.length === 3
          ? endParts[0] * 3600 + endParts[1] * 60 + endParts[2]
          : endParts[0] * 60 + endParts[1]
        
        timeLabel = `${rangeMatch[1]}-${rangeMatch[2]}`
      } else if (singleMatch) {
        // Fallback: single timestamp
        const parts = singleMatch[1].split(':').map(Number)
        startTime = parts.length === 3
          ? parts[0] * 3600 + parts[1] * 60 + parts[2]
          : parts[0] * 60 + parts[1]
        endTime = startTime + 60  // Default 1 minute range
        timeLabel = singleMatch[1]
      }
      
      const description = cleanText(line.replace(/\[.*?\]\s*/, '').replace(/^\d+\.\s*/, ''))  // Remove timestamp and numbering
      
      return {
        timestamp: startTime,
        endTimestamp: endTime,
        timeLabel: timeLabel,
        text: description || `Key moment ${idx + 1}`
      }
    }).filter(m => m.text.length > 5)
    return { keyMoments }
  }
  return {}
}

// Build metadata-only fallback context (used when LLMs fail but videoInfo is available)
function buildMetadataContext(videoInfo) {
  if (!videoInfo) return ""
  const channel = typeof videoInfo.channel === 'object' ? videoInfo.channel.name : videoInfo.channel
  return `Video Information:\nTitle: "${videoInfo.title}"\nChannel: ${channel || 'Unknown'}\nDuration: ${videoInfo.duration || 'Unknown'}\n\n`
}

// Generate summary for ONE type with full fallback chain
async function generateSummaryForType(summaryType, segments, language, videoInfo, hasActualCaptions, videoId) {
  const languageInstructions = getLanguageInstructions(language)
  const videoContext = buildMetadataContext(videoInfo)
  const fullText = segments.map(s => s.text).join(" ")

  const errors = []

  // ── STEP 1: Pinecone-based context (only when real captions exist) ──
  let pineconeContext = null
  if (hasActualCaptions && videoId) {
    try {
      const { queryTranscriptRAG } = require("../services/pineconeService")
      const queryTerm = summaryType === "keyMoments" ? "key moments important highlights" :
                        summaryType === "bullets"    ? "main topics key points" :
                        summaryType === "detailed"   ? "comprehensive overview all topics" :
                                                       "main topic summary overview"
      const chunks = await queryTranscriptRAG(videoId, queryTerm, 10)
      if (chunks && chunks.length > 0) {
        pineconeContext = chunks.map(c => `[${formatTime(c.startTime)}] ${c.text}`).join("\n")
        console.log(`✅ Pinecone returned ${chunks.length} chunks for ${summaryType} summary`)
      }
    } catch (e) {
      console.log(`  Pinecone query failed for summary: ${e.message}`)
      errors.push(`Pinecone: ${e.message}`)
    }
  }

  // Prefer Pinecone context, fall back to full transcript text
  const contextText = pineconeContext || fullText

  const prompt = buildPrompts(summaryType, contextText, languageInstructions, videoContext, segments)
  if (!prompt) throw new Error(`Unknown summaryType: ${summaryType}`)

  // ── STEP 2: Gemini ──
  try {
    console.log(`  Trying Gemini for ${summaryType} summary${pineconeContext ? ' (Pinecone context)' : ''}...`)
    const raw = await callGemini(prompt)
    return { ...parseRawToSummary(summaryType, raw, segments), _source: "gemini" }
  } catch (e) {
    console.log(`  Gemini failed for ${summaryType}: ${e.message}`)
    errors.push(`Gemini: ${e.message}`)
  }

  // ── STEP 3: Mistral ──
  try {
    console.log(`  Trying Mistral for ${summaryType} summary${pineconeContext ? ' (Pinecone context)' : ''}...`)
    const raw = await callMistral(prompt)
    return { ...parseRawToSummary(summaryType, raw, segments), _source: "mistral" }
  } catch (e) {
    console.log(`  Mistral failed for ${summaryType}: ${e.message}`)
    errors.push(`Mistral: ${e.message}`)
  }

  // ── STEP 4: If Pinecone was used, retry both LLMs with full-text context ──
  if (pineconeContext) {
    const fullPrompt = buildPrompts(summaryType, fullText, languageInstructions, videoContext, segments)
    try {
      console.log(`  Retrying Gemini with full-text context for ${summaryType}...`)
      const raw = await callGemini(fullPrompt)
      return { ...parseRawToSummary(summaryType, raw, segments), _source: "gemini-fulltext" }
    } catch (e) {
      errors.push(`Gemini-fulltext: ${e.message}`)
    }
    try {
      console.log(`  Retrying Mistral with full-text context for ${summaryType}...`)
      const raw = await callMistral(fullPrompt)
      return { ...parseRawToSummary(summaryType, raw, segments), _source: "mistral-fulltext" }
    } catch (e) {
      errors.push(`Mistral-fulltext: ${e.message}`)
    }
  }

  // ── STEP 5: Metadata-only fallback via Gemini then Mistral ──
  if (videoInfo) {
    const metaText = `${videoInfo.title}. Channel: ${typeof videoInfo.channel === 'object' ? videoInfo.channel.name : videoInfo.channel}. Duration: ${videoInfo.duration}.`
    const metaPrompt = buildPrompts(summaryType, metaText, languageInstructions, videoContext, segments)
    try {
      console.log(`  Trying metadata-only Gemini fallback for ${summaryType}...`)
      const raw = await callGemini(metaPrompt)
      return { ...parseRawToSummary(summaryType, raw, segments), _source: "gemini-metadata" }
    } catch (e) {
      errors.push(`Gemini-metadata: ${e.message}`)
    }
    try {
      console.log(`  Trying metadata-only Mistral fallback for ${summaryType}...`)
      const raw = await callMistral(metaPrompt)
      return { ...parseRawToSummary(summaryType, raw, segments), _source: "mistral-metadata" }
    } catch (e) {
      errors.push(`Mistral-metadata: ${e.message}`)
    }
  }

  // ── All layers failed ──
  const errorSummary = errors.slice(-2).join("; ")
  throw new Error(`All summary providers failed for ${summaryType}. Last errors: ${errorSummary}`)
}

// Main generateSummary — returns the full summary object + optional summaryError
async function generateSummary(segments, summaryType = "brief", language = "en", videoInfo = null, hasActualCaptions = false, videoId = null) {
  if (!segments || segments.length === 0) {
    throw new Error("No transcript segments provided")
  }

  const fullText = segments.map(s => s.text).join(" ")
  if (fullText.length < 50) {
    throw new Error("Transcript too short for summarization")
  }

  const summary = {
    brief: "",
    detailed: "",
    bulletPoints: [],
    keyMoments: [],
  }

  const typesToGenerate = ['brief', 'detailed', 'bullets', 'keyMoments'].includes(summaryType)
    ? [summaryType]
    : ['brief', 'detailed', 'bullets', 'keyMoments']

  const errors = []

  for (const type of typesToGenerate) {
    try {
      const result = await generateSummaryForType(type, segments, language, videoInfo, hasActualCaptions, videoId)
      const src = result._source
      delete result._source
      Object.assign(summary, result)
      console.log(`✅ ${type} summary generated via ${src}`)
    } catch (e) {
      console.error(`❌ Failed to generate ${type} summary: ${e.message}`)
      errors.push(`${type}: ${e.message}`)
    }
  }

  // If every requested type failed, signal the caller via a thrown error
  const allFailed = typesToGenerate.every(type => {
    if (type === "brief" || type === "detailed") return !summary[type]
    if (type === "bullets") return !summary.bulletPoints.length
    if (type === "keyMoments") return !summary.keyMoments.length
    return true
  })

  if (allFailed && errors.length > 0) {
    const err = new Error(`Summary generation failed: ${errors.join("; ")}`)
    err.isAllFailed = true
    err.details = errors
    throw err
  }

  return summary
}

// Get language-specific instructions for Gemini
function getLanguageInstructions(language) {
  const languageMap = {
    'en': 'Respond in English.',
    'es': 'Responde en español.',
    'fr': 'Répondez en français.',
    'de': 'Antworten Sie auf Deutsch.',
    'it': 'Rispondi in italiano.',
    'pt': 'Responda em português.',
    'ru': 'Отвечайте на русском языке.',
    'ja': '日本語で回答してください。',
    'ko': '한국어로 답변해주세요.',
    'zh': '请用中文回答。',
    'ar': 'أجب باللغة العربية.',
    'hi': 'हिंदी में उत्तर दें।'
  }
  
  return languageMap[language] || 'Respond in English.'
}

// Helper function to format time for moments
function formatTime(seconds) {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }
  return `${minutes}:${secs.toString().padStart(2, "0")}`
}

// Helper functions for video processing
function parseDuration(isoDuration) {
  const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!match) return 0

  const hours = parseInt(match[1] || 0)
  const minutes = parseInt(match[2] || 0)
  const seconds = parseInt(match[3] || 0)

  return hours * 3600 + minutes * 60 + seconds
}

function formatDuration(seconds) {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }
  return `${minutes}:${secs.toString().padStart(2, "0")}`
}

function formatViews(viewCount) {
  const count = parseInt(viewCount)
  if (count >= 1000000) {
    return `${Math.round(count / 100000) / 10}M views`
  } else if (count >= 1000) {
    return `${Math.round(count / 100) / 10}K views`
  }
  return `${count} views`
}

function formatDate(dateString) {
  const date = new Date(dateString)
  const now = new Date()
  const diffTime = Math.abs(now - date)
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

  if (diffDays === 1) return "1 day ago"
  if (diffDays < 7) return `${diffDays} days ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`
  return `${Math.floor(diffDays / 365)} years ago`
}

module.exports = {
  generateTranscript,
  generateSummary,
  extractVideoId
}