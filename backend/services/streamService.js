const StreamRoom = require("../models/StreamRoom")
const { sendEmail } = require("../services/emailService")
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

/**
 * Stream Service
 * Handles business logic for watch party/streaming rooms
 */
class StreamService {
  /**
   * Format room document to payload
   */
  toRoomPayload(roomDoc) {
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

  /**
   * Generate unique room code
   */
  async createUniqueRoomCode() {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const code = generateMeetingCode()
      const existing = await StreamRoom.findOne({ code })
      if (!existing) return code
    }

    throw new Error("Unable to generate unique room code")
  }

  /**
   * Create a new streaming room
   */
  async createRoom(data) {
    const { roomId, name, videoUrl, videoId, joinPolicy, queue, currentQueueIndex, hostId, hostName } = data

    if (!name || !videoUrl || !videoId) {
      throw new Error("name, videoUrl, and videoId are required")
    }

    const requestedCode = normalizeRoomCode(roomId)
    if (requestedCode && !isValidRoomCode(requestedCode)) {
      throw new Error("Room code format must be like ynj-rnfd-uhx")
    }

    const nextHostId = String(hostId || "").trim() || `host-${Date.now()}-${Math.floor(Math.random() * 1000)}`
    const code = requestedCode || (await this.createUniqueRoomCode())

    const existingRoom = await StreamRoom.findOne({ code })
    if (existingRoom) {
      throw new Error("This room code is unavailable. Please generate a new code")
    }

    const safeQueue = sanitizeQueue(queue, hostName || "Host")
    const queueWithInitial =
      safeQueue.length > 0
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

    return this.toRoomPayload(room)
  }

  /**
   * Get room by ID
   */
  async getRoom(roomId) {
    const normalizedId = normalizeRoomCode(roomId)
    const room = await StreamRoom.findOne({ code: normalizedId })

    if (!room) {
      throw new Error("Room not found")
    }

    if (room.status === "ended") {
      throw new Error("This stream has ended")
    }

    return this.toRoomPayload(room)
  }

  /**
   * Update room settings
   */
  async updateRoom(roomId, updates) {
    const normalizedId = normalizeRoomCode(roomId)
    const existing = await StreamRoom.findOne({ code: normalizedId })

    if (!existing) {
      throw new Error("Room not found")
    }

    if (existing.status === "ended") {
      throw new Error("This stream has ended")
    }

    const nextQueue = Array.isArray(updates.queue)
      ? sanitizeQueue(updates.queue, existing.hostName || "Host")
      : sanitizeQueue(existing.queue, existing.hostName || "Host")

    const safeIndex = clampQueueIndex(
      Number.isInteger(updates.currentQueueIndex) ? updates.currentQueueIndex : existing.currentQueueIndex,
      nextQueue.length
    )

    const activeItem = nextQueue[safeIndex]

    existing.name = typeof updates.name === "string" && updates.name.trim() ? updates.name.trim() : existing.name
    existing.slug = slugify(existing.name)
    existing.videoUrl =
      typeof updates.videoUrl === "string" && updates.videoUrl.trim()
        ? updates.videoUrl.trim()
        : activeItem?.url || existing.videoUrl
    existing.videoId =
      typeof updates.videoId === "string" && updates.videoId.trim()
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
      existing.playback.playbackRate =
        Number.isFinite(nextPlaybackRate) && nextPlaybackRate > 0 ? nextPlaybackRate : existing.playback.playbackRate
      existing.playback.updatedAt = new Date()
      existing.playback.updatedBy = String(updates.playback.updatedBy || "")
    }

    await existing.save()

