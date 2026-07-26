const express = require("express")
const router = express.Router()
const { authenticateToken } = require("../middleware/auth")
const {
  validateCreateSession,
  validateAskQuestion,
  validateSessionId,
  validateVideoId,
} = require("../middleware/videoQAValidation")
const VideoQA = require("../models/VideoQA")
const VideoQAUsage = require("../models/VideoQAUsage")
const Transcript = require("../models/Transcript")
const rateLimit = require("express-rate-limit")
const { v4: uuidv4 } = require("uuid")
const axios = require("axios")

// Rate limiting for Q&A requests
const qaLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // limit each IP to 10 requests per minute
  message: {
    error: "Too many Q&A requests, please slow down.",
  },
  standardHeaders: true,
  legacyHeaders: false,
})

// Security: Max question length to prevent abuse
const MAX_QUESTION_LENGTH = 500
const MAX_CONTEXT_LENGTH = 100000 // Max transcript length for Mistral

// Get user's daily usage
router.get("/usage", authenticateToken, async (req, res) => {
  try {
    const usage = await VideoQAUsage.getTodayUsage(req.user.id)

    res.json({
      premiumRemaining: Math.max(0, 2 - usage.premiumQuestionsUsed),
      standardRemaining: Math.max(0, 3 - usage.standardQuestionsUsed),
      imagesRemaining: Math.max(0, 2 - usage.imagesUploadedCount),
      premiumUsed: usage.premiumQuestionsUsed,
      standardUsed: usage.standardQuestionsUsed,
      imagesUsed: usage.imagesUploadedCount,
      resetAt: usage.resetAt,
    })
  } catch (error) {
    console.error("Error fetching usage:", error)
    res.status(500).json({ error: "Failed to fetch usage data" })
  }
})

// Get Q&A sessions for a video
router.get("/sessions/:videoId", authenticateToken, validateVideoId, async (req, res) => {
  try {
    const { videoId } = req.params

    let videoQA = await VideoQA.findOne({
      userId: req.user.id,
      videoId,
    })

    if (!videoQA) {
      // Return empty sessions if none exist
      return res.json({ sessions: [], videoMetadata: null })
    }

    // Return sessions with limited message data for list view
    const sessions = videoQA.sessions.map((session) => ({
      sessionId: session.sessionId,
      title: session.title,
      messageCount: session.messages.length,
      lastMessage:
        session.messages.length > 0
          ? session.messages[session.messages.length - 1].content.substring(0, 100)
          : "",
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    }))

    res.json({
      sessions,
      videoMetadata: videoQA.videoMetadata,
    })
  } catch (error) {
    console.error("Error fetching Q&A sessions:", error)
    res.status(500).json({ error: "Failed to fetch Q&A sessions" })
  }
})

// Get specific session
router.get("/session/:sessionId", authenticateToken, validateSessionId, async (req, res) => {
  try {
    const { sessionId } = req.params

    const videoQA = await VideoQA.findOne({
      userId: req.user.id,
      "sessions.sessionId": sessionId,
    })

    if (!videoQA) {
      return res.status(404).json({ error: "Session not found" })
    }

    const session = videoQA.sessions.find((s) => s.sessionId === sessionId)

    if (!session) {
      return res.status(404).json({ error: "Session not found" })
    }

    res.json({
      session: {
        sessionId: session.sessionId,
        title: session.title,
        messages: session.messages,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
      },
      videoMetadata: videoQA.videoMetadata,
    })
  } catch (error) {
    console.error("Error fetching session:", error)
    res.status(500).json({ error: "Failed to fetch session" })
  }
})

// Create new Q&A session
router.post("/session/create", authenticateToken, validateCreateSession, async (req, res) => {
  try {
    const { videoId, videoUrl, videoMetadata } = req.body

    if (!videoId || !videoUrl) {
      return res.status(400).json({ error: "Video ID and URL are required" })
    }

    const sessionId = uuidv4()

    let videoQA = await VideoQA.findOne({
      userId: req.user.id,
      videoId,
    })

    if (!videoQA) {
      videoQA = new VideoQA({
        userId: req.user.id,
        videoId,
        videoUrl,
        videoMetadata: videoMetadata || {},
        sessions: [
          {
            sessionId,
            title: "New Chat",
            messages: [],
          },
        ],
      })
    } else {
      videoQA.sessions.push({
        sessionId,
        title: "New Chat",
        messages: [],
      })
    }

    await videoQA.save()

    res.json({
      sessionId,
      message: "Session created successfully",
    })
  } catch (error) {
    console.error("Error creating session:", error)
    res.status(500).json({ error: "Failed to create session" })
  }
})

