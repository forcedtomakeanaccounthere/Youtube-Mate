const mongoose = require("mongoose")

const transcriptSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    youtubeUrl: {
      type: String,
      required: true,
      trim: true,
    },
    videoId: {
      type: String,
      required: true,
      index: true,
    },
    language: {
      type: String,
      default: "en",
      maxlength: 10,
    },
    content: [
      {
        id: String,
        start: Number,
        end: Number,
        text: String,
        speaker: String,
        confidence: Number,
      },
    ],
    summary: {
      brief: String,
      detailed: String,
      bulletPoints: [String],
      keyMoments: [
        {
          timestamp: Number,
          text: String,
          importance: Number,
        },
      ],
    },
    videoInfo: {
      title: String,
      duration: String,
      thumbnail: String,
      channel: String,
      views: String,
      uploadDate: String,
      videoId: String,
    },
    status: {
      type: String,
      enum: ["pending", "processing", "completed", "failed"],
      default: "pending",
    },
    processingProgress: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    error: {
      type: String,
      default: null,
    },
    statistics: {
      wordCount: {
        type: Number,
        default: 0,
      },
      segmentCount: {
        type: Number,
        default: 0,
      },
      averageConfidence: {
        type: Number,
        default: 0,
      },
      speakerCount: {
        type: Number,
        default: 1,
      },
    },
  },
  {
    timestamps: true,
  },
)

// Index for efficient queries
transcriptSchema.index({ userId: 1, createdAt: -1 })
transcriptSchema.index({ videoId: 1, language: 1 })
transcriptSchema.index({ status: 1 })

// Calculate statistics before saving
transcriptSchema.pre("save", function (next) {
  if (this.content && this.content.length > 0) {
    // Calculate word count
    this.statistics.wordCount = this.content.reduce((total, segment) => {
      return total + segment.text.split(" ").length
    }, 0)

    // Calculate segment count
    this.statistics.segmentCount = this.content.length

    // Calculate average confidence
    const totalConfidence = this.content.reduce((total, segment) => {
      return total + (segment.confidence || 0)
    }, 0)
    this.statistics.averageConfidence = Math.round((totalConfidence / this.content.length) * 100) / 100

    // Calculate unique speakers
    const speakers = new Set(this.content.map((segment) => segment.speaker))
    this.statistics.speakerCount = speakers.size
  }
  next()
})

module.exports = mongoose.model("Transcript", transcriptSchema)