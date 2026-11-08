const videoQAService = require("../services/videoQAService")
const { VideoQAError } = require("../services/videoQAService")

/**
 * Video QA Controller
 * Handles HTTP requests/responses for Video Q&A endpoints, including the
 * Server-Sent Events streaming endpoint.
 *
 * Error presentation per endpoint (JSON vs SSE) is mapped from the
 * VideoQAError kinds thrown by the service — see the table there.
 */
class VideoQAController {
  // ============================================
  // Usage
  // ============================================

  /**
   * Get user's daily usage
   * GET /api/video-qa/usage
   */
  async getUsage(req, res) {
    try {
      const usage = await videoQAService.getUsage(req.user.id)
      res.json(usage)
    } catch (error) {
      console.error("Error fetching usage:", error)
      res.status(500).json({ error: "Failed to fetch usage data" })
    }
  }

  // ============================================
  // Sessions
  // ============================================

  /**
   * Get Q&A sessions for a video
   * GET /api/video-qa/sessions/:videoId
   */
  async getSessions(req, res) {
    try {
      const result = await videoQAService.getSessionsForVideo(req.user.id, req.params.videoId)
      res.json(result)
    } catch (error) {
      console.error("Error fetching Q&A sessions:", error)
      res.status(500).json({ error: "Failed to fetch Q&A sessions" })
    }
  }

  /**
   * Get specific session
   * GET /api/video-qa/session/:sessionId
   */
  async getSession(req, res) {
    try {
      const result = await videoQAService.getSession(req.user.id, req.params.sessionId)
      res.json(result)
    } catch (error) {
      if (error instanceof VideoQAError && error.kind === "session_not_found") {
        return res.status(404).json({ error: "Session not found" })
      }

      console.error("Error fetching session:", error)
      res.status(500).json({ error: "Failed to fetch session" })
    }
  }

  /**
   * Create new Q&A session
   * POST /api/video-qa/session/create
   */
  async createSession(req, res) {
    try {
      const { videoId, videoUrl, videoMetadata } = req.body
      const result = await videoQAService.createSession(req.user.id, { videoId, videoUrl, videoMetadata })
      res.json(result)
    } catch (error) {
      if (error instanceof VideoQAError && error.kind === "missing_fields") {
        return res.status(400).json({ error: "Video ID and URL are required" })
      }

      console.error("Error creating session:", error)
      res.status(500).json({ error: "Failed to create session" })
    }
  }

  /**
   * Delete session
   * DELETE /api/video-qa/session/:sessionId
   */
  async deleteSession(req, res) {
    try {
      const result = await videoQAService.deleteSession(req.user.id, req.params.sessionId)
      res.json(result)
    } catch (error) {
      if (error instanceof VideoQAError && error.kind === "session_not_found") {
        return res.status(404).json({ error: "Session not found" })
      }

      console.error("Error deleting session:", error)
      res.status(500).json({ error: "Failed to delete session" })
    }
  }

  /**
   * Get caption languages available for a video (for the Q&A language picker)
   * GET /api/video-qa/languages/:videoId
   */
  async getLanguages(req, res) {
    try {
      const result = await videoQAService.getCaptionLanguages(req.user.id, req.params.videoId)
      res.json(result)
    } catch (error) {
      console.error("Error fetching caption languages:", error)
      res.status(500).json({ error: "Failed to fetch caption languages" })
    }
  }

  // ============================================
  // Asking questions
  // ============================================

