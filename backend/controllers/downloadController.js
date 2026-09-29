const downloadService = require("../services/downloadService")
const fs = require("fs")
const path = require("path")

/**
 * Download Controller
 * Handles HTTP requests/responses for download-related endpoints
 */
class DownloadController {
  /**
   * Get download history
   * GET /api/downloads/history
   */
  async getHistory(req, res) {
    try {
      const filters = {
        page: req.query.page,
        limit: req.query.limit,
        format: req.query.format,
      }

      const userId = req.user ? req.user._id : null
      const ipAddress = req.ip

      const result = await downloadService.getDownloadHistory(filters, userId, ipAddress)
      res.json(result)
    } catch (error) {
      console.error("Error fetching download history:", error)
      res.status(500).json({ error: "Failed to fetch download history" })
    }
  }

  /**
   * Get download by ID
   * GET /api/downloads/:id
   */
  async getDownloadById(req, res) {
    try {
      const userId = req.user ? req.user._id : null
      const ipAddress = req.ip

      const download = await downloadService.getDownloadById(req.params.id, userId, ipAddress)
      res.json(download)
    } catch (error) {
      console.error("Error fetching download:", error)
      
      if (error.message === "Download not found") {
        return res.status(404).json({ error: error.message })
      }
      if (error.message === "Access denied") {
        return res.status(403).json({ error: error.message })
      }
      
      res.status(500).json({ error: "Failed to fetch download" })
    }
  }

  /**
   * Get available formats for a video
   * POST /api/downloads/formats
   */
  async getFormats(req, res) {
    try {
      const { youtube_url } = req.body
      
      if (!youtube_url) {
        return res.status(400).json({ error: "YouTube URL is required" })
      }

      const userEmail = req.user ? req.user.email : null
      const formats = await downloadService.getVideoFormats(youtube_url, userEmail)
      
      res.json(formats)
    } catch (error) {
      console.error("Error getting available formats:", error)
      res.status(500).json({ error: "Failed to get available formats" })
    }
  }

  /**
   * Get audio preview stream
   * GET /api/downloads/preview/:videoId
   */
  async getPreview(req, res) {
    try {
      const { videoId } = req.params
      await downloadService.streamVideoPreview(videoId, req, res)
    } catch (error) {
      console.error("Error getting audio preview:", error)
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to get audio preview" })
      }
    }
  }

  /**
   * Serve downloaded file
   * GET /api/downloads/file/:id
   */
  async serveFile(req, res) {
    try {
      const userId = req.user ? req.user._id : null
      const ipAddress = req.ip

      const download = await downloadService.getDownloadById(req.params.id, userId, ipAddress)

      if (download.status !== "completed" || !download.file_path) {
        return res.status(400).json({ error: "File not ready for download" })
      }

      if (!fs.existsSync(download.file_path)) {
        return res.status(404).json({ error: "File not found on disk" })
      }

      const filename = path.basename(download.file_path)
      const stat = fs.statSync(download.file_path)
      
      res.setHeader("Content-Disposition", `attachment; filename="${download.title || filename}"`)
      res.setHeader("Content-Length", stat.size)
      res.setHeader("Content-Type", "application/octet-stream")

      const fileStream = fs.createReadStream(download.file_path)
      fileStream.pipe(res)
    } catch (error) {
      console.error("Error serving file:", error)
      
      if (error.message === "Download not found") {
        return res.status(404).json({ error: error.message })
      }
      if (error.message === "Access denied") {
        return res.status(403).json({ error: error.message })
      }
      
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to serve file" })
      }
    }
  }

  /**
   * Create new download
   * POST /api/downloads
   */
  async createDownload(req, res) {
    try {
      const userId = req.user ? req.user._id : null
      const ipAddress = req.ip
      const userEmail = req.user ? req.user.email : null

      const downloadData = {
        ...req.body,
        options: {
          ...req.body.options,
          userEmail,
        },
      }

      const download = await downloadService.createDownload(downloadData, userId, ipAddress)
      res.status(201).json(download)
    } catch (error) {
      console.error("Error creating download:", error)
      res.status(500).json({ error: error.message || "Failed to create download" })
    }
  }

  /**
   * Delete download
   * DELETE /api/downloads/:id
   */
  async deleteDownload(req, res) {
    try {
      const userId = req.user ? req.user._id : null
      const ipAddress = req.ip

      const result = await downloadService.deleteDownload(req.params.id, userId, ipAddress)
      res.json(result)
    } catch (error) {
      console.error("Error deleting download:", error)
      
      if (error.message === "Download not found") {
        return res.status(404).json({ error: error.message })
      }
      if (error.message === "Access denied") {
        return res.status(403).json({ error: error.message })
      }
      
      res.status(500).json({ error: "Failed to delete download" })
    }
  }

  /**
   * Get download statistics
   * GET /api/downloads/stats
   */
  async getStats(req, res) {
    try {
      const userId = req.user ? req.user._id : null
      const ipAddress = req.ip

      const stats = await downloadService.getDownloadStats(userId, ipAddress)
      res.json(stats)
    } catch (error) {
      console.error("Error fetching download stats:", error)
      res.status(500).json({ error: "Failed to fetch download statistics" })
    }
  }

  /**
   * Retry failed download
   * POST /api/downloads/:id/retry
   */
  async retryDownload(req, res) {
    try {
      const userId = req.user ? req.user._id : null
      const ipAddress = req.ip

      const download = await downloadService.retryDownload(req.params.id, userId, ipAddress)
      res.json(download)
    } catch (error) {
      console.error("Error retrying download:", error)
      
      if (error.message === "Download not found") {
        return res.status(404).json({ error: error.message })
      }
      if (error.message === "Access denied" || error.message === "Only failed downloads can be retried") {
        return res.status(403).json({ error: error.message })
      }
      
      res.status(500).json({ error: "Failed to retry download" })
    }
  }
}

module.exports = new DownloadController()
