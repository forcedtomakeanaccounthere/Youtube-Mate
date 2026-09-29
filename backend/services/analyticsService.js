const ShortenedUrl = require("../models/ShortenedUrl")
const UrlAnalytics = require("../models/UrlAnalytics")
const geoip = require("geoip-lite")

/**
 * Parse a user agent string into device/browser/OS info
 */
const parseUserAgent = (userAgent) => {
  const ua = userAgent.toLowerCase()

  // Detect device type
  let deviceType = "desktop"
  if (/mobile|android|iphone|ipad|phone/i.test(ua)) {
    deviceType = "mobile"
  } else if (/tablet|ipad/i.test(ua)) {
    deviceType = "tablet"
  }

  // Detect browser
  let browser = "unknown"
  if (ua.includes("chrome") && !ua.includes("edg")) {
    browser = "Chrome"
  } else if (ua.includes("firefox")) {
    browser = "Firefox"
  } else if (ua.includes("safari") && !ua.includes("chrome")) {
    browser = "Safari"
  } else if (ua.includes("edg")) {
    browser = "Edge"
  } else if (ua.includes("opera") || ua.includes("opr")) {
    browser = "Opera"
  }

  // Detect OS
  let os = "unknown"
  if (ua.includes("windows")) {
    os = "Windows"
  } else if (ua.includes("mac")) {
    os = "macOS"
  } else if (ua.includes("linux")) {
    os = "Linux"
  } else if (ua.includes("android")) {
    os = "Android"
  } else if (ua.includes("ios") || ua.includes("iphone") || ua.includes("ipad")) {
    os = "iOS"
  }

  return {
    type: deviceType,
    browser,
    os,
  }
}

/**
 * Resolve country/region/city/timezone from an IP address
 */
const getLocationFromIP = (ip) => {
  const emptyLocation = {
    country: null,
    region: null,
    city: null,
    timezone: null,
  }

  try {
    // Handle localhost and private IPs
    if (ip === "::1" || ip === "127.0.0.1" || ip.startsWith("192.168.") || ip.startsWith("10.")) {
      return emptyLocation
    }

    const geo = geoip.lookup(ip)
    if (!geo) {
      return emptyLocation
    }

    return {
      country: geo.country,
      region: geo.region,
      city: geo.city,
      timezone: geo.timezone,
    }
  } catch (error) {
    console.error("Error getting location from IP:", error)
    return emptyLocation
  }
}

/**
 * Analytics Service
 * Handles business logic for URL redirect tracking and analytics retrieval
 */
class AnalyticsService {
  /**
   * Handle short URL redirect with analytics tracking
   */
  async handleRedirect(shortCode, req) {
    // Find the URL and increment click count
    const urlDoc = await ShortenedUrl.findOneAndUpdate(
      { shortCode },
      { $inc: { clicks: 1 } },
      { new: true }
    )

    if (!urlDoc) {
      throw new Error("URL not found")
    }

    // Check if URL has expired
    if (urlDoc.expiresAt && new Date() > urlDoc.expiresAt) {
      throw new Error("URL has expired")
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
        await this.trackClick(urlDoc._id, req)
      } catch (analyticsError) {
        console.error("Error tracking analytics:", analyticsError)
        // Don't fail the redirect if analytics fails
      }
    }

