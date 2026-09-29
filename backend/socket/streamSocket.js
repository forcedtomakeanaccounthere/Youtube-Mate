const streamHandler = require("./handlers/streamHandler");

/**
 * Initialize Stream Socket.IO handlers
 * Sets up all real-time event listeners for watch party rooms
 */
function initializeStreamSocket(io) {
  io.on("connection", (socket) => {
    // Join a stream room
    socket.on("stream:join", (payload, callback) => {
      streamHandler.handleJoin(socket, io, payload, callback);
    });

    // Send chat message
    socket.on("stream:chat:send", (payload, callback) => {
      streamHandler.handleChatSend(socket, io, payload, callback);
    });

    // Send reaction emoji
    socket.on("stream:reaction", (payload) => {
      streamHandler.handleReaction(socket, io, payload);
    });

    // Rename participant
    socket.on("stream:participant:rename", (payload) => {
      streamHandler.handleParticipantRename(socket, io, payload);
    });

    // Update media state (mute, video, speaking)
    socket.on("stream:media:state", (payload) => {
      streamHandler.handleMediaState(socket, io, payload);
    });

    // Update queue
    socket.on("stream:queue:update", (payload, callback) => {
      streamHandler.handleQueueUpdate(socket, io, payload, callback);
    });

    // Update playback state
    socket.on("stream:playback:update", (payload) => {
      streamHandler.handlePlaybackUpdate(socket, io, payload);
    });

    // Update controls (lock, loop)
    socket.on("stream:controls:update", (payload, callback) => {
      streamHandler.handleControlsUpdate(socket, io, payload, callback);
    });

    // WebRTC signaling: offer
    socket.on("stream:webrtc:offer", (payload) => {
      streamHandler.handleWebRTCOffer(socket, io, payload);
    });

    // WebRTC signaling: answer
    socket.on("stream:webrtc:answer", (payload) => {
      streamHandler.handleWebRTCAnswer(socket, io, payload);
    });

    // WebRTC signaling: ICE candidate
    socket.on("stream:webrtc:ice-candidate", (payload) => {
      streamHandler.handleWebRTCIceCandidate(socket, io, payload);
    });

    // End stream (host only)
    socket.on("stream:end", (callback) => {
      streamHandler.handleEnd(socket, io, callback);
    });

    // Handle disconnect
    socket.on("disconnect", () => {
      streamHandler.handleDisconnect(socket, io);
    });
  });
}

module.exports = {
  initializeStreamSocket,
};

