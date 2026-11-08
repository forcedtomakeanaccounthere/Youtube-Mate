const VideoQA = require("../models/VideoQA")
const VideoQAUsage = require("../models/VideoQAUsage")
const Transcript = require("../models/Transcript")
const { verifyRecaptcha } = require("../utils/recaptcha")
const { v4: uuidv4 } = require("uuid")
const guardrailsService = require("./guardrailsService")
const { remember } = require("./cacheService")
const {
  MAX_QUESTION_LENGTH,
  askGemini,
  askMistral,
  streamGemini,
  streamMistral,
  listCaptionLanguages,
} = require("./videoQAProviders")

/**
 * Video QA Service
 * Business logic for Q&A sessions, daily usage limits, and question answering.
 *
 * Endpoint-specific presentation (JSON status codes vs SSE error events) lives
 * in the controller; this service communicates failures via VideoQAError kinds:
 *
 *  kind                        | JSON endpoint                   | SSE endpoint (error event message)
 *  ----------------------------+---------------------------------+--------------------------------------
 *  recaptcha_failed            | 400 reCAPTCHA failed            | "reCAPTCHA verification failed. Please try again."
 *  recaptcha_required          | 400 RECAPTCHA_REQUIRED          | "reCAPTCHA verification required"
 *  missing_fields              | 400 Missing required fields     | "Missing required fields"
 *  question_too_long           | 400 Question too long (500)     | (pre-blocked by validation)
 *  too_many_images             | 400 Max 2 images per question   | (pre-blocked by validation)
 *  limit_premium_exhausted     | 429 + usage details             | "Daily question limit reached. Upgrade for unlimited access."
 *  limit_standard              | 429 + usage details             | "Daily question limit reached."
 *  limit_images                | 429 image limit                 | "Daily image upload limit reached."
 *  session_missing             | 404 create first                | "Session not found."
 *  session_not_found           | 404 Session not found           | "Session not found."
 *  standard_needs_transcript   | 400 standardDisabled + reason   | "Standard mode requires a transcript. Use Premium mode."
 *  generation_no_transcript    | 500 friendly (discard msg)      | "Unable to answer — no transcript and Gemini unavailable." (keep msg)
 *  generation_failed           | 500 friendly (discard msg)      | "We're having trouble processing your question. Please try again." (discard msg)
 */
class VideoQAError extends Error {
  constructor(kind, details = {}) {
    super(details.message || kind)
    this.kind = kind
    this.details = details
  }
}

// Daily limits (mirrors VideoQAUsage.canAskQuestion semantics)
const PREMIUM_DAILY_LIMIT = 2
const STANDARD_DAILY_LIMIT = 3
const IMAGE_DAILY_LIMIT = 2

class VideoQAService {
  // ============================================
  // Usage
  // ============================================

  /**
   * Completed transcript for a video, served from the ephemeral cache when
   * available (60s TTL). Misses are never cached, so a transcript that just
   * finished processing is picked up on the next request.
   */
  async _getCompletedTranscriptCached(videoId) {
    return remember(60, ["qa:transcript", videoId], async () => {
      const transcript = await Transcript.findOne({ videoId, status: "completed" }).sort({ createdAt: -1 })
      return transcript || null
    })
  }

  /**
   * Get the user's Q&A usage summary for today
   */
  async getUsage(userId) {
    // Display endpoint: 30s read cache. Limit ENFORCEMENT in prepareAsk()
    // always reads fresh from MongoDB — Mongo stays authoritative for quota.
    const usage = await remember(30, ["qa:usage", String(userId)], () =>
      VideoQAUsage.getTodayUsage(userId)
    )

    return {
      premiumRemaining: Math.max(0, PREMIUM_DAILY_LIMIT - usage.premiumQuestionsUsed),
      standardRemaining: Math.max(0, STANDARD_DAILY_LIMIT - usage.standardQuestionsUsed),
      imagesRemaining: Math.max(0, IMAGE_DAILY_LIMIT - usage.imagesUploadedCount),
      premiumUsed: usage.premiumQuestionsUsed,
      standardUsed: usage.standardQuestionsUsed,
      imagesUsed: usage.imagesUploadedCount,
      resetAt: usage.resetAt,
    }
  }

  /**
   * Check reCAPTCHA for a question request.
   * When a fresh token is provided it is verified and remembered on the user;
   * otherwise the user must have verified within the last hour.
   */
  async verifyRecaptchaForUser(user, recaptchaToken, ip) {
    if (!process.env.RECAPTCHA_SECRET_KEY) return

    if (recaptchaToken) {
      const isHuman = await verifyRecaptcha(recaptchaToken, ip)
      if (!isHuman) {
        throw new VideoQAError("recaptcha_failed")
      }
      user.lastRecaptchaVerified = new Date()
      await user.save()
    } else {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
      if (!user.lastRecaptchaVerified || user.lastRecaptchaVerified < oneHourAgo) {
        throw new VideoQAError("recaptcha_required")
      }
    }
  }

