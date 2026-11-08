#!/usr/bin/env node

/**
 * Dedicated Worker Entry Point
 *
 * Runs background work separately from the API server:
 *   - BullMQ download workers (yt-dlp / FFmpeg processing)
 *   - Cron jobs (enabled by default here; disable on API instances with
 *     ENABLE_CRON=false so jobs run exactly once across the deployment)
 *
 * Usage:
 *   node worker.js                       # workers + cron
 *   WORKER_CONCURRENCY=4 node worker.js  # more parallel downloads
 *
 * Typical production topology (Render/any host):
 *   API service:     ENABLE_CRON=false DOWNLOAD_QUEUE_MODE=bullmq node server.js
 *   Worker service:  ENABLE_CRON=true DOWNLOAD_QUEUE_MODE=bullmq node worker.js
 */

require("dotenv").config({ quiet: true })

const { validateEnv } = require("./config/env")
const { connectToMongoDB, closeDatabaseConnection } = require("./config/database")
const { initializeCronJobs, stopCronJobs } = require("./config/jobs")
const { startDownloadWorker } = require("./workers/downloadWorker")
const { closeQueues } = require("./services/queueService")
const { closeRedis } = require("./config/redis")
const { initializeEmailService } = require("./services/emailService")

let shuttingDown = false

async function gracefulShutdown(signal) {
  if (shuttingDown) return
  shuttingDown = true
  console.log(`\n Received ${signal}. Starting worker graceful shutdown...`)

  try {
    stopCronJobs()
    await closeQueues()
    await closeDatabaseConnection()
    await closeRedis()
    console.log("Worker graceful shutdown completed")
    process.exit(0)
  } catch (err) {
    console.error("Error during worker shutdown:", err)
    process.exit(1)
  }
}

process.on("SIGINT", () => gracefulShutdown("SIGINT"))
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"))

async function startWorker() {
  try {
    console.log("   Starting YouTube Mate Worker...")
    console.log(`   Environment: ${process.env.NODE_ENV || "development"}`)

    validateEnv()

    const mongoConnected = await connectToMongoDB()
    if (!mongoConnected) {
      throw new Error("Failed to connect to MongoDB")
    }

    initializeEmailService()

    // Download queue workers
    const concurrency = Number.parseInt(process.env.WORKER_CONCURRENCY) || 2
    startDownloadWorker(concurrency)

    // Cron jobs (scheduler runs here, not on API instances)
    initializeCronJobs()

    console.log("\n" + "-".repeat(50))
    console.log("WORKER STARTED SUCCESSFULLY")
    console.log(`Download concurrency: ${concurrency}`)
    console.log("Cron jobs: enabled")
    console.log("-".repeat(50) + "\n")
  } catch (err) {
    console.error("Failed to start worker:", err)
    process.exit(1)
  }
}

startWorker()
