const express = require("express")
const router = express.Router()
const { getYouTubePlaylistInfo, getYouTubeVideoInfo } = require("../utils/youtube")

// Get playlist info (similar to download page)
router.get("/playlist/info", async (req, res) => {
  try {
    const { url } = req.query

    if (!url) {
      return res.status(400).json({ error: "YouTube playlist URL is required" })
    }

    const playlistInfo = await getYouTubePlaylistInfo(url)
    
    res.json({
      title: playlistInfo.title,
      description: playlistInfo.description,
      thumbnail: playlistInfo.thumbnail,
      channel: "YouTube Channel", // Could be extracted from playlist info
      videos: playlistInfo.videos.map((video, index) => ({
        id: video.videoId,
        title: video.title,
        thumbnail: video.thumbnail,
        duration: video.duration,
        channel: video.channel,
        url: `https://www.youtube.com/watch?v=${video.videoId}`
      }))
    })
  } catch (error) {
    console.error("Error fetching playlist info:", error)
    res.status(400).json({ error: "Failed to fetch playlist information" })
  }
})

// Get video info
router.get("/video/info", async (req, res) => {
  try {
    const { url } = req.query

    if (!url) {
      return res.status(400).json({ error: "YouTube video URL is required" })
    }

    const videoInfo = await getYouTubeVideoInfo(url)
    
    res.json({
      id: videoInfo.id || videoInfo.videoId,
      title: videoInfo.title,
      thumbnail: videoInfo.thumbnail || videoInfo.thumbnailUrl,
      duration: videoInfo.duration,
      durationSeconds: videoInfo.durationSeconds,
      channel: videoInfo.channel?.name || videoInfo.channel || "Unknown Channel",
      views: videoInfo.views,
      likes: videoInfo.likes,
      description: videoInfo.description
    })
  } catch (error) {
    console.error("Error fetching video info:", error)
    res.status(400).json({ error: "Failed to fetch video information" })
  }
})

module.exports = router
