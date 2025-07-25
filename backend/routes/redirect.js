const express = require("express")
const router = express.Router()
const ShortenedUrl = require("../models/ShortenedUrl")
const UrlAnalytics = require("../models/UrlAnalytics")
const { parseUserAgent, getLocationFromIP } = require("../utils/analytics")

// Handle short URL redirects
router.get("/:shortCode", async (req, res) => {
  try {
    const { shortCode } = req.params

    // Find the URL by short code or custom alias
    const url = await ShortenedUrl.findOne({
      $or: [{ shortCode }, { customAlias: shortCode }],
      isActive: true,
    })

    if (!url) {
      return res.status(404).json({
        error: "Short URL not found",
        message: "The requested short URL does not exist or has been deactivated.",
      })
    }

    // Check if URL is expired
    if (url.isExpired()) {
      return res.status(410).json({
        error: "Short URL expired",
        message: "This short URL has expired and is no longer valid.",
      })
    }

    // Build the redirect URL with timestamp if specified
    let redirectUrl = url.originalUrl
    if (url.timestampStart > 0) {
      const separator = redirectUrl.includes("?") ? "&" : "?"
      redirectUrl += `${separator}t=${url.timestampStart}`
    }

    // Track analytics if enabled
    if (url.analyticsEnabled) {
      try {
        // Parse user agent and get location
        const userAgent = req.get("User-Agent") || ""
        const deviceInfo = parseUserAgent(userAgent)
        const locationInfo = getLocationFromIP(req.ip)

        // Extract UTM parameters
        const utm = {
          source: req.query.utm_source || null,
          medium: req.query.utm_medium || null,
          campaign: req.query.utm_campaign || null,
          term: req.query.utm_term || null,
          content: req.query.utm_content || null,
        }

        // Create analytics record
        const analytics = new UrlAnalytics({
          shortUrlId: url._id,
          ipAddress: req.ip,
          userAgent,
          referer: req.get("Referer") || null,
          country: locationInfo.country,
          region: locationInfo.region,
          city: locationInfo.city,
          timezone: locationInfo.timezone,
          device: deviceInfo,
          utm,
        })

        await analytics.save()

        // Increment click count
        await url.incrementClicks()
      } catch (analyticsError) {
        console.error("Error tracking analytics:", analyticsError)
        // Don't fail the redirect if analytics fails
      }
    }

    // Redirect to the original URL
    res.redirect(302, redirectUrl)
  } catch (error) {
    console.error("Error handling redirect:", error)
    res.status(500).json({
      error: "Internal server error",
      message: "An error occurred while processing your request.",
    })
  }
})

module.exports = router