const urlService = require("../services/urlService")

/**
 * URL Controller
 * Handles HTTP requests/responses for URL shortening endpoints
 */
class UrlController {
  /**
   * Create shortened URL
   * POST /api/urls/shorten
   */
  async shorten(req, res) {
    try {
      const { fetchMetaOnly } = req.body

      // If only fetching metadata, do not create a short URL
      if (fetchMetaOnly) {
        const result = await urlService.fetchMetadataOnly(req.body.originalUrl)
        return res.status(200).json(result)
      }

      const userId = req.user?.id || null
      const result = await urlService.createShortenedUrl(userId, req.body)

      res.status(201).json({
        success: true,
        data: result,
      })
    } catch (error) {
      console.error("Error creating shortened URL:", error)

      if (error.message.includes("Custom alias already exists")) {
        return res.status(400).json({
          error: "Custom alias already exists",
          suggestion: error.message.split("Suggestion: ")[1],
        })
      }

      if (error.message.includes("Timestamp exceeds video duration")) {
        return res.status(400).json({
          error: error.message,
        })
      }

      res.status(500).json({
        error: "Failed to create shortened URL",
        message: error.message,
      })
    }
  }

  /**
   * Bulk URL shortening
   * POST /api/urls/bulk-shorten
   */
  async bulkShorten(req, res) {
    try {
      const { urls, domain, analyticsEnabled = true } = req.body
      const userId = req.user?.id || null

      const result = await urlService.bulkShortenUrls(userId, urls, domain, analyticsEnabled)

      res.status(200).json({
        success: true,
        ...result,
      })
    } catch (error) {
      console.error("Error in bulk URL shortening:", error)
      res.status(500).json({
        error: "Failed to process bulk URLs",
        message: error.message,
      })
    }
  }

  /**
   * Get user's URLs
   * GET /api/urls/my-urls
   */
  async getMyUrls(req, res) {
    try {
      const userId = req.user?.id || null
      const options = {
        page: req.query.page,
        limit: req.query.limit,
        search: req.query.search,
        sortBy: req.query.sortBy,
        sortOrder: req.query.sortOrder,
      }

      const result = await urlService.getUserUrls(userId, options)

      res.json({
        success: true,
        data: result,
      })
    } catch (error) {
      console.error("Error fetching user URLs:", error)
      res.status(500).json({
        error: "Failed to fetch URLs",
        message: error.message,
      })
    }
  }

  /**
   * Get single URL details
   * GET /api/urls/:id
   */
  async getById(req, res) {
    try {
      const userId = req.user?.id || null
      const url = await urlService.getUrlById(req.params.id, userId)

      res.json({
        success: true,
        data: url,
      })
    } catch (error) {
      console.error("Error fetching URL:", error)

      if (error.message === "URL not found") {
        return res.status(404).json({ error: error.message })
      }

      if (error.message === "Access denied") {
        return res.status(403).json({ error: error.message })
      }

      res.status(500).json({
        error: "Failed to fetch URL",
        message: error.message,
      })
    }
  }

  /**
   * Update URL
   * PUT /api/urls/:id
   */
  async update(req, res) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Authentication required" })
      }

      const url = await urlService.updateUrl(req.params.id, req.user.id, req.body)

      res.json({
        success: true,
        data: url,
      })
    } catch (error) {
      console.error("Error updating URL:", error)

      if (error.message === "URL not found") {
        return res.status(404).json({ error: error.message })
      }

      if (error.message === "Custom alias already exists") {
        return res.status(400).json({ error: error.message })
      }

      res.status(500).json({
        error: "Failed to update URL",
        message: error.message,
      })
    }
  }

  /**
   * Delete URL
   * DELETE /api/urls/:id
   */
  async delete(req, res) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Authentication required" })
      }

      const result = await urlService.deleteUrl(req.params.id, req.user.id)

      res.json({
        success: true,
        ...result,
      })
    } catch (error) {
      console.error("Error deleting URL:", error)

      if (error.message === "URL not found") {
        return res.status(404).json({ error: error.message })
      }

      res.status(500).json({
        error: "Failed to delete URL",
        message: error.message,
      })
    }
  }
}

module.exports = new UrlController()
