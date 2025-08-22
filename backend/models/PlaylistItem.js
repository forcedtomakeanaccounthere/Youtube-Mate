const mongoose = require("mongoose")

const playlistItemSchema = new mongoose.Schema(
  {
    playlist_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Playlist",
      required: true,
    },
    youtube_url: {
      type: String,
      required: true,
      validate: {
        validator: (v) => /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/.test(v),
        message: "Invalid YouTube URL format",
      },
    },
    youtube_id: {
      type: String,
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 300,
    },
    description: {
      type: String,
      default: "",
      maxlength: 2000,
    },
    thumbnail_url: {
      type: String,
      default: null,
    },
    duration: {
      type: Number, // in seconds
      default: 0,
    },
    channel: {
      name: { type: String, default: "" },
      url: { type: String, default: "" },
      thumbnail: { type: String, default: "" },
    },
    added_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    position: {
      type: Number,
      required: true,
      min: 0,
    },
    metadata: {
      views: { type: Number, default: 0 },
      likes: { type: Number, default: 0 },
      published_at: { type: Date, default: null },
      language: { type: String, default: null },
    },
    added_at: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
)

// Indexes for better performance
playlistItemSchema.index({ playlist_id: 1, position: 1 }, { unique: true })
playlistItemSchema.index({ youtube_id: 1 })
playlistItemSchema.index({ added_by: 1, added_at: -1 })

// Pre-save middleware to extract YouTube ID
playlistItemSchema.pre("save", function (next) {
  if (this.youtube_url) {
    const match = this.youtube_url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
    if (match) {
      this.youtube_id = match[1]
    }
  }
  next()
})

module.exports = mongoose.model("PlaylistItem", playlistItemSchema)