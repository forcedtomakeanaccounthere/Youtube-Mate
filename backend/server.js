const express = require("express")
const http = require("http")
const mongoose = require("mongoose")
const cors = require("cors")
const helmet = require("helmet")
const morgan = require("morgan")
const session = require("express-session")
const MongoStore = require("connect-mongo")
const { Server } = require("socket.io")
const passport = require("./config/passport")
const cron = require("node-cron")
require("dotenv").config({ quiet: true })
const { initializeStreamSocket } = require("./socket/streamSocket")

// Initialize email service after environment variables are loaded
const { initializeEmailService } = require("./services/emailService")
initializeEmailService()

// Import utilities
const { cleanupOldFiles } = require("./utils/fileUtils")

const app = express()
const httpServer = http.createServer(app)

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

initializeStreamSocket(io)
app.set("io", io)

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}))
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
    exposedHeaders: ['Content-Disposition', 'Content-Length']
  }),
)

// Logging
app.use(morgan("combined"))

// Body parsing middleware
app.use(express.json({ limit: "10mb" }))
app.use(express.urlencoded({ extended: true }))

// Handle preflight requests
app.options('*', cors())

// Trust proxy in production
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1)
}

// Connect to MongoDB
const connectToMongoDB = async () => {
  try {
    // Set mongoose configuration for better connection handling
    mongoose.set('bufferCommands', false); // Disable command buffering
    
    await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/youtube-mate", {
      serverSelectionTimeoutMS: 30000, // 30 seconds
      socketTimeoutMS: 45000, // 45 seconds
      maxPoolSize: 10,
      bufferCommands: false, // Disable mongoose buffering
    });
    
    console.log("✅ Connected to MongoDB successfully");
    return true;
  } catch (err) {
    console.error("❌ MongoDB connection error:", err);
    return false;
  }
};

// Initialize MongoDB connection before starting server
const startServer = async () => {
  // Validate required environment variables
  if (!process.env.MONGODB_URI) {
    console.error("❌ MONGODB_URI environment variable is required");
    process.exit(1);
  }

  if (!process.env.SESSION_SECRET) {
    console.warn("⚠️  SESSION_SECRET not set, using default (not recommended for production)");
  }

  const mongoConnected = await connectToMongoDB();
  
  if (!mongoConnected) {
    console.error("Failed to connect to MongoDB. Server will exit.");
    process.exit(1);
  }

  console.log("✅ MongoDB connection established, initializing session store...");

  // Load routes after MongoDB connection to prevent model index creation timeouts
  const authRoutes = require("./routes/auth")
  const urlRoutes = require("./routes/urls")
  const analyticsRoutes = require("./routes/analytics")
  const redirectRoutes = require("./routes/redirect")
  const downloadRoutes = require("./routes/downloads")
  const transcriptRoutes = require("./routes/transcript")
  const stripeRoutes = require("./routes/stripe")

  // Session middleware with MongoDB store (after MongoDB connection)
  app.use(session({
    secret: process.env.SESSION_SECRET || "your-session-secret",
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGODB_URI,
      touchAfter: 24 * 3600, // lazy session update - only touch session once in 24 hours
      ttl: 14 * 24 * 60 * 60, // session TTL of 14 days
      autoRemove: 'native', // automatically remove expired sessions
      collectionName: 'sessions',
      stringify: false,
    }),
    cookie: { 
      secure: process.env.NODE_ENV === 'production', // Set to true in production with HTTPS
      maxAge: 14 * 24 * 60 * 60 * 1000, // 14 days in milliseconds
      httpOnly: true,
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
    }
  }))

  console.log("✅ Session store initialized with MongoDB");

  // Initialize Passport (after session)
  app.use(passport.initialize())
  app.use(passport.session())

  // Health check endpoint (must be before catch-all routes)
  app.get("/health", (req, res) => {
    res.status(200).json({
      status: "OK",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      mongodb: mongoose.connection.readyState === 1 ? "Connected" : "Disconnected"
    })
  })

  // Root endpoint with status
  app.get("/", (req, res) => {
    res.json({ 
      message: "YouTube Mate API is running",
      status: "OK",
      mongodb: mongoose.connection.readyState === 1 ? "Connected" : "Disconnected",
      timestamp: new Date().toISOString()
    })
  })

  // API Routes
  app.use("/api/auth", authRoutes)
  app.use("/api/urls", urlRoutes)
  app.use("/api/analytics", analyticsRoutes)
  app.use("/api/downloads", downloadRoutes)
  app.use("/api/transcript", transcriptRoutes)
  app.use("/api/stripe", stripeRoutes)
  app.use("/api/playlists", require("./routes/playlists"))
  app.use("/api/playlists", require("./routes/playlistItems"))
  app.use("/api/youtube", require("./routes/youtube"))
  app.use("/api/stream", require("./routes/stream"))

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
  httpServer.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`)
  })
};

// Start the server
startServer().catch(err => {
  console.error("Failed to start server:", err);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Received SIGINT. Graceful shutdown...');
  try {
    await mongoose.connection.close();
    console.log('✅ MongoDB connection closed.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error during shutdown:', err);
    process.exit(1);
  }
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Received SIGTERM. Graceful shutdown...');
  try {
    await mongoose.connection.close();
    console.log('✅ MongoDB connection closed.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error during shutdown:', err);
    process.exit(1);
  }
});

module.exports = app