const express = require("express")
const router = express.Router()
const { nanoid } = require("nanoid")
const QRCode = require("qrcode")
const ShortenedUrl = require("../models/ShortenedUrl")
const { validateUrl, validateBulkUrls } = require("../middleware/validation")
const { authenticateToken, optionalAuth } = require("../middleware/auth")
const { rateLimiter } = require("../middleware/rateLimiter")
const { fetchYouTubeMetadata } = require("../utils/youtube")

// Create shortened URL
router.post("/shorten", optionalAuth, validateUrl, async (req, res) => {
  try {
    const {
      originalUrl,
      customAlias,
      timestamp,
      analyticsEnabled = true,
      domain = process.env.NODE_ENV === 'production' ? 'youtube-mate-backend.onrender.com' : 'localhost:5000',
      expiryDate,
      tags = [],
      notes,
      fetchMetaOnly // <-- add this
    } = req.body

    // If only fetching metadata, do not create a short URL
    if (fetchMetaOnly) {
      const videoData = await fetchYouTubeMetadata(originalUrl)
      return res.status(200).json({ videoData })
    }

    // Check if custom alias already exists
    if (customAlias) {
      const existingAlias = await ShortenedUrl.findOne({
        $or: [{ customAlias }, { shortCode: customAlias }],
      })

      if (existingAlias) {
        return res.status(400).json({
          error: "Custom alias already exists",
          suggestion: `${customAlias}-${nanoid(4)}`,
        })
      }
    }

    // Generate short code
    const shortCode = customAlias || nanoid(8)

    // Fetch YouTube metadata
    const videoData = await fetchYouTubeMetadata(originalUrl)

    // Parse timestamp
    let timestampStart = 0
    let timestampFormatted = null

    if (timestamp) {
      const { hours = 0, minutes = 0, seconds = 0 } = timestamp
      timestampStart = hours * 3600 + minutes * 60 + seconds

      if (timestampStart > 0) {
        timestampFormatted = `${hours}h${minutes}m${seconds}s`

        // Validate timestamp against video duration
        if (videoData.durationSeconds && timestampStart > videoData.durationSeconds) {
          return res.status(400).json({
            error: "Timestamp exceeds video duration",
            videoDuration: videoData.duration,
            maxSeconds: videoData.durationSeconds,
          })
        }
      }
    }

    // Prepare video data for database storage
    const videoDataForDB = {
      ...videoData,
      // Ensure channel is a string for database storage
      channel: typeof videoData.channel === 'object' ? videoData.channel.name : videoData.channel
    }

    // Create shortened URL
    const shortenedUrl = new ShortenedUrl({
      userId: req.user?.id || null,
      originalUrl,
      shortCode,
      customAlias: customAlias || null,
      domain,
      videoData: videoDataForDB,
      timestampStart,
      timestampFormatted,
      analyticsEnabled,
      expiresAt: expiryDate ? new Date(expiryDate) : null,
      tags,
      notes,
    })

    // Generate QR code
    const baseUrl = process.env.BACKEND_URL || 'http://localhost:5000';
    const shortUrl = `${baseUrl}/${shortCode}`
    const qrCodeDataUrl = await QRCode.toDataURL(shortUrl, {
      width: 200,
      margin: 2,
      color: {
        dark: "#f97316", // Orange color
        light: "#ffffff",
      },
    })

    shortenedUrl.qrCodeUrl = qrCodeDataUrl

    await shortenedUrl.save()

    // Prepare response data with original video data structure
    const responseVideoData = {
      ...shortenedUrl.videoData.toObject(),
      // Restore channel object for frontend compatibility
      channel: videoData.channel
    }

    res.status(201).json({
      success: true,
      data: {
        id: shortenedUrl._id,
        originalUrl: shortenedUrl.originalUrl,
        shortUrl: shortUrl,
        shortCode: shortenedUrl.shortCode,
        customAlias: shortenedUrl.customAlias,
        videoData: responseVideoData,
        timestamp: {
          start: shortenedUrl.timestampStart,
          formatted: shortenedUrl.timestampFormatted,
        },
        qrCode: shortenedUrl.qrCodeUrl,
        analyticsEnabled: shortenedUrl.analyticsEnabled,
        expiresAt: shortenedUrl.expiresAt,
        createdAt: shortenedUrl.createdAt,
      },
    })
  } catch (error) {
    console.error("Error creating shortened URL:", error)
    res.status(500).json({
      error: "Failed to create shortened URL",
      message: error.message,
    })
  }
})

