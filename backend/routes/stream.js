const express = require("express")
const { authenticateToken } = require("../middleware/auth")
const { sendEmail } = require("../services/emailService")

const router = express.Router()
const streamRooms = new Map()
const joinRequestsByRoom = new Map()

const isValidEmail = (email) => {
  if (typeof email !== "string") return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}

const getRoomJoinMap = (roomId) => {
  if (!joinRequestsByRoom.has(roomId)) {
    joinRequestsByRoom.set(roomId, new Map())
  }
  return joinRequestsByRoom.get(roomId)
}

const normalizeRoomId = (roomId) => String(roomId || "").trim().toUpperCase()

router.post("/rooms", async (req, res) => {
  try {
    const { roomId, name, videoUrl, videoId, joinPolicy, queue, currentQueueIndex } = req.body || {}
    const normalizedId = normalizeRoomId(roomId)

    if (!normalizedId || !name || !videoUrl || !videoId) {
      return res.status(400).json({ error: "roomId, name, videoUrl, and videoId are required." })
    }

    const room = {
      id: normalizedId,
      name: String(name),
      videoUrl: String(videoUrl),
      videoId: String(videoId),
      joinPolicy: joinPolicy === "approval" ? "approval" : "open",
      queue: Array.isArray(queue) ? queue : [],
      currentQueueIndex: Number.isInteger(currentQueueIndex) ? currentQueueIndex : 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    streamRooms.set(normalizedId, room)
    return res.json({ success: true, room })
  } catch (error) {
    console.error("Failed to create stream room:", error)
    return res.status(500).json({ error: "Failed to create room." })
  }
})

router.get("/rooms/:roomId", async (req, res) => {
  try {
    const roomId = normalizeRoomId(req.params.roomId)
    const room = streamRooms.get(roomId)
    if (!room) {
      return res.status(404).json({ error: "Room not found." })
    }
    return res.json({ success: true, room })
  } catch (error) {
    console.error("Failed to fetch stream room:", error)
    return res.status(500).json({ error: "Failed to fetch room." })
  }
})

router.patch("/rooms/:roomId", async (req, res) => {
  try {
    const roomId = normalizeRoomId(req.params.roomId)
    const existing = streamRooms.get(roomId)
    if (!existing) {
      return res.status(404).json({ error: "Room not found." })
    }

    const updates = req.body || {}
    const room = {
      ...existing,
      name: typeof updates.name === "string" && updates.name.trim() ? updates.name.trim() : existing.name,
      videoUrl: typeof updates.videoUrl === "string" && updates.videoUrl.trim() ? updates.videoUrl.trim() : existing.videoUrl,
      videoId: typeof updates.videoId === "string" && updates.videoId.trim() ? updates.videoId.trim() : existing.videoId,
      joinPolicy: updates.joinPolicy === "approval" || updates.joinPolicy === "open" ? updates.joinPolicy : existing.joinPolicy,
      queue: Array.isArray(updates.queue) ? updates.queue : existing.queue,
      currentQueueIndex: Number.isInteger(updates.currentQueueIndex) ? updates.currentQueueIndex : existing.currentQueueIndex,
      updatedAt: new Date().toISOString(),
    }

    streamRooms.set(roomId, room)
    return res.json({ success: true, room })
  } catch (error) {
    console.error("Failed to update stream room:", error)
    return res.status(500).json({ error: "Failed to update room." })
  }
})

router.post("/join-requests", async (req, res) => {
  try {
    const { roomId, name } = req.body || {}
    if (!roomId || typeof roomId !== "string") {
      return res.status(400).json({ error: "roomId is required." })
    }

    const normalizedId = normalizeRoomId(roomId)
    if (!streamRooms.has(normalizedId)) {
      return res.status(404).json({ error: "Room not found." })
    }

    const request = {
      id: `jr-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      name: (typeof name === "string" && name.trim()) || "Guest",
      requestedAt: new Date().toISOString(),
      decision: "pending",
    }

    const roomJoinMap = getRoomJoinMap(normalizedId)
    roomJoinMap.set(request.id, request)

    return res.json({ success: true, request })
  } catch (error) {
    console.error("Failed to create join request:", error)
    return res.status(500).json({ error: "Failed to create join request." })
  }
})

router.get("/join-requests/:roomId", async (req, res) => {
  try {
    const roomId = normalizeRoomId(req.params.roomId)
    if (!streamRooms.has(roomId)) {
      return res.status(404).json({ error: "Room not found." })
    }

    const roomJoinMap = getRoomJoinMap(roomId)
    const requests = [...roomJoinMap.values()]
      .filter((request) => request.decision === "pending")
      .sort((a, b) => new Date(a.requestedAt).getTime() - new Date(b.requestedAt).getTime())
      .map(({ id, name, requestedAt }) => ({ id, name, requestedAt }))

    return res.json({ success: true, requests })
  } catch (error) {
    console.error("Failed to fetch join requests:", error)
    return res.status(500).json({ error: "Failed to fetch join requests." })
  }
})

router.post("/join-requests/:roomId/:requestId/decision", async (req, res) => {
  try {
    const roomId = normalizeRoomId(req.params.roomId)
    if (!streamRooms.has(roomId)) {
      return res.status(404).json({ error: "Room not found." })
    }

    const requestId = String(req.params.requestId || "")
    const decision = req.body?.decision

    if (decision !== "approved" && decision !== "rejected") {
      return res.status(400).json({ error: "decision must be approved or rejected." })
    }

    const roomJoinMap = getRoomJoinMap(roomId)
    const existing = roomJoinMap.get(requestId)
    if (!existing) {
      return res.status(404).json({ error: "Join request not found." })
    }

    roomJoinMap.set(requestId, { ...existing, decision, decidedAt: new Date().toISOString() })
    return res.json({ success: true })
  } catch (error) {
    console.error("Failed to update join decision:", error)
    return res.status(500).json({ error: "Failed to update join decision." })
  }
})

router.get("/join-requests/:roomId/:requestId/decision", async (req, res) => {
  try {
    const roomId = normalizeRoomId(req.params.roomId)
    if (!streamRooms.has(roomId)) {
      return res.status(404).json({ error: "Room not found." })
    }

    const requestId = String(req.params.requestId || "")
    const roomJoinMap = getRoomJoinMap(roomId)
    const existing = roomJoinMap.get(requestId)

    if (!existing) {
      return res.status(404).json({ error: "Join request not found." })
    }

    return res.json({ success: true, decision: existing.decision || "pending" })
  } catch (error) {
    console.error("Failed to fetch join decision:", error)
    return res.status(500).json({ error: "Failed to fetch join decision." })
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
