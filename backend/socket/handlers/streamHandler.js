const streamService = require("../../services/streamService");
const { normalizeRoomCode, sanitizeQueue, clampQueueIndex } = require("../../utils/streamRoom");

/**
 * In-memory participant tracking
 * Maps room codes to participant data
 */
const roomParticipants = new Map();

/**
 * In-memory socket membership tracking
 * Maps socket IDs to their room membership data
 */
const socketMembership = new Map();

/**
 * Playback persistence throttling — playback "sync" ticks arrive continuously
 * while a video plays; persisting every tick to MongoDB would hammer the
 * database. Ticks broadcast in realtime from memory; the DB is written on
 * discrete actions (play/pause/seek) and at most every PLAYBACK_PERSIST_MS
 * per room as a periodic checkpoint. room.playback stores {currentTime,
 * isPlaying, playbackRate, updatedAt}, so late joiners reconstruct drift
 * correctly from the last checkpoint.
 */
const PLAYBACK_PERSIST_MS = 5000;
const playbackLastPersist = new Map(); // roomCode -> timestamp
const playbackCache = new Map(); // roomCode -> last known playback state

/**
 * WebRTC signaling must never cross rooms: the target socket must be a
 * current participant of the SENDER's room. Without this check a malicious
 * client could signal (and receive signals from) arbitrary sockets anywhere
 * on the server.
 */
function getValidatedWebRTCTarget(socket, payload) {
  if (!payload?.to || !socketMembership.has(socket.id)) return null;

  const membership = socketMembership.get(socket.id);
  const target = String(payload.to);
  if (target === socket.id) return null;

  const roomMap = getRoomParticipants(membership.roomCode);
  if (!roomMap.has(target)) return null;

  return target;
}

/**
 * Get participants map for a room
 */
function getRoomParticipants(roomCode) {
  if (!roomParticipants.has(roomCode)) {
    roomParticipants.set(roomCode, new Map());
  }
  return roomParticipants.get(roomCode);
}

/**
 * Serialize participants for client transmission
 */
function serializeParticipants(roomCode) {
  return [...getRoomParticipants(roomCode).values()].map((participant) => ({
    id: participant.id,
    name: participant.name,
    isHost: participant.isHost,
    isMuted: Boolean(participant.isMuted),
    isVideoOn: Boolean(participant.isVideoOn),
    isSpeaking: Boolean(participant.isSpeaking),
  }));
}

/**
 * Emit complete room state to all participants
 */
async function emitRoomState(io, roomCode) {
  try {
    const room = await streamService.getRoomByCode(roomCode);
    if (!room) return;

    const roomPayload = streamService.toRoomPayload(room);
    
    io.to(roomCode).emit("stream:state", {
      room: roomPayload,
      participants: serializeParticipants(roomCode),
    });
  } catch (error) {
    console.error("Error emitting room state:", error);
  }
}

/**
 * Stream Socket Handler
 * Handles real-time Socket.IO events for watch party rooms
 */
