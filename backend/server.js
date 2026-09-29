#!/usr/bin/env node

/**
 * YouTube Mate Server
 * Main entry point for the application
 * 
 * This file is now streamlined to only handle:
 * - Environment setup
 * - Server initialization
 * - Graceful shutdown
 * 
 * All configuration has been moved to separate modules:
 * - config/database.js - MongoDB connection
 * - config/session.js - Session configuration
 * - config/socket.js - Socket.IO setup
 * - config/jobs.js - Cron jobs
 * - app.js - Express app configuration
 */

require("dotenv").config({ quiet: true })
const http = require("http")
const { connectToMongoDB, closeDatabaseConnection, setupConnectionHandlers } = require("./config/database")
const { createSessionMiddleware } = require("./config/session")
const { createSocketServer } = require("./config/socket")
const { initializeCronJobs, stopCronJobs } = require("./config/jobs")
const { createApp } = require("./app")
const { initializeEmailService } = require("./services/emailService")

/**
 * Start the server
 */
const startServer = async () => {
  try {
    console.log("   Starting YouTube Mate Server...")
    console.log(`   Environment: ${process.env.NODE_ENV || "development"}`)
    console.log(`   Node version: ${process.version}`)

    // Validate required environment variables
    if (!process.env.MONGODB_URI) {
      throw new Error("MONGODB_URI environment variable is required")
    }

    // Initialize email service
    initializeEmailService()

    // Connect to MongoDB
    const mongoConnected = await connectToMongoDB()
    if (!mongoConnected) {
      throw new Error("Failed to connect to MongoDB")
    }

    // Setup MongoDB connection event handlers
    setupConnectionHandlers()

    // Create HTTP server
    const httpServer = http.createServer()

    // Create Socket.IO server
    const io = createSocketServer(httpServer)

    // Create Express app
    const app = createApp(io)

    // Add session middleware to app
    app.use(createSessionMiddleware())

    // Attach Express app to HTTP server
    httpServer.on("request", app)

    // Initialize cron jobs
    initializeCronJobs()

    // Start HTTP server
    const PORT = process.env.PORT || 5000
    httpServer.listen(PORT, () => {
      console.log("\n" + "-".repeat(50))
      console.log("SERVER STARTED SUCCESSFULLY")
      console.log("-".repeat(50))
      console.log(`Server running on port ${PORT}`)
      console.log(`API: http://localhost:${PORT}/api`)
      console.log(`Docs: http://localhost:${PORT}/api-docs`)
      console.log(`Health: http://localhost:${PORT}/health`)
      console.log("-".repeat(50) + "\n")
    })

    // Export for testing
    return { app, httpServer, io }
  } catch (err) {
    console.error("Failed to start server:", err)
    process.exit(1)
  }
}

/**
 * Graceful shutdown handler
 */
const gracefulShutdown = async (signal) => {
  console.log(`\n Received ${signal}. Starting graceful shutdown...`)

  try {
    // Stop cron jobs
    stopCronJobs()

    // Close database connection
    await closeDatabaseConnection()

    console.log("Graceful shutdown completed")
    process.exit(0)
  } catch (err) {
    console.error("Error during shutdown:", err)
    process.exit(1)
  }
}

// Handle graceful shutdown
process.on("SIGINT", () => gracefulShutdown("SIGINT"))
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"))

// Handle uncaught exceptions
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err)
  process.exit(1)
})

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason)
  process.exit(1)
})

// Start the server if this file is run directly
if (require.main === module) {
  startServer()
}

// Export for testing
module.exports = { startServer, gracefulShutdown }