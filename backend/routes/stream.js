const express = require("express")
const { authenticateToken } = require("../middleware/auth")
const { sendEmail } = require("../services/emailService")
const StreamRoom = require("../models/StreamRoom")
const {
  generateMeetingCode,
  normalizeRoomCode,
  isValidRoomCode,
  normalizeJoinPolicy,
  sanitizeQueue,
  clampQueueIndex,
  resolvePlayback,
  slugify,
} = require("../utils/streamRoom")

const router = express.Router()

const isValidEmail = (email) => {
  if (typeof email !== "string") return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}

const toRoomPayload = (roomDoc) => {
  const playback = resolvePlayback(roomDoc.playback)
  const queue = sanitizeQueue(roomDoc.queue, roomDoc.hostName || "Host")
  const currentQueueIndex = clampQueueIndex(roomDoc.currentQueueIndex, queue.length)
  const activeItem = queue[currentQueueIndex]

  return {
    id: roomDoc.code,
    name: roomDoc.name,
    slug: roomDoc.slug,
    videoUrl: activeItem?.url || roomDoc.videoUrl,
    videoId: activeItem?.videoId || roomDoc.videoId,
    joinPolicy: roomDoc.joinPolicy,
    queue,
    currentQueueIndex,
    status: roomDoc.status,
    hostId: roomDoc.hostId,
    hostName: roomDoc.hostName,
    controlsLocked: Boolean(roomDoc.controlsLocked),
    loopEnabled: Boolean(roomDoc.loopEnabled),
    playback: {
      isPlaying: playback.isPlaying,
      currentTime: playback.currentTime,
      playbackRate: playback.playbackRate,
      updatedAt: playback.updatedAt,
      updatedBy: playback.updatedBy,
    },
    createdAt: roomDoc.created_at,
    updatedAt: roomDoc.updated_at,
    startedAt: roomDoc.startedAt,
    endedAt: roomDoc.endedAt,
  }
}

const createUniqueRoomCode = async () => {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = generateMeetingCode()
    const existing = await StreamRoom.findOne({ code })
    if (!existing) return code
  }

  throw new Error("Unable to generate unique room code")
}

router.post("/rooms", async (req, res) => {
  try {
    const { roomId, name, videoUrl, videoId, joinPolicy, queue, currentQueueIndex, hostId, hostName } = req.body || {}

    if (!name || !videoUrl || !videoId) {
      return res.status(400).json({ error: "name, videoUrl, and videoId are required." })
    }

    const requestedCode = normalizeRoomCode(roomId)
    if (requestedCode && !isValidRoomCode(requestedCode)) {
      return res.status(400).json({ error: "Room code format must be like ynj-rnfd-uhx." })
    }

    const nextHostId = String(hostId || "").trim() || `host-${Date.now()}-${Math.floor(Math.random() * 1000)}`
    const code = requestedCode || (await createUniqueRoomCode())

    const existingRoom = await StreamRoom.findOne({ code })
    if (existingRoom) {
      return res.status(409).json({ error: "This room code is unavailable. Please generate a new code." })
    }

    const safeQueue = sanitizeQueue(queue, hostName || "Host")
    const queueWithInitial = safeQueue.length > 0
      ? safeQueue
      : [
          {
            id: `q-${Date.now()}`,
            videoId: String(videoId),
            title: "Queued Video",
            thumbnail: "",
            duration: "",
            url: String(videoUrl),
            addedBy: String(hostName || "Host"),
          },
        ]

    const safeQueueIndex = clampQueueIndex(currentQueueIndex, queueWithInitial.length)
    const activeItem = queueWithInitial[safeQueueIndex]

    const room = await StreamRoom.create({
      code,
      name: String(name).trim(),
      slug: slugify(name),
      hostId: nextHostId,
      hostName: String(hostName || "Host").trim() || "Host",
      joinPolicy: normalizeJoinPolicy(joinPolicy),
      status: "waiting",
      controlsLocked: false,
      loopEnabled: false,
      videoUrl: activeItem?.url || String(videoUrl),
      videoId: activeItem?.videoId || String(videoId),
      queue: queueWithInitial,
      currentQueueIndex: safeQueueIndex,
      playback: {
        isPlaying: false,
        currentTime: 0,
        playbackRate: 1,
        updatedAt: new Date(),
        updatedBy: "",
      },
      endedAt: null,
    })

    return res.json({ success: true, room: toRoomPayload(room) })
  } catch (error) {
    console.error("Failed to create stream room:", error)
    return res.status(500).json({ error: "Failed to create room." })
  }
})

router.get("/rooms/:roomId", async (req, res) => {
  try {
    const roomId = normalizeRoomCode(req.params.roomId)
    const room = await StreamRoom.findOne({ code: roomId })
    if (!room) {
      return res.status(404).json({ error: "Room not found." })
    }

    if (room.status === "ended") {
      return res.status(410).json({ error: "This stream has ended.", status: room.status })
    }

    return res.json({ success: true, room: toRoomPayload(room) })
  } catch (error) {
    console.error("Failed to fetch stream room:", error)
    return res.status(500).json({ error: "Failed to fetch room." })
  }
})