class StreamHandler {
  /**
   * Handle user joining a stream room
   */
  async handleJoin(socket, io, payload, callback = () => {}) {
    try {
      const roomCode = normalizeRoomCode(payload?.roomCode);
      if (!roomCode) {
        callback({ ok: false, error: "Room code is required." });
        return;
      }

      // Get room from service
      const room = await streamService.getRoomByCode(roomCode);
      if (!room) {
        callback({ ok: false, error: "Room not found." });
        return;
      }

      // Check if stream has ended
      if (room.status === "ended") {
        callback({ ok: false, error: "This stream has ended.", reason: "ended" });
        return;
      }

      // Determine if user is host
      const hostId = String(payload?.hostId || "").trim();
      const isHost = Boolean(hostId) && hostId === room.hostId;

      // Non-hosts can't join if stream hasn't started
      if (!isHost && room.status !== "live") {
        callback({ ok: false, error: "Stream has not started yet.", reason: "not_started" });
        return;
      }

      // Check join approval for non-hosts
      if (!isHost && room.joinPolicy === "approval") {
        const requestId = String(payload?.requestId || "").trim();
        const joinRequest = room.joinRequests.find((request) => request.id === requestId);
        if (!joinRequest || joinRequest.decision !== "approved") {
          callback({ ok: false, error: "Host approval is required.", reason: "approval_required" });
          return;
        }
      }

      // If host joins, start the stream
      if (isHost && room.status !== "live") {
        await streamService.updateRoomStatus(roomCode, "live");
      }

      // Add participant to in-memory tracking
      const participantName = String(payload?.name || "Guest").trim() || "Guest";
      const roomMap = getRoomParticipants(roomCode);

      // Prevent duplicate host entries
      if (isHost) {
        for (const [sid, p] of roomMap.entries()) {
          if (p.isHost) {
            roomMap.delete(sid);
            socketMembership.delete(sid);
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
      });

      socket.join(roomCode);
      socketMembership.set(socket.id, { roomCode, isHost, name: participantName });

      // Get fresh room data and send to client
      const freshRoom = await streamService.getRoomByCode(roomCode);
      callback({
        ok: true,
        room: streamService.toRoomPayload(freshRoom),
        participants: serializeParticipants(roomCode),
        selfId: socket.id,
        isHost,
      });

      // Notify all participants of new user
      io.to(roomCode).emit("stream:participants", {
        participants: serializeParticipants(roomCode),
      });
    } catch (error) {
      console.error("stream:join error", error);
      callback({ ok: false, error: "Failed to join stream." });
    }
  }

  /**
   * Handle chat message
   */
  async handleChatSend(socket, io, payload, callback = () => {}) {
    try {
      const membership = socketMembership.get(socket.id);
      if (!membership) {
        callback({ ok: false, error: "Not joined in any room." });
        return;
      }

      const text = String(payload?.text || "").trim();
      if (!text) {
        callback({ ok: false, error: "Message cannot be empty." });
        return;
      }

      // Add message through service
      const message = await streamService.addChatMessage(membership.roomCode, {
        userId: socket.id,
        userName: membership.name,
        text,
        replyTo: payload?.replyTo?.id
          ? {
              id: String(payload.replyTo.id),
              userName: String(payload.replyTo.userName || ""),
              text: String(payload.replyTo.text || ""),
            }
          : undefined,
      });

      if (!message) {
        callback({ ok: false, error: "Room unavailable." });
        return;
      }

      // Broadcast message to all participants
      io.to(membership.roomCode).emit("stream:chat:new", message);
      callback({ ok: true });
    } catch (error) {
      console.error("stream:chat:send error", error);
      callback({ ok: false, error: "Failed to send message." });
    }
  }

  /**
   * Handle reaction emoji
   */
  handleReaction(socket, io, payload) {
    const membership = socketMembership.get(socket.id);
    if (!membership) return;

    const emoji = String(payload?.emoji || "").trim();
    if (!emoji) return;

    io.to(membership.roomCode).emit("stream:reaction", {
      id: `react-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      emoji,
      userId: socket.id,
      userName: membership.name,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Handle participant rename
   */
  async handleParticipantRename(socket, io, payload) {
    const membership = socketMembership.get(socket.id);
    if (!membership) return;

    const nextName = String(payload?.name || "").trim();
    if (!nextName) return;

    // Update in-memory tracking
    membership.name = nextName;
    socketMembership.set(socket.id, membership);

    const roomMap = getRoomParticipants(membership.roomCode);
    const participant = roomMap.get(socket.id);
    if (participant) {
      participant.name = nextName;
      roomMap.set(socket.id, participant);
    }

    // If host renamed, update in database
    if (membership.isHost) {
      try {
        await streamService.updateHostName(membership.roomCode, nextName);
      } catch (error) {
        console.error("stream:participant:rename error", error);
      }
    }

    // Notify all participants
    io.to(membership.roomCode).emit("stream:participants", {
      participants: serializeParticipants(membership.roomCode),
    });
  }

  /**
   * Handle media state update (mute, video, speaking)
   */
  handleMediaState(socket, io, payload) {
    const membership = socketMembership.get(socket.id);
    if (!membership) return;

    const roomMap = getRoomParticipants(membership.roomCode);
    const participant = roomMap.get(socket.id);
    if (!participant) return;

    participant.isMuted = Boolean(payload?.isMuted);
    participant.isVideoOn = Boolean(payload?.isVideoOn);
    participant.isSpeaking = Boolean(payload?.isSpeaking);
    roomMap.set(socket.id, participant);

    io.to(membership.roomCode).emit("stream:participant:media", {
      participantId: socket.id,
      isMuted: participant.isMuted,
      isVideoOn: participant.isVideoOn,
      isSpeaking: participant.isSpeaking,
    });
  }

  /**
   * Handle queue update
   */
  async handleQueueUpdate(socket, io, payload, callback = () => {}) {
    try {
      const membership = socketMembership.get(socket.id);
      if (!membership) {
        callback({ ok: false, error: "Not in room." });
        return;
      }

      const safeQueue = sanitizeQueue(payload?.queue, membership.name);
      const safeIndex = clampQueueIndex(payload?.currentQueueIndex, safeQueue.length);

      // Update queue through service
      await streamService.updateQueue(membership.roomCode, safeQueue, safeIndex);

      // Emit updated state
      await emitRoomState(io, membership.roomCode);
      callback({ ok: true });
    } catch (error) {
      console.error("stream:queue:update error", error);
      callback({ ok: false, error: "Failed to update queue." });
    }
  }

  /**
   * Handle playback update (play, pause, seek, sync tick)
   *
   * Every event broadcasts to the room in realtime; only discrete actions
   * and periodic checkpoints (>= PLAYBACK_PERSIST_MS apart) write to MongoDB.
   */
  async handlePlaybackUpdate(socket, io, payload) {
    try {
      const membership = socketMembership.get(socket.id);
      if (!membership) return;

      const roomCode = membership.roomCode;
      const action = String(payload?.action || "sync");
      const isDiscrete = action !== "sync";

      const lastPersist = playbackLastPersist.get(roomCode) || 0;
      const shouldPersist =
        isDiscrete || Date.now() - lastPersist >= PLAYBACK_PERSIST_MS;

      if (shouldPersist) {
        const playbackData = {
          isPlaying: Boolean(payload?.isPlaying),
          currentTime: Number(payload?.currentTime),
          playbackRate: Number(payload?.playbackRate),
          updatedBy: socket.id,
        };

        // Update playback through service (MongoDB)
        const updatedPlayback = await streamService.updatePlayback(roomCode, playbackData);

        if (!updatedPlayback) return;

        playbackLastPersist.set(roomCode, Date.now());
        playbackCache.set(roomCode, {
          isPlaying: updatedPlayback.isPlaying,
          currentTime: updatedPlayback.currentTime,
          playbackRate: updatedPlayback.playbackRate,
          updatedAt: updatedPlayback.updatedAt,
          updatedBy: socket.id,
        });

        var syncPayload = {
          action,
          isPlaying: updatedPlayback.isPlaying,
          currentTime: updatedPlayback.currentTime,
          playbackRate: updatedPlayback.playbackRate,
          updatedBy: socket.id,
          timestamp: updatedPlayback.updatedAt,
        };
      } else {
        // Broadcast-only tick: derive the payload from the incoming event
        // without touching MongoDB.
        const now = new Date();
        playbackCache.set(roomCode, {
          isPlaying: Boolean(payload?.isPlaying),
          currentTime: Number(payload?.currentTime),
          playbackRate: Number(payload?.playbackRate),
          updatedAt: now,
          updatedBy: socket.id,
        });

        var syncPayload = {
          action,
          isPlaying: Boolean(payload?.isPlaying),
          currentTime: Number(payload?.currentTime),
          playbackRate: Number(payload?.playbackRate),
          updatedBy: socket.id,
          timestamp: now,
        };
      }

      // Sync playback to other participants (not the sender)
      socket.to(roomCode).emit("stream:playback:sync", syncPayload);
    } catch (error) {
      console.error("stream:playback:update error", error);
    }
  }

  /**
   * Handle controls update (lock controls, enable loop)
   */
  async handleControlsUpdate(socket, io, payload, callback = () => {}) {
    try {
      const membership = socketMembership.get(socket.id);
      if (!membership || !membership.isHost) {
        callback({ ok: false, error: "Only host can update controls." });
        return;
      }

      const controlsData = {};
      if (typeof payload?.controlsLocked === "boolean") {
        controlsData.controlsLocked = payload.controlsLocked;
      }
      if (typeof payload?.loopEnabled === "boolean") {
        controlsData.loopEnabled = payload.loopEnabled;
      }

      // Update controls through service
      const updated = await streamService.updateControls(membership.roomCode, controlsData);
      
      if (!updated) {
        callback({ ok: false, error: "Room unavailable." });
        return;
      }

      // Sync to all participants
      io.to(membership.roomCode).emit("stream:controls:sync", {
        controlsLocked: Boolean(updated.controlsLocked),
        loopEnabled: Boolean(updated.loopEnabled),
      });

      callback({ ok: true });
    } catch (error) {
      console.error("stream:controls:update error", error);
      callback({ ok: false, error: "Failed to update controls." });
    }
  }

  /**
   * Handle WebRTC offer (same-room targets only)
   */
  handleWebRTCOffer(socket, io, payload) {
    if (!payload?.offer) return;
    const target = getValidatedWebRTCTarget(socket, payload);
    if (!target) return;
    io.to(target).emit("stream:webrtc:offer", {
      from: socket.id,
      offer: payload.offer,
    });
  }

  /**
   * Handle WebRTC answer (same-room targets only)
   */
  handleWebRTCAnswer(socket, io, payload) {
    if (!payload?.answer) return;
    const target = getValidatedWebRTCTarget(socket, payload);
    if (!target) return;
    io.to(target).emit("stream:webrtc:answer", {
      from: socket.id,
      answer: payload.answer,
    });
  }

  /**
   * Handle WebRTC ICE candidate (same-room targets only)
   */
  handleWebRTCIceCandidate(socket, io, payload) {
    if (!payload?.candidate) return;
    const target = getValidatedWebRTCTarget(socket, payload);
    if (!target) return;
    io.to(target).emit("stream:webrtc:ice-candidate", {
      from: socket.id,
      candidate: payload.candidate,
    });
  }

  /**
   * Handle stream end (host only)
   */
  async handleEnd(socket, io, callback = () => {}) {
    try {
      const membership = socketMembership.get(socket.id);
      if (!membership || !membership.isHost) {
        callback({ ok: false, error: "Only host can end the stream." });
        return;
      }

      // End stream through service
      const ended = await streamService.endStream(membership.roomCode);
      
      if (!ended) {
        callback({ ok: false, error: "Room not found." });
        return;
      }

      // Notify all participants
      io.to(membership.roomCode).emit("stream:ended", {
        reason: "host_ended",
        message: "The host ended this stream.",
      });

      callback({ ok: true });
    } catch (error) {
      console.error("stream:end error", error);
      callback({ ok: false, error: "Failed to end stream." });
    }
  }

  /**
   * Handle disconnect
   */
  async handleDisconnect(socket, io) {
    const membership = socketMembership.get(socket.id);
    socketMembership.delete(socket.id);
    if (!membership) return;

    const roomMap = getRoomParticipants(membership.roomCode);
    roomMap.delete(socket.id);

    // Clean up room tracking if empty
    if (roomMap.size === 0) {
      roomParticipants.delete(membership.roomCode);
      playbackLastPersist.delete(membership.roomCode);
      playbackCache.delete(membership.roomCode);
    }

    // Notify remaining participants
    io.to(membership.roomCode).emit("stream:participants", {
      participants: serializeParticipants(membership.roomCode),
    });

    // If host disconnected, pause the stream
    if (membership.isHost) {
      try {
        const room = await streamService.getRoomByCode(membership.roomCode);
        if (room && room.status === "live") {
          await streamService.updateRoomStatus(membership.roomCode, "waiting");
          await streamService.updatePlayback(membership.roomCode, { isPlaying: false });

          io.to(membership.roomCode).emit("stream:host:offline", {
            message: "Host disconnected. New joins are paused until host returns.",
          });
        }
      } catch (error) {
        console.error("disconnect host handling error", error);
      }
    }
  }
}

module.exports = new StreamHandler();
