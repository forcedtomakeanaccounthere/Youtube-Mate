const express = require("express")
const router = express.Router()
const Download = require("../models/Download")
const Playlist = require("../models/Playlist")
const { authenticateToken, optionalAuth } = require("../middleware/auth")
const { rateLimiter } = require("../middleware/rateLimiter")
const { validateDownloadRequest, validatePlaylistRequest } = require("../middleware/validation")
const { fetchYouTubeMetadata, extractVideoId } = require("../utils/youtube")
const {
  processDownload,
  getAvailableFormats,
  downloadAudio,
  downloadVideo,
  getVideoInfo,
  DOWNLOADS_DIR
} = require("../utils/downloadProcessor")
const { fetchPlaylistData } = require("../utils/playlist")
const { estimateFileSize } = require("../utils/fileUtils")

// Get user's download history
router.get("/history", optionalAuth, async (req, res) => {
  try {
    const page = Number.parseInt(req.query.page) || 1
    const limit = Number.parseInt(req.query.limit) || 20
    const skip = (page - 1) * limit
    const format = req.query.format // Add format filter

    const query = req.user ? { user_id: req.user._id } : { ip_address: req.ip }
    
    // Add format filter if provided
    if (format) {
      query.format = format
    }

    const downloads = await Download.find(query)
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit)
      .populate("user_id", "username email")

    const total = await Download.countDocuments(query)

    res.json({
      downloads,
      pagination: {
        current_page: page,
        total_pages: Math.ceil(total / limit),
        total_items: total,
        items_per_page: limit,
      },
    })
  } catch (error) {
    console.error("Error fetching download history:", error)
    res.status(500).json({ error: "Failed to fetch download history" })
  }
})

// Get download by ID
router.get("/:id", optionalAuth, async (req, res) => {
  try {
    const download = await Download.findById(req.params.id)

    if (!download) {
      return res.status(404).json({ error: "Download not found" })
    }

    // Check if user owns this download or it's from same IP
    if (req.user && download.user_id && !download.user_id.equals(req.user._id)) {
      return res.status(403).json({ error: "Access denied" })
    } else if (!req.user && download.ip_address !== req.ip) {
      return res.status(403).json({ error: "Access denied" })
    }

    res.json(download)
  } catch (error) {
    console.error("Error fetching download:", error)
    res.status(500).json({ error: "Failed to fetch download" })
  }
})

// Get available formats for a video
router.post("/formats", rateLimiter, async (req, res) => {
  try {
    const { youtube_url } = req.body
    
    if (!youtube_url) {
      return res.status(400).json({ error: "YouTube URL is required" })
    }

    const formats = await getAvailableFormats(youtube_url)
    res.json(formats)
  } catch (error) {
    console.error("Error getting available formats:", error)
    res.status(500).json({ error: "Failed to get available formats" })
  }
})

