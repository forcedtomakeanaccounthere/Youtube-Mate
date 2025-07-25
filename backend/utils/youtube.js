const axios = require("axios")
const cheerio = require("cheerio")

const extractVideoId = (url) => {
  const match = url.match(/(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/)
  return match ? match[1] : null
}

const formatDuration = (duration) => {
  // Convert ISO 8601 duration to readable format
  const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/)

  const hours = (match[1] || "").replace("H", "")
  const minutes = (match[2] || "").replace("M", "")
  const seconds = (match[3] || "").replace("S", "")

  let formatted = ""
  if (hours) formatted += `${hours}:`
  formatted += `${minutes.padStart(2, "0")}:${seconds.padStart(2, "0")}`

  return formatted
}

const fetchYouTubeMetadata = async (url) => {
  try {
    const videoId = extractVideoId(url)
    if (!videoId) {
      throw new Error("Invalid YouTube URL")
    }

    // Try YouTube API first if API key is available
    if (process.env.YOUTUBE_API_KEY) {
      try {
        const response = await axios.get("https://www.googleapis.com/youtube/v3/videos", {
          params: {
            part: "snippet,contentDetails,statistics",
            id: videoId,
            key: process.env.YOUTUBE_API_KEY,
          },
        })

        if (response.data.items && response.data.items.length > 0) {
          const video = response.data.items[0]
          const duration = video.contentDetails.duration
          const durationSeconds = parseDurationToSeconds(duration)

          return {
            videoId,
            title: video.snippet.title,
            thumbnailUrl:
              video.snippet.thumbnails.maxres?.url ||
              video.snippet.thumbnails.high?.url ||
              video.snippet.thumbnails.medium?.url,
            duration: formatDuration(duration),
            durationSeconds,
            channel: video.snippet.channelTitle,
            views: Number.parseInt(video.statistics.viewCount).toLocaleString() + " views",
            description: video.snippet.description,
          }
        }
      } catch (apiError) {
        console.warn("YouTube API failed, falling back to scraping:", apiError.message)
      }
    }

    // Fallback to web scraping
    const response = await axios.get(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      },
    })

    const $ = cheerio.load(response.data)

    // Extract data from page
    const title = $('meta[property="og:title"]').attr("content") || $("title").text().replace(" - YouTube", "")

    const thumbnailUrl = $('meta[property="og:image"]').attr("content")

    const channel = $('meta[name="author"]').attr("content") || $('link[itemprop="name"]').attr("content")

    // Try to extract duration from script tags
    let duration = "Unknown"
    let durationSeconds = 0

    const scriptTags = $("script").toArray()
    for (const script of scriptTags) {
      const content = $(script).html()
      if (content && content.includes("lengthSeconds")) {
        const match = content.match(/"lengthSeconds":"(\d+)"/)
        if (match) {
          durationSeconds = Number.parseInt(match[1])
          duration = formatSecondsToTime(durationSeconds)
          break
        }
      }
    }

    return {
      videoId,
      title: title || "YouTube Video",
      thumbnailUrl: thumbnailUrl || `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
      duration,
      durationSeconds,
      channel: channel || "Unknown Channel",
      views: "Unknown views",
      description: $('meta[property="og:description"]').attr("content") || "",
    }
  } catch (error) {
    console.error("Error fetching YouTube metadata:", error)

    // Return basic data if everything fails
    const videoId = extractVideoId(url)
    return {
      videoId: videoId || "unknown",
      title: "YouTube Video",
      thumbnailUrl: videoId ? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg` : null,
      duration: "Unknown",
      durationSeconds: 0,
      channel: "Unknown Channel",
      views: "Unknown views",
      description: "",
    }
  }
}

const parseDurationToSeconds = (duration) => {
  const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/)

  const hours = Number.parseInt((match[1] || "").replace("H", "")) || 0
  const minutes = Number.parseInt((match[2] || "").replace("M", "")) || 0
  const seconds = Number.parseInt((match[3] || "").replace("S", "")) || 0

  return hours * 3600 + minutes * 60 + seconds
}

const formatSecondsToTime = (seconds) => {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }
  return `${minutes}:${secs.toString().padStart(2, "0")}`
}

module.exports = {
  fetchYouTubeMetadata,
  extractVideoId,
  formatDuration,
  parseDurationToSeconds,
  formatSecondsToTime,
}