router.patch("/rooms/:roomId", async (req, res) => {
  try {
    const roomId = normalizeRoomCode(req.params.roomId)
    const existing = await StreamRoom.findOne({ code: roomId })
    if (!existing) {
      return res.status(404).json({ error: "Room not found." })
    }

    if (existing.status === "ended") {
      return res.status(410).json({ error: "This stream has ended." })
    }

    const updates = req.body || {}

    const nextQueue = Array.isArray(updates.queue)
      ? sanitizeQueue(updates.queue, existing.hostName || "Host")
      : sanitizeQueue(existing.queue, existing.hostName || "Host")

    const safeIndex = clampQueueIndex(
      Number.isInteger(updates.currentQueueIndex) ? updates.currentQueueIndex : existing.currentQueueIndex,
      nextQueue.length,
    )

    const activeItem = nextQueue[safeIndex]

    existing.name = typeof updates.name === "string" && updates.name.trim() ? updates.name.trim() : existing.name
    existing.slug = slugify(existing.name)
    existing.videoUrl = typeof updates.videoUrl === "string" && updates.videoUrl.trim()
      ? updates.videoUrl.trim()
      : activeItem?.url || existing.videoUrl
    existing.videoId = typeof updates.videoId === "string" && updates.videoId.trim()
      ? updates.videoId.trim()
      : activeItem?.videoId || existing.videoId
    existing.joinPolicy = normalizeJoinPolicy(updates.joinPolicy || existing.joinPolicy)
    existing.queue = nextQueue
    existing.currentQueueIndex = safeIndex
    if (typeof updates.controlsLocked === "boolean") {
      existing.controlsLocked = updates.controlsLocked
    }
    if (typeof updates.loopEnabled === "boolean") {
      existing.loopEnabled = updates.loopEnabled
    }

    if (updates.playback && typeof updates.playback === "object") {
      existing.playback.isPlaying = Boolean(updates.playback.isPlaying)
      const nextCurrentTime = Number(updates.playback.currentTime)
      const nextPlaybackRate = Number(updates.playback.playbackRate)
      existing.playback.currentTime = Number.isFinite(nextCurrentTime)
        ? Math.max(0, nextCurrentTime)
        : existing.playback.currentTime
      existing.playback.playbackRate = Number.isFinite(nextPlaybackRate) && nextPlaybackRate > 0
        ? nextPlaybackRate
        : existing.playback.playbackRate
      existing.playback.updatedAt = new Date()
      existing.playback.updatedBy = String(updates.playback.updatedBy || "")
    }

    await existing.save()

    return res.json({ success: true, room: toRoomPayload(existing) })
  } catch (error) {
    console.error("Failed to update stream room:", error)
    return res.status(500).json({ error: "Failed to update room." })
  }
})

