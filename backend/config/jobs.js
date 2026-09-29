const cron = require("node-cron")
const { cleanupOldFiles } = require("../utils/fileUtils")
const { startTranscriptCleanupJob } = require("../jobs/cleanupTranscripts")
const { runCleanup: runVideoQACleanup } = require("../jobs/cleanupVideoQA")

/**
 * Cron Jobs Configuration
 * Sets up all scheduled background jobs
 */

/**
 * Initialize all cron jobs
 */
const initializeCronJobs = () => {
  console.log("Initializing cron jobs...")

  // Cleanup old downloaded files every hour
  cron.schedule("0 * * * *", () => {
    console.log("Running file cleanup...")
    try {
      cleanupOldFiles(24) // Clean files older than 24 hours
    } catch (error) {
      console.error("Error in file cleanup job:", error)
    }
  })
  console.log(" File cleanup job scheduled (hourly)")

  // Start transcript cleanup job (runs every hour)
  startTranscriptCleanupJob()
  console.log(" Transcript cleanup job scheduled (hourly)")

  // Video Q&A cleanup job (runs daily at 3 AM)
  cron.schedule("0 3 * * *", async () => {
    console.log("Running Video Q&A cleanup...")
    try {
      await runVideoQACleanup()
    } catch (error) {
      console.error("Error in Video Q&A cleanup job:", error)
    }
  })
  console.log("   ✅ Video Q&A cleanup job scheduled (daily at 3 AM)")

  console.log("✅ All cron jobs initialized")
}

/**
 * Stop all cron jobs (for graceful shutdown)
 */
const stopCronJobs = () => {
  console.log(" Stopping cron jobs...")
  cron.getTasks().forEach((task) => task.stop())
  console.log("All cron jobs stopped")
}

module.exports = {
  initializeCronJobs,
  stopCronJobs,
}
