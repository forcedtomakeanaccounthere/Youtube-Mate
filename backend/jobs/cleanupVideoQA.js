/**
 * Cleanup Job for Video Q&A
 * 
 * This job:
 * 1. Removes old Q&A sessions (older than 90 days)
 * 2. Removes orphaned usage records (older than 30 days)
 * 3. Provides statistics on cleanup operations
 * 
 * Run: node jobs/cleanupVideoQA.js
 * Or schedule with cron in server.js
 */

const VideoQA = require("../models/VideoQA")
const VideoQAUsage = require("../models/VideoQAUsage")

/**
 * Clean up old Q&A sessions
 * @param {Number} daysOld - Remove sessions older than this many days (default: 90)
 * @returns {Object} Cleanup statistics
 */
async function cleanupOldSessions(daysOld = 90) {
  try {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysOld)

    console.log(`🧹 Cleaning up Q&A sessions older than ${daysOld} days (before ${cutoffDate.toISOString()})...`)

    // Count sessions that will be removed (single aggregation pass, DB-side)
    const [countResult] = await VideoQA.aggregate([
      {
        $project: {
          oldSessions: {
            $size: {
              $filter: {
                input: "$sessions",
                as: "session",
                cond: {
                  $and: [
                    { $ne: [{ $type: "$$session.updatedAt" }, "missing"] },
                    { $lt: ["$$session.updatedAt", cutoffDate] },
                  ],
                },
              },
            },
          },
        },
      },
      { $group: { _id: null, total: { $sum: "$oldSessions" } } },
    ])
    const totalSessionsRemoved = countResult?.total || 0

    // Remove old sessions inside the database (aggregation pipeline update) —
    // no documents are loaded into Node memory. Sessions without updatedAt
    // are kept, matching the original JS behavior (undefined < date = false).
    const updateResult = await VideoQA.updateMany(
      {},
      [
        {
          $set: {
            sessions: {
              $filter: {
                input: "$sessions",
                as: "session",
                cond: {
                  $or: [
                    { $eq: [{ $type: "$$session.updatedAt" }, "missing"] },
                    { $gte: ["$$session.updatedAt", cutoffDate] },
                  ],
                },
              },
            },
          },
        },
      ]
    )

    // Delete documents left with no sessions (same rule as the original loop)
    const deleteResult = await VideoQA.deleteMany({ sessions: { $size: 0 } })

    console.log(`✅ Cleanup complete:`)
    console.log(`   - ${totalSessionsRemoved} sessions removed`)
    console.log(`   - ${updateResult.modifiedCount} documents updated`)
    console.log(`   - ${deleteResult.deletedCount} documents deleted`)

    return {
      sessionsRemoved: totalSessionsRemoved,
      documentsUpdated: updateResult.modifiedCount,
      documentsDeleted: deleteResult.deletedCount,
      cutoffDate: cutoffDate.toISOString(),
    }
  } catch (error) {
    console.error("❌ Error cleaning up Q&A sessions:", error)
    throw error
  }
}

/**
 * Clean up old usage records
 * @param {Number} daysOld - Remove usage records older than this many days (default: 30)
 * @returns {Number} Number of records deleted
 */
async function cleanupOldUsageRecords(daysOld = 30) {
  try {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysOld)

    console.log(`🧹 Cleaning up usage records older than ${daysOld} days (before ${cutoffDate.toISOString()})...`)

    const result = await VideoQAUsage.deleteMany({
      date: { $lt: cutoffDate },
    })

    console.log(`✅ Removed ${result.deletedCount} old usage records`)

    return result.deletedCount
  } catch (error) {
    console.error("❌ Error cleaning up usage records:", error)
    throw error
  }
}

/**
 * Get Q&A statistics
 * @returns {Object} Statistics
 */
async function getQAStatistics() {
  try {
    const totalDocuments = await VideoQA.countDocuments()

    // Aggregate totals DB-side instead of loading every document
    const [totals] = await VideoQA.aggregate([
      {
        $project: {
          sessionCount: { $size: { $ifNull: ["$sessions", []] } },
          messageCount: {
            $sum: {
              $map: {
                input: { $ifNull: ["$sessions", []] },
                as: "session",
                in: { $size: { $ifNull: ["$$session.messages", []] } },
              },
            },
          },
        },
      },
      {
        $group: {
          _id: null,
          totalSessions: { $sum: "$sessionCount" },
          totalMessages: { $sum: "$messageCount" },
        },
      },
    ])

    const totalSessions = totals?.totalSessions || 0
    const totalMessages = totals?.totalMessages || 0

    const todayUsageCount = await VideoQAUsage.countDocuments({
      date: {
        $gte: new Date(new Date().setHours(0, 0, 0, 0)),
        $lt: new Date(new Date().setHours(23, 59, 59, 999)),
      },
    })

    return {
      totalDocuments,
      totalSessions,
      totalMessages,
      averageSessionsPerDocument: totalDocuments > 0 ? (totalSessions / totalDocuments).toFixed(2) : 0,
      averageMessagesPerSession: totalSessions > 0 ? (totalMessages / totalSessions).toFixed(2) : 0,
      activeUsersToday: todayUsageCount,
    }
  } catch (error) {
    console.error("❌ Error getting Q&A statistics:", error)
    throw error
  }
}

/**
 * Main cleanup function
 * Runs all cleanup operations
 */
async function runCleanup() {
  console.log("🚀 Starting Video Q&A cleanup job...")
  console.log("Time:", new Date().toISOString())
  console.log("")

  try {
    // Get statistics before cleanup
    console.log("📊 Statistics before cleanup:")
    const statsBefore = await getQAStatistics()
    console.log(`   - Total documents: ${statsBefore.totalDocuments}`)
    console.log(`   - Total sessions: ${statsBefore.totalSessions}`)
    console.log(`   - Total messages: ${statsBefore.totalMessages}`)
    console.log(`   - Active users today: ${statsBefore.activeUsersToday}`)
    console.log("")

    // Cleanup old sessions (90 days)
    const sessionCleanup = await cleanupOldSessions(90)
    console.log("")

    // Cleanup old usage records (30 days)
    const usageCleanup = await cleanupOldUsageRecords(30)
    console.log("")

    // Get statistics after cleanup
    console.log("📊 Statistics after cleanup:")
    const statsAfter = await getQAStatistics()
    console.log(`   - Total documents: ${statsAfter.totalDocuments}`)
    console.log(`   - Total sessions: ${statsAfter.totalSessions}`)
    console.log(`   - Total messages: ${statsAfter.totalMessages}`)
    console.log("")

    console.log("✨ Cleanup job completed successfully!")

    return {
      sessionCleanup,
      usageCleanup,
      statsBefore,
      statsAfter,
    }
  } catch (error) {
    console.error("❌ Cleanup job failed:", error)
    throw error
  }
}

// If running directly (not imported as module)
if (require.main === module) {
  require("dotenv").config()
  const mongoose = require("mongoose")

  mongoose
    .connect(process.env.MONGODB_URI || "mongodb://localhost:27017/youtube-mate")
    .then(async () => {
      console.log("✅ Connected to MongoDB\n")
      await runCleanup()
      await mongoose.disconnect()
      console.log("\n👋 Disconnected from MongoDB")
      process.exit(0)
    })
    .catch((error) => {
      console.error("❌ MongoDB connection error:", error)
      process.exit(1)
    })
}

module.exports = {
  cleanupOldSessions,
  cleanupOldUsageRecords,
  getQAStatistics,
  runCleanup,
}
