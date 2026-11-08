const { Queue } = require("bullmq")
const { getRedis, isRedisEnabled } = require("../config/redis")

/**
 * Queue Service (BullMQ)
 *
 * Moves background work (downloads) out of the API process into dedicated
 * workers. Gated by DOWNLOAD_QUEUE_MODE:
 *
 *   "inline"  (default) — behavior identical to the original app: work runs
 *              in the API process. No Redis required.
 *   "bullmq"  — jobs are enqueued and processed by workers/downloadWorker.js
 *              (run `node worker.js` or a container). Requires REDIS_URL.
 *
 * Horizontal scale: run the API with DOWNLOAD_QUEUE_MODE=bullmq and
 * ENABLE_CRON=false, plus one or more `node worker.js` processes.
 */

const QUEUE_NAME = "downloads"
const QUEUE_OPTIONS = {
  connection: null, // resolved lazily from config/redis
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: { age: 3600, count: 500 },
    removeOnFail: { age: 24 * 3600 },
  },
}

let downloadsQueue = null

function getQueueMode() {
  return (process.env.DOWNLOAD_QUEUE_MODE || "inline").trim().toLowerCase()
}

/**
 * True when the API should enqueue downloads instead of processing inline.
 */
function shouldEnqueueDownloads() {
  return getQueueMode() === "bullmq" && isRedisEnabled()
}

/**
 * Get (or lazily create) the downloads queue. Returns null when Redis is off.
 */
function getDownloadsQueue() {
  if (!isRedisEnabled()) return null

  if (!downloadsQueue) {
    const connection = getRedis()
    downloadsQueue = new Queue(QUEUE_NAME, { ...QUEUE_OPTIONS, connection })
    downloadsQueue.on("error", (err) => {
      console.error("Downloads queue error:", err.message)
    })
  }
  return downloadsQueue
}

/**
 * Enqueue a download job.
 * @param {Object} job - { downloadId, downloadData, options }
 */
async function enqueueDownload(job) {
  const queue = getDownloadsQueue()
  if (!queue) throw new Error("Downloads queue unavailable (Redis not configured)")

  const queued = await queue.add("process-download", job, {
    jobId: `dl-${job.downloadId}`,
  })

  console.log(`📥 Download ${job.downloadId} queued (job ${queued.id})`)
  return queued
}

/**
 * Close queues gracefully.
 */
async function closeQueues() {
  if (downloadsQueue) {
    await downloadsQueue.close()
    downloadsQueue = null
  }
}

module.exports = { getQueueMode, shouldEnqueueDownloads, getDownloadsQueue, enqueueDownload, closeQueues, QUEUE_NAME }
