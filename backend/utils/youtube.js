const axios = require("axios")
const cheerio = require("cheerio")

const extractVideoId = (url) => {
  const match = url.match(/(?:youtube\.com\/(?:shorts\/|[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/)
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
            id: videoId,
            videoId,
            title: video.snippet.title,
            thumbnailUrl:
              video.snippet.thumbnails.maxres?.url ||
              video.snippet.thumbnails.high?.url ||
              video.snippet.thumbnails.medium?.url,
            thumbnail:
              video.snippet.thumbnails.maxres?.url ||
              video.snippet.thumbnails.high?.url ||
              video.snippet.thumbnails.medium?.url,
            duration: formatDuration(duration),
            durationSeconds,
            channel: {
              name: video.snippet.channelTitle,
              url: `https://www.youtube.com/channel/${video.snippet.channelId}`,
              thumbnail: ""
            },
            views: Number.parseInt(video.statistics.viewCount || 0),
            likes: Number.parseInt(video.statistics.likeCount || 0),
            description: video.snippet.description,
            publishedAt: video.snippet.publishedAt,
            language: video.snippet.defaultLanguage || video.snippet.defaultAudioLanguage
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
      id: videoId,
      videoId,
      title: title || "YouTube Video",
      thumbnailUrl: thumbnailUrl || `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
      thumbnail: thumbnailUrl || `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
      duration,
      durationSeconds,
      channel: {
        name: channel || "Unknown Channel",
        url: "",
        thumbnail: ""
      },
      views: 0,
      likes: 0,
      description: $('meta[property="og:description"]').attr("content") || "",
      publishedAt: null,
      language: null
    }
  } catch (error) {
    console.error("Error fetching YouTube metadata:", error)

    // Return basic data if everything fails
    const videoId = extractVideoId(url)
    return {
      id: videoId || "unknown",
      videoId: videoId || "unknown",
      title: "YouTube Video",
      thumbnailUrl: videoId ? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg` : null,
      thumbnail: videoId ? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg` : null,
      duration: "Unknown",
      durationSeconds: 0,
      channel: {
        name: "Unknown Channel",
        url: "",
        thumbnail: ""
      },
      views: 0,
      likes: 0,
      description: "",
      publishedAt: null,
      language: null
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

const extractPlaylistId = (url) => {
  const match = url.match(/[&?]list=([a-zA-Z0-9_-]+)/)
  return match ? match[1] : null
}

const getYouTubePlaylistInfo = async (url) => {
  try {
    const playlistId = extractPlaylistId(url)
    if (!playlistId) {
      throw new Error("Invalid YouTube playlist URL")
    }

    // Try YouTube API first if API key is available
    if (process.env.YOUTUBE_API_KEY) {
      try {
        // Get playlist info
        const playlistResponse = await axios.get("https://www.googleapis.com/youtube/v3/playlists", {
          params: {
            part: "snippet",
            id: playlistId,
            key: process.env.YOUTUBE_API_KEY,
          },
        })

        if (playlistResponse.data.items && playlistResponse.data.items.length > 0) {
          const playlist = playlistResponse.data.items[0]
          
          // Get playlist items
          const itemsResponse = await axios.get("https://www.googleapis.com/youtube/v3/playlistItems", {
            params: {
              part: "snippet",
              playlistId: playlistId,
              maxResults: 50, // YouTube API limit
              key: process.env.YOUTUBE_API_KEY,
            },
          })

          const videos = []
          if (itemsResponse.data.items) {
            for (const item of itemsResponse.data.items) {
              // Get video details for each video
              try {
                const videoDetails = await fetchYouTubeMetadata(`https://www.youtube.com/watch?v=${item.snippet.resourceId.videoId}`)
                videos.push({
                  videoId: item.snippet.resourceId.videoId,
                  title: item.snippet.title,
                  thumbnail: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.medium?.url,
                  channel: item.snippet.videoOwnerChannelTitle || item.snippet.channelTitle,
                  ...videoDetails
                })
              } catch (error) {
                console.warn(`Failed to get details for video ${item.snippet.resourceId.videoId}:`, error.message)
                // Include basic info even if detailed fetch fails
                videos.push({
                  videoId: item.snippet.resourceId.videoId,
                  title: item.snippet.title,
                  thumbnail: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.medium?.url,
                  channel: item.snippet.videoOwnerChannelTitle || item.snippet.channelTitle,
                  duration: "Unknown",
                  durationSeconds: 0,
                  views: "Unknown views"
                })
              }
            }
          }

          return {
            title: playlist.snippet.title,
            description: playlist.snippet.description,
            thumbnail: playlist.snippet.thumbnails?.high?.url || playlist.snippet.thumbnails?.medium?.url,
            videos: videos,
            videoCount: videos.length
          }
        }
      } catch (apiError) {
        console.warn("YouTube API failed for playlist, falling back to scraping:", apiError.message)
      }
    }

    // Fallback to basic scraping (limited functionality)
    const response = await axios.get(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      },
    })

    const $ = cheerio.load(response.data)
    
    const title = $('meta[property="og:title"]').attr("content") || $("title").text()
    const description = $('meta[property="og:description"]').attr("content") || ""
    const thumbnail = $('meta[property="og:image"]').attr("content")

    return {
      title: title || "YouTube Playlist",
      description: description,
      thumbnail: thumbnail,
      videos: [], // Scraping individual videos from playlist is complex, return empty for now
      videoCount: 0
    }

  } catch (error) {
    console.error("Error fetching YouTube playlist info:", error)
    throw error
  }
}

const getYouTubeVideoInfo = async (url) => {
  return await fetchYouTubeMetadata(url)
}

module.exports = {
  fetchYouTubeMetadata,
  extractVideoId,
  formatDuration,
  parseDurationToSeconds,
  formatSecondsToTime,
  getYouTubePlaylistInfo,
  getYouTubeVideoInfo,
}