// Bulk URL shortening
router.post("/bulk-shorten", optionalAuth, validateBulkUrls, async (req, res) => {
  try {
    const { urls, domain = process.env.NODE_ENV === 'production' ? 'youtube-mate-backend.onrender.com' : 'localhost:5000', analyticsEnabled = true } = req.body
    const bulkOperationId = nanoid(12)
    const results = []

    for (const urlData of urls) {
      try {
        const { url: originalUrl, customAlias, timestamp } = urlData

        // Check custom alias conflicts
        if (customAlias) {
          const existingAlias = await ShortenedUrl.findOne({
            $or: [{ customAlias }, { shortCode: customAlias }],
          })

          if (existingAlias) {
            results.push({
              originalUrl,
              status: "error",
              error: "Custom alias already exists",
            })
            continue
          }
        }

        const shortCode = customAlias || nanoid(8)
        const videoData = await fetchYouTubeMetadata(originalUrl)

        // Parse timestamp
        let timestampStart = 0
        let timestampFormatted = null

        if (timestamp) {
          const { hours = 0, minutes = 0, seconds = 0 } = timestamp
          timestampStart = hours * 3600 + minutes * 60 + seconds

          if (timestampStart > 0) {
            timestampFormatted = `${hours}h${minutes}m${seconds}s`
          }
        }

        // Prepare video data for database storage
        const videoDataForDB = {
          ...videoData,
          // Ensure channel is a string for database storage
          channel: typeof videoData.channel === 'object' ? videoData.channel.name : videoData.channel
        }

        const shortenedUrl = new ShortenedUrl({
          userId: req.user?.id || null,
          originalUrl,
          shortCode,
          customAlias: customAlias || null,
          domain,
          videoData: videoDataForDB,
          timestampStart,
          timestampFormatted,
          analyticsEnabled,
          bulkOperationId,
        })

        // Generate QR code
        const baseUrl = process.env.BACKEND_URL || 'http://localhost:5000';
        const fullShortUrl = `${baseUrl}/${shortCode}`
        const qrCodeDataUrl = await QRCode.toDataURL(fullShortUrl, {
          width: 200,
          margin: 2,
          color: { dark: "#f97316", light: "#ffffff" },
        })

        shortenedUrl.qrCodeUrl = qrCodeDataUrl
        await shortenedUrl.save()

        results.push({
          originalUrl,
          shortUrl: fullShortUrl,
          shortCode,
          status: "success",
          videoData,
        })
      } catch (error) {
        results.push({
          originalUrl: urlData.url,
          status: "error",
          error: error.message,
        })
      }
    }

    res.status(200).json({
      success: true,
      bulkOperationId,
      results,
      summary: {
        total: urls.length,
        successful: results.filter((r) => r.status === "success").length,
        failed: results.filter((r) => r.status === "error").length,
      },
    })
  } catch (error) {
    console.error("Error in bulk URL shortening:", error)
    res.status(500).json({
      error: "Failed to process bulk URLs",
      message: error.message,
    })
  }
})

