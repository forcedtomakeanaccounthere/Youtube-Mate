const mongoose = require("mongoose")

const queueItemSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    videoId: { type: String, required: true },
    title: { type: String, default: "Queued Video" },
    thumbnail: { type: String, default: "" },
    duration: { type: String, default: "" },
    url: { type: String, required: true },
    addedBy: { type: String, default: "Host" },
  },
  { _id: false },
)

const chatMessageSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    userId: { type: String, required: true },
    userName: { type: String, required: true },
    text: { type: String, required: true },
    timestamp: { type: Date, required: true },
    replyTo: {
      id: { type: String, default: "" },
      userName: { type: String, default: "" },
      text: { type: String, default: "" },
    },
  },
  { _id: false },
)

const joinRequestSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    requesterId: { type: String, default: "" },
    name: { type: String, required: true },
    decision: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
    requestedAt: { type: Date, required: true },
    decidedAt: { type: Date },
  },
  { _id: false },
)

const playbackSchema = new mongoose.Schema(
  {
    isPlaying: { type: Boolean, default: false },
    currentTime: { type: Number, default: 0 },
    playbackRate: { type: Number, default: 1 },
    updatedAt: { type: Date, default: Date.now },
    updatedBy: { type: String, default: "" },
  },
  { _id: false },
)

const streamRoomSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: /^[a-z]{3}-[a-z]{4}-[a-z]{3}$/,
    },
    name: { type: String, required: true, trim: true },
    slug: { type: String, default: "stream-room" },
    hostId: { type: String, required: true, trim: true },
    hostName: { type: String, default: "Host" },
    joinPolicy: { type: String, enum: ["open", "approval"], default: "open" },
    status: { type: String, enum: ["waiting", "live", "ended"], default: "waiting" },
    videoUrl: { type: String, required: true, trim: true },
    videoId: { type: String, required: true, trim: true },
    queue: { type: [queueItemSchema], default: [] },
    currentQueueIndex: { type: Number, default: 0 },
    controlsLocked: { type: Boolean, default: false },
    loopEnabled: { type: Boolean, default: false },
    playback: { type: playbackSchema, default: () => ({}) },
    chatMessages: { type: [chatMessageSchema], default: [] },
    joinRequests: { type: [joinRequestSchema], default: [] },
    startedAt: { type: Date },
    endedAt: { type: Date },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  },
)

streamRoomSchema.index({ code: 1 }, { unique: true })
streamRoomSchema.index({ status: 1, updated_at: -1 })

module.exports = mongoose.model("StreamRoom", streamRoomSchema)