// Delete session
router.delete("/session/:sessionId", authenticateToken, validateSessionId, async (req, res) => {
  try {
    const { sessionId } = req.params

    const videoQA = await VideoQA.findOne({
      userId: req.user.id,
      "sessions.sessionId": sessionId,
    })

    if (!videoQA) {
      return res.status(404).json({ error: "Session not found" })
    }

    videoQA.sessions = videoQA.sessions.filter((s) => s.sessionId !== sessionId)

    await videoQA.save()

    res.json({ message: "Session deleted successfully" })
  } catch (error) {
    console.error("Error deleting session:", error)
    res.status(500).json({ error: "Failed to delete session" })
  }
})

// Ask question
router.post("/ask", authenticateToken, qaLimiter, validateAskQuestion, async (req, res) => {
  try {
    const { videoId, videoUrl, sessionId, question, questionType, images = [] } = req.body

    // Input validation
    if (!videoId || !videoUrl || !sessionId || !question) {
      return res.status(400).json({ error: "Missing required fields" })
    }

    if (question.length > MAX_QUESTION_LENGTH) {
      return res.status(400).json({
        error: `Question too long. Maximum ${MAX_QUESTION_LENGTH} characters allowed.`,
      })
    }

    if (images.length > 2) {
      return res.status(400).json({
        error: "Maximum 2 images allowed per question",
      })
    }

    // Sanitize question (basic XSS protection)
    const sanitizedQuestion = question.trim().replace(/[<>]/g, "")

    // Check usage limits
    const usage = await VideoQAUsage.getTodayUsage(req.user.id)

    // Determine which question type to use
    let actualQuestionType = questionType

    // Auto-fallback logic
    if (questionType === "premium" && usage.premiumQuestionsUsed >= 2) {
      // Check if standard questions are available
      if (usage.standardQuestionsUsed < 3) {
        actualQuestionType = "standard"
      } else {
        return res.status(429).json({
          error: "Daily question limit reached",
          message: "You've used all your daily questions. Upgrade to premium for unlimited access.",
          premiumRemaining: 0,
          standardRemaining: 0,
        })
      }
    }

    if (actualQuestionType === "standard" && usage.standardQuestionsUsed >= 3) {
      return res.status(429).json({
        error: "Daily question limit reached",
        message: "You've used all your daily questions. Upgrade to premium for unlimited access.",
        premiumRemaining: Math.max(0, 2 - usage.premiumQuestionsUsed),
        standardRemaining: 0,
      })
    }

    // Check image upload limit
    if (images.length > 0 && usage.imagesUploadedCount >= 2) {
      return res.status(429).json({
        error: "Daily image limit reached",
        message: "You've reached your daily limit of 2 image uploads.",
      })
    }

    // Find or create session
    let videoQA = await VideoQA.findOne({
      userId: req.user.id,
      videoId,
    })

    if (!videoQA) {
      return res.status(404).json({
        error: "Session not found. Please create a session first.",
      })
    }

    const sessionIndex = videoQA.sessions.findIndex((s) => s.sessionId === sessionId)

    if (sessionIndex === -1) {
      return res.status(404).json({
        error: "Session not found",
      })
    }

    // Add user message to history
    videoQA.sessions[sessionIndex].messages.push({
      role: "user",
      content: sanitizedQuestion,
      timestamp: new Date(),
      images: images.map((img) => ({ url: img, analyzed: false })),
    })

    // Get transcript for context
    const transcript = await Transcript.findOne({
      videoId,
      status: "completed",
    }).sort({ createdAt: -1 })

    let response
    let tokensUsed = 0
    let usedFallback = false

    try {
      if (actualQuestionType === "premium") {
        // Try Gemini API first
        try {
          response = await askGemini(videoUrl, sanitizedQuestion, images, transcript)
          tokensUsed = response.tokensUsed || 0
        } catch (geminiError) {
          console.error("Gemini API failed, falling back to Mistral:", geminiError.message)
          
          // Fallback to Mistral if Gemini fails
          if (!transcript || !transcript.content) {
            throw new Error("Unable to answer your question. Please try generating a transcript first, or try again later.")
          }
          
          usedFallback = true
          actualQuestionType = "standard"
          response = await askMistral(sanitizedQuestion, transcript, images)
          tokensUsed = response.tokensUsed || 0
        }
      } else {
        // Use Mistral API (needs transcript)
        if (!transcript || !transcript.content) {
          return res.status(400).json({
            error: "Transcript not available",
            message: "Please generate a transcript first before asking questions.",
          })
        }

        response = await askMistral(sanitizedQuestion, transcript, images)
        tokensUsed = response.tokensUsed || 0
      }

      // Add assistant response to history
      videoQA.sessions[sessionIndex].messages.push({
        role: "assistant",
        content: response.answer,
        timestamp: new Date(),
        responseType: actualQuestionType,
        tokensUsed,
      })

      // Update session timestamp and title if it's the first question
      videoQA.sessions[sessionIndex].updatedAt = new Date()
      if (videoQA.sessions[sessionIndex].messages.length === 2) {
        // First Q&A pair
        videoQA.sessions[sessionIndex].title = sanitizedQuestion.substring(0, 50) + "..."
      }

      await videoQA.save()

      // Increment usage
      await VideoQAUsage.incrementUsage(req.user.id, actualQuestionType, 1)
      if (images.length > 0) {
        await VideoQAUsage.incrementUsage(req.user.id, "images", images.length)
      }

      // Get updated usage
      const updatedUsage = await VideoQAUsage.getTodayUsage(req.user.id)

      res.json({
        answer: response.answer,
        responseType: actualQuestionType,
        tokensUsed,
        fallbackUsed: usedFallback,
        usage: {
          premiumRemaining: Math.max(0, 2 - updatedUsage.premiumQuestionsUsed),
          standardRemaining: Math.max(0, 3 - updatedUsage.standardQuestionsUsed),
          imagesRemaining: Math.max(0, 2 - updatedUsage.imagesUploadedCount),
        },
      })
    } catch (error) {
      console.error("Error generating response:", error)

      // Remove the user message if response generation failed
      videoQA.sessions[sessionIndex].messages.pop()
      await videoQA.save()

      // Send sanitized error message to frontend
      const userFriendlyMessage = "We're having trouble processing your question right now. Please try again in a moment."

      res.status(500).json({
        error: "Failed to generate response",
        message: userFriendlyMessage,
      })
    }
  } catch (error) {
    console.error("Error in ask endpoint:", error)
    res.status(500).json({ error: "Failed to process question" })
  }
})

