const path = require("path")
const Download = require("../models/Download")
const downloadProcessor = require("../utils/downloadProcessor")
const { shouldEnqueueDownloads, enqueueDownload } = require("./queueService")
const youtubeService = require("./youtubeService")

/**
 * Download Service
 * Handles all download-related business logic
 * Uses downloadProcessor for low-level yt-dlp operations
 */
class DownloadService {
  /**
   * Get download history for a user or IP address
   */
  async getDownloadHistory(filters = {}, userId = null, ipAddress = null) {
    const {
      page = 1,
      limit = 20,
      format = null,
    } = filters

    const pageNum = Number.parseInt(page)
    const limitNum = Number.parseInt(limit)
    const skip = (pageNum - 1) * limitNum

    const query = userId ? { user_id: userId } : { ip_address: ipAddress }
    
    // Add format filter if provided
    if (format) {
      query.format = format
    }

    const downloads = await Download.find(query)
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limitNum)
      .populate("user_id", "username email")

    const total = await Download.countDocuments(query)

    return {
      downloads,
      pagination: {
        current_page: pageNum,
        total_pages: Math.ceil(total / limitNum),
        total_items: total,
        items_per_page: limitNum,
      },
    }
  }

  /**
   * Get download by ID
   */
  async getDownloadById(downloadId, userId = null, ipAddress = null) {
    const download = await Download.findById(downloadId)

    if (!download) {
      throw new Error("Download not found")
    }

    // Check if user owns this download or it's from same IP
    if (userId && download.user_id && !download.user_id.equals(userId)) {
      throw new Error("Access denied")
    } else if (!userId && download.ip_address !== ipAddress) {
      throw new Error("Access denied")
    }

    return download
  }

  /**
   * Get available formats for a video using downloadProcessor
   */
  async getVideoFormats(youtubeUrl, userEmail = null) {
    return await downloadProcessor.getAvailableFormats(youtubeUrl, userEmail)
  }

  /**
   * Create a new download request
   */
  async createDownload(downloadData, userId = null, ipAddress = null, userAgent = null) {
    const { youtube_url, format, quality, options = {} } = downloadData

    // Validate YouTube URL
    const videoId = downloadProcessor.extractVideoId(youtube_url)
    if (!videoId) {
      throw new Error("Invalid YouTube URL")
    }

    // Get video info using downloadProcessor
    const videoInfo = await downloadProcessor.getVideoInfo(youtube_url, options.userEmail)

    // Create download record — the schema requires video_id AND user_agent
    // (both were dropped in an earlier refactor, which 400'd every download)
    const download = new Download({
      user_id: userId,
      ip_address: ipAddress,
      user_agent: userAgent || "unknown",
      youtube_url,
      video_id: videoId,
      youtube_id: videoId,
      title: videoInfo.title,
      format,
      quality,
      status: "pending",
      metadata: {
        // title lives in metadata — the history cards read
        // download.metadata.title ('Unknown Title' otherwise)
        title: videoInfo.title,
        thumbnail: videoInfo.thumbnail,
        duration: videoInfo.duration,
        channel: videoInfo.uploader,
      },
    })

    await download.save()

    // Start download process asynchronously
    this._processDownloadAsync(download._id, downloadData, options)

    return download
  }

  /**
   * Process download asynchronously using downloadProcessor
   */
  async _processDownloadAsync(downloadId, downloadData, options = {}) {
    try {
      // Update status to processing
      await Download.findByIdAndUpdate(downloadId, {
        status: "processing",
        started_at: new Date(),
      })

      // Process download using downloadProcessor
      const result = await downloadProcessor.processDownload(downloadData)

      // Update download record with result — file_name is what the download
      // pages use for the client-side link filename
      await Download.findByIdAndUpdate(downloadId, {
        status: "completed",
        file_path: result.filepath,
        file_name: result.filename || (result.filepath ? path.basename(result.filepath) : null),
        file_size: result.size,
        completed_at: new Date(),
      })

      return result
    } catch (error) {
      console.error(`Download ${downloadId} failed:`, error)
      
      // Update status to failed
      await Download.findByIdAndUpdate(downloadId, {
        status: "failed",
        error_message: error.message,
        completed_at: new Date(),
      })

      throw error
    }
  }

  /**
   * Download video directly using downloadProcessor
   */
  async downloadVideo(youtubeUrl, options = {}) {
    return await downloadProcessor.downloadVideo(youtubeUrl, options)
  }

  /**
   * Download audio directly using downloadProcessor
   */
  async downloadAudio(youtubeUrl, options = {}) {
    return await downloadProcessor.downloadAudio(youtubeUrl, options)
  }

  /**
   * Stream preview of a video using downloadProcessor
   */
  async streamVideoPreview(videoId, req, res) {
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`
    await downloadProcessor.streamPreview(videoUrl, req, res)
  }

  /**
   * Delete a download
   */
  async deleteDownload(downloadId, userId = null, ipAddress = null) {
    const download = await Download.findById(downloadId)

    if (!download) {
      throw new Error("Download not found")
    }

    // Check ownership
    if (userId && download.user_id && !download.user_id.equals(userId)) {
      throw new Error("Access denied")
    } else if (!userId && download.ip_address !== ipAddress) {
      throw new Error("Access denied")
    }

    // Delete file from disk if exists
    if (download.file_path) {
      const fs = require("fs")
      if (fs.existsSync(download.file_path)) {
        fs.unlinkSync(download.file_path)
      }
    }

    // Delete record from database
    await Download.findByIdAndDelete(downloadId)

    return { message: "Download deleted successfully" }
  }

  /**
   * Get download statistics for user
   */
  async getDownloadStats(userId = null, ipAddress = null) {
    const query = userId ? { user_id: userId } : { ip_address: ipAddress }

    const stats = await Download.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          total_downloads: { $sum: 1 },
          total_size: { $sum: "$file_size" },
          completed: {
            $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] },
          },
          failed: {
            $sum: { $cond: [{ $eq: ["$status", "failed"] }, 1, 0] },
          },
          video_downloads: {
            $sum: { $cond: [{ $eq: ["$format", "video"] }, 1, 0] },
          },
          audio_downloads: {
            $sum: { $cond: [{ $eq: ["$format", "audio"] }, 1, 0] },
          },
        },
      },
    ])

    return stats[0] || {
      total_downloads: 0,
      total_size: 0,
      completed: 0,
      failed: 0,
      video_downloads: 0,
      audio_downloads: 0,
    }
  }

  /**
   * Clean up old downloads (files older than specified hours)
   */
  async cleanupOldDownloads(hoursOld = 24) {
    const cutoffDate = new Date(Date.now() - hoursOld * 60 * 60 * 1000)

    const oldDownloads = await Download.find({
      completed_at: { $lt: cutoffDate },
      status: "completed",
    })

    const fs = require("fs")
    let deletedCount = 0

    for (const download of oldDownloads) {
      try {
        // Delete file from disk
        if (download.file_path && fs.existsSync(download.file_path)) {
          fs.unlinkSync(download.file_path)
        }

        // Delete record from database
        await Download.findByIdAndDelete(download._id)
        deletedCount++
      } catch (error) {
        console.error(`Failed to delete download ${download._id}:`, error)
      }
    }

    return {
      message: `Cleaned up ${deletedCount} old downloads`,
      deletedCount,
    }
  }

  /**
   * Retry a failed download
   */
  async retryDownload(downloadId, userId = null, ipAddress = null) {
    const download = await Download.findById(downloadId)

    if (!download) {
      throw new Error("Download not found")
    }

    // Check ownership
    if (userId && download.user_id && !download.user_id.equals(userId)) {
      throw new Error("Access denied")
    } else if (!userId && download.ip_address !== ipAddress) {
      throw new Error("Access denied")
    }

    // Only retry failed downloads
    if (download.status !== "failed") {
      throw new Error("Only failed downloads can be retried")
    }

    // Reset download status
    await Download.findByIdAndUpdate(downloadId, {
      status: "pending",
      error_message: null,
      started_at: null,
      completed_at: null,
    })

    // Retry download
    const downloadData = {
      youtube_url: download.youtube_url,
      format: download.format,
      quality: download.quality,
    }

    this._processDownloadAsync(downloadId, downloadData, {})

    return download
  }
}

// Public entry point used by workers/downloadWorker.js (BullMQ queue mode)
DownloadService.prototype.processDownload = DownloadService.prototype._processDownloadAsync

module.exports = new DownloadService()
