const express = require("express")
const router = express.Router()
const Transcript = require("../models/Transcript")
const { authenticateToken, optionalAuth } = require("../middleware/auth")
const { validateTranscriptRequest } = require("../middleware/validation")
const { generateTranscript, generateSummary } = require("../utils/transcriptProcessor")
const rateLimit = require("express-rate-limit")

// Rate limiting for transcript generation
const transcriptLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 transcript requests per windowMs
  message: {
    error: "Too many transcript requests, please try again later.",
    retryAfter: 15 * 60 * 1000,
  },
  standardHeaders: true,
  legacyHeaders: false,
})

// Get user's transcript history (requires authentication)
router.get("/history", authenticateToken, async (req, res) => {
  try {
    const page = Number.parseInt(req.query.page) || 1
    const limit = Number.parseInt(req.query.limit) || 10
    const skip = (page - 1) * limit

    const query = { userId: req.user.id } // Now guaranteed to have user

    const transcripts = await Transcript.find(query)
      .select("youtubeUrl videoInfo status createdAt statistics")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)

    const total = await Transcript.countDocuments(query)

    res.json({
      transcripts,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error("Error fetching transcript history:", error)
    res.status(500).json({ error: "Failed to fetch transcript history" })
  }
})

// Get specific transcript (requires authentication)
router.get("/:id", authenticateToken, async (req, res) => {
  try {
    const query = { _id: req.params.id, userId: req.user.id } // Now guaranteed to have user

    const transcript = await Transcript.findOne(query)

    if (!transcript) {
      return res.status(404).json({ error: "Transcript not found" })
    }

    // Restore channel object format for frontend compatibility
    const transcriptForResponse = transcript.toObject()
    if (transcriptForResponse.videoInfo && typeof transcriptForResponse.videoInfo.channel === 'string') {
      transcriptForResponse.videoInfo.channel = {
        name: transcriptForResponse.videoInfo.channel,
        url: `https://www.youtube.com/channel/unknown`,
        thumbnail: ''
      }
    }

    res.json(transcriptForResponse)
  } catch (error) {
    console.error("Error fetching transcript:", error)
    res.status(500).json({ error: "Failed to fetch transcript" })
  }
})

// Create new transcript
router.post("/", transcriptLimiter, authenticateToken, validateTranscriptRequest, async (req, res) => {
  try {
    const { youtubeUrl, language = "en", summaryType = "brief" } = req.body

    // Extract video ID
    const videoIdMatch = youtubeUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
    if (!videoIdMatch) {
      return res.status(400).json({ error: "Invalid YouTube URL" })
    }
    const videoId = videoIdMatch[1]

    // Check if a valid (non-expired) transcript exists for this video and language
    const existingTranscript = await Transcript.findOne({
      videoId,
      language,
      status: "completed",
      expiresAt: { $gt: new Date() }, // Not expired
    }).sort({ createdAt: -1 }) // Get most recent

    if (existingTranscript) {
      console.log(`♻️ Reusing cached transcript for video ${videoId}`)
      
      // Check if the requested summary type already exists
      const hasSummary = existingTranscript.summary && existingTranscript.summary[summaryType]
      
      if (!hasSummary) {
        // Need to generate the missing summary type
        console.log(`📝 Generating missing summary type: ${summaryType}`)
        
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
            ...newSummary
          }
          
          // Update expiresAt to extend cache by 12 hours from now
          existingTranscript.expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000)
          await existingTranscript.save()
          
          console.log(`✅ Added ${summaryType} summary to cached transcript`)
        } catch (summaryError) {
          console.error(`⚠️ Failed to generate ${summaryType} summary:`, summaryError.message)
          // Still return the transcript even if summary generation fails
        }
      } else {
        console.log(`✅ Using cached summary for type: ${summaryType}`)
        
        // Extend cache expiration by 12 hours
        existingTranscript.expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000)
        await existingTranscript.save()
      }
      
      // Restore channel object format for frontend compatibility
      const transcriptForResponse = existingTranscript.toObject()
      if (transcriptForResponse.videoInfo && typeof transcriptForResponse.videoInfo.channel === 'string') {
        transcriptForResponse.videoInfo.channel = {
          name: transcriptForResponse.videoInfo.channel,
          url: `https://www.youtube.com/channel/unknown`,
          thumbnail: ''
        }
      }
      
      return res.json(transcriptForResponse)
    }

    // Check if a transcript is currently being processed
    const processingTranscript = await Transcript.findOne({
      videoId,
      language,
      status: { $in: ["pending", "processing"] },
    })

    if (processingTranscript) {
      return res.json({
        message: "Transcript is being processed",
        transcriptId: processingTranscript._id,
        status: "processing",
      })
    }

    // Create new transcript record
    const transcript = new Transcript({
      userId: req.user.id, // Now guaranteed to have user
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
      expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000), // 12 hours from now
    })

    await transcript.save()

    // Start processing asynchronously
    processTranscriptAsync(transcript._id, summaryType, language)

    res.status(202).json({
      message: "Transcript processing started",
      transcriptId: transcript._id,
      status: "processing",
    })
  } catch (error) {
    console.error("Error creating transcript:", error)
    res.status(500).json({ error: "Failed to create transcript" })
  }
})

