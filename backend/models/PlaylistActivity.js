const mongoose = require("mongoose")

const playlistActivitySchema = new mongoose.Schema(
  {
    playlist_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Playlist",
      required: true,
      index: true,
    },
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    action: {
      type: String,
      enum: [
        "created",
        "updated",
        "deleted",
        "video_added",
        "video_removed",
        "video_reordered",
        "collaborator_added",
        "collaborator_removed",
        "permission_changed",
        "comment_added",
        "shared",
      ],
      required: true,
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    metadata: {
      ip_address: { type: String, default: null },
      user_agent: { type: String, default: null },
    },
    created_at: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: false,
  },
)

// Indexes
playlistActivitySchema.index({ playlist_id: 1, created_at: -1 })
playlistActivitySchema.index({ user_id: 1, created_at: -1 })
playlistActivitySchema.index({ action: 1, created_at: -1 })

// TTL index to automatically delete old activities (keep for 90 days)
playlistActivitySchema.index({ created_at: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 })

module.exports = mongoose.model("PlaylistActivity", playlistActivitySchema)