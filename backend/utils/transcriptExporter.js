const { GoogleGenerativeAI } = require("@google/generative-ai")
const axios = require("axios")

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)

// Extract video ID from YouTube URL
function extractVideoId(url) {
  const regex = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  const match = url.match(regex)
  return match ? match[1] : null
}

// Get video metadata using YouTube API or fallback
async function getVideoMetadata(videoId) {
  try {
    // Try YouTube API first if available
    if (process.env.YOUTUBE_API_KEY) {
      const response = await axios.get(`https://www.googleapis.com/youtube/v3/videos`, {
        params: {
          part: "snippet,contentDetails,statistics",
          id: videoId,
          key: process.env.YOUTUBE_API_KEY,
        },
      })

      if (response.data.items && response.data.items.length > 0) {
        const video = response.data.items[0]
        const snippet = video.snippet
        const contentDetails = video.contentDetails
        const statistics = video.statistics

        // Parse duration from ISO 8601 format
        const duration = parseDuration(contentDetails.duration)

        return {
          title: snippet.title,
          duration: formatDuration(duration),
          thumbnail: snippet.thumbnails.high?.url || snippet.thumbnails.default.url,
          channel: snippet.channelTitle,
          views: formatViews(statistics.viewCount),
          uploadDate: formatDate(snippet.publishedAt),
          videoId,
        }
      }
    }

    // Fallback to basic metadata
    return {
      title: "YouTube Video",
      duration: "Unknown",
      thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      channel: "Unknown Channel",
      views: "",
      uploadDate: "",
      videoId,
    }
  } catch (error) {
    console.error("Error fetching video metadata:", error)
    return {
      title: "YouTube Video",
      duration: "Unknown",
      thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      channel: "Unknown Channel",
      views: "",
      uploadDate: "",
      videoId,
    }
  }
}

