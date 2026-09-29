const { nanoid } = require("nanoid")
const QRCode = require("qrcode")
const ShortenedUrl = require("../models/ShortenedUrl")
const youtubeService = require("./youtubeService")

/**
 * URL Service
 * Handles business logic for URL shortening, QR code generation, and analytics
 */
class UrlService {
  /**
   * Get backend base URL
   */
  getBaseUrl() {
    return (process.env.BACKEND_URL || "http://localhost:5000").trim().replace(/\/+$/, "")
  }

  /**
   * Get default domain based on environment
   */
  getDefaultDomain() {
    return process.env.NODE_ENV === "production" ? "youtube-mate-backend-wlch.onrender.com" : "localhost:5000"
  }

  /**
   * Fetch YouTube metadata only (without creating short URL)
   */
  async fetchMetadataOnly(originalUrl) {
    const videoData = await youtubeService.getVideoInfo(originalUrl)
    return { videoData }
  }

  /**
   * Check if custom alias exists
   */
  async checkAliasExists(customAlias, excludeId = null) {
    const query = {
      $or: [{ customAlias }, { shortCode: customAlias }],
    }

    if (excludeId) {
      query._id = { $ne: excludeId }
    }

    const existing = await ShortenedUrl.findOne(query)
    return !!existing
  }

  /**
   * Parse timestamp object to seconds
   */
  parseTimestamp(timestamp) {
    if (!timestamp) {
      return { timestampStart: 0, timestampFormatted: null }
    }

    const { hours = 0, minutes = 0, seconds = 0 } = timestamp
    const timestampStart = hours * 3600 + minutes * 60 + seconds

    if (timestampStart === 0) {
      return { timestampStart: 0, timestampFormatted: null }
    }

    const timestampFormatted = `${hours}h${minutes}m${seconds}s`
    return { timestampStart, timestampFormatted }
  }

  /**
   * Generate QR code for URL
   */
  async generateQRCode(url) {
    return await QRCode.toDataURL(url, {
      width: 200,
      margin: 2,
      color: {
        dark: "#f97316", // Orange color
        light: "#ffffff",
      },
    })
  }

  /**
   * Prepare video data for database storage
   */
  prepareVideoDataForDB(videoData) {
    return {
      ...videoData,
      channel: typeof videoData.channel === "object" ? videoData.channel.name : videoData.channel,
    }
  }

  /**
   * Create shortened URL
   */
  async createShortenedUrl(userId, data) {
    const {
      originalUrl,
      customAlias,
      timestamp,
      analyticsEnabled = true,
      domain,
      expiryDate,
      tags = [],
      notes,
    } = data

    // Check custom alias conflicts
    if (customAlias) {
      const exists = await this.checkAliasExists(customAlias)
      if (exists) {
        throw new Error(`Custom alias already exists. Suggestion: ${customAlias}-${nanoid(4)}`)
      }
    }

    // Generate short code
    const shortCode = customAlias || nanoid(8)

    // Fetch YouTube metadata
    const videoData = await youtubeService.getVideoInfo(originalUrl)

    // Parse timestamp
    const { timestampStart, timestampFormatted } = this.parseTimestamp(timestamp)

    // Validate timestamp against video duration
    if (timestampStart > 0 && videoData.durationSeconds && timestampStart > videoData.durationSeconds) {
      throw new Error(`Timestamp exceeds video duration. Max: ${videoData.duration} (${videoData.durationSeconds}s)`)
    }

    // Prepare video data for database
    const videoDataForDB = this.prepareVideoDataForDB(videoData)

    // Create shortened URL
    const shortenedUrl = new ShortenedUrl({
      userId: userId || null,
      originalUrl,
      shortCode,
      customAlias: customAlias || null,
      domain: domain || this.getDefaultDomain(),
      videoData: videoDataForDB,
      timestampStart,
      timestampFormatted,
      analyticsEnabled,
      expiresAt: expiryDate ? new Date(expiryDate) : null,
      tags,
      notes,
    })

    // Generate QR code
    const baseUrl = this.getBaseUrl()
    const shortUrl = `${baseUrl}/${shortCode}`
    const qrCodeDataUrl = await this.generateQRCode(shortUrl)

    shortenedUrl.qrCodeUrl = qrCodeDataUrl
    await shortenedUrl.save()

    // Return with original video data structure
    return {
      id: shortenedUrl._id,
      originalUrl: shortenedUrl.originalUrl,
      shortUrl,
      shortCode: shortenedUrl.shortCode,
      customAlias: shortenedUrl.customAlias,
      videoData: { ...shortenedUrl.videoData.toObject(), channel: videoData.channel },
      timestamp: {
        start: shortenedUrl.timestampStart,
        formatted: shortenedUrl.timestampFormatted,
      },
      qrCode: shortenedUrl.qrCodeUrl,
      analyticsEnabled: shortenedUrl.analyticsEnabled,
      expiresAt: shortenedUrl.expiresAt,
      createdAt: shortenedUrl.createdAt,
    }
  }