// Get audio preview stream
router.get("/preview/:videoId", async (req, res) => {
  try {
    const { videoId } = req.params
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`
    
    const ytdl = require('@distube/ytdl-core')
    
    // Check if video exists and get info
    const info = await ytdl.getInfo(videoUrl)
    
    // Find best audio format for streaming
    const audioFormat = ytdl.chooseFormat(info.formats, { 
      filter: 'audioonly',
      quality: 'highestaudio'
    })
    
    if (!audioFormat) {
      return res.status(404).json({ error: 'No audio format available for preview' })
    }
    
    // Set proper headers for audio streaming
    res.setHeader('Content-Type', 'audio/mpeg')
    res.setHeader('Accept-Ranges', 'bytes')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Access-Control-Allow-Origin', '*')
    
    // Handle range requests for seeking
    const range = req.headers.range
    
    if (range) {
      const contentLength = audioFormat.contentLength
      if (contentLength) {
        const parts = range.replace(/bytes=/, "").split("-")
        const start = parseInt(parts[0], 10)
        const end = parts[1] ? parseInt(parts[1], 10) : contentLength - 1
        const chunksize = (end - start) + 1
        
        res.status(206)
        res.setHeader('Content-Range', `bytes ${start}-${end}/${contentLength}`)
        res.setHeader('Content-Length', chunksize)
        
        const stream = ytdl(videoUrl, { 
          filter: 'audioonly',
          quality: 'highestaudio',
          range: { start, end }
        })
        
        stream.pipe(res)
        return
      }
    }
    
    // Regular streaming without range
    const stream = ytdl(videoUrl, { 
      filter: 'audioonly',
      quality: 'highestaudio'
    })
    
    stream.on('error', (error) => {
      console.error('Preview stream error:', error)
      if (!res.headersSent) {
        res.status(503).json({ error: 'Audio preview temporarily unavailable' })
      }
    })
    
    stream.pipe(res)
    
  } catch (error) {
    console.error("Error getting audio preview:", error)
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to get audio preview" })
    }
  }
})

// Serve downloaded files
router.get("/file/:id", optionalAuth, async (req, res) => {
  try {
    const download = await Download.findById(req.params.id)

    if (!download) {
      return res.status(404).json({ error: "Download not found" })
    }

    if (download.status !== "completed" || !download.file_path) {
      return res.status(400).json({ error: "File not ready for download" })
    }

    // Check if user owns this download or it's from same IP
    if (req.user && download.user_id && !download.user_id.equals(req.user._id)) {
      return res.status(403).json({ error: "Access denied" })
    } else if (!req.user && download.ip_address !== req.ip) {
      return res.status(403).json({ error: "Access denied" })
    }

    const fs = require('fs')
    const path = require('path')
    
    if (!fs.existsSync(download.file_path)) {
      return res.status(404).json({ error: "File not found on disk" })
    }

    const filename = path.basename(download.file_path)
    const stat = fs.statSync(download.file_path)
    
    res.setHeader('Content-Disposition', `attachment; filename="${download.title || filename}"`)
    res.setHeader('Content-Length', stat.size)
    res.setHeader('Content-Type', download.format === 'mp3' ? 'audio/mpeg' : 'video/mp4')
    
    const fileStream = fs.createReadStream(download.file_path)
    fileStream.pipe(res)
    
  } catch (error) {
    console.error("Error serving file:", error)
    res.status(500).json({ error: "Failed to serve file" })
  }
})

// Create new download
router.post("/", rateLimiter, optionalAuth, validateDownloadRequest, async (req, res) => {
  try {
    const { youtube_url, format, quality, options = {} } = req.body

    // Extract video ID and validate URL
    const videoId = extractVideoId(youtube_url)
    if (!videoId) {
      return res.status(400).json({ error: "Invalid YouTube URL" })
    }

    // Check for existing pending/processing download
    const existingDownload = await Download.findOne({
      video_id: videoId,
      format,
      quality,
      status: { $in: ["pending", "processing"] },
    })

    if (existingDownload) {
      return res.status(409).json({
        error: "Download already in progress",
        download_id: existingDownload._id,
      })
    }

    // Get video info first
    let metadata
    try {
      metadata = await getVideoInfo(youtube_url)
    } catch (error) {
      console.error('Error fetching metadata:', error)
      metadata = { title: 'Unknown', duration: 0, thumbnail: null }
    }

    // Create download record
    const download = new Download({
      user_id: req.user ? req.user._id : null,
      youtube_url,
      video_id: videoId,
      format,
      quality,
      estimated_size: 0, // Will be updated during download
      metadata,
      options,
      ip_address: req.ip,
      user_agent: req.get("User-Agent") || "Unknown",
      status: 'processing',
      progress: 0
    })

    await download.save()

    // Start download in background
    const downloadData = {
      youtube_url,
      format,
      quality,
      options: {
        onProgress: async (progress) => {
          // Update progress in database
          await Download.findByIdAndUpdate(download._id, { 
            progress: progress,
            updated_at: new Date()
          })
        }
      }
    }

    // Process download asynchronously
    processDownload(downloadData)
      .then(async (result) => {
        // Update download record with success
        await Download.findByIdAndUpdate(download._id, {
          status: 'completed',
          progress: 100,
          file_path: result.filepath,
          file_name: result.filename,
          file_size: result.size,
          completed_at: new Date(),
          updated_at: new Date()
        })
        console.log('Download completed:', result.filename)
      })
      .catch(async (error) => {
        // Update download record with error
        await Download.findByIdAndUpdate(download._id, {
          status: 'failed',
          error_message: error.message,
          updated_at: new Date()
        })
        console.error('Download failed:', error.message)
      })

    res.status(201).json({
      message: "Download started",
      download_id: download._id,
      download
    })
  } catch (error) {
    console.error("Error creating download:", error)
    res.status(500).json({ error: "Failed to start download" })
  }
})

// Pause download
router.post("/:id/pause", optionalAuth, async (req, res) => {
  try {
    const download = await Download.findById(req.params.id)

    if (!download) {
      return res.status(404).json({ error: "Download not found" })
    }

    // Check ownership
    if (req.user && download.user_id && !download.user_id.equals(req.user._id)) {
      return res.status(403).json({ error: "Access denied" })
    } else if (!req.user && download.ip_address !== req.ip) {
      return res.status(403).json({ error: "Access denied" })
    }

    if (download.status !== "processing") {
      return res.status(400).json({ error: "Download is not in progress" })
    }

    await pauseDownload(download._id)
    download.status = "paused"
    await download.save()

    res.json({ message: "Download paused", download })
  } catch (error) {
    console.error("Error pausing download:", error)
    res.status(500).json({ error: "Failed to pause download" })
  }
})

// Resume download
router.post("/:id/resume", optionalAuth, async (req, res) => {
  try {
    const download = await Download.findById(req.params.id)

    if (!download) {
      return res.status(404).json({ error: "Download not found" })
    }

    // Check ownership
    if (req.user && download.user_id && !download.user_id.equals(req.user._id)) {
      return res.status(403).json({ error: "Access denied" })
    } else if (!req.user && download.ip_address !== req.ip) {
      return res.status(403).json({ error: "Access denied" })
    }

    if (download.status !== "paused") {
      return res.status(400).json({ error: "Download is not paused" })
    }

    await resumeDownload(download._id)
    download.status = "processing"
    await download.save()

    res.json({ message: "Download resumed", download })
  } catch (error) {
    console.error("Error resuming download:", error)
    res.status(500).json({ error: "Failed to resume download" })
  }
})

// Cancel download
router.delete("/:id", optionalAuth, async (req, res) => {
  try {
    const download = await Download.findById(req.params.id)

    if (!download) {
      return res.status(404).json({ error: "Download not found" })
    }

    // Check ownership
    if (req.user && download.user_id && !download.user_id.equals(req.user._id)) {
      return res.status(403).json({ error: "Access denied" })
    } else if (!req.user && download.ip_address !== req.ip) {
      return res.status(403).json({ error: "Access denied" })
    }

    if (["completed", "failed", "cancelled"].includes(download.status)) {
      return res.status(400).json({ error: "Cannot cancel completed/failed download" })
    }

    await cancelDownload(download._id)
    download.status = "cancelled"
    await download.save()

    res.json({ message: "Download cancelled", download })
  } catch (error) {
    console.error("Error cancelling download:", error)
    res.status(500).json({ error: "Failed to cancel download" })
  }
})

// Get download queue status
router.get("/queue/status", (req, res) => {
  try {
    const queueStatus = getDownloadQueue()
    res.json(queueStatus)
  } catch (error) {
    console.error("Error fetching queue status:", error)
    res.status(500).json({ error: "Failed to fetch queue status" })
  }
})

// Playlist routes
// Get playlist info (metadata and videos) without downloading
router.get("/playlist/info", rateLimiter, optionalAuth, async (req, res) => {
  try {
    const { url } = req.query

    if (!url) {
      return res.status(400).json({ error: "Playlist URL is required" })
    }

    // Fetch playlist data
    const playlistData = await fetchPlaylistData(url)

    if (!playlistData) {
      return res.status(400).json({ error: "Invalid playlist URL or playlist not found" })
    }

    res.json({
      id: playlistData.id,
      title: playlistData.title,
      description: playlistData.description,
      channel: playlistData.channel,
      thumbnail: playlistData.thumbnail,
      video_count: playlistData.videos.length,
      videos: playlistData.videos.map((video, index) => ({
        id: video.id,
        title: video.title,
        thumbnail: video.thumbnail,
        duration: video.duration,
        channel: video.channel,
        url: video.url,
        index: index + 1
      }))
    })

  } catch (error) {
    console.error("Error fetching playlist info:", error)
    res.status(500).json({ error: "Failed to fetch playlist information" })
  }
})

router.post("/playlist", rateLimiter, optionalAuth, validatePlaylistRequest, async (req, res) => {
  try {
    const { playlist_url, download_options, selected_videos } = req.body

    // Fetch playlist data
    const playlistData = await fetchPlaylistData(playlist_url)

    if (!playlistData) {
      return res.status(400).json({ error: "Invalid playlist URL or playlist not found" })
    }

    // Create playlist record
    const playlist = new Playlist({
      user_id: req.user ? req.user._id : null,
      playlist_url,
      playlist_id: playlistData.id,
      title: playlistData.title,
      description: playlistData.description,
      thumbnail: playlistData.thumbnail,
      channel: playlistData.channel,
      video_count: playlistData.videos.length,
      videos: playlistData.videos.map((video) => ({
        ...video,
        selected: selected_videos ? selected_videos.includes(video.video_id) : true,
      })),
      download_options,
      ip_address: req.ip,
      user_agent: req.get("User-Agent") || "Unknown",
    })

    await playlist.save()

    // Create individual downloads for selected videos
    const selectedVideos = playlist.videos.filter((video) => video.selected)
    const downloads = []

    for (const video of selectedVideos) {
      const download = new Download({
        user_id: req.user ? req.user._id : null,
        youtube_url: `https://www.youtube.com/watch?v=${video.video_id}`,
        video_id: video.video_id,
        format: download_options.format,
        quality: download_options.quality,
        metadata: {
          title: video.title,
          duration: video.duration,
          thumbnail: video.thumbnail,
        },
        options: {
          include_subtitles: download_options.include_subtitles,
          create_folder: download_options.create_folder,
          number_files: download_options.number_files,
        },
        ip_address: req.ip,
        user_agent: req.get("User-Agent") || "Unknown",
      })

      await download.save()
      downloads.push(download._id)

      // Add to download queue
      processDownload(download._id)
    }

    playlist.downloads = downloads
    playlist.progress.total_videos = selectedVideos.length
    await playlist.save()

    res.status(201).json({
      message: "Playlist download started",
      playlist_id: playlist._id,
      playlist,
      downloads_created: downloads.length,
    })
  } catch (error) {
    console.error("Error creating playlist download:", error)
    res.status(500).json({ error: "Failed to start playlist download" })
  }
})

// Get playlist download status
router.get("/playlist/:id", optionalAuth, async (req, res) => {
  try {
    const playlist = await Playlist.findById(req.params.id).populate("downloads")

    if (!playlist) {
      return res.status(404).json({ error: "Playlist not found" })
    }

    // Check ownership
    if (req.user && playlist.user_id && !playlist.user_id.equals(req.user._id)) {
      return res.status(403).json({ error: "Access denied" })
    } else if (!req.user && playlist.ip_address !== req.ip) {
      return res.status(403).json({ error: "Access denied" })
    }

    // Update progress
    const completedDownloads = playlist.downloads.filter((d) => d.status === "completed").length
    playlist.progress.completed_videos = completedDownloads
    playlist.progress.percentage = Math.round((completedDownloads / playlist.progress.total_videos) * 100)

    if (completedDownloads === playlist.progress.total_videos) {
      playlist.status = "completed"
    } else if (playlist.downloads.some((d) => d.status === "processing")) {
      playlist.status = "processing"
    }

    await playlist.save()

    res.json(playlist)
  } catch (error) {
    console.error("Error fetching playlist:", error)
    res.status(500).json({ error: "Failed to fetch playlist" })
  }
})

module.exports = router