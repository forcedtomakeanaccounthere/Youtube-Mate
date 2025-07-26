const express = require("express")
const router = express.Router()
const ShortenedUrl = require("../models/ShortenedUrl")
const UrlAnalytics = require("../models/UrlAnalytics")
const { parseUserAgent, getLocationFromIP } = require("../utils/analytics")

// Handle short URL redirects
router.get("/:shortCode", async (req, res) => {
  try {
    const { shortCode } = req.params

    // Find the URL and increment click count
    const urlDoc = await ShortenedUrl.findOneAndUpdate(
      { shortCode },
      {
        $inc: { clicks: 1 }
        // Remove the clickHistory push for now to avoid potential issues
      },
      { new: true }
    )

    if (!urlDoc) {
      return res.status(404).json({ error: "URL not found" })
    }

    // Check if URL has expired
    if (urlDoc.expiresAt && new Date() > urlDoc.expiresAt) {
      return res.status(410).json({ error: "URL has expired" })
    }

    // Build the redirect URL with timestamp if provided
    let redirectUrl = urlDoc.originalUrl
    if (urlDoc.timestampStart && urlDoc.timestampStart > 0) {
      const url = new URL(redirectUrl)
      url.searchParams.set("t", `${urlDoc.timestampStart}s`)
      redirectUrl = url.toString()
    }

    // Track analytics if enabled
    if (urlDoc.analyticsEnabled) {
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
          shortUrlId: urlDoc._id,
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