    return this.toRoomPayload(existing)
  }

  /**
   * Create a join request
   */
  async createJoinRequest(roomId, requesterId, name) {
    if (!roomId || typeof roomId !== "string") {
      throw new Error("roomId is required")
    }

    const normalizedRequesterId = String(requesterId || "").trim()
    if (!normalizedRequesterId) {
      throw new Error("requesterId is required")
    }

    const normalizedId = normalizeRoomCode(roomId)
    const room = await StreamRoom.findOne({ code: normalizedId })

    if (!room) {
      throw new Error("Room not found")
    }

    if (room.status === "ended") {
      throw new Error("This stream has ended")
    }

    const existingRequest = (room.joinRequests || []).find((request) => request.requesterId === normalizedRequesterId)
    if (existingRequest) {
      return {
        request: existingRequest,
        decision: existingRequest.decision || "pending",
        reused: true,
      }
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

    return {
      request,
      decision: "pending",
      roomCode: normalizedId,
    }
  }

  /**
   * Get pending join requests for a room
   */
  async getJoinRequests(roomId) {
    const normalizedId = normalizeRoomCode(roomId)
    const room = await StreamRoom.findOne({ code: normalizedId })

    if (!room) {
      throw new Error("Room not found")
    }

    const requests = [...(room.joinRequests || [])]
      .filter((request) => request.decision === "pending")
      .sort((a, b) => new Date(a.requestedAt).getTime() - new Date(b.requestedAt).getTime())
      .map(({ id, name, requestedAt, requesterId }) => ({ id, name, requestedAt, requesterId }))

    return requests
  }

  /**
   * Update join request decision
   */
  async updateJoinDecision(roomId, requestId, decision) {
    const normalizedId = normalizeRoomCode(roomId)
    const room = await StreamRoom.findOne({ code: normalizedId })

    if (!room) {
      throw new Error("Room not found")
    }

    if (decision !== "approved" && decision !== "rejected") {
      throw new Error("decision must be approved or rejected")
    }

    const targetIndex = (room.joinRequests || []).findIndex((request) => request.id === requestId)
    if (targetIndex === -1) {
      throw new Error("Join request not found")
    }

    room.joinRequests[targetIndex].decision = decision
    room.joinRequests[targetIndex].decidedAt = new Date()
    await room.save()

    return {
      roomCode: normalizedId,
      requestId,
      decision,
    }
  }

  /**
   * Get join decision status
   */
  async getJoinDecision(roomId, requestId) {
    const normalizedId = normalizeRoomCode(roomId)
    const room = await StreamRoom.findOne({ code: normalizedId })

    if (!room) {
      throw new Error("Room not found")
    }

    const existing = (room.joinRequests || []).find((request) => request.id === requestId)

    if (!existing) {
      throw new Error("Join request not found")
    }

    return {
      decision: existing.decision || "pending",
    }
  }

  /**
   * End a streaming room
   */
  async endRoom(roomId) {
    const normalizedId = normalizeRoomCode(roomId)
    const room = await StreamRoom.findOne({ code: normalizedId })

    if (!room) {
      throw new Error("Room not found")
    }

    room.status = "ended"
    room.endedAt = new Date()
    room.playback.isPlaying = false
    room.playback.updatedAt = new Date()
    await room.save()

    return {
      roomCode: normalizedId,
      message: "The host ended this stream",
    }
  }

  /**
   * Send invite email
   */
  async sendInviteEmail(email, inviteData, inviterName) {
    if (!this.isValidEmail(email)) {
      throw new Error("A valid email is required")
    }

    const { roomId, roomName, inviteLink, joinPolicy } = inviteData

    if (!roomId || !roomName || !inviteLink) {
      throw new Error("Missing required invite data")
    }

    const policyLine =
      joinPolicy === "approval"
        ? "This room requires host approval before joining."
        : "You can join this room directly using the invite link."

    const safeRoomName = String(roomName).replace(/</g, "&lt;").replace(/>/g, "&gt;")

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
      throw new Error(result.error || "Failed to send invite email")
    }

    return { message: "Invite sent" }
  }

  /**
   * Validate email format
   */
  isValidEmail(email) {
    if (typeof email !== "string") return false
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  }

  /**
   * Get room by code (without throwing if not found)
   */
  async getRoomByCode(roomCode) {
    const normalizedId = normalizeRoomCode(roomCode)
    return await StreamRoom.findOne({ code: normalizedId })
  }

  /**
   * Update room status
   */
  async updateRoomStatus(roomCode, status) {
    const normalizedId = normalizeRoomCode(roomCode)
    const room = await StreamRoom.findOne({ code: normalizedId })

    if (!room) {
      throw new Error("Room not found")
    }

    room.status = status
    if (status === "live" && !room.startedAt) {
      room.startedAt = new Date()
    }
    await room.save()

    return room
  }

  /**
   * Update host name
   */
  async updateHostName(roomCode, hostName) {
    const normalizedId = normalizeRoomCode(roomCode)
    const room = await StreamRoom.findOne({ code: normalizedId })

    if (!room || room.status === "ended") {
      return null
    }

    room.hostName = String(hostName).trim() || "Host"
    await room.save()

    return room
  }

  /**
   * Add chat message to room
   */
  async addChatMessage(roomCode, messageData) {
    const normalizedId = normalizeRoomCode(roomCode)
    const room = await StreamRoom.findOne({ code: normalizedId })

    if (!room || room.status === "ended") {
      return null
    }

    const message = {
      id: `msg-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      userId: messageData.userId,
      userName: messageData.userName,
      text: messageData.text,
      timestamp: new Date(),
      replyTo: messageData.replyTo,
    }

    room.chatMessages.push(message)
    if (room.chatMessages.length > 200) {
      room.chatMessages = room.chatMessages.slice(-200)
    }
    await room.save()

    return message
  }

  /**
   * Update queue
   */
  async updateQueue(roomCode, queue, currentQueueIndex) {
    const normalizedId = normalizeRoomCode(roomCode)
    const room = await StreamRoom.findOne({ code: normalizedId })

    if (!room || room.status === "ended") {
      return null
    }

    room.queue = queue
    room.currentQueueIndex = currentQueueIndex

    const activeItem = queue[currentQueueIndex]
    if (activeItem) {
      room.videoId = activeItem.videoId
      room.videoUrl = activeItem.url
    }

    await room.save()

    return room
  }

  /**
   * Update playback state
   */
  async updatePlayback(roomCode, playbackData) {
    const normalizedId = normalizeRoomCode(roomCode)
    const room = await StreamRoom.findOne({ code: normalizedId })

    if (!room || room.status === "ended") {
      return null
    }

    if (typeof playbackData.isPlaying === "boolean") {
      room.playback.isPlaying = playbackData.isPlaying
    }

    const nextCurrentTime = Number(playbackData.currentTime)
    if (Number.isFinite(nextCurrentTime)) {
      room.playback.currentTime = Math.max(0, nextCurrentTime)
    }

    const nextPlaybackRate = Number(playbackData.playbackRate)
    if (Number.isFinite(nextPlaybackRate) && nextPlaybackRate > 0) {
      room.playback.playbackRate = nextPlaybackRate
    }

    room.playback.updatedAt = new Date()
    room.playback.updatedBy = String(playbackData.updatedBy || "")

    await room.save()

    return room.playback
  }

  /**
   * Update controls (lock, loop)
   */
  async updateControls(roomCode, controlsData) {
    const normalizedId = normalizeRoomCode(roomCode)
    const room = await StreamRoom.findOne({ code: normalizedId })

    if (!room || room.status === "ended") {
      return null
    }

    if (typeof controlsData.controlsLocked === "boolean") {
      room.controlsLocked = controlsData.controlsLocked
    }
    if (typeof controlsData.loopEnabled === "boolean") {
      room.loopEnabled = controlsData.loopEnabled
    }

    await room.save()

    return room
  }

  /**
   * End stream
   */
  async endStream(roomCode) {
    const normalizedId = normalizeRoomCode(roomCode)
    const room = await StreamRoom.findOne({ code: normalizedId })

    if (!room) {
      return null
    }

    room.status = "ended"
    room.endedAt = new Date()
    room.playback.isPlaying = false
    room.playback.updatedAt = new Date()
    await room.save()

    return room
  }
}

module.exports = new StreamService()
