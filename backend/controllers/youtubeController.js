const youtubeService = require("../services/youtubeService")

/**
 * YouTube Controller
 * Handles HTTP requests/responses for YouTube-related endpoints
 */
class YouTubeController {
  /**
   * Get YouTube playlist information
   * GET /api/youtube/playlist/info
   */
  async getPlaylistInfo(req, res) {
    try {
      const { url } = req.query

      if (!url) {
        return res.status(400).json({ error: "YouTube playlist URL is required" })
      }

      const playlistInfo = await youtubeService.getPlaylistInfo(url)
      
      res.json({
        title: playlistInfo.title,
        description: playlistInfo.description,
        thumbnail: playlistInfo.thumbnail,
        channel: "YouTube Channel", // Could be extracted from playlist info
        videos: playlistInfo.videos.map((video) => ({
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
  }

  /**
   * Get YouTube video information
   * GET /api/youtube/video/info
   */
  async getVideoInfo(req, res) {
    try {
      const { url } = req.query

      if (!url) {
        return res.status(400).json({ error: "YouTube video URL is required" })
      }

      const videoInfo = await youtubeService.getVideoInfo(url)
      
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
  }

  /**
   * Get YouTube video chapters
   * GET /api/youtube/video/chapters
   */
  async getVideoChapters(req, res) {
    try {
      const { url } = req.query

      if (!url) {
        return res.status(400).json({ error: "YouTube video URL is required" })
      }

      const chapters = await youtubeService.getVideoChapters(url)
      
      res.json({
        chapters,
        count: chapters.length
      })
    } catch (error) {
      console.error("Error fetching video chapters:", error)
      res.status(500).json({ error: "Failed to fetch video chapters" })
    }
  }
}

module.exports = new YouTubeController()
