const express = require("express")
const router = express.Router()
const { validateUrl, validateBulkUrls } = require("../middleware/validation")
const { authenticateToken, optionalAuth } = require("../middleware/auth")
const urlController = require("../controllers/urlController")

/**
 * URL Routes
 * REFACTORED - All routes now use urlController
 * 
 * These routes handle URL shortening, QR code generation, and URL management
 */

// Create shortened URL
router.post("/shorten", optionalAuth, validateUrl, urlController.shorten.bind(urlController))

// Bulk URL shortening
router.post("/bulk-shorten", optionalAuth, validateBulkUrls, urlController.bulkShorten.bind(urlController))

// Get user's URLs
router.get("/my-urls", optionalAuth, urlController.getMyUrls.bind(urlController))

// Get single URL details
router.get("/:id", optionalAuth, urlController.getById.bind(urlController))

// Update URL
router.put("/:id", authenticateToken, urlController.update.bind(urlController))

// Delete URL
router.delete("/:id", authenticateToken, urlController.delete.bind(urlController))

module.exports = router