router.post("/join-requests", async (req, res) => {
  try {
    const { roomId, name, requesterId } = req.body || {}
    if (!roomId || typeof roomId !== "string") {
      return res.status(400).json({ error: "roomId is required." })
    }

    const normalizedRequesterId = String(requesterId || "").trim()
    if (!normalizedRequesterId) {
      return res.status(400).json({ error: "requesterId is required." })
    }

    const normalizedId = normalizeRoomCode(roomId)
    const room = await StreamRoom.findOne({ code: normalizedId })
    if (!room) {
      return res.status(404).json({ error: "Room not found." })
    }

    if (room.status === "ended") {
      return res.status(410).json({ error: "This stream has ended." })
    }

    const existingRequest = (room.joinRequests || []).find((request) => request.requesterId === normalizedRequesterId)
    if (existingRequest) {
      return res.json({
        success: true,
        request: existingRequest,
        decision: existingRequest.decision || "pending",
        reused: true,
      })
    }

    const request = {
      id: `jr-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      requesterId: normalizedRequesterId,
      name: (typeof name === "string" && name.trim()) || "Guest",
      requestedAt: new Date(),
      decision: "pending",
    }

    room.joinRequests.push(request)
    room.joinRequests = room.joinRequests.slice(-200)
    await room.save()

    const io = req.app.get("io")
    if (io) {
      io.to(normalizedId).emit("stream:join-request:created", {
        id: request.id,
        name: request.name,
        requestedAt: request.requestedAt,
      })
    }

    return res.json({ success: true, request, decision: "pending" })
  } catch (error) {
    console.error("Failed to create join request:", error)
    return res.status(500).json({ error: "Failed to create join request." })
  }
})

router.get("/join-requests/:roomId", async (req, res) => {
  try {
    const roomId = normalizeRoomCode(req.params.roomId)
    const room = await StreamRoom.findOne({ code: roomId })
    if (!room) {
      return res.status(404).json({ error: "Room not found." })
    }

    const requests = [...(room.joinRequests || [])]
      .filter((request) => request.decision === "pending")
      .sort((a, b) => new Date(a.requestedAt).getTime() - new Date(b.requestedAt).getTime())
      .map(({ id, name, requestedAt, requesterId }) => ({ id, name, requestedAt, requesterId }))

    return res.json({ success: true, requests })
  } catch (error) {
    console.error("Failed to fetch join requests:", error)
    return res.status(500).json({ error: "Failed to fetch join requests." })
  }
})

router.post("/join-requests/:roomId/:requestId/decision", async (req, res) => {
  try {
    const roomId = normalizeRoomCode(req.params.roomId)
    const room = await StreamRoom.findOne({ code: roomId })
    if (!room) {
      return res.status(404).json({ error: "Room not found." })
    }

    const requestId = String(req.params.requestId || "")
    const decision = req.body?.decision

    if (decision !== "approved" && decision !== "rejected") {
      return res.status(400).json({ error: "decision must be approved or rejected." })
    }

    const targetIndex = (room.joinRequests || []).findIndex((request) => request.id === requestId)
    if (targetIndex === -1) {
      return res.status(404).json({ error: "Join request not found." })
    }

    room.joinRequests[targetIndex].decision = decision
    room.joinRequests[targetIndex].decidedAt = new Date()
    await room.save()

    const io = req.app.get("io")
    if (io) {
      io.to(roomId).emit("stream:join-request:decision", {
        requestId,
        decision,
      })
    }

    return res.json({ success: true })
  } catch (error) {
    console.error("Failed to update join decision:", error)
    return res.status(500).json({ error: "Failed to update join decision." })
  }
})

router.get("/join-requests/:roomId/:requestId/decision", async (req, res) => {
  try {
    const roomId = normalizeRoomCode(req.params.roomId)
    const room = await StreamRoom.findOne({ code: roomId })
    if (!room) {
      return res.status(404).json({ error: "Room not found." })
    }

    const requestId = String(req.params.requestId || "")
    const existing = (room.joinRequests || []).find((request) => request.id === requestId)

    if (!existing) {
      return res.status(404).json({ error: "Join request not found." })
    }

    return res.json({ success: true, decision: existing.decision || "pending" })
  } catch (error) {
    console.error("Failed to fetch join decision:", error)
    return res.status(500).json({ error: "Failed to fetch join decision." })
  }
})

router.post("/rooms/:roomId/end", async (req, res) => {
  try {
    const roomId = normalizeRoomCode(req.params.roomId)
    const room = await StreamRoom.findOne({ code: roomId })
    if (!room) {
      return res.status(404).json({ error: "Room not found." })
    }

    room.status = "ended"
    room.endedAt = new Date()
    room.playback.isPlaying = false
    room.playback.updatedAt = new Date()
    await room.save()

    const io = req.app.get("io")
    if (io) {
      io.to(roomId).emit("stream:ended", {
        reason: "host_ended",
        message: "The host ended this stream.",
      })
    }

    return res.json({ success: true })
  } catch (error) {
    console.error("Failed to end room:", error)
    return res.status(500).json({ error: "Failed to end room." })
  }
})

router.post("/invite-email", authenticateToken, async (req, res) => {
  try {
    const { email, roomId, roomName, inviteLink, joinPolicy } = req.body || {}

    if (!isValidEmail(email)) {
      return res.status(400).json({ error: "A valid email is required." })
    }

    if (!roomId || !roomName || !inviteLink) {
      return res.status(400).json({ error: "Missing required invite data." })
    }

    const inviterName = req.user?.name || req.user?.email || "A YouTube Mate user"
    const policyLine =
      joinPolicy === "approval"
        ? "This room requires host approval before joining."
        : "You can join this room directly using the invite link."

    const safeRoomName = String(roomName)
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")

    const html = `
      <div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6;">
        <h2 style="margin: 0 0 12px; color: #f97316;">You are invited to join a stream</h2>
        <p style="margin: 0 0 8px;"><strong>${inviterName}</strong> invited you to join:</p>
        <p style="margin: 0 0 16px; font-size: 18px;"><strong>${safeRoomName}</strong></p>
        <p style="margin: 0 0 20px;">${policyLine}</p>
        <p style="margin: 0 0 20px;">
          <a href="${inviteLink}" style="display: inline-block; background: linear-gradient(135deg, #f97316, #dc2626); color: #ffffff; text-decoration: none; padding: 12px 18px; border-radius: 8px; font-weight: 700;">Join Stream</a>
        </p>
        <p style="margin: 0; font-size: 13px; color: #6b7280; word-break: break-all;">${inviteLink}</p>
      </div>
    `

    const result = await sendEmail(email.trim(), `Stream invite: ${safeRoomName} - YouTube Mate`, html)

    if (!result.success) {
      return res.status(500).json({ error: result.error || "Failed to send invite email." })
    }

    return res.json({ success: true, message: "Invite sent." })
  } catch (error) {
    console.error("Failed to send stream invite email:", error)
    return res.status(500).json({ error: "Failed to send invite email." })
  }
})

module.exports = router