  /**
   * Bulk URL shortening
   */
  async bulkShortenUrls(userId, urls, domain, analyticsEnabled = true) {
    const bulkOperationId = nanoid(12)
    const results = []

    for (const urlData of urls) {
      try {
        const { url: originalUrl, customAlias, timestamp } = urlData

        // Check custom alias conflicts
        if (customAlias) {
          const exists = await this.checkAliasExists(customAlias)
          if (exists) {
            results.push({
              originalUrl,
              status: "error",
              error: "Custom alias already exists",
            })
            continue
          }
        }

        const shortCode = customAlias || nanoid(8)
        const videoData = await youtubeService.getVideoInfo(originalUrl)

        // Parse timestamp
        const { timestampStart, timestampFormatted } = this.parseTimestamp(timestamp)

        // Prepare video data
        const videoDataForDB = this.prepareVideoDataForDB(videoData)

        const shortenedUrl = new ShortenedUrl({
          userId: userId || null,
          originalUrl,
          shortCode,
          customAlias: customAlias || null,
          domain: domain || this.getDefaultDomain(),
          videoData: videoDataForDB,
          timestampStart,
          timestampFormatted,
          analyticsEnabled,
          bulkOperationId,
        })

        // Generate QR code
        const baseUrl = this.getBaseUrl()
        const fullShortUrl = `${baseUrl}/${shortCode}`
        const qrCodeDataUrl = await this.generateQRCode(fullShortUrl)

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

    return {
      bulkOperationId,
      results,
      summary: {
        total: urls.length,
        successful: results.filter((r) => r.status === "success").length,
        failed: results.filter((r) => r.status === "error").length,
      },
    }
  }

  /**
   * Get user's URLs with pagination and search
   */
  async getUserUrls(userId, options = {}) {
    const { page = 1, limit = 20, search, sortBy = "createdAt", sortOrder = "desc" } = options

    const query = {
      userId: userId || null,
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

    const baseUrl = this.getBaseUrl()

    return {
      urls: urls.map((url) => ({
        _id: url._id,
        originalUrl: url.originalUrl,
        shortUrl: `${baseUrl}/${url.customAlias || url.shortCode}`,
        shortCode: url.shortCode,
        customAlias: url.customAlias,
        videoData: url.videoData,
        analyticsEnabled: url.analyticsEnabled,
        clicks: url.clicks || 0,
        createdAt: url.createdAt,
        expiresAt: url.expiresAt,
        qrCodeUrl: url.qrCodeUrl,
        timestampFormatted: url.timestampFormatted,
      })),
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
   * Get single URL by ID
   */
  async getUrlById(urlId, userId = null) {
    const url = await ShortenedUrl.findById(urlId)

    if (!url) {
      throw new Error("URL not found")
    }

    // Check ownership
    if (url.userId && (!userId || url.userId.toString() !== userId)) {
      throw new Error("Access denied")
    }

    const baseUrl = this.getBaseUrl()

    return {
      ...url.toObject(),
      fullShortUrl: `${baseUrl}/${url.customAlias || url.shortCode}`,
    }
  }

  /**
   * Update URL
   */
  async updateUrl(urlId, userId, updates) {
    const { customAlias, tags, notes, analyticsEnabled, expiresAt } = updates

    const url = await ShortenedUrl.findOne({
      _id: urlId,
      userId,
    })

    if (!url) {
      throw new Error("URL not found")
    }

    // Check custom alias conflicts if changing
    if (customAlias && customAlias !== url.customAlias) {
      const exists = await this.checkAliasExists(customAlias, urlId)
      if (exists) {
        throw new Error("Custom alias already exists")
      }
    }

    // Update fields
    if (customAlias !== undefined) url.customAlias = customAlias
    if (tags !== undefined) url.tags = tags
    if (notes !== undefined) url.notes = notes
    if (analyticsEnabled !== undefined) url.analyticsEnabled = analyticsEnabled
    if (expiresAt !== undefined) url.expiresAt = expiresAt ? new Date(expiresAt) : null

    await url.save()

    const baseUrl = this.getBaseUrl()

    return {
      ...url.toObject(),
      fullShortUrl: `${baseUrl}/${url.customAlias || url.shortCode}`,
    }
  }

  /**
   * Delete URL (soft delete)
   */
  async deleteUrl(urlId, userId) {
    const url = await ShortenedUrl.findOneAndUpdate(
      { _id: urlId, userId },
      { isActive: false },
      { new: true }
    )

    if (!url) {
      throw new Error("URL not found")
    }

    return { message: "URL deleted successfully" }
  }
}

module.exports = new UrlService()