  /**
   * Ask question (JSON response)
   * POST /api/video-qa/ask
   */
  async ask(req, res) {
    const payload = {
      videoId: req.body.videoId,
      videoUrl: req.body.videoUrl,
      sessionId: req.body.sessionId,
      question: req.body.question,
      questionType: req.body.questionType,
      images: req.body.images || [],
      recaptchaToken: req.body.recaptchaToken,
    }

    try {
      await videoQAService.verifyRecaptchaForUser(req.user, payload.recaptchaToken, req.ip)
    } catch (error) {
      return this._recaptchaErrorResponse(error, res)
    }

    let context
    try {
      context = await videoQAService.prepareAsk(req.user, payload, { mode: "json", imageAnalyzed: false })
    } catch (error) {
      return this._prepareAskErrorResponse(error, res)
    }

    let result
    try {
      result = await videoQAService.generateAnswer(context, null)
    } catch (error) {
      return this._generationErrorResponse(error, context, res)
    }

    try {
      const usage = await videoQAService.finalizeAnswer(context.videoQA, context.sessionIndex, {
        answer: result.answer,
        actualQuestionType: result.actualQuestionType,
        tokensUsed: result.tokensUsed,
        sanitizedQuestion: context.sanitizedQuestion,
        images: context.images,
        userId: context.userId,
      })

      res.json({
        answer: result.answer,
        responseType: result.actualQuestionType,
        tokensUsed: result.tokensUsed,
        fallbackUsed: result.usedFallback,
        usage,
      })
    } catch (error) {
      console.error("Error in ask endpoint:", error)
      res.status(500).json({ error: "Failed to process question" })
    }
  }

  /**
   * Ask question (Server-Sent Events streaming response)
   * POST /api/video-qa/ask/stream — same contract as /ask but streams tokens via SSE
   */
  async askStream(req, res) {
    const payload = {
      videoId: req.body.videoId,
      videoUrl: req.body.videoUrl,
      sessionId: req.body.sessionId,
      question: req.body.question,
      questionType: req.body.questionType,
      images: req.body.images || [],
      recaptchaToken: req.body.recaptchaToken,
    }

    // Check reCAPTCHA verification status before streaming — failures are
    // plain JSON responses, matching the original endpoint
    try {
      await videoQAService.verifyRecaptchaForUser(req.user, payload.recaptchaToken, req.ip)
    } catch (error) {
      return this._recaptchaErrorResponse(error, res)
    }

    // Set SSE headers before any streaming starts
    res.setHeader("Content-Type", "text/event-stream")
    res.setHeader("Cache-Control", "no-cache")
    res.setHeader("Connection", "keep-alive")
    res.setHeader("X-Accel-Buffering", "no")
    res.flushHeaders()

    const sseWrite = (event, data) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
    }

