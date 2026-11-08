const express = require("express")
const router = express.Router()
const rateLimit = require("express-rate-limit")
const { authenticateToken } = require("../middleware/auth")
const {
  validateCreateSession,
  validateAskQuestion,
  validateSessionId,
  validateVideoId,
} = require("../middleware/videoQAValidation")
const videoQAController = require("../controllers/videoQAController")

/**
 * Video QA Routes
 *
 * All business logic lives in:
 * - controllers/videoQAController.js (HTTP + SSE handling)
 * - services/videoQAService.js (sessions, usage limits, orchestration)
 * - services/videoQAProviders.js (Gemini / Mistral AI adapters)
 */

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

// Get user's daily usage
router.get("/usage", authenticateToken, videoQAController.getUsage.bind(videoQAController))

// Get Q&A sessions for a video
router.get("/sessions/:videoId", authenticateToken, validateVideoId, videoQAController.getSessions.bind(videoQAController))

// Get caption languages available for a video (Q&A language picker)
router.get("/languages/:videoId", authenticateToken, validateVideoId, videoQAController.getLanguages.bind(videoQAController))

// Get specific session
router.get("/session/:sessionId", authenticateToken, validateSessionId, videoQAController.getSession.bind(videoQAController))

// Create new Q&A session
router.post("/session/create", authenticateToken, validateCreateSession, videoQAController.createSession.bind(videoQAController))

// Delete session
router.delete("/session/:sessionId", authenticateToken, validateSessionId, videoQAController.deleteSession.bind(videoQAController))

// Ask question (JSON response)
router.post("/ask", authenticateToken, qaLimiter, validateAskQuestion, videoQAController.ask.bind(videoQAController))

// Ask question (Server-Sent Events streaming response)
router.post("/ask/stream", authenticateToken, qaLimiter, validateAskQuestion, videoQAController.askStream.bind(videoQAController))

module.exports = router
