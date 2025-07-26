const fs = require("fs").promises
const path = require("path")

// File size estimation based on format and quality
const estimateFileSize = async (videoId, format, quality) => {
  try {
    // These are rough estimates in MB based on typical YouTube videos
    const sizeEstimates = {
      mp4: {
        "4320p": 2000, // 4K
        "2160p": 1000, // 4K
        "1440p": 500, // 1440p
        "1080p": 200, // 1080p
        "720p": 100, // 720p
        "480p": 50, // 480p
        "360p": 25, // 360p
        "240p": 15, // 240p
        "144p": 8, // 144p
      },
      webm: {
        "4320p": 1500,
        "2160p": 800,
        "1440p": 400,
        "1080p": 150,
        "720p": 80,
        "480p": 40,
        "360p": 20,
        "240p": 12,
        "144p": 6,
      },
      mkv: {
        "4320p": 2200,
        "2160p": 1100,
        "1440p": 550,
        "1080p": 220,
        "720p": 110,
        "480p": 55,
        "360p": 28,
        "240p": 17,
        "144p": 9,
      },
      mp3: {
        320: 4, // 320kbps
        256: 3.2, // 256kbps
        192: 2.4, // 192kbps
        128: 1.6, // 128kbps
        96: 1.2, // 96kbps
        64: 0.8, // 64kbps
      },
      aac: {
        256: 3,
        192: 2.2,
        128: 1.5,
        96: 1.1,
        64: 0.7,
      },
      ogg: {
        320: 3.5,
        256: 2.8,
        192: 2.1,
        128: 1.4,
        96: 1.0,
        64: 0.7,
      },
      wav: {
        lossless: 50, // Uncompressed
      },
      flac: {
        lossless: 25, // Lossless compression
      },
    }

    const formatEstimates = sizeEstimates[format]
    if (!formatEstimates) {
      return 100 // Default estimate in MB
    }

    const estimate = formatEstimates[quality] || formatEstimates["720p"] || 100

    // Convert to bytes and add some variance (±20%)
    const baseSize = estimate * 1024 * 1024
    const variance = 0.2
    const randomFactor = 1 + (Math.random() - 0.5) * variance * 2

    return Math.round(baseSize * randomFactor)
  } catch (error) {
    console.error("Error estimating file size:", error)
    return 100 * 1024 * 1024 // Default 100MB
  }
}

// Clean up old files
const cleanupOldFiles = async (maxAgeHours = 24) => {
  try {
    const downloadDir = process.env.DOWNLOAD_DIR || path.join(__dirname, "../downloads")
    const files = await fs.readdir(downloadDir)
    const now = Date.now()
    const maxAge = maxAgeHours * 60 * 60 * 1000

    for (const file of files) {
      const filePath = path.join(downloadDir, file)
      const stats = await fs.stat(filePath)

      if (now - stats.mtime.getTime() > maxAge) {
        await fs.unlink(filePath)
        console.log(`Cleaned up old file: ${file}`)
      }
    }
  } catch (error) {
    console.error("Error cleaning up old files:", error)
  }
}

// Get file info
const getFileInfo = async (filePath) => {
  try {
    const stats = await fs.stat(filePath)
    return {
      size: stats.size,
      created: stats.birthtime,
      modified: stats.mtime,
      exists: true,
    }
  } catch (error) {
    return {
      exists: false,
      error: error.message,
    }
  }
}

// Format file size for display
const formatFileSize = (bytes) => {
  if (bytes === 0) return "0 Bytes"

  const k = 1024
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
}

module.exports = {
  estimateFileSize,
  cleanupOldFiles,
  getFileInfo,
  formatFileSize,
}