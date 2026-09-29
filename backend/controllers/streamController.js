const streamService = require("../services/streamService")

/**
 * Stream Controller
 * Handles HTTP requests/responses for streaming/watch party endpoints
 */
class StreamController {
  /**
   * Create a new streaming room
   * POST /api/stream/rooms
   */
  async createRoom(req, res) {
    try {
      const room = await streamService.createRoom(req.body || {})
      res.json({ success: true, room })
    } catch (error) {
      console.error("Failed to create stream room:", error)

      if (
        error.message.includes("required") ||
        error.message.includes("format") ||
        error.message.includes("unavailable")
      ) {
        return res.status(400).json({ error: error.message })
      }

      if (error.message.includes("unavailable")) {
        return res.status(409).json({ error: error.message })
      }

      res.status(500).json({ error: "Failed to create room" })
    }
  }

  /**
   * Get room by ID
   * GET /api/stream/rooms/:roomId
   */
  async getRoom(req, res) {
    try {
      const room = await streamService.getRoom(req.params.roomId)
      res.json({ success: true, room })
    } catch (error) {
      console.error("Failed to fetch stream room:", error)

      if (error.message === "Room not found") {
        return res.status(404).json({ error: error.message })
      }

      if (error.message === "This stream has ended") {
        return res.status(410).json({ error: error.message, status: "ended" })
      }

      res.status(500).json({ error: "Failed to fetch room" })
    }
  }

  /**
   * Update room settings
   * PATCH /api/stream/rooms/:roomId
   */
  async updateRoom(req, res) {
    try {
      const room = await streamService.updateRoom(req.params.roomId, req.body || {})
      res.json({ success: true, room })
    } catch (error) {
      console.error("Failed to update stream room:", error)

      if (error.message === "Room not found") {
        return res.status(404).json({ error: error.message })
      }

      if (error.message === "This stream has ended") {
        return res.status(410).json({ error: error.message })
      }

      res.status(500).json({ error: "Failed to update room" })
    }
  }

  /**
   * Create join request
   * POST /api/stream/join-requests
   */
  async createJoinRequest(req, res) {
    try {
      const { roomId, name, requesterId } = req.body || {}
      const result = await streamService.createJoinRequest(roomId, requesterId, name)

      // Emit socket event if available
      if (result.roomCode && !result.reused) {
        const io = req.app.get("io")
        if (io) {
          io.to(result.roomCode).emit("stream:join-request:created", {
            id: result.request.id,
            name: result.request.name,
            requestedAt: result.request.requestedAt,
          })
        }
      }

      res.json({ success: true, ...result })
    } catch (error) {
      console.error("Failed to create join request:", error)

      if (error.message.includes("required")) {
        return res.status(400).json({ error: error.message })
      }

      if (error.message === "Room not found") {
        return res.status(404).json({ error: error.message })
      }

      if (error.message === "This stream has ended") {
        return res.status(410).json({ error: error.message })
      }

      res.status(500).json({ error: "Failed to create join request" })
    }
  }

  /**
   * Get pending join requests
   * GET /api/stream/join-requests/:roomId
   */
  async getJoinRequests(req, res) {
    try {
      const requests = await streamService.getJoinRequests(req.params.roomId)
      res.json({ success: true, requests })
    } catch (error) {
      console.error("Failed to fetch join requests:", error)

      if (error.message === "Room not found") {
        return res.status(404).json({ error: error.message })
      }

      res.status(500).json({ error: "Failed to fetch join requests" })
    }
  }

  /**
   * Update join decision
   * POST /api/stream/join-requests/:roomId/:requestId/decision
   */
  async updateJoinDecision(req, res) {
    try {
      const { decision } = req.body || {}
      const result = await streamService.updateJoinDecision(req.params.roomId, req.params.requestId, decision)

      // Emit socket event if available
      if (result.roomCode) {
        const io = req.app.get("io")
        if (io) {
          io.to(result.roomCode).emit("stream:join-request:decision", {
            requestId: result.requestId,
            decision: result.decision,
          })
        }
      }

      res.json({ success: true })
    } catch (error) {
      console.error("Failed to update join decision:", error)

      if (error.message.includes("must be")) {
        return res.status(400).json({ error: error.message })
      }

      if (error.message === "Room not found" || error.message === "Join request not found") {
        return res.status(404).json({ error: error.message })
      }

      res.status(500).json({ error: "Failed to update join decision" })
    }
  }

  /**
   * Get join decision status
   * GET /api/stream/join-requests/:roomId/:requestId/decision
   */
  async getJoinDecision(req, res) {
    try {
      const result = await streamService.getJoinDecision(req.params.roomId, req.params.requestId)
      res.json({ success: true, ...result })
    } catch (error) {
      console.error("Failed to fetch join decision:", error)

      if (error.message === "Room not found" || error.message === "Join request not found") {
        return res.status(404).json({ error: error.message })
      }

      res.status(500).json({ error: "Failed to fetch join decision" })
    }
  }

  /**
   * End streaming room
   * POST /api/stream/rooms/:roomId/end
   */
  async endRoom(req, res) {
    try {
      const result = await streamService.endRoom(req.params.roomId)

      // Emit socket event if available
      if (result.roomCode) {
        const io = req.app.get("io")
        if (io) {
          io.to(result.roomCode).emit("stream:ended", {
            reason: "host_ended",
            message: result.message,
          })
        }
      }

      res.json({ success: true })
    } catch (error) {
      console.error("Failed to end room:", error)

      if (error.message === "Room not found") {
        return res.status(404).json({ error: error.message })
      }

      res.status(500).json({ error: "Failed to end room" })
    }
  }

  /**
   * Send invite email
   * POST /api/stream/invite-email
   */
  async sendInviteEmail(req, res) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Authentication required" })
      }

      const { email, roomId, roomName, inviteLink, joinPolicy } = req.body || {}
      const inviterName = req.user.name || req.user.email || "A YouTube Mate user"

      const result = await streamService.sendInviteEmail(email, { roomId, roomName, inviteLink, joinPolicy }, inviterName)

      res.json({ success: true, ...result })
    } catch (error) {
      console.error("Failed to send stream invite email:", error)

      if (error.message.includes("email") || error.message.includes("required")) {
        return res.status(400).json({ error: error.message })
      }

      res.status(500).json({ error: "Failed to send invite email" })
    }
  }
}

module.exports = new StreamController()
