const { GoogleGenerativeAI } = require("@google/generative-ai")
const { fetchYouTubeMetadata, fetchYouTubeChapters } = require("./youtube")
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
    
    return {
      available: true,
      manual: true, // We can't easily distinguish manual vs auto, but if it works, captions exist
      auto: true
    }
  } catch (error) {
    console.log(`❌ No captions available for video ${videoId}:`, error.message)
    return {
      available: false,
      manual: false,
      auto: false,
      error: error.message
    }
  }
}

// Method 1: Try to fetch transcript using youtube-transcript API
async function fetchTranscriptViaAPI(videoId, language = "en") {
  try {
    console.log(`📝 Attempting to fetch transcript via YouTube Transcript API for ${videoId}...`)
    
    // Correct usage: YoutubeTranscript.fetchTranscript() returns array directly
    const transcriptData = await YoutubeTranscript.fetchTranscript(videoId, {
      lang: language
    })
    
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
    return {
      success: false,
      error: error.message
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
    console.log(`🤖 Generating AI-based transcript content for video...`)
    
    const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash" })
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

    const result = await model.generateContent(transcriptPrompt)
    const response = await result.response
    const transcriptText = response.text()

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
    const videoInfo = await fetchYouTubeMetadata(youtubeUrl)
    console.log(`📺 Video: "${videoInfo.title}" by ${videoInfo.channel.name || videoInfo.channel}`)
    console.log(`⏱️ Video duration: ${videoInfo.duration}`)

    // Fetch chapters if available
    const chapters = await fetchYouTubeChapters(youtubeUrl)
    if (chapters.length > 0) {
      console.log(`📚 Video has ${chapters.length} chapters`)
    }

    // Check if captions are available
    console.log(`🔍 Checking caption availability...`)
    const captionsCheck = await checkCaptionsAvailable(videoId)
    
    let transcriptResult
    let transcriptMethod = "none"

    if (!captionsCheck.available) {
      // No captions available - inform user clearly
      console.log(`⚠️ No captions available for this video. Falling back to AI-generated content...`)
      transcriptResult = await generateFakeTranscript(videoInfo, language)
      transcriptMethod = "ai-generated-no-captions"
    } else {
      // Try Method 1: youtube-transcript API
      transcriptResult = await fetchTranscriptViaAPI(videoId, language)
      
      if (!transcriptResult.success) {
        // Method 1 failed, try Method 2: yt-dlp
        console.log(`🔄 Falling back to yt-dlp method...`)
        transcriptResult = await fetchTranscriptViaYtDlp(videoId, language)
        
        if (!transcriptResult.success) {
          // Both failed, use Method 3: AI-generated
          console.log(`🔄 Falling back to AI-generated content...`)
          transcriptResult = await generateFakeTranscript(videoInfo, language)
          transcriptMethod = "ai-generated-fallback"
        } else {
          transcriptMethod = transcriptResult.method
        }
      } else {
        transcriptMethod = transcriptResult.method
      }
    }

    if (!transcriptResult.success) {
      throw new Error("All transcript extraction methods failed")
    }

    console.log(`✅ Successfully generated transcript using method: ${transcriptMethod}`)

    return {
      videoInfo,
      segments: transcriptResult.segments,
      chapters: chapters || [],
      transcriptMethod,
      hasActualCaptions: captionsCheck.available
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

// Generate summary using Google Gemini API with curated prompts
async function generateSummary(segments, summaryType = "brief", language = "en", videoInfo = null) {
  try {
    if (!segments || segments.length === 0) {
      throw new Error("No transcript segments provided")
    }

    // Combine all transcript text
    const fullText = segments.map((segment) => segment.text).join(" ")

    if (fullText.length < 50) {
      throw new Error("Transcript too short for summarization")
    }

    console.log(`Generating ${summaryType} summary for ${fullText.length} characters of text using Gemini AI`)

    const summary = {
      brief: "",
      detailed: "",
      bulletPoints: [],
      keyMoments: [],
    }

    try {
      // Get Gemini model - using Gemini 3.5 Flash (latest and most intelligent model)
      const model = genAI.getGenerativeModel({ 
        model: "gemini-3.5-flash"
      })

      // Create context about the video
      const videoContext = videoInfo ? `Video Information:
Title: "${videoInfo.title}"
Channel: ${videoInfo.channel}
Duration: ${videoInfo.duration}

` : ""

      // Language-specific instructions
      const languageInstructions = getLanguageInstructions(language)

      // Generate response based on summary type
      if (summaryType === "brief") {
        const briefPrompt = `${videoContext}You are analyzing transcript content from a video. Please provide a concise summary based on the following transcript text.

${languageInstructions}

TRANSCRIPT CONTENT:
${fullText.substring(0, 8000)}

INSTRUCTIONS: 
- Provide a brief, informative summary in 2-3 sentences maximum
- Focus on the main topic and primary message from the transcript
- Be factual and based only on the provided transcript content
- Use clear, professional language
- Avoid speculation beyond what's stated in the transcript

Summary:`

        const briefResult = await model.generateContent(briefPrompt)
        const briefResponse = await briefResult.response
        summary.brief = briefResponse.text().trim()

      } else if (summaryType === "detailed") {
        const detailedPrompt = `${videoContext}You are analyzing transcript content from a video. Please provide a comprehensive detailed summary based on the following transcript text.

${languageInstructions}

TRANSCRIPT CONTENT:
${fullText.substring(0, 8000)}

INSTRUCTIONS:
- Provide a thorough analysis in 4-6 sentences covering the main points
- Include key insights and information mentioned in the transcript
- Maintain logical flow between ideas
- Base your summary only on the provided transcript content
- Use professional, analytical language
- Avoid adding information not present in the transcript

Detailed Summary:`

        const detailedResult = await model.generateContent(detailedPrompt)
        const detailedResponse = await detailedResult.response
        summary.detailed = detailedResponse.text().trim()

      } else if (summaryType === "bullets") {
        const bulletPrompt = `${videoContext}You are analyzing transcript content from a video. Please extract key points and format them as bullet points based on the following transcript text.

${languageInstructions}

TRANSCRIPT CONTENT:
${fullText.substring(0, 8000)}

INSTRUCTIONS:
- Extract 5-7 most important points from the transcript content
- Make each point concise but complete (10-25 words each)
- Focus on key information and insights mentioned in the transcript
- Maintain the order of presentation from the content
- Use clear, direct language
- Base points only on the provided transcript content
- Format using bullet points with "•"

Key Points:`

        const bulletResult = await model.generateContent(bulletPrompt)
        const bulletResponse = await bulletResult.response
        const bulletText = bulletResponse.text().trim()

        // Parse bullet points more carefully
        summary.bulletPoints = bulletText
          .split(/[•\-*\n]/)
          .map((point) => point.trim())
          .filter((point) => point.length > 10 && !point.toLowerCase().includes('key points'))
          .slice(0, 7)

      } else if (summaryType === "keyMoments") {
        const momentsPrompt = `${videoContext}You are analyzing transcript content with timestamps from a video. Please identify important moments based on the following transcript text.

${languageInstructions}

TRANSCRIPT WITH TIMESTAMPS:
${segments.slice(0, 50).map(seg => `[${formatTime(seg.start)}] ${seg.text}`).join('\n')}

INSTRUCTIONS:
- Identify 5-7 most important moments from the provided transcript
- Include the timestamp and describe what happens at that moment
- Focus on key information, transitions, or insights mentioned
- Make descriptions concise but informative (15-30 words each)
- Base descriptions only on the content provided in the transcript
- Use the exact timestamps shown above

Format each as: [TIMESTAMP] Description

Important Moments:`

        const momentsResult = await model.generateContent(momentsPrompt)
        const momentsResponse = await momentsResult.response
        const momentsText = momentsResponse.text().trim()

        // Parse key moments
        const momentLines = momentsText.split('\n').filter(line => line.includes('[') && line.includes(']'))
        summary.keyMoments = momentLines.slice(0, 7).map((line, index) => {
          const timestampMatch = line.match(/\[(\d+:\d+(?::\d+)?)\]/)
          const description = line.replace(/\[.*?\]\s*/, '').trim()
          
          // Convert timestamp to seconds
          let timestamp = 0
          if (timestampMatch) {
            const timeParts = timestampMatch[1].split(':').map(Number)
            if (timeParts.length === 3) {
              timestamp = timeParts[0] * 3600 + timeParts[1] * 60 + timeParts[2]
            } else if (timeParts.length === 2) {
              timestamp = timeParts[0] * 60 + timeParts[1]
            }
          }

          return {
            timestamp: timestamp,
            text: description || `Important moment ${index + 1}`,
            importance: 0.9 - (index * 0.1)
          }
        }).filter(moment => moment.text.length > 5)
      }

      // If no specific type requested, generate all types
      if (!['brief', 'detailed', 'bullets', 'keyMoments'].includes(summaryType)) {
        // Generate brief summary
        const briefResult = await generateSummary(segments, 'brief', language, videoInfo)
        summary.brief = briefResult.brief

        // Generate detailed summary  
        const detailedResult = await generateSummary(segments, 'detailed', language, videoInfo)
        summary.detailed = detailedResult.detailed

        // Generate bullet points
        const bulletResult = await generateSummary(segments, 'bullets', language, videoInfo)
        summary.bulletPoints = bulletResult.bulletPoints

        // Generate key moments
        const momentResult = await generateSummary(segments, 'keyMoments', language, videoInfo)
        summary.keyMoments = momentResult.keyMoments
      }

      console.log("Successfully generated AI summary using Gemini")
    } catch (geminiError) {
      console.error("Gemini API error:", geminiError.message)
      throw new Error(`Failed to generate summary with Gemini: ${geminiError.message}`)
    }

    console.log("Successfully generated complete summary")
    return summary
  } catch (error) {
    console.error("Error generating summary:", error)
    throw new Error(`Failed to generate summary: ${error.message}`)
  }
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