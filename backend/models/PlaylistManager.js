const mongoose = require("mongoose")

const playlistSchema = new mongoose.Schema(
  {
    owner_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    description: {
      type: String,
      default: "",
      maxlength: 1000,
    },
    is_public: {
      type: Boolean,
      default: false,
    },
    is_collaborative: {
      type: Boolean,
      default: false,
    },
    thumbnail_url: {
      type: String,
      default: null,
    },
    category: {
      type: String,
      enum: ["music", "education", "entertainment", "gaming", "technology", "sports", "cooking", "travel", "other"],
      default: "other",
    },
    tags: [
      {
        type: String,
        trim: true,
        maxlength: 50,
      },
    ],
    status: {
      type: String,
      enum: ["active", "draft", "archived"],
      default: "active",
    },
    stats: {
      total_views: { type: Number, default: 0 },
      total_duration: { type: Number, default: 0 }, // in seconds
      video_count: { type: Number, default: 0 },
    },
    import_data: {
      source: { type: String, enum: ["youtube", "manual"], default: "manual" },
      original_url: { type: String, default: null },
      imported_at: { type: Date, default: null },
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  },
)

// Indexes for better performance
playlistSchema.index({ owner_id: 1, created_at: -1 })
// /mine endpoint sorts by updated_at within an owner
playlistSchema.index({ owner_id: 1, updated_at: -1 })
playlistSchema.index({ is_public: 1, created_at: -1 })
playlistSchema.index({ name: "text", description: "text", tags: "text" })
playlistSchema.index({ category: 1 })
playlistSchema.index({ status: 1 })

// Virtual for collaborator count
playlistSchema.virtual("collaborator_count", {
  ref: "PlaylistCollaborator",
  localField: "_id",
  foreignField: "playlist_id",
  count: true,
})

// Virtual for items
playlistSchema.virtual("items", {
  ref: "PlaylistItem",
  localField: "_id",
  foreignField: "playlist_id",
})

// Ensure virtual fields are serialized
playlistSchema.set("toJSON", { virtuals: true })
playlistSchema.set("toObject", { virtuals: true })

module.exports = mongoose.model("PlaylistManager", playlistSchema)