// Generate transcript and summary using Gemini's YouTube capabilities
async function generateTranscript(youtubeUrl, language = "en") {
  try {
    const videoId = extractVideoId(youtubeUrl)
    if (!videoId) {
      throw new Error("Invalid YouTube URL")
    }

    console.log(`🎬 Generating transcript for video ${videoId} in language ${language}`)

    // Get video metadata
    const videoInfo = await getVideoMetadata(videoId)
    console.log(`📺 Video: "${videoInfo.title}" by ${videoInfo.channel}`)

    // Get Gemini model
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" })

    // Language-specific instructions
    const languageInstructions = getLanguageInstructions(language)

    // Create a comprehensive prompt for Gemini to analyze the YouTube video
    const transcriptPrompt = `Please analyze this YouTube video: ${youtubeUrl}

${languageInstructions}

I need you to:
1. Summarise the content of this youtube video in brief
2. Create a detailed transcript with timestamps
3. Break it down into segments of approximately 20-25 seconds each
4. Provide the text content for each segment

Please format your response as a JSON object with this structure:
{
  "segments": [
    {
      "start": 0.0,
      "end": 12.5,
      "text": "The actual spoken content in this time segment"
    },
    {
      "start": 12.5,
      "end": 25.0,
      "text": "Next segment of spoken content"
    }
  ]
}

Make sure to:
- Use appropriate timestamps (in seconds)
- Keep segments reasonably sized
- Include all key information, dialogue, and explanations any important higlights
- Maintain the original language and tone of the video`

    const result = await model.generateContent(transcriptPrompt)
    const response = await result.response
    const transcriptText = response.text()

    console.log("✅ Gemini response received, parsing transcript...")

    // Parse the JSON response
    let transcriptData
    try {
      // Extract JSON from the response (in case there's extra text)
      const jsonMatch = transcriptText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        transcriptData = JSON.parse(jsonMatch[0])
      } else {
        // If no JSON found, try parsing the whole response
        transcriptData = JSON.parse(transcriptText)
      }
    } catch (parseError) {
      console.error("Error parsing Gemini response:", parseError)
      throw new Error("Failed to parse transcript from Gemini response")
    }

    // Convert to our expected format
    const segments = transcriptData.segments.map((item, index) => ({
      id: `segment_${index + 1}`,
      start: parseFloat(item.start),
      end: parseFloat(item.end),
      text: item.text.trim(),
      speaker: "Speaker", // Default speaker
      confidence: 0.95, // Default confidence
    }))

    // Update video duration if we got segments
    if (segments.length > 0) {
      const lastSegment = segments[segments.length - 1]
      const totalSeconds = Math.ceil(lastSegment.end)
      videoInfo.duration = formatDuration(totalSeconds)
    }

    console.log(`Successfully generated transcript with ${segments.length} segments using Gemini`)

    return {
      videoInfo,
      segments,
    }
  } catch (error) {
    console.error("Error generating transcript:", error)
    throw new Error(`Failed to generate transcript: ${error.message}`)
  }
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
      // Get Gemini model
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" })

      // Create context about the video
      const videoContext = videoInfo ? `Video Title: "${videoInfo.title}"
Video Channel: ${videoInfo.channel}
Video Duration: ${videoInfo.duration}

` : ""

      // Language-specific instructions
      const languageInstructions = getLanguageInstructions(language)

      // Generate response based on summary type
      if (summaryType === "brief") {
        const briefPrompt = `${videoContext}You are an expert content analyst. Please provide a concise, informative brief summary (2-3 sentences maximum) of the following video transcript. Focus on the main topic and key takeaway.

${languageInstructions}

Transcript:
${fullText.substring(0, 8000)}

Instructions: 
- Keep it concise but informative
- Focus on the main topic and primary message
- Make it accessible to someone who hasn't watched the video
- Use clear, professional language

Brief Summary:`

        const briefResult = await model.generateContent(briefPrompt)
        const briefResponse = await briefResult.response
        summary.brief = briefResponse.text().trim()

      } else if (summaryType === "detailed") {
        const detailedPrompt = `${videoContext}You are an expert content analyst. Please provide a comprehensive detailed summary (4-6 sentences) of the following video transcript. Cover the main points, key insights, methodology, and conclusions.

${languageInstructions}

Transcript:
${fullText.substring(0, 8000)}

Instructions:
- Provide a thorough analysis covering all major points
- Include methodology, key insights, and conclusions
- Maintain logical flow between ideas
- Make it valuable for someone researching this topic
- Use professional, analytical language

Detailed Summary:`

        const detailedResult = await model.generateContent(detailedPrompt)
        const detailedResponse = await detailedResult.response
        summary.detailed = detailedResponse.text().trim()

      } else if (summaryType === "bullets") {
        const bulletPrompt = `${videoContext}You are an expert content analyst. Please extract the most important key points from the following video transcript and format them as clear, actionable bullet points.

${languageInstructions}

Transcript:
${fullText.substring(0, 8000)}

Instructions:
- Extract 5-7 most important points
- Make each point concise but complete (10-25 words)
- Focus on actionable insights or key information
- Maintain logical order of presentation
- Use clear, direct language
- Format as bullet points using "•"

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
        const momentsPrompt = `${videoContext}You are an expert content analyst. Please identify the most important timestamps and moments from the following video transcript. Focus on key transitions, important announcements, crucial explanations, or significant insights.

${languageInstructions}

Transcript with timestamps:
${segments.slice(0, 50).map(seg => `[${formatTime(seg.start)}] ${seg.text}`).join('\n')}

Instructions:
- Identify 5-7 most important moments
- Include the timestamp and describe what happens
- Focus on key transitions, insights, or important information
- Make descriptions concise but informative (15-30 words)
- Prioritize moments that viewers would want to jump to

Format each as: [TIMESTAMP] Description

Key Moments:`

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
  extractVideoId,
  getVideoMetadata,
}