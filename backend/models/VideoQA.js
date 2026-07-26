const mongoose = require("mongoose")

const videoQASchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    videoId: {
      type: String,
      required: true,
      index: true,
    },
    videoUrl: {
      type: String,
      required: true,
    },
    sessions: [
      {
        sessionId: {
          type: String,
          required: true,
          unique: true,
        },
        title: {
          type: String,
          default: "New Chat",
        },
        messages: [
          {
            role: {
              type: String,
              enum: ["user", "assistant"],
              required: true,
            },
            content: {
              type: String,
              required: true,
            },
            timestamp: {
              type: Date,
              default: Date.now,
            },
            responseType: {
              type: String,
              enum: ["premium", "standard"],
              default: null,
            },
            images: [
              {
                url: String,
                analyzed: {
                  type: Boolean,
                  default: false,
                },
              },
            ],
            tokensUsed: {
              type: Number,
              default: 0,
            },
          },
        ],
        createdAt: {
          type: Date,
          default: Date.now,
        },
        updatedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    videoMetadata: {
      title: String,
      thumbnail: String,
      duration: String,
      channel: mongoose.Schema.Types.Mixed, // Can be string or object
      uploadDate: String,
    },
  },
  {
    timestamps: true,
  }
)

// Index for efficient queries
videoQASchema.index({ userId: 1, videoId: 1 })
videoQASchema.index({ "sessions.sessionId": 1 })

module.exports = mongoose.model("VideoQA", videoQASchema)
