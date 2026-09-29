const express = require("express")
const cors = require("cors")
const helmet = require("helmet")
const morgan = require("morgan")
const passport = require("./config/passport")
const swaggerUi = require("swagger-ui-express")
const swaggerSpec = require("./config/swagger")
const mongoose = require("mongoose")

/**
 * Express Application Configuration
 * Sets up middleware, routes, and error handling
 */

/**
 * Create and configure Express application
 * @param {Object} io - Socket.IO server instance
 * @returns {Express} Configured Express app
 */
const createApp = (io) => {
  const app = express()

  // Allowed origins for CORS
  const allowedOrigins = [
    process.env.FRONTEND_URL || "http://localhost:3000",
    "https://youtube-mate-mu.vercel.app",
    "http://localhost:3001",
  ]

  // ============================================
  // Security & General Middleware
  // ============================================

  // Security headers
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" },
    })
  )

  // CORS configuration
  app.use(
    cors({
      origin: allowedOrigins,
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept"],
      exposedHeaders: ["Content-Disposition", "Content-Length"],
    })
  )

  // Handle preflight requests
  app.options("*", cors())

  // HTTP request logging
  app.use(morgan("combined"))

  // Body parsing
  app.use(express.json({ limit: "20mb" }))
  app.use(express.urlencoded({ extended: true, limit: "20mb" }))

  // Trust proxy in production (for proper IP detection behind proxies)
  if (process.env.NODE_ENV === "production") {
    app.set("trust proxy", 1)
  }

  // ============================================
  // Passport Authentication (requires session)
  // Note: Session middleware must be added before this
  // ============================================

  app.use(passport.initialize())
  app.use(passport.session())

  // ============================================
  // Socket.IO Integration
  // ============================================

  // Make Socket.IO available to routes
  app.set("io", io)

  // ============================================
  // Health Check & Root Endpoints
  // ============================================

  app.get("/health", (req, res) => {
    res.status(200).json({
      status: "OK",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      mongodb: mongoose.connection.readyState === 1 ? "Connected" : "Disconnected",
      environment: process.env.NODE_ENV || "development",
    })
  })

  app.get("/", (req, res) => {
    res.json({
      message: "YouTube Mate API is running",
      status: "OK",
      mongodb: mongoose.connection.readyState === 1 ? "Connected" : "Disconnected",
      timestamp: new Date().toISOString(),
      documentation: "/api-docs",
      version: process.env.npm_package_version || "1.0.0",
    })
  })

  // ============================================
  // API Documentation (Swagger)
  // ============================================

  app.use(
    "/api-docs",
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, {
      customCss: ".swagger-ui .topbar { display: none }",
      customSiteTitle: "YouTube Mate API Documentation",
      customfavIcon: "/favicon.ico",
    })
  )

  app.get("/api-docs.json", (req, res) => {
    res.setHeader("Content-Type", "application/json")
    res.send(swaggerSpec)
  })

  // ============================================
  // API Routes
  // ============================================

  // Load routes (lazy loading to ensure models are ready)
  const authRoutes = require("./routes/auth")
  const urlRoutes = require("./routes/urls")
  const analyticsRoutes = require("./routes/analytics")
  const redirectRoutes = require("./routes/redirect")
  const downloadRoutes = require("./routes/downloads")
  const transcriptRoutes = require("./routes/transcript")
  const videoQARoutes = require("./routes/videoQA")
  const stripeRoutes = require("./routes/stripe")
  const playlistRoutes = require("./routes/playlists")
  const playlistItemRoutes = require("./routes/playlistItems")
  const youtubeRoutes = require("./routes/youtube")
  const streamRoutes = require("./routes/stream")

  // Mount routes
  app.use("/api/auth", authRoutes)
  app.use("/api/urls", urlRoutes)
  app.use("/api/analytics", analyticsRoutes)
  app.use("/api/downloads", downloadRoutes)
  app.use("/api/transcript", transcriptRoutes)
  app.use("/api/video-qa", videoQARoutes)
  app.use("/api/stripe", stripeRoutes)
  app.use("/api/playlists", playlistRoutes)
  app.use("/api/playlists", playlistItemRoutes) // Additional playlist routes
  app.use("/api/youtube", youtubeRoutes)
  app.use("/api/stream", streamRoutes)

  // ============================================
  // Static File Serving
  // ============================================

  // Serve downloaded files
  app.use("/downloads", express.static(process.env.DOWNLOAD_DIR || "./downloads"))

  // ============================================
  // Fallback Routes
  // ============================================

  // Fallback auth routes for compatibility (redirect to API routes)
  app.use("/auth", authRoutes)

  // Handle short URL redirects (must be last as it catches all remaining routes)
  app.use("/", redirectRoutes)

  // ============================================
  // Error Handling
  // ============================================

  // Global error handler
  app.use((err, req, res, next) => {
    console.error("❌ Error:", err.stack)

    // Don't leak error details in production
    const errorResponse = {
      error: "Something went wrong!",
      message: process.env.NODE_ENV === "development" ? err.message : "Internal server error",
    }

    // Add stack trace in development
    if (process.env.NODE_ENV === "development") {
      errorResponse.stack = err.stack
    }

    res.status(err.status || 500).json(errorResponse)
  })

  // 404 handler (must be last)
  app.use("*", (req, res) => {
    res.status(404).json({
      error: "Route not found",
      path: req.originalUrl,
      method: req.method,
    })
  })

  console.log("✅ Express app configured")
  console.log(`   Environment: ${process.env.NODE_ENV || "development"}`)
  console.log(`   CORS origins: ${allowedOrigins.length} configured`)

  return app
}

module.exports = { createApp }