  // ============================================
  // Sessions
  // ============================================

  /**
   * Get Q&A session summaries for a video
   */
  async getSessionsForVideo(userId, videoId) {
    const videoQA = await VideoQA.findOne({ userId, videoId })

    // Build session list — return empty array if no document yet
    const sessions = videoQA
      ? videoQA.sessions.map((s) => ({
          sessionId: s.sessionId,
          title: s.title,
          messageCount: s.messages?.length || 0,
          lastMessage: s.messages?.length > 0 ? s.messages[s.messages.length - 1].content : null,
          createdAt: s.createdAt,
          updatedAt: s.updatedAt,
        }))
      : []

    // Check if transcript exists for video (cached: positive results only,
    // 60s TTL — derived read; MongoDB stays authoritative)
    const transcript = await this._getCompletedTranscriptCached(videoId)
    const hasTranscript = !!(transcript && transcript.content && transcript.content.length > 0)

    // Include caption-language info when already discovered; discovery is
    // kicked off in the background when the doc has none yet
    let availableLanguages = videoQA?.availableLanguages || null
    let defaultLanguage = videoQA?.defaultLanguage || null
    if (videoQA && !availableLanguages) {
      this._discoverLanguagesInBackground(videoQA).catch(() => {})
    }

    return {
      sessions,
      videoMetadata: videoQA?.videoMetadata || {},
      availableLanguages,
      defaultLanguage,
      hasTranscript,
      reason: hasTranscript ? null : "No captions or transcript available for this video.",
    }
  }

  /**
   * Get a specific Q&A session with its messages
   */
  async getSession(userId, sessionId) {
    const videoQA = await VideoQA.findOne({ userId, "sessions.sessionId": sessionId })

    if (!videoQA) {
      throw new VideoQAError("session_not_found")
    }

    const session = videoQA.sessions.find((s) => s.sessionId === sessionId)

    if (!session) {
      throw new VideoQAError("session_not_found")
    }

    return {
      session: {
        sessionId: session.sessionId,
        title: session.title,
        messages: session.messages,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
      },
      videoMetadata: videoQA.videoMetadata,
      availableLanguages: videoQA.availableLanguages || null,
      defaultLanguage: videoQA.defaultLanguage || null,
    }
  }

