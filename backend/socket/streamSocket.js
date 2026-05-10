const StreamRoom = require("../models/StreamRoom")
const {
  normalizeRoomCode,
  sanitizeQueue,
  clampQueueIndex,
  resolvePlayback,
} = require("../utils/streamRoom")

const roomParticipants = new Map()
const socketMembership = new Map()

function getRoomParticipants(roomCode) {
  if (!roomParticipants.has(roomCode)) {
    roomParticipants.set(roomCode, new Map())
  }
  return roomParticipants.get(roomCode)
}

function serializeParticipants(roomCode) {
  return [...getRoomParticipants(roomCode).values()].map((participant) => ({
    id: participant.id,
    name: participant.name,
    isHost: participant.isHost,
    isMuted: Boolean(participant.isMuted),
    isVideoOn: Boolean(participant.isVideoOn),
    isSpeaking: Boolean(participant.isSpeaking),
  }))
}

function toRoomPayload(roomDoc) {
  const playback = resolvePlayback(roomDoc.playback)
  const safeQueue = sanitizeQueue(roomDoc.queue, roomDoc.hostName || "Host")
  const queueIndex = clampQueueIndex(roomDoc.currentQueueIndex, safeQueue.length)
  const currentItem = safeQueue[queueIndex] || null

  return {
    id: roomDoc.code,
    name: roomDoc.name,
    slug: roomDoc.slug,
    videoUrl: currentItem?.url || roomDoc.videoUrl,
    videoId: currentItem?.videoId || roomDoc.videoId,
    joinPolicy: roomDoc.joinPolicy,
    status: roomDoc.status,
    queue: safeQueue,
    currentQueueIndex: queueIndex,
    controlsLocked: Boolean(roomDoc.controlsLocked),
    loopEnabled: Boolean(roomDoc.loopEnabled),
    playback: {
      isPlaying: playback.isPlaying,
      currentTime: playback.currentTime,
      playbackRate: playback.playbackRate,
      updatedAt: playback.updatedAt,
      updatedBy: playback.updatedBy,
    },
    messages: Array.isArray(roomDoc.chatMessages)
      ? roomDoc.chatMessages.map((message) => ({
          id: message.id,
          userId: message.userId,
          userName: message.userName,
          text: message.text,
          timestamp: message.timestamp,
          replyTo: message.replyTo?.id
            ? {
                id: message.replyTo.id,
                userName: message.replyTo.userName,
                text: message.replyTo.text,
              }
            : undefined,
        }))
      : [],
  }
}

async function emitRoomState(io, roomCode) {
  const roomDoc = await StreamRoom.findOne({ code: roomCode })
  if (!roomDoc) return

  io.to(roomCode).emit("stream:state", {
    room: toRoomPayload(roomDoc),
    participants: serializeParticipants(roomCode),
  })
}

