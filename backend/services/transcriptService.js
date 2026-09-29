const Transcript = require("../models/Transcript")
const { generateTranscript, generateSummary } = require("../utils/transcriptProcessor")
const { indexTranscriptInPinecone } = require("../services/pineconeService")

/**
 * Transcript Service
 * Handles business logic for transcript generation, caching, and management
 */
class TranscriptService {
  /**
   * Get user's transcript history with pagination
   */
  async getUserTranscriptHistory(userId, page = 1, limit = 10) {
    const skip = (page - 1) * limit

    const query = { userId }

    const transcripts = await Transcript.find(query)
      .select("youtubeUrl videoInfo status createdAt statistics")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)

    const total = await Transcript.countDocuments(query)

    return {
      transcripts,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    }
  }

  /**
   * Get specific transcript by ID
   */
  async getTranscriptById(transcriptId, userId) {
    const query = { _id: transcriptId, userId }
    const transcript = await Transcript.findOne(query)

    if (!transcript) {
      throw new Error("Transcript not found")
    }

    // Restore channel object format for frontend compatibility
    const transcriptForResponse = transcript.toObject()
    if (transcriptForResponse.videoInfo && typeof transcriptForResponse.videoInfo.channel === "string") {
      transcriptForResponse.videoInfo.channel = {
        name: transcriptForResponse.videoInfo.channel,
        url: `https://www.youtube.com/channel/unknown`,
        thumbnail: "",
      }
    }

    return transcriptForResponse
  }

  /**
   * Create new transcript or return existing cached one
   */
  async createTranscript(userId, youtubeUrl, language = "en", summaryType = "brief") {
    // Extract video ID
    const videoIdMatch = youtubeUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
    if (!videoIdMatch) {
      throw new Error("Invalid YouTube URL")
    }
    const videoId = videoIdMatch[1]

    // Check for existing valid cached transcript
    const existingTranscript = await Transcript.findOne({
      videoId,
      language,
      status: "completed",
      expiresAt: { $gt: new Date() }, // Not expired
    }).sort({ createdAt: -1 })

    if (existingTranscript) {
      console.log(`Reusing cached transcript for video ${videoId}`)

      // Check if the requested summary type already exists
      const hasSummary = existingTranscript.summary && existingTranscript.summary[summaryType]

      if (!hasSummary) {
        // Generate missing summary type
        console.log(`Generating missing summary type: ${summaryType}`)

        try {
          const newSummary = await generateSummary(
            existingTranscript.content,
            summaryType,
            language,
            existingTranscript.videoInfo
          )

          // Update the transcript with the new summary
          existingTranscript.summary = {
            ...existingTranscript.summary,
            ...newSummary,
          }

          // Extend cache expiration by 12 hours
          existingTranscript.expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000)
          await existingTranscript.save()

          console.log(`Added ${summaryType} summary to cached transcript`)
        } catch (summaryError) {
          console.error(`Failed to generate ${summaryType} summary:`, summaryError.message)
        }
      } else {
        console.log(`Using cached summary for type: ${summaryType}`)

        // Extend cache expiration by 12 hours
        existingTranscript.expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000)
        await existingTranscript.save()
      }

      // Restore channel object format
      const transcriptForResponse = existingTranscript.toObject()
      if (transcriptForResponse.videoInfo && typeof transcriptForResponse.videoInfo.channel === "string") {
        transcriptForResponse.videoInfo.channel = {
          name: transcriptForResponse.videoInfo.channel,
          url: `https://www.youtube.com/channel/unknown`,
          thumbnail: "",
        }
      }

      return transcriptForResponse
    }

    // Check if transcript is currently being processed
    const processingTranscript = await Transcript.findOne({
      videoId,
      language,
      status: { $in: ["pending", "processing"] },
    })

    if (processingTranscript) {
      return {
        message: "Transcript is being processed",
        transcriptId: processingTranscript._id,
        status: "processing",
      }
    }

    // Create new transcript record
    const transcript = new Transcript({
      userId,
      youtubeUrl,
      videoId,
      language,
      status: "pending",
      videoInfo: {
        title: "Processing...",
        duration: "0:00",
        thumbnail: "",
        channel: "Unknown",
        videoId,
      },
      expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000), // 12 hours
    })

    await transcript.save()

    // Start processing asynchronously
    this.processTranscriptAsync(transcript._id, summaryType, language)

    return {
      message: "Transcript processing started",
      transcriptId: transcript._id,
      status: "processing",
    }
  }

  /**
   * Process transcript asynchronously
   */
  async processTranscriptAsync(transcriptId, summaryType, language = "en") {
    try {
      const transcript = await Transcript.findById(transcriptId)
      if (!transcript) return

      // Update status to processing
      transcript.status = "processing"
      transcript.processingProgress = 10
      await transcript.save()

      // Generate transcript
      const result = await generateTranscript(transcript.youtubeUrl, transcript.language || language)

      // Prepare video info for database storage (convert channel object to string)
      const videoInfoForDB = {
        ...result.videoInfo,
        channel: typeof result.videoInfo.channel === "object" ? result.videoInfo.channel.name : result.videoInfo.channel,
      }

      transcript.videoInfo = videoInfoForDB
      transcript.content = result.segments
      transcript.chapters = result.chapters || []
      transcript.transcriptMethod = result.transcriptMethod || "unknown"
      transcript.hasActualCaptions = result.hasActualCaptions || false
      transcript.processingProgress = 60
      await transcript.save()

      // Generate summary (non-fatal)
      try {
        const summaryResult = await generateSummary(
          result.segments,
          summaryType,
          transcript.language || language,
          result.videoInfo,
          result.hasActualCaptions,
          transcript.videoId
        )
        transcript.summary = summaryResult
        transcript.summaryError = null
      } catch (summaryError) {
        console.error(`Summary generation failed: ${summaryError.message}`)
        transcript.summaryError = summaryError.message
      }

      transcript.processingProgress = 90
      await transcript.save()

      // Mark as completed
      transcript.status = "completed"
      transcript.processingProgress = 100
      await transcript.save()

      // Trigger Pinecone indexing in background
      indexTranscriptInPinecone(transcript.videoId, result.segments).catch((err) => {
        console.error(`⚠️ Pinecone indexing failed for ${transcript.videoId}:`, err.message)
      })
    } catch (error) {
      console.error(`Error processing transcript ${transcriptId}:`, error)

      await Transcript.findByIdAndUpdate(transcriptId, {
        status: "failed",
        error: error.message,
        processingProgress: 0,
      })
    }
  }

  /**
   * Regenerate summary with different type
   */
  async regenerateSummary(segments, summaryType, language = "en", videoInfo = null, hasActualCaptions = false, videoId = null) {
    if (!segments || !Array.isArray(segments)) {
      throw new Error("Invalid segments data")
    }

    try {
      const summaryResult = await generateSummary(segments, summaryType, language, videoInfo, hasActualCaptions, videoId)
      return { summary: summaryResult, summaryError: null }
    } catch (summaryError) {
      return { summary: null, summaryError: summaryError.message }
    }
  }

  /**
   * Get transcript cache statistics
   */
  async getCacheStats() {
    const { getTranscriptCacheStats } = require("../jobs/cleanupTranscripts")
    const stats = await getTranscriptCacheStats()

    return {
      ...stats,
      cacheHitRate: stats.total > 0 ? ((stats.active / stats.total) * 100).toFixed(2) + "%" : "0%",
      message: `${stats.active} active cached transcripts, ${stats.expired} expired`,
    }
  }

  /**
   * Manually cleanup expired transcripts
   */
  async cleanupExpiredTranscripts() {
    const { cleanupExpiredTranscripts } = require("../jobs/cleanupTranscripts")
    const deletedCount = await cleanupExpiredTranscripts()

    return {
      message: "Cleanup completed successfully",
      deletedCount,
      timestamp: new Date().toISOString(),
    }
  }

  /**
   * Get transcript processing status
   */
  async getTranscriptStatus(transcriptId) {
    const transcript = await Transcript.findById(transcriptId).select("status processingProgress error summaryError")

    if (!transcript) {
      throw new Error("Transcript not found")
    }

    return {
      status: transcript.status,
      progress: transcript.processingProgress,
      error: transcript.error,
      summaryError: transcript.summaryError || null,
    }
  }

  /**
   * Delete transcript by ID
   */
  async deleteTranscript(transcriptId, userId) {
    const query = { _id: transcriptId, userId }
    const transcript = await Transcript.findOneAndDelete(query)

    if (!transcript) {
      throw new Error("Transcript not found")
    }

    return { message: "Transcript deleted successfully" }
  }

  /**
   * Export transcript in various formats
   */
  async exportTranscript(transcriptId, userId, format) {
    const allowedFormats = ["txt", "json", "srt", "vtt"]

    if (!allowedFormats.includes(format)) {
      throw new Error("Invalid export format")
    }

    const query = { _id: transcriptId, userId }
    const transcript = await Transcript.findOne(query)

    if (!transcript) {
      throw new Error("Transcript not found")
    }

    if (transcript.status !== "completed") {
      throw new Error("Transcript not ready for export")
    }

    const { exportTranscript } = require("../utils/transcriptExporter")
    const exportData = exportTranscript(transcript, format)

    const filename = `transcript_${transcript.videoId}_${Date.now()}.${format}`

    return {
      data: exportData,
      filename,
      contentType: format === "json" ? "application/json" : "text/plain",
    }
  }
}

module.exports = new TranscriptService()