  /**
   * Create a new Q&A session for a video
   */
  async createSession(userId, { videoId, videoUrl, videoMetadata }) {
    if (!videoId || !videoUrl) {
      throw new VideoQAError("missing_fields")
    }

    const sessionId = uuidv4()

    let videoQA = await VideoQA.findOne({ userId, videoId })

    if (!videoQA) {
      videoQA = new VideoQA({
        userId,
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

    // Discover caption languages in the background (cached on the document)
    this._discoverLanguagesInBackground(videoQA).catch(() => {})

    return { sessionId, message: "Session created successfully" }
  }

  /**
   * Delete a Q&A session
   */
  async deleteSession(userId, sessionId) {
    const videoQA = await VideoQA.findOne({ userId, "sessions.sessionId": sessionId })

    if (!videoQA) {
      throw new VideoQAError("session_not_found")
    }

    videoQA.sessions = videoQA.sessions.filter((s) => s.sessionId !== sessionId)

    await videoQA.save()

    return { message: "Session deleted successfully" }
  }

  // ============================================
  // Asking questions
  // ============================================

  /**
   * Validate the request, enforce daily limits (with premium→standard
   * auto-fallback), locate the session, and record the user's message.
   *
   * @param {Object} user - Authenticated user document
   * @param {Object} payload - { videoId, videoUrl, sessionId, question, questionType, images }
   * @param {Object} options - { mode: "json" | "sse", imageAnalyzed: Boolean }
   *   mode "json" additionally enforces the explicit question-length and
   *   image-count checks (the SSE endpoint relies on validation middleware).
   *   imageAnalyzed reflects the persisted analyzed flag (false on the JSON
   *   endpoint, true on the SSE endpoint — preserved from the original routes).
   * @returns {Object} context for generateAnswer()/finalizeAnswer()
   */
  async prepareAsk(user, payload, { mode = "json", imageAnalyzed = false } = {}) {
    const { videoId, videoUrl, sessionId, question, questionType, images = [] } = payload

    if (!videoId || !videoUrl || !sessionId || !question) {
      throw new VideoQAError("missing_fields")
    }

    // Input validation (explicit backstop; the JSON endpoint has always had it)
    if (mode === "json") {
      if (question.length > MAX_QUESTION_LENGTH) {
        throw new VideoQAError("question_too_long", { maxLength: MAX_QUESTION_LENGTH })
      }

      if (images.length > 2) {
        throw new VideoQAError("too_many_images")
      }
    }

    // Check usage limits and resolve the question type (premium→standard fallback)
    const usage = await VideoQAUsage.getTodayUsage(user.id)
    let actualQuestionType = questionType

    if (questionType === "premium" && usage.premiumQuestionsUsed >= PREMIUM_DAILY_LIMIT) {
      if (usage.standardQuestionsUsed < STANDARD_DAILY_LIMIT) {
        actualQuestionType = "standard"
      } else {
        throw new VideoQAError("limit_premium_exhausted", { usage })
      }
    }

    if (actualQuestionType === "standard" && usage.standardQuestionsUsed >= STANDARD_DAILY_LIMIT) {
      throw new VideoQAError("limit_standard", { usage })
    }

    if (images.length > 0 && usage.imagesUploadedCount >= IMAGE_DAILY_LIMIT) {
      throw new VideoQAError("limit_images", { usage })
    }

    // Find session
    const videoQA = await VideoQA.findOne({ userId: user.id, videoId })

    if (!videoQA) {
      throw new VideoQAError("session_missing")
    }

    const sessionIndex = videoQA.sessions.findIndex((s) => s.sessionId === sessionId)

    if (sessionIndex === -1) {
      throw new VideoQAError("session_not_found")
    }

    // Sanitize question (basic XSS protection)
    const sanitizedQuestion = question.trim().replace(/[<>]/g, "")

    // Check if transcript exists for context (cached, 60s)
    const transcript = await this._getCompletedTranscriptCached(videoId)
    const hasTranscript = !!(transcript && transcript.content && transcript.content.length > 0)

    // Standard mode requires transcript/captions
    if (actualQuestionType === "standard" && !hasTranscript) {
      throw new VideoQAError("standard_needs_transcript", { standardDisabled: true })
    }

    // Record the user's message (persisted by the caller as each endpoint did)
    videoQA.sessions[sessionIndex].messages.push({
      role: "user",
      content: sanitizedQuestion,
      timestamp: new Date(),
      images: images.map((img) => ({ url: img, analyzed: imageAnalyzed })),
    })

    return {
      videoQA,
      sessionIndex,
      sanitizedQuestion,
      transcript,
      hasTranscript,
      actualQuestionType,
      videoUrl,
      videoId,
      images,
      userId: user.id,
    }
  }

  /**
   * Persist the user's message (the SSE endpoint saves it before streaming)
   */
  async persistUserMessage(videoQA) {
    await videoQA.save()
  }

  /**
   * Remove the user's message after a failed generation attempt
   */
  async discardUserMessage(videoQA, sessionIndex) {
    videoQA.sessions[sessionIndex].messages.pop()
    await videoQA.save()
  }

  /**
   * Caption languages available for a video (1h cache; persisted to the
   * VideoQA document). Falls back to null on discovery failure — the client
   * then uses its static language list.
   */
  async getCaptionLanguages(userId, videoId) {
    const videoQA = await VideoQA.findOne({ userId, videoId })
    const videoUrl = videoQA?.videoUrl || `https://www.youtube.com/watch?v=${videoId}`
    const result = await remember(3600, ["qa:langs", videoId], () =>
      listCaptionLanguages(videoUrl)
    )
    if (!result) {
      return { availableLanguages: videoQA?.availableLanguages || null, defaultLanguage: videoQA?.defaultLanguage || null }
    }

    // Persist onto the document when it changed
    if (videoQA) {
      videoQA.availableLanguages = result.languages
      videoQA.defaultLanguage = result.defaultLanguage
      await videoQA.save().catch(() => {})
    }

    return { availableLanguages: result.languages, defaultLanguage: result.defaultLanguage }
  }

  /**
   * Background caption-language discovery (never blocks a request)
   */
  async _discoverLanguagesInBackground(videoQA) {
    if (videoQA.availableLanguages && videoQA.availableLanguages.length > 0) return
    const result = await remember(3600, ["qa:langs", videoQA.videoId], () =>
      listCaptionLanguages(videoQA.videoUrl)
    )
    if (result && result.languages && result.languages.length > 0) {
      videoQA.availableLanguages = result.languages
      videoQA.defaultLanguage = result.defaultLanguage
      await videoQA.save().catch(() => {})
    }
  }

  /**
   * Generate an answer via the premium (Gemini) or standard (Mistral) provider,
   * falling back to Mistral when Gemini fails and a transcript is available.
   * Model output passes through the guardrails output scanner before it is
   * returned (and later persisted) — secrets/leaked instructions are redacted.
   *
   * @param {Object} context - from prepareAsk()
   * @param {Function|null} onChunk - streaming callback; null for non-streaming.
   *   Chunks are forwarded RAW for realtime streaming; the scanner runs on the
   *   assembled answer before persistence/response.
   * @returns {Promise<{answer: String, tokensUsed: Number, actualQuestionType: String, usedFallback: Boolean}>}
   */
  async generateAnswer(context, onChunk = null) {
    const result = await this._generateAnswerInternal(context, onChunk)
    return { ...result, answer: guardrailsService.scanOutput(result.answer) }
  }

  async _generateAnswerInternal(context, onChunk = null) {
    const { videoId, sanitizedQuestion, transcript, hasTranscript, images } = context
    let actualQuestionType = context.actualQuestionType

    const handleChunk = onChunk
      ? (chunk) => onChunk(chunk)
      : null

    try {
      if (actualQuestionType === "premium") {
        try {
          if (handleChunk) {
            const answer = await this._streamWithAccumulation(
              (chunk) => streamGemini(sanitizedQuestion, images, transcript, chunk),
              handleChunk
            )
            return { answer, tokensUsed: 0, actualQuestionType, usedFallback: false }
          }
          const response = await askGemini(context.videoUrl, sanitizedQuestion, images, transcript)
          return { answer: response.answer, tokensUsed: response.tokensUsed || 0, actualQuestionType, usedFallback: false }
        } catch (geminiError) {
          console.error("Gemini API failed, falling back to Mistral:", geminiError.message)

          if (!hasTranscript) {
            throw new VideoQAError("generation_no_transcript")
          }

          actualQuestionType = "standard"
          if (handleChunk) {
            // Restart the client-visible answer from the fallback provider
            const answer = await this._streamWithAccumulation(
              (chunk) => streamMistral(videoId, sanitizedQuestion, transcript, images, chunk),
              handleChunk
            )
            return { answer, tokensUsed: 0, actualQuestionType, usedFallback: true }
          }
          const response = await askMistral(videoId, sanitizedQuestion, transcript, images)
          return { answer: response.answer, tokensUsed: response.tokensUsed || 0, actualQuestionType, usedFallback: true }
        }
      }

      if (handleChunk) {
        const answer = await this._streamWithAccumulation(
          (chunk) => streamMistral(videoId, sanitizedQuestion, transcript, images, chunk),
          handleChunk
        )
        return { answer, tokensUsed: 0, actualQuestionType, usedFallback: false }
      }
      const response = await askMistral(videoId, sanitizedQuestion, transcript, images)
      return { answer: response.answer, tokensUsed: response.tokensUsed || 0, actualQuestionType, usedFallback: false }
    } catch (error) {
      if (error instanceof VideoQAError) throw error
      console.error("Error generating response:", error)
      throw new VideoQAError("generation_failed")
    }
  }

  /**
   * Drive a provider stream, forwarding chunks and accumulating the answer.
   * A provider failure mid-stream discards the partial accumulation so a
   * fallback provider's output replaces it (matching the original SSE route).
   */
  async _streamWithAccumulation(startStream, onChunk) {
    let fullAnswer = ""
    await startStream((chunk) => {
      fullAnswer += chunk
      onChunk(chunk)
    })
    return fullAnswer
  }

  /**
   * Persist the assistant response, update the session, and increment usage.
   * @returns {Object} updated usage summary for the response payload
   */
  async finalizeAnswer(videoQA, sessionIndex, { answer, actualQuestionType, tokensUsed, sanitizedQuestion, images = [], userId }) {
    // Add assistant response to history
    videoQA.sessions[sessionIndex].messages.push({
      role: "assistant",
      content: answer,
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
    await VideoQAUsage.incrementUsage(userId, actualQuestionType, 1)
    if (images.length > 0) {
      await VideoQAUsage.incrementUsage(userId, "images", images.length)
    }

    // Get updated usage
    const updatedUsage = await VideoQAUsage.getTodayUsage(userId)

    return {
      premiumRemaining: Math.max(0, PREMIUM_DAILY_LIMIT - updatedUsage.premiumQuestionsUsed),
      standardRemaining: Math.max(0, STANDARD_DAILY_LIMIT - updatedUsage.standardQuestionsUsed),
      imagesRemaining: Math.max(0, IMAGE_DAILY_LIMIT - updatedUsage.imagesUploadedCount),
    }
  }
}

module.exports = new VideoQAService()
module.exports.VideoQAError = VideoQAError
