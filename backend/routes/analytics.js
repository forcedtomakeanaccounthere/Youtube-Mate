const express = require("express")
const router = express.Router()
const { authenticateToken } = require("../middleware/auth")
const analyticsController = require("../controllers/analyticsController")

/**
 * Analytics Routes
 * REFACTORED - All routes now use analyticsController
 * 
 * These routes handle analytics retrieval for shortened URLs
 */

// Get analytics overview for user
router.get("/overview", authenticateToken, analyticsController.getOverview.bind(analyticsController))

// Get click history for a specific URL
router.get("/:id/clicks", authenticateToken, analyticsController.getClicks.bind(analyticsController))

// Get click summary statistics
router.get("/:id/summary", authenticateToken, analyticsController.getSummary.bind(analyticsController))

// Get geographic breakdown
router.get("/:id/geo", authenticateToken, analyticsController.getGeoBreakdown.bind(analyticsController))

// Get device/browser breakdown
router.get("/:id/devices", authenticateToken, analyticsController.getDeviceBreakdown.bind(analyticsController))

module.exports = router