    return { redirectUrl, urlDoc }
  }

  /**
   * Track a click with detailed analytics
   */
  async trackClick(shortUrlId, req) {
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
      shortUrlId,
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
    return analytics
  }

  /**
   * Get click history for a URL
   */
  async getClickHistory(urlId, userId, options = {}) {
    const { page = 1, limit = 10 } = options

    // Verify ownership
    const url = await ShortenedUrl.findOne({ _id: urlId, userId })
    if (!url) {
      throw new Error("URL not found or access denied")
    }

    const skip = (page - 1) * limit

    const clicks = await UrlAnalytics.find({ shortUrlId: urlId })
      .sort({ clickedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean()

    const total = await UrlAnalytics.countDocuments({ shortUrlId: urlId })

    return {
      clicks,
      pagination: {
        current: Number.parseInt(page),
        pages: Math.ceil(total / limit),
        total,
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    }
  }

  /**
   * Get click summary statistics
   */
  async getClickSummary(urlId, userId) {
    // Verify ownership
    const url = await ShortenedUrl.findOne({ _id: urlId, userId })
    if (!url) {
      throw new Error("URL not found or access denied")
    }

    const totalClicks = await UrlAnalytics.countDocuments({ shortUrlId: urlId })

    // Get unique visitors (by IP)
    const uniqueVisitors = await UrlAnalytics.distinct("ipAddress", { shortUrlId: urlId })

    // Get clicks by date (last 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const clicksByDate = await UrlAnalytics.aggregate([
      {
        $match: {
          shortUrlId: url._id,
          clickedAt: { $gte: thirtyDaysAgo },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$clickedAt" },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ])

    // Get clicks in last 24 hours
    const oneDayAgo = new Date()
    oneDayAgo.setDate(oneDayAgo.getDate() - 1)

    const clicksLast24h = await UrlAnalytics.countDocuments({
      shortUrlId: urlId,
      clickedAt: { $gte: oneDayAgo },
    })

    return {
      totalClicks,
      uniqueVisitors: uniqueVisitors.length,
      clicksLast24h,
      clicksByDate: clicksByDate.map((item) => ({
        date: item._id,
        clicks: item.count,
      })),
    }
  }

  /**
   * Get geographic breakdown
   */
  async getGeoBreakdown(urlId, userId) {
    // Verify ownership
    const url = await ShortenedUrl.findOne({ _id: urlId, userId })
    if (!url) {
      throw new Error("URL not found or access denied")
    }

    // Group by country
    const byCountry = await UrlAnalytics.aggregate([
      { $match: { shortUrlId: url._id, country: { $ne: null } } },
      {
        $group: {
          _id: "$country",
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ])

    // Group by city
    const byCity = await UrlAnalytics.aggregate([
      { $match: { shortUrlId: url._id, city: { $ne: null } } },
      {
        $group: {
          _id: { city: "$city", country: "$country" },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ])

    return {
      countries: byCountry.map((item) => ({
        country: item._id,
        clicks: item.count,
      })),
      cities: byCity.map((item) => ({
        city: item._id.city,
        country: item._id.country,
        clicks: item.count,
      })),
    }
  }

  /**
   * Get device/browser breakdown
   */
  async getDeviceBreakdown(urlId, userId) {
    // Verify ownership
    const url = await ShortenedUrl.findOne({ _id: urlId, userId })
    if (!url) {
      throw new Error("URL not found or access denied")
    }

    // Group by device type
    const byDeviceType = await UrlAnalytics.aggregate([
      { $match: { shortUrlId: url._id } },
      {
        $group: {
          _id: "$device.type",
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ])

    // Group by browser
    const byBrowser = await UrlAnalytics.aggregate([
      { $match: { shortUrlId: url._id } },
      {
        $group: {
          _id: "$device.browser",
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ])

    // Group by OS
    const byOS = await UrlAnalytics.aggregate([
      { $match: { shortUrlId: url._id } },
      {
        $group: {
          _id: "$device.os",
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ])

    return {
      deviceTypes: byDeviceType.map((item) => ({
        type: item._id || "unknown",
        clicks: item.count,
      })),
      browsers: byBrowser.map((item) => ({
        browser: item._id || "unknown",
        clicks: item.count,
      })),
      operatingSystems: byOS.map((item) => ({
        os: item._id || "unknown",
        clicks: item.count,
      })),
    }
  }

  /**
   * Get analytics overview for user
   */
  async getAnalyticsOverview(userId) {
    // Get all user's URLs
    const urls = await ShortenedUrl.find({ userId, isActive: true }).select("_id clicks")

    const totalUrls = urls.length
    const totalClicks = urls.reduce((sum, url) => sum + (url.clicks || 0), 0)

    // Get analytics for all user's URLs
    const urlIds = urls.map((url) => url._id)

    // Get unique visitors across all URLs
    const uniqueVisitors = await UrlAnalytics.distinct("ipAddress", {
      shortUrlId: { $in: urlIds },
    })

    // Get clicks in last 7 days
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const clicksLast7Days = await UrlAnalytics.countDocuments({
      shortUrlId: { $in: urlIds },
      clickedAt: { $gte: sevenDaysAgo },
    })

    // Get top performing URLs
    const topUrls = urls
      .sort((a, b) => (b.clicks || 0) - (a.clicks || 0))
      .slice(0, 5)
      .map((url) => ({
        id: url._id,
        clicks: url.clicks || 0,
      }))

    // Get detailed info for top URLs
    const topUrlsDetailed = await ShortenedUrl.find({
      _id: { $in: topUrls.map((u) => u.id) },
    })
      .select("shortCode customAlias videoData.title clicks")
      .lean()

    return {
      totalUrls,
      totalClicks,
      uniqueVisitors: uniqueVisitors.length,
      clicksLast7Days,
      topUrls: topUrlsDetailed.map((url) => ({
        id: url._id,
        shortCode: url.shortCode,
        customAlias: url.customAlias,
        title: url.videoData?.title || "Untitled",
        clicks: url.clicks || 0,
      })),
    }
  }
}

module.exports = new AnalyticsService()
