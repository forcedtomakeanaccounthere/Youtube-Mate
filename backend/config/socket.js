const { Server } = require("socket.io")
const { createAdapter } = require("@socket.io/redis-adapter")
const { initializeStreamSocket } = require("../socket/streamSocket")
const { getRedis, getSubscriber, getPublisher, isRedisEnabled } = require("./redis")

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

  // Redis adapter (horizontal scaling): when REDIS_URL is set, socket events
  // are pub/sub'd across instances so rooms work behind a load balancer.
  // Without Redis the default in-memory adapter is used (single instance).
  if (isRedisEnabled()) {
    try {
      const pubClient = getPublisher()
      const subClient = getSubscriber()
      io.adapter(createAdapter(pubClient, subClient))
      console.log("✅ Socket.IO Redis adapter enabled")
    } catch (error) {
      console.warn("⚠️  Socket.IO Redis adapter failed to initialize, using in-memory:", error.message)
    }
  }

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