// Get user's URLs
router.get("/my-urls", optionalAuth, async (req, res) => {
  try {
    const { page = 1, limit = 20, search, sortBy = "createdAt", sortOrder = "desc" } = req.query

    const query = {
      userId: req.user?.id || null,
      isActive: true,
    }

    if (search) {
      query.$or = [
        { "videoData.title": { $regex: search, $options: "i" } },
        { originalUrl: { $regex: search, $options: "i" } },
        { customAlias: { $regex: search, $options: "i" } },
        { tags: { $in: [new RegExp(search, "i")] } },
      ]
    }

    const sort = {}
    sort[sortBy] = sortOrder === "desc" ? -1 : 1

    const urls = await ShortenedUrl.find(query)
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean()

    const total = await ShortenedUrl.countDocuments(query)

    res.json({
      success: true,
      data: {
        urls: urls.map((url) => ({
          _id: url._id,
          originalUrl: url.originalUrl,
          shortUrl: `${process.env.NODE_ENV === 'production' ? 'https' : 'http'}://${process.env.NODE_ENV === 'production' ? url.domain : `localhost:${process.env.PORT || 5000}`}/${url.customAlias || url.shortCode}`,
          shortCode: url.shortCode,
          customAlias: url.customAlias,
          videoData: url.videoData,
          analyticsEnabled: url.analyticsEnabled,
          clicks: url.clicks || 0, // Make sure clicks field is included
          createdAt: url.createdAt,
          expiresAt: url.expiresAt,
          qrCodeUrl: url.qrCodeUrl,
          timestampFormatted: url.timestampFormatted,
        })),
      },
      pagination: {
        current: Number.parseInt(page),
        pages: Math.ceil(total / limit),
        total,
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    })
  } catch (error) {
    console.error("Error fetching user URLs:", error)
    res.status(500).json({
      error: "Failed to fetch URLs",
      message: error.message,
    })
  }
})

// Get single URL details
router.get("/:id", optionalAuth, async (req, res) => {
  try {
    const url = await ShortenedUrl.findById(req.params.id)

    if (!url) {
      return res.status(404).json({ error: "URL not found" })
    }

    // Check if user owns this URL or if it's public
    if (url.userId && (!req.user || url.userId.toString() !== req.user.id)) {
      return res.status(403).json({ error: "Access denied" })
    }

    res.json({
      success: true,
      data: {
        ...url.toObject(),
        fullShortUrl: `https://${url.domain}/${url.customAlias || url.shortCode}`,
      },
    })
  } catch (error) {
    console.error("Error fetching URL:", error)
    res.status(500).json({
      error: "Failed to fetch URL",
      message: error.message,
    })
  }
})

// Update URL
router.put("/:id", authenticateToken, async (req, res) => {
  try {
    const { customAlias, tags, notes, analyticsEnabled, expiresAt } = req.body

    const url = await ShortenedUrl.findOne({
      _id: req.params.id,
      userId: req.user.id,
    })

    if (!url) {
      return res.status(404).json({ error: "URL not found" })
    }

    // Check custom alias conflicts if changing
    if (customAlias && customAlias !== url.customAlias) {
      const existingAlias = await ShortenedUrl.findOne({
        $or: [{ customAlias }, { shortCode: customAlias }],
        _id: { $ne: url._id },
      })

      if (existingAlias) {
        return res.status(400).json({
          error: "Custom alias already exists",
        })
      }
    }

    // Update fields
    if (customAlias !== undefined) url.customAlias = customAlias
    if (tags !== undefined) url.tags = tags
    if (notes !== undefined) url.notes = notes
    if (analyticsEnabled !== undefined) url.analyticsEnabled = analyticsEnabled
    if (expiresAt !== undefined) url.expiresAt = expiresAt ? new Date(expiresAt) : null

    await url.save()

    res.json({
      success: true,
      data: {
        ...url.toObject(),
        fullShortUrl: `https://${url.domain}/${url.customAlias || url.shortCode}`,
      },
    })
  } catch (error) {
    console.error("Error updating URL:", error)
    res.status(500).json({
      error: "Failed to update URL",
      message: error.message,
    })
  }
})

// Delete URL
router.delete("/:id", authenticateToken, async (req, res) => {
  try {
    const url = await ShortenedUrl.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { isActive: false },
      { new: true },
    )

    if (!url) {
      return res.status(404).json({ error: "URL not found" })
    }

    res.json({
      success: true,
      message: "URL deleted successfully",
    })
  } catch (error) {
    console.error("Error deleting URL:", error)
    res.status(500).json({
      error: "Failed to delete URL",
      message: error.message,
    })
  }
})

module.exports = router