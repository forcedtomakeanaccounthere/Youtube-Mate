const mongoose = require("mongoose")

/**
 * MongoDB Database Configuration
 * Handles database connection with proper error handling and configuration
 */

/**
 * Connect to MongoDB with optimized settings
 */
const connectToMongoDB = async () => {
  try {
    // Validate MongoDB URI
    if (!process.env.MONGODB_URI) {
      throw new Error("MONGODB_URI environment variable is required")
    }

    // Set mongoose configuration for better connection handling
    mongoose.set("bufferCommands", false) // Disable command buffering

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 30000, // 30 seconds
      socketTimeoutMS: 45000, // 45 seconds
      maxPoolSize: 10,
      bufferCommands: false, // Disable mongoose buffering
    })

    console.log("✅ Connected to MongoDB successfully")
    console.log(`   Database: ${mongoose.connection.name}`)
    console.log(`   Host: ${mongoose.connection.host}`)

    return true
  } catch (err) {
    console.error("❌ MongoDB connection error:", err)
    return false
  }
}

/**
 * Close MongoDB connection gracefully
 */
const closeDatabaseConnection = async () => {
  try {
    await mongoose.connection.close()
    console.log("✅ MongoDB connection closed.")
  } catch (err) {
    console.error("❌ Error closing MongoDB connection:", err)
    throw err
  }
}

/**
 * Get current connection status
 */
const getConnectionStatus = () => {
  const states = {
    0: "Disconnected",
    1: "Connected",
    2: "Connecting",
    3: "Disconnecting",
  }

  return {
    status: states[mongoose.connection.readyState] || "Unknown",
    isConnected: mongoose.connection.readyState === 1,
    database: mongoose.connection.name,
    host: mongoose.connection.host,
  }
}

/**
 * Handle MongoDB connection events
 */
const setupConnectionHandlers = () => {
  mongoose.connection.on("connected", () => {
    console.log("📡 MongoDB connection established")
  })

  mongoose.connection.on("error", (err) => {
    console.error("❌ MongoDB connection error:", err)
  })

  mongoose.connection.on("disconnected", () => {
    console.log("📴 MongoDB disconnected")
  })

  // Handle process termination
  process.on("SIGINT", async () => {
    await closeDatabaseConnection()
    process.exit(0)
  })
}

module.exports = {
  connectToMongoDB,
  closeDatabaseConnection,
  getConnectionStatus,
  setupConnectionHandlers,
}