// Helper function to ask Gemini
async function askGemini(videoUrl, question, images = [], transcript = null) {
  const apiKey = process.env.GEMINI_API_KEY

  if (!apiKey) {
    console.error("Gemini API key not configured")
    throw new Error("Service temporarily unavailable")
  }

  // Model fallback list with gemini-3.6-flash first
  const modelsToTry = ["gemini-3.6-flash", "gemini-2.5-flash", "gemini-1.5-flash", "gemini-2.0-flash"]

  // Build prompt parts
  const parts = [
    {
      text: `You are a helpful AI assistant analyzing a YouTube video. Answer the following question about the video: ${question}`,
    },
    {
      file_data: {
        file_uri: videoUrl,
      },
    },
  ]

  // Add images if provided (base64 data URI or HTTP URL)
  if (images && images.length > 0) {
    parts.push({
      text: "The user has provided image attachment(s) for additional context. Consider them in your answer:",
    })
    for (const img of images) {
      if (typeof img === "string" && img.startsWith("data:image/")) {
        const match = img.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/)
        if (match) {
          parts.push({
            inline_data: {
              mime_type: match[1],
              data: match[2],
            },
          })
        }
      } else if (typeof img === "string" && (img.startsWith("http://") || img.startsWith("https://"))) {
        parts.push({
          text: `(Image URL provided: ${img})`,
        })
      }
    }
  }

  // Add transcript context if available
  if (transcript && transcript.content) {
    const transcriptText = transcript.content
      .map((seg) => seg.text)
      .join(" ")
      .substring(0, 40000) // 40k character context limit
    parts.push({
      text: `Video transcript for reference:\n${transcriptText}`,
    })
  }

  let lastError = null

  for (const modelName of modelsToTry) {
    try {
      console.log(`Attempting Gemini API request with model: ${modelName}`)
      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
        {
          contents: [
            {
              parts,
            },
          ],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2500,
          },
          safetySettings: [
            {
              category: "HARM_CATEGORY_HARASSMENT",
              threshold: "BLOCK_MEDIUM_AND_ABOVE",
            },
            {
              category: "HARM_CATEGORY_HATE_SPEECH",
              threshold: "BLOCK_MEDIUM_AND_ABOVE",
            },
            {
              category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
              threshold: "BLOCK_MEDIUM_AND_ABOVE",
            },
            {
              category: "HARM_CATEGORY_DANGEROUS_CONTENT",
              threshold: "BLOCK_MEDIUM_AND_ABOVE",
            },
          ],
        },
        {
          timeout: 45000,
        }
      )

      if (
        response.data &&
        response.data.candidates &&
        response.data.candidates[0] &&
        response.data.candidates[0].content &&
        response.data.candidates[0].content.parts &&
        response.data.candidates[0].content.parts[0]
      ) {
        const answer = response.data.candidates[0].content.parts[0].text
        return {
          answer,
          tokensUsed: response.data.usageMetadata?.totalTokenCount || 0,
        }
      }
    } catch (err) {
      const errDetail = err.response?.data?.error?.message || err.message
      console.warn(`Gemini model ${modelName} returned error: ${errDetail}. Retrying next model...`)
      lastError = err
    }
  }

  console.error("All Gemini models failed, details:", lastError?.response?.data || lastError?.message)
  throw new Error("Gemini service failed: " + (lastError?.response?.data?.error?.message || lastError?.message))
}

