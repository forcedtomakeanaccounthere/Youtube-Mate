const express = require("express")
const router = express.Router()
const { authenticateToken } = require("../middleware/auth")
const { validateTranscriptRequest } = require("../middleware/validation")
const transcriptController = require("../controllers/transcriptController")
const rateLimit = require("express-rate-limit")

/**
 * Transcript Routes
 * REFACTORED - All routes now use transcriptController
 * 
 * These routes handle transcript generation, caching, and export functionality
 */

// Rate limiting for transcript generation
const transcriptLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 transcript requests per windowMs
  message: {
    error: "Too many transcript requests, please try again later.",
    retryAfter: 15 * 60 * 1000,
  },
  standardHeaders: true,
  legacyHeaders: false,
})

// Get user's transcript history (requires authentication)
router.get("/history", authenticateToken, transcriptController.getHistory.bind(transcriptController))

// Get specific transcript (requires authentication)
router.get("/:id", authenticateToken, transcriptController.getById.bind(transcriptController))

// Create new transcript
router.post("/", transcriptLimiter, authenticateToken, validateTranscriptRequest, transcriptController.create.bind(transcriptController))

// Regenerate summary with different type (requires authentication)
router.post("/regenerate-summary", authenticateToken, transcriptController.regenerateSummary.bind(transcriptController))

// Get cache statistics (admin/debug endpoint)
router.get("/cache/stats", authenticateToken, transcriptController.getCacheStats.bind(transcriptController))

// Manual cleanup endpoint (admin/debug)
router.post("/cache/cleanup", authenticateToken, transcriptController.cleanupCache.bind(transcriptController))

// Get transcript processing status
router.get("/:id/status", transcriptController.getStatus.bind(transcriptController))

// Delete transcript (requires authentication)
router.delete("/:id", authenticateToken, transcriptController.delete.bind(transcriptController))

// Export transcript (requires authentication)
router.get("/:id/export/:format", authenticateToken, transcriptController.export.bind(transcriptController))

module.exports = router
