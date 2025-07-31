const mongoose = require("mongoose")

const playlistCommentSchema = new mongoose.Schema(
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
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    parent_comment_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PlaylistComment",
      default: null,
    },
    is_edited: {
      type: Boolean,
      default: false,
    },
    edited_at: {
      type: Date,
      default: null,
    },
    created_at: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
)

// Indexes
playlistCommentSchema.index({ playlist_id: 1, created_at: -1 })
playlistCommentSchema.index({ user_id: 1, created_at: -1 })
playlistCommentSchema.index({ parent_comment_id: 1 })

module.exports = mongoose.model("PlaylistComment", playlistCommentSchema)