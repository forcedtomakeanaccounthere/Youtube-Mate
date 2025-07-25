const mongoose = require("mongoose")

const urlAnalyticsSchema = new mongoose.Schema(
  {
    shortUrlId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ShortenedUrl",
      required: true,
      index: true,
    },

    // Request information
    ipAddress: {
      type: String,
      required: true,
    },
    userAgent: {
      type: String,
      default: null,
    },
    referer: {
      type: String,
      default: null,
    },

    // Geographic data
    country: {
      type: String,
      maxlength: 2,
      default: null,
    },
    region: {
      type: String,
      default: null,
    },
    city: {
      type: String,
      default: null,
    },
    timezone: {
      type: String,
      default: null,
    },

    // Device and browser info
    device: {
      type: {
        type: String, // mobile, desktop, tablet
        default: null,
      },
      browser: {
        type: String,
        default: null,
      },
      os: {
        type: String,
        default: null,
      },
    },

    // Social media tracking
    utm: {
      source: String,
      medium: String,
      campaign: String,
      term: String,
      content: String,
    },

    // Timestamp
    clickedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: false, // We use clickedAt instead
  },
)

// Indexes for analytics queries
urlAnalyticsSchema.index({ shortUrlId: 1, clickedAt: -1 })
urlAnalyticsSchema.index({ country: 1 })
urlAnalyticsSchema.index({ "device.type": 1 })

module.exports = mongoose.model("UrlAnalytics", urlAnalyticsSchema)