    try {
      let context
      try {
        context = await videoQAService.prepareAsk(req.user, payload, { mode: "sse", imageAnalyzed: true })
      } catch (error) {
        return this._prepareAskSseErrorResponse(error, sseWrite, res)
      }

      // Save user message before streaming
      await videoQAService.persistUserMessage(context.videoQA)

      let result
      try {
        result = await videoQAService.generateAnswer(context, (chunk) => {
          sseWrite("chunk", { text: chunk })
        })
      } catch (error) {
        if (error instanceof VideoQAError && error.kind === "generation_no_transcript") {
          sseWrite("error", { message: "Unable to answer — no transcript and Gemini unavailable." })
          return res.end()
        }

        if (error instanceof VideoQAError && error.kind === "generation_failed") {
          console.error("Streaming error")
          sseWrite("error", { message: "We're having trouble processing your question. Please try again." })
          await videoQAService.discardUserMessage(context.videoQA, context.sessionIndex)
          return res.end()
        }

        throw error
      }

      const usage = await videoQAService.finalizeAnswer(context.videoQA, context.sessionIndex, {
        answer: result.answer,
        actualQuestionType: result.actualQuestionType,
        tokensUsed: result.tokensUsed,
        sanitizedQuestion: context.sanitizedQuestion,
        images: context.images,
        userId: context.userId,
      })

      sseWrite("done", {
        responseType: result.actualQuestionType,
        fallbackUsed: result.usedFallback,
        tokensUsed: result.tokensUsed,
        usage,
      })
      res.end()
    } catch (err) {
      console.error("Error in /ask/stream:", err)
      sseWrite("error", { message: "Failed to process question." })
      res.end()
    }
  }

  // ============================================
  // Private error mappers
  // ============================================

  /**
   * Map reCAPTCHA failures to their JSON responses (used by both endpoints,
   * before the SSE stream starts)
   */
  _recaptchaErrorResponse(error, res) {
    if (error instanceof VideoQAError) {
      if (error.kind === "recaptcha_failed") {
        return res.status(400).json({ error: "reCAPTCHA verification failed. Please try again." })
      }
      if (error.kind === "recaptcha_required") {
        return res.status(400).json({
          error: "reCAPTCHA verification required",
          code: "RECAPTCHA_REQUIRED",
        })
      }
    }
    console.error("Error checking reCAPTCHA:", error)
    return res.status(500).json({ error: "Failed to process question" })
  }

  /**
   * Map prepareAsk failures to the JSON endpoint's responses
   */
  _prepareAskErrorResponse(error, res) {
    if (error instanceof VideoQAError) {
      const { kind, details } = error

      if (kind === "question_too_long") {
        return res.status(400).json({
          error: `Question too long. Maximum ${details.maxLength} characters allowed.`,
        })
      }
      if (kind === "too_many_images") {
        return res.status(400).json({ error: "Maximum 2 images allowed per question" })
      }
      if (kind === "limit_premium_exhausted") {
        return res.status(429).json({
          error: "Daily question limit reached",
          message: "You've used all your daily questions. Upgrade to premium for unlimited access.",
          premiumRemaining: 0,
          standardRemaining: 0,
        })
      }
      if (kind === "limit_standard") {
        return res.status(429).json({
          error: "Daily question limit reached",
          message: "You've used all your daily questions. Upgrade to premium for unlimited access.",
          premiumRemaining: Math.max(0, 2 - details.usage.premiumQuestionsUsed),
          standardRemaining: 0,
        })
      }
      if (kind === "limit_images") {
        return res.status(429).json({
          error: "Daily image limit reached",
          message: "You've reached your daily limit of 2 image uploads.",
        })
      }
      if (kind === "session_missing") {
        return res.status(404).json({
          error: "Session not found. Please create a session first.",
        })
      }
      if (kind === "session_not_found") {
        return res.status(404).json({ error: "Session not found" })
      }
      if (kind === "standard_needs_transcript") {
        return res.status(400).json({
          error: "Standard mode unavailable",
          message: "This video does not have available captions or a transcript. Standard mode (Mistral) requires transcript context to answer questions. Please use Premium mode (Gemini), which can analyze the video directly.",
          standardDisabled: true,
          reason: "No captions or transcript available for this video.",
        })
      }
    }

    console.error("Error in ask endpoint:", error)
    return res.status(500).json({ error: "Failed to process question" })
  }

  /**
   * Map prepareAsk failures to the SSE endpoint's error events
   */
  _prepareAskSseErrorResponse(error, sseWrite, res) {
    if (error instanceof VideoQAError) {
      const { kind } = error

      if (kind === "missing_fields") {
        sseWrite("error", { message: "Missing required fields" })
        return res.end()
      }
      if (kind === "limit_premium_exhausted") {
        sseWrite("error", { message: "Daily question limit reached. Upgrade for unlimited access." })
        return res.end()
      }
      if (kind === "limit_standard") {
        sseWrite("error", { message: "Daily question limit reached." })
        return res.end()
      }
      if (kind === "limit_images") {
        sseWrite("error", { message: "Daily image upload limit reached." })
        return res.end()
      }
      if (kind === "session_missing" || kind === "session_not_found") {
        sseWrite("error", { message: "Session not found." })
        return res.end()
      }
      if (kind === "standard_needs_transcript") {
        sseWrite("error", { message: "Standard mode requires a transcript. Use Premium mode.", standardDisabled: true })
        return res.end()
      }
    }

    console.error("Error in /ask/stream:", error)
    sseWrite("error", { message: "Failed to process question." })
    return res.end()
  }

  /**
   * Map generation failures to the JSON endpoint's responses.
   * The user's message is removed again when generation fails.
   */
  async _generationErrorResponse(error, context, res) {
    if (error instanceof VideoQAError) {
      if (error.kind === "generation_no_transcript" || error.kind === "generation_failed") {
        await videoQAService.discardUserMessage(context.videoQA, context.sessionIndex)

        return res.status(500).json({
          error: "Failed to generate response",
          message: "We're having trouble processing your question right now. Please try again in a moment.",
        })
      }
    }

    console.error("Error in ask endpoint:", error)
    return res.status(500).json({ error: "Failed to process question" })
  }
}

module.exports = new VideoQAController()
