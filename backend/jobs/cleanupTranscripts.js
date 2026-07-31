const cron = require('node-cron');
const Transcript = require('../models/Transcript');

/**
 * Cron job to clean up expired transcripts
 * Runs every hour to remove transcripts older than 12 hours
 */
function startTranscriptCleanupJob() {
  // Run every hour (at minute 0)
  cron.schedule('0 * * * *', async () => {
    try {
      const now = new Date();
      console.log(`[${now.toISOString()}] Running transcript cleanup job...`);
      
      // Find and delete expired transcripts
      const result = await Transcript.deleteMany({
        expiresAt: { $lt: now },
        status: 'completed' // Only delete completed transcripts
      });
      
      if (result.deletedCount > 0) {
        console.log(`Cleaned up ${result.deletedCount} expired transcript(s)`);
      } else {
        console.log(`No expired transcripts to clean up`);
      }
    } catch (error) {
      console.error('Error in transcript cleanup job:', error);
    }
  });
  
  console.log('Transcript cleanup job scheduled (runs every hour)');
}

/**
 * Manual cleanup function for testing or on-demand cleanup
 */
async function cleanupExpiredTranscripts() {
  try {
    const now = new Date();
    console.log(`🧹 Manual cleanup: Removing expired transcripts...`);
    
    const result = await Transcript.deleteMany({
      expiresAt: { $lt: now },
      status: 'completed'
    });
    
    console.log(`✅ Cleaned up ${result.deletedCount} expired transcript(s)`);
    return result.deletedCount;
  } catch (error) {
    console.error('❌ Error in manual cleanup:', error);
    throw error;
  }
}

/**
 * Get statistics about cached transcripts
 */
async function getTranscriptCacheStats() {
  try {
    const now = new Date();
    
    const stats = {
      total: await Transcript.countDocuments({ status: 'completed' }),
      active: await Transcript.countDocuments({ 
        status: 'completed',
        expiresAt: { $gt: now }
      }),
      expired: await Transcript.countDocuments({ 
        status: 'completed',
        expiresAt: { $lt: now }
      }),
      processing: await Transcript.countDocuments({ 
        status: { $in: ['pending', 'processing'] }
      }),
      failed: await Transcript.countDocuments({ status: 'failed' })
    };
    
    return stats;
  } catch (error) {
    console.error('❌ Error getting cache stats:', error);
    throw error;
  }
}

module.exports = {
  startTranscriptCleanupJob,
  cleanupExpiredTranscripts,
  getTranscriptCacheStats
};
