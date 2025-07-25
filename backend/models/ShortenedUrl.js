const mongoose = require("mongoose")

const shortenedUrlSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null, // Allow anonymous URLs
    },
    originalUrl: {
      type: String,
      required: true,
      trim: true,
    },
    shortCode: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    customAlias: {
      type: String,
      default: null,
      sparse: true, // Allow multiple null values
      index: true,
    },
    domain: {
      type: String,
      default: "ytmate.co",
    },

    // YouTube video metadata
    videoData: {
      videoId: String,
      title: String,
      thumbnailUrl: String,
      duration: String,
      durationSeconds: Number,
      channel: String,
      views: String,
      description: String,
    },

    // Timestamp settings
    timestampStart: {
      type: Number,
      default: 0, // seconds
    },
    timestampFormatted: {
      type: String,
      default: null, // "1h30m45s" format
    },

    // Analytics and tracking
    clicks: {
      type: Number,
      default: 0,
    },
    analyticsEnabled: {
      type: Boolean,
      default: true,
    },

    // QR Code
    qrCodeUrl: {
      type: String,
      default: null,
    },

    // Expiry and status
    expiresAt: {
      type: Date,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },

    // Metadata
    tags: [String],
    notes: {
      type: String,
      maxlength: 500,
    },

    // Bulk operation tracking
    bulkOperationId: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  },
)

// Indexes for performance
shortenedUrlSchema.index({ userId: 1, createdAt: -1 })
shortenedUrlSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })
shortenedUrlSchema.index({ isActive: 1 })

// Virtual for full short URL
shortenedUrlSchema.virtual("fullShortUrl").get(function () {
  return `https://${this.domain}/${this.customAlias || this.shortCode}`
})

// Method to check if URL is expired
shortenedUrlSchema.methods.isExpired = function () {
  return this.expiresAt && new Date() > this.expiresAt
}

// Method to increment clicks
shortenedUrlSchema.methods.incrementClicks = async function () {
  this.clicks += 1
  return this.save()
}

module.exports = mongoose.model("ShortenedUrl", shortenedUrlSchema)