// Regenerate summary with different type (requires authentication)
router.post("/regenerate-summary", authenticateToken, async (req, res) => {
  try {
    const { segments, summaryType, language = 'en', videoInfo = null } = req.body

    if (!segments || !Array.isArray(segments)) {
      return res.status(400).json({ error: "Invalid segments data" })
    }

    // Generate new summary
    const summaryResult = await generateSummary(segments, summaryType, language, videoInfo)
    
    res.json(summaryResult)
  } catch (error) {
    console.error("Error regenerating summary:", error)
    res.status(500).json({ error: "Failed to regenerate summary" })
  }
})

// Get cache statistics (admin/debug endpoint)
router.get("/cache/stats", authenticateToken, async (req, res) => {
  try {
    const { getTranscriptCacheStats } = require("../jobs/cleanupTranscripts")
    const stats = await getTranscriptCacheStats()
    
    res.json({
      ...stats,
      cacheHitRate: stats.total > 0 ? ((stats.active / stats.total) * 100).toFixed(2) + '%' : '0%',
      message: `${stats.active} active cached transcripts, ${stats.expired} expired`
    })
  } catch (error) {
    console.error("Error getting cache stats:", error)
    res.status(500).json({ error: "Failed to get cache statistics" })
  }
})

// Manual cleanup endpoint (admin/debug)
router.post("/cache/cleanup", authenticateToken, async (req, res) => {
  try {
    const { cleanupExpiredTranscripts } = require("../jobs/cleanupTranscripts")
    const deletedCount = await cleanupExpiredTranscripts()
    
    res.json({
      message: "Cleanup completed successfully",
      deletedCount,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error("Error in manual cleanup:", error)
    res.status(500).json({ error: "Failed to cleanup expired transcripts" })
  }
})

// Get transcript processing status
router.get("/:id/status", async (req, res) => {
  try {
    const transcript = await Transcript.findById(req.params.id).select("status processingProgress error")

    if (!transcript) {
      return res.status(404).json({ error: "Transcript not found" })
    }

    res.json({
      status: transcript.status,
      progress: transcript.processingProgress,
      error: transcript.error,
    })
  } catch (error) {
    console.error("Error fetching transcript status:", error)
    res.status(500).json({ error: "Failed to fetch transcript status" })
  }
})

// Delete transcript (requires authentication)
router.delete("/:id", authenticateToken, async (req, res) => {
  try {
    const query = { _id: req.params.id, userId: req.user.id } // Now guaranteed to have user

    const transcript = await Transcript.findOneAndDelete(query)

    if (!transcript) {
      return res.status(404).json({ error: "Transcript not found" })
    }

    res.json({ message: "Transcript deleted successfully" })
  } catch (error) {
    console.error("Error deleting transcript:", error)
    res.status(500).json({ error: "Failed to delete transcript" })
  }
})

// Export transcript (requires authentication)
router.get("/:id/export/:format", authenticateToken, async (req, res) => {
  try {
    const { format } = req.params
    const allowedFormats = ["txt", "json", "srt", "vtt"]

    if (!allowedFormats.includes(format)) {
      return res.status(400).json({ error: "Invalid export format" })
    }

    const query = { _id: req.params.id, userId: req.user.id } // Now guaranteed to have user

    const transcript = await Transcript.findOne(query)

    if (!transcript) {
      return res.status(404).json({ error: "Transcript not found" })
    }

    if (transcript.status !== "completed") {
      return res.status(400).json({ error: "Transcript not ready for export" })
    }

    const { exportTranscript } = require("../utils/transcriptExporter")
    const exportData = exportTranscript(transcript, format)

    // Set appropriate headers
    const filename = `transcript_${transcript.videoId}_${Date.now()}.${format}`
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`)

    if (format === "json") {
      res.setHeader("Content-Type", "application/json")
    } else {
      res.setHeader("Content-Type", "text/plain")
    }

    res.send(exportData)
  } catch (error) {
    console.error("Error exporting transcript:", error)
    res.status(500).json({ error: "Failed to export transcript" })
  }
})

// Async function to process transcript
async function processTranscriptAsync(transcriptId, summaryType, language = 'en') {
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
      channel: typeof result.videoInfo.channel === 'object' 
        ? result.videoInfo.channel.name 
        : result.videoInfo.channel
    }

    transcript.videoInfo = videoInfoForDB
    transcript.content = result.segments
    transcript.chapters = result.chapters || []
    transcript.transcriptMethod = result.transcriptMethod || 'unknown'
    transcript.hasActualCaptions = result.hasActualCaptions || false
    transcript.processingProgress = 60
    await transcript.save()

    // Generate summary with enhanced parameters
    const summaryResult = await generateSummary(
      result.segments, 
      summaryType, 
      transcript.language || language,
      result.videoInfo
    )
    transcript.summary = summaryResult
    transcript.processingProgress = 90
    await transcript.save()

    // Mark as completed
    transcript.status = "completed"
    transcript.processingProgress = 100
    await transcript.save()

  } catch (error) {
    console.error(`Error processing transcript ${transcriptId}:`, error)

    // Update transcript with error
    await Transcript.findByIdAndUpdate(transcriptId, {
      status: "failed",
      error: error.message,
      processingProgress: 0,
    })
  }
}

module.exports = router