function initializeStreamSocket(io) {
  io.on("connection", (socket) => {
    socket.on("stream:join", async (payload, callback = () => {}) => {
      try {
        const roomCode = normalizeRoomCode(payload?.roomCode)
        if (!roomCode) {
          callback({ ok: false, error: "Room code is required." })
          return
        }

        const roomDoc = await StreamRoom.findOne({ code: roomCode })
        if (!roomDoc) {
          callback({ ok: false, error: "Room not found." })
          return
        }

        if (roomDoc.status === "ended") {
          callback({ ok: false, error: "This stream has ended.", reason: "ended" })
          return
        }

        const hostId = String(payload?.hostId || "").trim()
        const isHost = Boolean(hostId) && hostId === roomDoc.hostId

        if (!isHost && roomDoc.status !== "live") {
          callback({ ok: false, error: "Stream has not started yet.", reason: "not_started" })
          return
        }

        if (!isHost && roomDoc.joinPolicy === "approval") {
          const requestId = String(payload?.requestId || "").trim()
          const joinRequest = roomDoc.joinRequests.find((request) => request.id === requestId)
          if (!joinRequest || joinRequest.decision !== "approved") {
            callback({ ok: false, error: "Host approval is required.", reason: "approval_required" })
            return
          }
        }

        if (isHost && roomDoc.status !== "live") {
          roomDoc.status = "live"
          roomDoc.startedAt = roomDoc.startedAt || new Date()
          await roomDoc.save()
        }

        const participantName = String(payload?.name || "Guest").trim() || "Guest"
        const roomMap = getRoomParticipants(roomCode)

        // Prevent duplicate host entries for the same room
        if (isHost) {
          for (const [sid, p] of roomMap.entries()) {
            if (p.isHost) {
              roomMap.delete(sid)
              socketMembership.delete(sid)
              // We don't disconnect the old socket to avoid infinite loops if it's the same client
              // but we clean up its membership so it doesn't affect the state
            }
          }
        }

        roomMap.set(socket.id, {
          id: socket.id,
          name: participantName,
          isHost,
          isMuted: true,
          isVideoOn: false,
          isSpeaking: false,
        })

        socket.join(roomCode)
        socketMembership.set(socket.id, { roomCode, isHost, name: participantName })

        const freshRoomDoc = await StreamRoom.findOne({ code: roomCode })
        callback({
          ok: true,
          room: toRoomPayload(freshRoomDoc),
          participants: serializeParticipants(roomCode),
          selfId: socket.id,
          isHost,
        })

        io.to(roomCode).emit("stream:participants", {
          participants: serializeParticipants(roomCode),
        })
      } catch (error) {
        console.error("stream:join error", error)
        callback({ ok: false, error: "Failed to join stream." })
      }
    })

    socket.on("stream:chat:send", async (payload, callback = () => {}) => {
      try {
        const membership = socketMembership.get(socket.id)
        if (!membership) {
          callback({ ok: false, error: "Not joined in any room." })
          return
        }

        const text = String(payload?.text || "").trim()
        if (!text) {
          callback({ ok: false, error: "Message cannot be empty." })
          return
        }

        const roomDoc = await StreamRoom.findOne({ code: membership.roomCode })
        if (!roomDoc || roomDoc.status === "ended") {
          callback({ ok: false, error: "Room unavailable." })
          return
        }

        const message = {
          id: `msg-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          userId: socket.id,
          userName: membership.name,
          text,
          timestamp: new Date(),
          replyTo: payload?.replyTo?.id
            ? {
                id: String(payload.replyTo.id),
                userName: String(payload.replyTo.userName || ""),
                text: String(payload.replyTo.text || ""),
              }
            : undefined,
        }

        roomDoc.chatMessages.push(message)
        if (roomDoc.chatMessages.length > 200) {
          roomDoc.chatMessages = roomDoc.chatMessages.slice(-200)
        }
        await roomDoc.save()

        io.to(membership.roomCode).emit("stream:chat:new", message)
        callback({ ok: true })
      } catch (error) {
        console.error("stream:chat:send error", error)
        callback({ ok: false, error: "Failed to send message." })
      }
    })

    socket.on("stream:reaction", (payload) => {
      const membership = socketMembership.get(socket.id)
      if (!membership) return
      const emoji = String(payload?.emoji || "").trim()
      if (!emoji) return

      io.to(membership.roomCode).emit("stream:reaction", {
        id: `react-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        emoji,
        userId: socket.id,
        userName: membership.name,
        timestamp: new Date().toISOString(),
      })
    })

    socket.on("stream:participant:rename", async (payload) => {
      const membership = socketMembership.get(socket.id)
      if (!membership) return
      const nextName = String(payload?.name || "").trim()
      if (!nextName) return

      membership.name = nextName
      socketMembership.set(socket.id, membership)

      const roomMap = getRoomParticipants(membership.roomCode)
      const participant = roomMap.get(socket.id)
      if (participant) {
        participant.name = nextName
        roomMap.set(socket.id, participant)
      }

      if (membership.isHost) {
        try {
          const roomDoc = await StreamRoom.findOne({ code: membership.roomCode })
          if (roomDoc && roomDoc.status !== "ended") {
            roomDoc.hostName = nextName
            await roomDoc.save()
          }
        } catch (error) {
          console.error("stream:participant:rename error", error)
        }
      }

      io.to(membership.roomCode).emit("stream:participants", {
        participants: serializeParticipants(membership.roomCode),
      })
    })

    socket.on("stream:media:state", (payload) => {
      const membership = socketMembership.get(socket.id)
      if (!membership) return

      const roomMap = getRoomParticipants(membership.roomCode)
      const participant = roomMap.get(socket.id)
      if (!participant) return

      participant.isMuted = Boolean(payload?.isMuted)
      participant.isVideoOn = Boolean(payload?.isVideoOn)
      participant.isSpeaking = Boolean(payload?.isSpeaking)
      roomMap.set(socket.id, participant)

      io.to(membership.roomCode).emit("stream:participant:media", {
        participantId: socket.id,
        isMuted: participant.isMuted,
        isVideoOn: participant.isVideoOn,
        isSpeaking: participant.isSpeaking,
      })
    })

    socket.on("stream:queue:update", async (payload, callback = () => {}) => {
      try {
        const membership = socketMembership.get(socket.id)
        if (!membership) {
          callback({ ok: false, error: "Not in room." })
          return
        }

        const roomDoc = await StreamRoom.findOne({ code: membership.roomCode })
        if (!roomDoc || roomDoc.status === "ended") {
          callback({ ok: false, error: "Room unavailable." })
          return
        }

        const safeQueue = sanitizeQueue(payload?.queue, membership.name)
        const safeIndex = clampQueueIndex(payload?.currentQueueIndex, safeQueue.length)

        roomDoc.queue = safeQueue
        roomDoc.currentQueueIndex = safeIndex

        const activeItem = safeQueue[safeIndex]
        if (activeItem) {
          roomDoc.videoId = activeItem.videoId
          roomDoc.videoUrl = activeItem.url
        }

        await roomDoc.save()
        await emitRoomState(io, membership.roomCode)
        callback({ ok: true })
      } catch (error) {
        console.error("stream:queue:update error", error)
        callback({ ok: false, error: "Failed to update queue." })
      }
    })

    socket.on("stream:playback:update", async (payload) => {
      try {
        const membership = socketMembership.get(socket.id)
        if (!membership) return

        const roomDoc = await StreamRoom.findOne({ code: membership.roomCode })
        if (!roomDoc || roomDoc.status === "ended") return

        const nextIsPlaying = Boolean(payload?.isPlaying)
        const nextCurrentTime = Number(payload?.currentTime)
        const nextPlaybackRate = Number(payload?.playbackRate)

        roomDoc.playback.isPlaying = nextIsPlaying
        roomDoc.playback.currentTime = Number.isFinite(nextCurrentTime) ? Math.max(0, nextCurrentTime) : roomDoc.playback.currentTime
        roomDoc.playback.playbackRate = Number.isFinite(nextPlaybackRate) && nextPlaybackRate > 0 ? nextPlaybackRate : roomDoc.playback.playbackRate || 1
        roomDoc.playback.updatedAt = new Date()
        roomDoc.playback.updatedBy = socket.id

        await roomDoc.save()

        socket.to(membership.roomCode).emit("stream:playback:sync", {
          action: String(payload?.action || "sync"),
          isPlaying: roomDoc.playback.isPlaying,
          currentTime: roomDoc.playback.currentTime,
          playbackRate: roomDoc.playback.playbackRate,
          updatedBy: socket.id,
          timestamp: roomDoc.playback.updatedAt,
        })
      } catch (error) {
        console.error("stream:playback:update error", error)
      }
    })

    socket.on("stream:controls:update", async (payload, callback = () => {}) => {
      try {
        const membership = socketMembership.get(socket.id)
        if (!membership || !membership.isHost) {
          callback({ ok: false, error: "Only host can update controls." })
          return
        }

        const roomDoc = await StreamRoom.findOne({ code: membership.roomCode })
        if (!roomDoc || roomDoc.status === "ended") {
          callback({ ok: false, error: "Room unavailable." })
          return
        }

        if (typeof payload?.controlsLocked === "boolean") {
          roomDoc.controlsLocked = payload.controlsLocked
        }
        if (typeof payload?.loopEnabled === "boolean") {
          roomDoc.loopEnabled = payload.loopEnabled
        }

        await roomDoc.save()

        io.to(membership.roomCode).emit("stream:controls:sync", {
          controlsLocked: Boolean(roomDoc.controlsLocked),
          loopEnabled: Boolean(roomDoc.loopEnabled),
        })

        callback({ ok: true })
      } catch (error) {
        console.error("stream:controls:update error", error)
        callback({ ok: false, error: "Failed to update controls." })
      }
    })

    socket.on("stream:webrtc:offer", (payload) => {
      if (!payload?.to || !payload?.offer) return
      io.to(payload.to).emit("stream:webrtc:offer", {
        from: socket.id,
        offer: payload.offer,
      })
    })

    socket.on("stream:webrtc:answer", (payload) => {
      if (!payload?.to || !payload?.answer) return
      io.to(payload.to).emit("stream:webrtc:answer", {
        from: socket.id,
        answer: payload.answer,
      })
    })

    socket.on("stream:webrtc:ice-candidate", (payload) => {
      if (!payload?.to || !payload?.candidate) return
      io.to(payload.to).emit("stream:webrtc:ice-candidate", {
        from: socket.id,
        candidate: payload.candidate,
      })
    })

    socket.on("stream:end", async (callback = () => {}) => {
      try {
        const membership = socketMembership.get(socket.id)
        if (!membership || !membership.isHost) {
          callback({ ok: false, error: "Only host can end the stream." })
          return
        }

        const roomDoc = await StreamRoom.findOne({ code: membership.roomCode })
        if (!roomDoc) {
          callback({ ok: false, error: "Room not found." })
          return
        }

        roomDoc.status = "ended"
        roomDoc.endedAt = new Date()
        roomDoc.playback.isPlaying = false
        roomDoc.playback.updatedAt = new Date()
        await roomDoc.save()

        io.to(membership.roomCode).emit("stream:ended", {
          reason: "host_ended",
          message: "The host ended this stream.",
        })

        callback({ ok: true })
      } catch (error) {
        console.error("stream:end error", error)
        callback({ ok: false, error: "Failed to end stream." })
      }
    })

    socket.on("disconnect", async () => {
      const membership = socketMembership.get(socket.id)
      socketMembership.delete(socket.id)
      if (!membership) return

      const roomMap = getRoomParticipants(membership.roomCode)
      roomMap.delete(socket.id)

      if (roomMap.size === 0) {
        roomParticipants.delete(membership.roomCode)
      }

      io.to(membership.roomCode).emit("stream:participants", {
        participants: serializeParticipants(membership.roomCode),
      })

      if (membership.isHost) {
        try {
          const roomDoc = await StreamRoom.findOne({ code: membership.roomCode })
          if (roomDoc && roomDoc.status === "live") {
            roomDoc.status = "waiting"
            roomDoc.playback.isPlaying = false
            roomDoc.playback.updatedAt = new Date()
            await roomDoc.save()
            io.to(membership.roomCode).emit("stream:host:offline", {
              message: "Host disconnected. New joins are paused until host returns.",
            })
          }
        } catch (error) {
          console.error("disconnect host handling error", error)
        }
      }
    })
  })
}

module.exports = {
  initializeStreamSocket,
}
