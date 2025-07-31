const mongoose = require("mongoose")

const playlistCollaboratorSchema = new mongoose.Schema(
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
      index: true,
    },
    permission_level: {
      type: String,
      enum: ["viewer", "editor", "admin"],
      default: "viewer",
    },
    invited_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "declined"],
      default: "pending",
    },
    added_at: {
      type: Date,
      default: Date.now,
    },
    last_active: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
)

// Compound index for unique collaborator per playlist
playlistCollaboratorSchema.index({ playlist_id: 1, user_id: 1 }, { unique: true })

// Index for finding user's collaborations
playlistCollaboratorSchema.index({ user_id: 1, status: 1, added_at: -1 })

module.exports = mongoose.model("PlaylistCollaborator", playlistCollaboratorSchema)