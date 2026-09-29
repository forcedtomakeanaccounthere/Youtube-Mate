const analyticsService = require("../services/analyticsService")

/**
 * Analytics Controller
 * Handles HTTP requests/responses for analytics endpoints
 */
class AnalyticsController {
  /**
   * Get click history for a URL
   * GET /api/analytics/:id/clicks
   */
  async getClicks(req, res) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Authentication required" })
      }

      const options = {
        page: req.query.page,
        limit: req.query.limit,
      }

      const result = await analyticsService.getClickHistory(req.params.id, req.user.id, options)

      res.json(result)
    } catch (error) {
      console.error("Error fetching click history:", error)

      if (error.message === "URL not found or access denied") {
        return res.status(404).json({ error: error.message })
      }

      res.status(500).json({ error: "Failed to fetch click history" })
    }
  }

  /**
   * Get click summary statistics
   * GET /api/analytics/:id/summary
   */
  async getSummary(req, res) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Authentication required" })
      }

      const summary = await analyticsService.getClickSummary(req.params.id, req.user.id)

      res.json(summary)
    } catch (error) {
      console.error("Error fetching click summary:", error)

      if (error.message === "URL not found or access denied") {
        return res.status(404).json({ error: error.message })
      }

      res.status(500).json({ error: "Failed to fetch click summary" })
    }
  }

  /**
   * Get geographic breakdown
   * GET /api/analytics/:id/geo
   */
  async getGeoBreakdown(req, res) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Authentication required" })
      }

      const geoData = await analyticsService.getGeoBreakdown(req.params.id, req.user.id)

      res.json(geoData)
    } catch (error) {
      console.error("Error fetching geo breakdown:", error)

      if (error.message === "URL not found or access denied") {
        return res.status(404).json({ error: error.message })
      }

      res.status(500).json({ error: "Failed to fetch geo breakdown" })
    }
  }

  /**
   * Get device/browser breakdown
   * GET /api/analytics/:id/devices
   */
  async getDeviceBreakdown(req, res) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Authentication required" })
      }

      const deviceData = await analyticsService.getDeviceBreakdown(req.params.id, req.user.id)

      res.json(deviceData)
    } catch (error) {
      console.error("Error fetching device breakdown:", error)

      if (error.message === "URL not found or access denied") {
        return res.status(404).json({ error: error.message })
      }

      res.status(500).json({ error: "Failed to fetch device breakdown" })
    }
  }

  /**
   * Get analytics overview for user
   * GET /api/analytics/overview
   */
  async getOverview(req, res) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Authentication required" })
      }

      const overview = await analyticsService.getAnalyticsOverview(req.user.id)

      res.json(overview)
    } catch (error) {
      console.error("Error fetching analytics overview:", error)
      res.status(500).json({ error: "Failed to fetch analytics overview" })
    }
  }
}

module.exports = new AnalyticsController()