// Helper function to ask Mistral
async function askMistral(question, transcript, images = []) {
  const apiKey = process.env.MISTRAL_API_KEY

  if (!apiKey) {
    console.error("Mistral API key not configured")
    throw new Error("Service temporarily unavailable")
  }

  try {
    // Build transcript context (limit to 40,000 characters for optimal performance and response time)
    const transcriptText = transcript.content
      .map((seg) => {
        const timestamp = formatTime(seg.start)
        return `[${timestamp}] ${seg.text}`
      })
      .join("\n")
      .substring(0, 40000)

    // Build messages
    const messages = [
      {
        role: "system",
        content:
          "You are a helpful AI assistant analyzing video content. You have access to the video transcript. Provide accurate, helpful answers based on the transcript content. Include timestamps when relevant.",
      },
      {
        role: "user",
        content: `Video Transcript:\n${transcriptText}\n\nQuestion: ${question}`,
      },
    ]

    if (images && images.length > 0) {
      messages[1].content += "\n\n(Note: User provided image attachments for context)"
    }

    const response = await axios.post(
      "https://api.mistral.ai/v1/chat/completions",
      {
        model: "mistral-large-latest",
        messages,
        temperature: 0.7,
        max_tokens: 2500,
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        timeout: 60000, // 60s timeout for large completions
      }
    )

    if (!response.data || !response.data.choices || !response.data.choices[0]) {
      console.error("Invalid Mistral API response:", JSON.stringify(response.data))
      throw new Error("Invalid API response")
    }

    const answer = response.data.choices[0].message.content

    return {
      answer,
      tokensUsed: response.data.usage?.total_tokens || 0,
    }
  } catch (error) {
    console.error("Mistral API error details:", {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
    })
    throw new Error("Mistral service failed: " + (error.response?.data?.message || error.message))
  }
}

// Helper function to format time
function formatTime(seconds) {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }
  return `${minutes}:${secs.toString().padStart(2, "0")}`
}

module.exports = router
