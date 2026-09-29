const express = require("express")
const router = express.Router()
const { optionalAuth } = require("../middleware/auth")
const { rateLimiter } = require("../middleware/rateLimiter")
const { validateDownloadRequest } = require("../middleware/validation")
const downloadController = require("../controllers/downloadController")

/**
 * Download Routes
 *
 * All business logic lives in:
 * - controllers/downloadController.js (HTTP handling)
 * - services/downloadService.js (business logic)
 * - utils/downloadProcessor.js (low-level yt-dlp operations)
 *
 * Routes only handle URL mapping and middleware application.
 *
 * NOTE: specific single-segment GET paths (/history, /stats) MUST be
 * registered before GET /:id, otherwise Express captures them as :id.
 */

// Get user's download history
router.get("/history", optionalAuth, downloadController.getHistory.bind(downloadController))

// Get download statistics
router.get("/stats", optionalAuth, downloadController.getStats.bind(downloadController))

// Get available formats for a video
router.post("/formats", rateLimiter, optionalAuth, downloadController.getFormats.bind(downloadController))

// Get audio preview stream
router.get("/preview/:videoId", downloadController.getPreview.bind(downloadController))

// Create new download (requires validation)
router.post("/", rateLimiter, optionalAuth, validateDownloadRequest, downloadController.createDownload.bind(downloadController))

// Get download by ID
router.get("/:id", optionalAuth, downloadController.getDownloadById.bind(downloadController))

// Serve downloaded file
router.get("/file/:id", optionalAuth, downloadController.serveFile.bind(downloadController))

// Delete download
router.delete("/:id", optionalAuth, downloadController.deleteDownload.bind(downloadController))

// Retry failed download
router.post("/:id/retry", optionalAuth, downloadController.retryDownload.bind(downloadController))

module.exports = router
