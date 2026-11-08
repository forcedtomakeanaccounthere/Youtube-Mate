const { Worker } = require("bullmq")
const { getRedis, isRedisEnabled } = require("../config/redis")
const { QUEUE_NAME } = require("../services/queueService")

/**
 * Download Worker
 *
 * Processes BullMQ download jobs in a dedicated process (`node worker.js`),
 * keeping yt-dlp/FFmpeg work off the API server.
 *
 * Job payload: { downloadId, downloadData, options }
 */

function startDownloadWorker(concurrency = 2) {
  if (!isRedisEnabled()) {
    throw new Error("Download worker requires REDIS_URL")
  }

  const connection = getRedis()

  const worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      const { downloadId, downloadData, options } = job.data
      console.log(`⚙️  Worker processing download ${downloadId} (job ${job.id}, attempt ${job.attemptsMade + 1})`)

      // Lazy require so the worker process initializes cleanly
      const downloadService = require("../services/downloadService")
      await downloadService.processDownload(downloadId, downloadData, options || {})

      return { downloadId, status: "processed" }
    },
    {
      connection,
      concurrency,
      lockDuration: 10 * 60 * 1000, // downloads can be long; renew via stall interval
      stalledInterval: 30 * 1000,
    }
  )

  worker.on("completed", (job) => {
    console.log(`✅ Download job ${job.id} completed (${job.data?.downloadId})`)
  })

  worker.on("failed", (job, err) => {
    console.error(`❌ Download job ${job?.id} failed (${job?.data?.downloadId}):`, err.message)
  })

  worker.on("error", (err) => {
    console.error("Download worker error:", err.message)
  })

  console.log(`⚙️  Download worker started (concurrency=${concurrency})`)
  return worker
}

module.exports = { startDownloadWorker }
