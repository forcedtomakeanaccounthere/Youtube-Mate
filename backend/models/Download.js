const mongoose = require("mongoose")

const downloadSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false, // Allow anonymous downloads
    },
    youtube_url: {
      type: String,
      required: true,
      validate: {
        validator: (v) => /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/.test(v),
        message: "Invalid YouTube URL",
      },
    },
    video_id: {
      type: String,
      required: true,
    },
    format: {
      type: String,
      required: true,
      enum: ["mp4", "mp3", "webm", "mkv", "aac", "ogg", "wav", "flac", "audio", "video"],
    },
    quality: {
      type: String,
      required: true,
    },
    file_path: {
      type: String,
      default: null,
    },
    file_name: {
      type: String,
      default: null,
    },
    file_size: {
      type: Number,
      default: 0,
    },
    estimated_size: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ["pending", "processing", "completed", "failed", "paused", "cancelled"],
      default: "pending",
    },
    progress: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    download_speed: {
      type: String,
      default: null,
    },
    eta: {
      type: String,
      default: null,
    },
    error_message: {
      type: String,
      default: null,
    },
    metadata: {
      title: String,
      duration: String,
      thumbnail: String,
      channel: String,
      views: String,
      description: String,
    },
    options: {
      include_subtitles: {
        type: Boolean,
        default: false,
      },
      subtitle_language: {
        type: String,
        default: "en",
      },
      audio_quality: String,
      video_codec: String,
      audio_codec: String,
      normalize_audio: {
        type: Boolean,
        default: false,
      },
      trim_silence: {
        type: Boolean,
        default: false,
      },
    },
    ip_address: {
      type: String,
      required: true,
    },
    user_agent: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  },
)

// Add indexes for better query performance
downloadSchema.index({ user_id: 1, created_at: -1 })
downloadSchema.index({ status: 1 })
downloadSchema.index({ video_id: 1 })
downloadSchema.index({ created_at: -1 })

// Virtual for completed_at
downloadSchema.virtual("completed_at").get(function () {
  return this.status === "completed" ? this.updated_at : null
})

// Virtual for filename (for frontend compatibility)
downloadSchema.virtual("filename").get(function () {
  return this.file_name || `${this.format}_${this.quality}.${this.format === 'audio' ? 'mp3' : 'mp4'}`
})

// Virtual for title (for frontend compatibility)
downloadSchema.virtual("title").get(function () {
  return this.metadata && this.metadata.title ? this.metadata.title : 'Unknown Video'
})

// Ensure virtual fields are serialized
downloadSchema.set('toJSON', { virtuals: true })
downloadSchema.set('toObject', { virtuals: true })

// Method to update progress
downloadSchema.methods.updateProgress = function (progress, speed = null, eta = null) {
  this.progress = progress
  if (speed) this.download_speed = speed
  if (eta) this.eta = eta
  return this.save()
}

// Method to mark as completed
downloadSchema.methods.markCompleted = function (filePath, fileName, fileSize) {
  this.status = "completed"
  this.progress = 100
  this.file_path = filePath
  this.file_name = fileName
  this.file_size = fileSize
  this.download_speed = null
  this.eta = null
  return this.save()
}

// Method to mark as failed
downloadSchema.methods.markFailed = function (errorMessage) {
  this.status = "failed"
  this.error_message = errorMessage
  this.download_speed = null
  this.eta = null
  return this.save()
}

module.exports = mongoose.model("Download", downloadSchema)