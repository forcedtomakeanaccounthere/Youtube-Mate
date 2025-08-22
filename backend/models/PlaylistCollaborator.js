const mongoose = require("mongoose")

const playlistCollaboratorSchema = new mongoose.Schema(
  {
    playlist_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PlaylistManager",
      required: true,
      index: true,
    },
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false, // Made optional to support email-based invites
      index: true,
    },
    invited_email: {
      type: String,
      required: false, // Either user_id or invited_email must be present
      lowercase: true,
      index: true,
    },
    token: {
      type: String,
      required: false, // Required for pending email invites
      unique: true,
      sparse: true, // Allows multiple null values but unique non-null values
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

// Compound index for unique collaborator per playlist (handles both user_id and email cases)
playlistCollaboratorSchema.index({ playlist_id: 1, user_id: 1 }, { unique: true, sparse: true })
playlistCollaboratorSchema.index({ playlist_id: 1, invited_email: 1 }, { unique: true, sparse: true })

// Index for finding user's collaborations
playlistCollaboratorSchema.index({ user_id: 1, status: 1, added_at: -1 })
playlistCollaboratorSchema.index({ invited_email: 1, status: 1, added_at: -1 })

// Validation to ensure either user_id or invited_email is present
playlistCollaboratorSchema.pre('save', function(next) {
  if (!this.user_id && !this.invited_email) {
    return next(new Error('Either user_id or invited_email must be provided'))
  }
  next()
})

module.exports = mongoose.model("PlaylistCollaborator", playlistCollaboratorSchema)