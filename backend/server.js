const express = require("express")
const mongoose = require("mongoose")
const cors = require("cors")
const helmet = require("helmet")
const morgan = require("morgan")
const session = require("express-session")
const passport = require("./config/passport")
const cron = require("node-cron")
require("dotenv").config({ quiet: true })

// Initialize email service after environment variables are loaded
const { initializeEmailService } = require("./services/emailService")
initializeEmailService()

const authRoutes = require("./routes/auth")
const urlRoutes = require("./routes/urls")
const analyticsRoutes = require("./routes/analytics")
const redirectRoutes = require("./routes/redirect")
const downloadRoutes = require("./routes/downloads")
const transcriptRoutes = require("./routes/transcript")

// Import utilities
const { cleanupOldFiles } = require("./utils/fileUtils")

const app = express()

// Security middleware
app.use(helmet())
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  }),
)

// Session middleware (required for Passport)
app.use(session({
  secret: process.env.SESSION_SECRET || "your-session-secret",
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false } // Set to true in production with HTTPS
}))

// Initialize Passport
app.use(passport.initialize())
app.use(passport.session())

// Logging
app.use(morgan("combined"))

// Body parsing middleware
app.use(express.json({ limit: "10mb" }))
app.use(express.urlencoded({ extended: true }))

// Connect to MongoDB
mongoose
  .connect(process.env.MONGODB_URI || "mongodb://localhost:27017/youtube-mate")
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err))

// Health check endpoint (must be before catch-all routes)
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  })
})

// API Routes
app.use("/api/auth", authRoutes)
app.use("/api/urls", urlRoutes)
app.use("/api/analytics", analyticsRoutes)
app.use("/api/downloads", downloadRoutes)
app.use("/api/transcript", transcriptRoutes)
app.use("/api/playlists", require("./routes/playlists"))
app.use("/api/playlists", require("./routes/playlistItems"))
app.use("/api/youtube", require("./routes/youtube"))

// Serve download files
app.use("/downloads", express.static(process.env.DOWNLOAD_DIR || "./downloads"))

// Fallback auth routes for compatibility (redirect to API routes)
app.use("/auth", authRoutes)

// Handle short URL redirects (must be last as it catches all remaining routes)
app.use("/", redirectRoutes)

// Cleanup old files every hour
cron.schedule("0 * * * *", () => {
  console.log("🧹 Running file cleanup...")
  cleanupOldFiles(24) // Clean files older than 24 hours
})

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(500).json({
    error: "Something went wrong!",
    message: process.env.NODE_ENV === "development" ? err.message : "Internal server error",
  })
})

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({ error: "Route not found" })
})

const PORT = process.env.PORT || 5000
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})

module.exports = app