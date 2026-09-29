const express = require("express")
const router = express.Router()
const analyticsService = require("../services/analyticsService")

/**
 * Redirect Routes
 * REFACTORED - Uses analyticsService for redirect and tracking
 * 
 * This route handles short URL redirects with analytics tracking
 */

// Handle short URL redirects
router.get("/:shortCode", async (req, res) => {
  try {
    const { shortCode } = req.params

    const { redirectUrl } = await analyticsService.handleRedirect(shortCode, req)

    // Redirect to the original URL
    res.redirect(302, redirectUrl)
  } catch (error) {
    console.error("Error handling redirect:", error)

    if (error.message === "URL not found") {
      return res.status(404).json({ error: "URL not found" })
    }

    if (error.message === "URL has expired") {
      return res.status(410).json({ error: "URL has expired" })
    }

    res.status(500).json({
      error: "Internal server error",
      message: "An error occurred while processing your request.",
    })
  }
})

module.exports = router
