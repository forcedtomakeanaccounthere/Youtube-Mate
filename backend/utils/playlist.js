const axios = require("axios")
const cheerio = require("cheerio")
const ytdl = require("@distube/ytdl-core")

const extractPlaylistId = (url) => {
  const match = url.match(/[?&]list=([^&]+)/)
  return match ? match[1] : null
}

const fetchPlaylistData = async (playlistUrl) => {
  try {
    const playlistId = extractPlaylistId(playlistUrl)
    if (!playlistId) {
      throw new Error("Invalid playlist URL")
    }

    // Try YouTube API first if available
    if (process.env.YOUTUBE_API_KEY) {
      try {
        return await fetchPlaylistFromAPI(playlistId)
      } catch (apiError) {
        console.warn("YouTube API failed, falling back to scraping:", apiError.message)
      }
    }

    // Fallback to web scraping with improved extraction
    return await fetchPlaylistFromWeb(playlistUrl, playlistId)
  } catch (error) {
    console.error("Error fetching playlist data:", error)
    throw error
  }
}

const fetchPlaylistFromAPI = async (playlistId) => {
  try {
    // Get playlist info
    const playlistResponse = await axios.get("https://www.googleapis.com/youtube/v3/playlists", {
      params: {
        part: "snippet",
        id: playlistId,
        key: process.env.YOUTUBE_API_KEY,
      },
    })

    if (!playlistResponse.data.items || playlistResponse.data.items.length === 0) {
      throw new Error("Playlist not found")
    }

    const playlistInfo = playlistResponse.data.items[0].snippet

    // Get playlist videos with pagination
    let allVideos = []
    let nextPageToken = null
    
    do {
      const videosResponse = await axios.get("https://www.googleapis.com/youtube/v3/playlistItems", {
        params: {
          part: "snippet,contentDetails",
          playlistId: playlistId,
          maxResults: 50,
          pageToken: nextPageToken,
          key: process.env.YOUTUBE_API_KEY,
        },
      })

      const videos = videosResponse.data.items
        .filter(item => item.snippet.title !== 'Private video' && item.snippet.title !== 'Deleted video')
        .map((item) => ({
          video_id: item.contentDetails.videoId,
          title: item.snippet.title,
          thumbnail: item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default?.url,
          duration: "Unknown",
          position: item.snippet.position,
          description: item.snippet.description,
          publishedAt: item.snippet.publishedAt
        }))

      allVideos = allVideos.concat(videos)
      nextPageToken = videosResponse.data.nextPageToken
    } while (nextPageToken && allVideos.length < 200) // Limit to 200 videos

    // Get video durations in batches
    const videoIds = allVideos.map(v => v.video_id).slice(0, 50) // Limit for API call
    if (videoIds.length > 0) {
      try {
        const videoDetailsResponse = await axios.get("https://www.googleapis.com/youtube/v3/videos", {
          params: {
            part: "contentDetails",
            id: videoIds.join(','),
            key: process.env.YOUTUBE_API_KEY,
          },
        })

        const videoDetails = videoDetailsResponse.data.items
        allVideos.forEach(video => {
          const details = videoDetails.find(d => d.id === video.video_id)
          if (details) {
            video.duration = formatDuration(details.contentDetails.duration)
          }
        })
      } catch (durationError) {
        console.warn("Could not fetch video durations:", durationError.message)
      }
    }

    return {
      id: playlistId,
      title: playlistInfo.title,
      description: playlistInfo.description,
      thumbnail: playlistInfo.thumbnails.medium?.url || playlistInfo.thumbnails.default?.url,
      channel: playlistInfo.channelTitle,
      videos: allVideos,
    }
  } catch (error) {
    console.error("YouTube API error:", error)
    throw error
  }
}

const fetchPlaylistFromWeb = async (playlistUrl, playlistId) => {
  try {
    const response = await axios.get(playlistUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
      },
    })

    const $ = cheerio.load(response.data)

    // Extract playlist info
    const title = $('meta[property="og:title"]').attr("content") || 
                  $('meta[name="title"]').attr("content") || 
                  "Unknown Playlist"
    const description = $('meta[property="og:description"]').attr("content") || ""
    const thumbnail = $('meta[property="og:image"]').attr("content") || ""
    
    // Try to get channel name
    let channel = "Unknown Channel"
    const channelMeta = $('meta[name="author"]').attr("content")
    if (channelMeta) {
      channel = channelMeta
    }

    // Extract videos using multiple selectors
    const videos = []
    const seenVideoIds = new Set()

    // Try different selectors for video extraction
    const videoSelectors = [
      'a[href*="/watch?v="]',
      'ytd-playlist-video-renderer',
      '[data-video-id]'
    ]

    videoSelectors.forEach(selector => {
      $(selector).each((i, element) => {
        if (videos.length >= 50) return false // Limit to 50 videos

        let videoId = null
        let videoTitle = "Unknown Title"
        let href = ""

        if (selector === '[data-video-id]') {
          videoId = $(element).attr('data-video-id')
          videoTitle = $(element).find('#video-title').text().trim() || 
                      $(element).attr('title') || 
                      "Unknown Title"
        } else {
          href = $(element).attr("href") || ""
          const videoIdMatch = href.match(/[?&]v=([^&]+)/)
          if (videoIdMatch) {
            videoId = videoIdMatch[1]
            videoTitle = $(element).attr("title") || 
                        $(element).text().trim() || 
                        $(element).find('[id*="title"]').text().trim() ||
                        "Unknown Title"
          }
        }

        if (videoId && !seenVideoIds.has(videoId) && videoTitle !== "Unknown Title") {
          seenVideoIds.add(videoId)
          videos.push({
            video_id: videoId,
            title: videoTitle.substring(0, 100), // Limit title length
            thumbnail: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
            duration: "Unknown",
            position: videos.length,
          })
        }
      })
    })

    // If we couldn't extract videos from HTML, try using ytdl-core as fallback
    if (videos.length === 0) {
      try {
        const playlistInfo = await ytdl.getPlaylistID(playlistUrl)
        if (playlistInfo) {
          // This is a simplified fallback - ytdl-core doesn't have direct playlist support
          // but we can try to get basic info
          const basicPlaylist = {
            id: playlistId,
            title: title,
            description: description,
            thumbnail: thumbnail,
            channel: channel,
            videos: [], // Empty for now, would need additional implementation
          }
          return basicPlaylist
        }
      } catch (ytdlError) {
        console.warn('ytdl-core playlist fallback failed:', ytdlError.message)
      }
    }

    return {
      id: playlistId,
      title: title,
      description: description,
      thumbnail: thumbnail,
      channel: channel,
      videos: videos,
    }
  } catch (error) {
    console.error("Web scraping error:", error)
    throw error
  }
}

const formatDuration = (duration) => {
  // Convert ISO 8601 duration to readable format
  const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/)
  if (!match) return "Unknown"

  const hours = (match[1] || "").replace("H", "")
  const minutes = (match[2] || "").replace("M", "")
  const seconds = (match[3] || "").replace("S", "")

  let formatted = ""
  if (hours) formatted += `${hours}:`
  formatted += `${minutes.padStart(2, "0")}:${seconds.padStart(2, "0")}`

  return formatted
}

module.exports = {
  fetchPlaylistData,
  extractPlaylistId,
}