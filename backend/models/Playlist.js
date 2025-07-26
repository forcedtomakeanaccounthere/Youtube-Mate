const mongoose = require("mongoose")

const playlistSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
    playlist_url: {
      type: String,
      required: true,
      validate: {
        validator: (v) => /^(https?:\/\/)?(www\.)?youtube\.com\/playlist\?list=/.test(v),
        message: "Invalid YouTube playlist URL",
      },
    },
    playlist_id: {
      type: String,
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    description: String,
    thumbnail: String,
    channel: String,
    video_count: {
      type: Number,
      default: 0,
    },
    videos: [
      {
        video_id: String,
        title: String,
        duration: String,
        thumbnail: String,
        selected: {
          type: Boolean,
          default: true,
        },
      },
    ],
    download_options: {
      format: {
        type: String,
        enum: ["mp4", "mp3", "webm", "mkv", "aac", "ogg", "wav", "flac"],
        required: true,
      },
      quality: String,
      create_folder: {
        type: Boolean,
        default: true,
      },
      number_files: {
        type: Boolean,
        default: true,
      },
      include_subtitles: {
        type: Boolean,
        default: false,
      },
    },
    status: {
      type: String,
      enum: ["pending", "processing", "completed", "failed", "paused"],
      default: "pending",
    },
    progress: {
      completed_videos: {
        type: Number,
        default: 0,
      },
      total_videos: {
        type: Number,
        default: 0,
      },
      percentage: {
        type: Number,
        default: 0,
      },
    },
    downloads: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Download",
      },
    ],
    ip_address: String,
    user_agent: String,
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  },
)

playlistSchema.index({ user_id: 1, created_at: -1 })
playlistSchema.index({ playlist_id: 1 })
playlistSchema.index({ status: 1 })

module.exports = mongoose.model("Playlist", playlistSchema)