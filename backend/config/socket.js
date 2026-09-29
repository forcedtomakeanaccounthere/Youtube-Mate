const { Server } = require("socket.io")
const { initializeStreamSocket } = require("../socket/streamSocket")

/**
 * Socket.IO Configuration
 * Sets up Socket.IO server with proper CORS and handlers
 */

/**
 * Create and configure Socket.IO server
 * @param {http.Server} httpServer - HTTP server instance
 * @returns {Server} Socket.IO server instance
 */
const createSocketServer = (httpServer) => {
  const allowedOrigins = [
    process.env.FRONTEND_URL || "http://localhost:3000",
    "https://youtube-mate-mu.vercel.app",
    "http://localhost:3001",
  ]

  const io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins,
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    },
  })

  console.log("✅ Socket.IO server created")
  console.log(`   Allowed origins: ${allowedOrigins.join(", ")}`)

  // Initialize stream socket handlers
  initializeStreamSocket(io)

  // Connection event logging
  io.on("connection", (socket) => {
    console.log(`🔌 Client connected: ${socket.id}`)

    socket.on("disconnect", (reason) => {
      console.log(`🔌 Client disconnected: ${socket.id} (${reason})`)
    })
  })

  return io
}

module.exports = {
  createSocketServer,
}
