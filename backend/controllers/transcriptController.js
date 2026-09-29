const transcriptService = require("../services/transcriptService")

/**
 * Transcript Controller
 * Handles HTTP requests/responses for transcript-related endpoints
 */
class TranscriptController {
  /**
   * Get user's transcript history
   * GET /api/transcripts/history
   */
  async getHistory(req, res) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Authentication required" })
      }

      const page = Number.parseInt(req.query.page) || 1
      const limit = Number.parseInt(req.query.limit) || 10

      const result = await transcriptService.getUserTranscriptHistory(req.user.id, page, limit)

      res.json(result)
    } catch (error) {
      console.error("Error fetching transcript history:", error)
      res.status(500).json({ error: "Failed to fetch transcript history" })
    }
  }

  /**
   * Get specific transcript by ID
   * GET /api/transcripts/:id
   */
  async getById(req, res) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Authentication required" })
      }

      const transcript = await transcriptService.getTranscriptById(req.params.id, req.user.id)

      res.json(transcript)
    } catch (error) {
      console.error("Error fetching transcript:", error)

      if (error.message === "Transcript not found") {
        return res.status(404).json({ error: error.message })
      }

      res.status(500).json({ error: "Failed to fetch transcript" })
    }
  }

  /**
   * Create new transcript
   * POST /api/transcripts
   */
  async create(req, res) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Authentication required" })
      }

      const { youtubeUrl, language = "en", summaryType = "brief" } = req.body

      const result = await transcriptService.createTranscript(req.user.id, youtubeUrl, language, summaryType)

      // If processing started (not cached), return 202 Accepted
      if (result.status === "processing" && result.message === "Transcript processing started") {
        return res.status(202).json(result)
      }

      // Otherwise return cached transcript or processing status
      res.json(result)
    } catch (error) {
      console.error("Error creating transcript:", error)

      if (error.message === "Invalid YouTube URL") {
        return res.status(400).json({ error: error.message })
      }

      res.status(500).json({ error: "Failed to create transcript" })
    }
  }

  /**
   * Regenerate summary with different type
   * POST /api/transcripts/regenerate-summary
   */
  async regenerateSummary(req, res) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Authentication required" })
      }

      const { segments, summaryType, language = "en", videoInfo = null, hasActualCaptions = false, videoId = null } = req.body

      const result = await transcriptService.regenerateSummary(segments, summaryType, language, videoInfo, hasActualCaptions, videoId)

      res.json(result)
    } catch (error) {
      console.error("Error regenerating summary:", error)

      if (error.message === "Invalid segments data") {
        return res.status(400).json({ error: error.message })
      }

      res.status(500).json({ error: "Failed to regenerate summary" })
    }
  }

  /**
   * Get cache statistics
   * GET /api/transcripts/cache/stats
   */
  async getCacheStats(req, res) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Authentication required" })
      }

      const stats = await transcriptService.getCacheStats()

      res.json(stats)
    } catch (error) {
      console.error("Error getting cache stats:", error)
      res.status(500).json({ error: "Failed to get cache statistics" })
    }
  }

  /**
   * Manual cleanup endpoint
   * POST /api/transcripts/cache/cleanup
   */
  async cleanupCache(req, res) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Authentication required" })
      }

      const result = await transcriptService.cleanupExpiredTranscripts()

      res.json(result)
    } catch (error) {
      console.error("Error in manual cleanup:", error)
      res.status(500).json({ error: "Failed to cleanup expired transcripts" })
    }
  }

  /**
   * Get transcript processing status
   * GET /api/transcripts/:id/status
   */
  async getStatus(req, res) {
    try {
      const status = await transcriptService.getTranscriptStatus(req.params.id)

      res.json(status)
    } catch (error) {
      console.error("Error fetching transcript status:", error)

      if (error.message === "Transcript not found") {
        return res.status(404).json({ error: error.message })
      }

      res.status(500).json({ error: "Failed to fetch transcript status" })
    }
  }

  /**
   * Delete transcript
   * DELETE /api/transcripts/:id
   */
  async delete(req, res) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Authentication required" })
      }

      const result = await transcriptService.deleteTranscript(req.params.id, req.user.id)

      res.json(result)
    } catch (error) {
      console.error("Error deleting transcript:", error)

      if (error.message === "Transcript not found") {
        return res.status(404).json({ error: error.message })
      }

      res.status(500).json({ error: "Failed to delete transcript" })
    }
  }

  /**
   * Export transcript in various formats
   * GET /api/transcripts/:id/export/:format
   */
  async export(req, res) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Authentication required" })
      }

      const { format } = req.params
      const result = await transcriptService.exportTranscript(req.params.id, req.user.id, format)

      // Set appropriate headers
      res.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`)
      res.setHeader("Content-Type", result.contentType)
      res.send(result.data)
    } catch (error) {
      console.error("Error exporting transcript:", error)

      if (error.message === "Invalid export format") {
        return res.status(400).json({ error: error.message })
      }
      if (error.message === "Transcript not found") {
        return res.status(404).json({ error: error.message })
      }
      if (error.message === "Transcript not ready for export") {
        return res.status(400).json({ error: error.message })
      }

      res.status(500).json({ error: "Failed to export transcript" })
    }
  }
}

module.exports = new TranscriptController()
