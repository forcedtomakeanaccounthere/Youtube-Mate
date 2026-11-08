const axios = require("axios")
const cheerio = require("cheerio")
const { remember } = require("./cacheService")

/**
 * YouTube Service
 * Handles all YouTube-related operations including video metadata, playlist info, and chapters
 */
class YouTubeService {
  constructor() {
    this.apiKey = process.env.YOUTUBE_API_KEY
  }

  // Metadata cache TTL — YouTube metadata (title/thumbnail/duration) is
  // slow-changing derived data; Redis/memory cache keeps it ephemeral while
  // MongoDB (ShortenedUrl/PlaylistItem documents) stays authoritative.
  static METADATA_TTL = 600 // 10 minutes

  /**
   * Extract video ID from various YouTube URL formats
   */
  extractVideoId(url) {
    const match = url.match(/(?:youtube\.com\/(?:shorts\/|[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/)
    return match ? match[1] : null
  }

  /**
   * Extract playlist ID from YouTube URL
   */
  extractPlaylistId(url) {
    const match = url.match(/[&?]list=([a-zA-Z0-9_-]+)/)
    return match ? match[1] : null
  }

  /**
   * Format ISO 8601 duration to readable format
   */
  formatDuration(duration) {
    const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/)
    const hours = (match[1] || "").replace("H", "")
    const minutes = (match[2] || "").replace("M", "")
    const seconds = (match[3] || "").replace("S", "")

    let formatted = ""
    if (hours) formatted += `${hours}:`
    formatted += `${minutes.padStart(2, "0")}:${seconds.padStart(2, "0")}`

    return formatted
  }

  /**
   * Parse ISO 8601 duration to seconds
   */
  parseDurationToSeconds(duration) {
    const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/)
    const hours = Number.parseInt((match[1] || "").replace("H", "")) || 0
    const minutes = Number.parseInt((match[2] || "").replace("M", "")) || 0
    const seconds = Number.parseInt((match[3] || "").replace("S", "")) || 0

    return hours * 3600 + minutes * 60 + seconds
  }

  /**
   * Format seconds to time string
   */
  formatSecondsToTime(seconds) {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
    }
    return `${minutes}:${secs.toString().padStart(2, "0")}`
  }

  /**
   * Fetch video metadata from YouTube API or web scraping
   * (cached: key = videoId, TTL 10 min — see cacheService)
   */
  async getVideoInfo(url) {
    const videoId = this.extractVideoId(url)
    if (!videoId) {
      // Preserve the original contract: invalid URLs return fallback info
      return this._getFallbackVideoInfo(null)
    }

    return remember(YouTubeService.METADATA_TTL, ["yt:video", videoId], () => this._fetchVideoInfo(url))
  }

  /**
   * Batch metadata for many video URLs — one YouTube Data API call per 50
   * videos instead of one per video (kills the playlist-import N+1).
   * Videos missing from the API result (deleted/private, or no API key)
   * fall back to the per-video cached path.
   * @param {String[]} urls
   * @returns {Promise<Map<String, Object>>} url -> videoInfo
   */
  async getVideosInfo(urls) {
    const results = new Map()
    const idToUrls = new Map()

    for (const url of urls) {
      const videoId = this.extractVideoId(url)
      if (videoId) {
        if (!idToUrls.has(videoId)) idToUrls.set(videoId, [])
        idToUrls.get(videoId).push(url)
      } else {
        results.set(url, this._getFallbackVideoInfo(null))
      }
    }

    const videoIds = [...idToUrls.keys()]

    if (this.apiKey && videoIds.length > 0) {
      // YouTube Data API allows up to 50 ids per call
      for (let i = 0; i < videoIds.length; i += 50) {
        const batch = videoIds.slice(i, i + 50)
        try {
          const response = await axios.get("https://www.googleapis.com/youtube/v3/videos", {
            params: {
              part: "snippet,contentDetails,statistics",
              id: batch.join(","),
              key: this.apiKey,
            },
          })

          const itemsById = new Map()
          for (const video of response.data.items || []) {
            itemsById.set(video.id, video)
          }

          for (const videoId of batch) {
            const video = itemsById.get(videoId)
            for (const url of idToUrls.get(videoId)) {
              if (video) {
                const duration = video.contentDetails.duration
                results.set(url, {
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
                  duration: this.formatDuration(duration),
                  durationSeconds: this.parseDurationToSeconds(duration),
                  channel: {
                    name: video.snippet.channelTitle,
                    url: `https://www.youtube.com/channel/${video.snippet.channelId}`,
                    thumbnail: "",
                  },
                  views: Number.parseInt(video.statistics.viewCount || 0),
                  likes: Number.parseInt(video.statistics.likeCount || 0),
                  description: video.snippet.description,
                  publishedAt: video.snippet.publishedAt,
                  language: video.snippet.defaultLanguage || video.snippet.defaultAudioLanguage,
                })
              } else {
                // Not returned by the API (deleted/private) — scrape fallback
                results.set(url, await this.getVideoInfo(url))
              }
            }
          }
        } catch (apiError) {
          console.warn("Batch YouTube API failed, falling back per-video:", apiError.message)
          for (const videoId of batch) {
            for (const url of idToUrls.get(videoId)) {
              results.set(url, await this.getVideoInfo(url))
            }
          }
        }
      }
    } else {
      // No API key — per-video (each cached)
      await Promise.all(
        videoIds.flatMap((videoId) =>
          idToUrls.get(videoId).map(async (url) => {
            results.set(url, await this.getVideoInfo(url))
          })
        )
      )
    }

    return results
  }

  /**
   * Uncached metadata fetch (API first, then scraping, then fallback)
   */
  async _fetchVideoInfo(url) {
    try {
      const videoId = this.extractVideoId(url)
      if (!videoId) {
        throw new Error("Invalid YouTube URL")
      }

      // Try YouTube API first if API key is available
      if (this.apiKey) {
        try {
          const response = await axios.get("https://www.googleapis.com/youtube/v3/videos", {
            params: {
              part: "snippet,contentDetails,statistics",
              id: videoId,
              key: this.apiKey,
            },
          })

          if (response.data.items && response.data.items.length > 0) {
            const video = response.data.items[0]
            const duration = video.contentDetails.duration
            const durationSeconds = this.parseDurationToSeconds(duration)

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
              duration: this.formatDuration(duration),
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
      return await this._scrapeVideoInfo(videoId)
    } catch (error) {
      console.error("Error fetching YouTube metadata:", error)
      // Return basic data if everything fails
      const videoId = this.extractVideoId(url)
      return this._getFallbackVideoInfo(videoId)
    }
  }

  /**
   * Scrape video info from YouTube webpage
   */
  async _scrapeVideoInfo(videoId) {
    const response = await axios.get(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      },
    })

    const $ = cheerio.load(response.data)
    const title = $('meta[property="og:title"]').attr("content") || $("title").text().replace(" - YouTube", "")
    const thumbnailUrl = $('meta[property="og:image"]').attr("content")
    const channel = $('meta[name="author"]').attr("content") || $('link[itemprop="name"]').attr("content")

    // Extract duration from script tags
    let duration = "Unknown"
    let durationSeconds = 0

    const scriptTags = $("script").toArray()
    for (const script of scriptTags) {
      const content = $(script).html()
      if (content && content.includes("lengthSeconds")) {
        const match = content.match(/"lengthSeconds":"(\d+)"/)
        if (match) {
          durationSeconds = Number.parseInt(match[1])
          duration = this.formatSecondsToTime(durationSeconds)
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
  }

  /**
   * Get fallback video info when all methods fail
   */
  _getFallbackVideoInfo(videoId) {
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

  /**
   * Get playlist information including all videos
   */
  async getPlaylistInfo(url) {
    try {
      const playlistId = this.extractPlaylistId(url)
      if (!playlistId) {
        throw new Error("Invalid YouTube playlist URL")
      }

      // Try YouTube API first if API key is available
      if (this.apiKey) {
        try {
          return await this._getPlaylistFromAPI(playlistId)
        } catch (apiError) {
          console.warn("YouTube API failed for playlist, falling back to scraping:", apiError.message)
        }
      }

      // Fallback to basic scraping
      return await this._scrapePlaylistInfo(url)
    } catch (error) {
      console.error("Error fetching YouTube playlist info:", error)
      throw error
    }
  }

  /**
   * Get playlist info from YouTube API
   */
  async _getPlaylistFromAPI(playlistId) {
    // Get playlist info
    const playlistResponse = await axios.get("https://www.googleapis.com/youtube/v3/playlists", {
      params: {
        part: "snippet",
        id: playlistId,
        key: this.apiKey,
      },
    })

    if (!playlistResponse.data.items || playlistResponse.data.items.length === 0) {
      throw new Error("Playlist not found")
    }

    const playlist = playlistResponse.data.items[0]
    
    // Get playlist items
    const itemsResponse = await axios.get("https://www.googleapis.com/youtube/v3/playlistItems", {
      params: {
        part: "snippet",
        playlistId: playlistId,
        maxResults: 50, // YouTube API limit
        key: this.apiKey,
      },
    })

    const videos = []
    if (itemsResponse.data.items) {
      // Batch-fetch metadata for every video in one API call (per 50) instead
      // of one call per video — removes the playlist-import N+1.
      const videoUrls = itemsResponse.data.items.map(
        (item) => `https://www.youtube.com/watch?v=${item.snippet.resourceId.videoId}`
      )
      const infoByUrl = await this.getVideosInfo(videoUrls)

      for (const item of itemsResponse.data.items) {
        const videoUrl = `https://www.youtube.com/watch?v=${item.snippet.resourceId.videoId}`
        try {
          const videoDetails = infoByUrl.get(videoUrl)
          if (!videoDetails) throw new Error("No metadata")
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

  /**
   * Scrape playlist info from YouTube webpage (limited functionality)
   */
  async _scrapePlaylistInfo(url) {
    const response = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
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
      videos: [], // Scraping individual videos from playlist is complex
      videoCount: 0
    }
  }

  /**
   * Fetch video chapters from YouTube
   */
  async getVideoChapters(url) {
    try {
      const videoId = this.extractVideoId(url)
      if (!videoId) {
        throw new Error("Invalid YouTube URL")
      }

      const response = await axios.get(`https://www.youtube.com/watch?v=${videoId}`, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept-Language": "en-US,en;q=0.9",
        },
      })

      const $ = cheerio.load(response.data)
      const chapters = []

      // Look for chapters in the page scripts
      const scriptTags = $("script").toArray()
      for (const script of scriptTags) {
        const content = $(script).html()
        if (content && content.includes("engagementPanels")) {
          this._extractChapters(content, chapters)
        }
      }

      // Sort chapters by timestamp and remove duplicates
      const uniqueChapters = this._deduplicateChapters(chapters)
      console.log(`📚 Found ${uniqueChapters.length} chapters for video ${videoId}`)
      
      return uniqueChapters
    } catch (error) {
      console.error("Error fetching YouTube chapters:", error)
      return [] // Return empty array if chapters can't be fetched
    }
  }

  /**
   * Extract chapters from script content
   */
  _extractChapters(content, chapters) {
    try {
      // Method 1: macroMarkersListRenderer (newer format)
      const markerMatch = content.match(/"macroMarkersListRenderer":\{[^}]*"contents":\[([^\]]+)\]/)
      if (markerMatch) {
        const markersText = markerMatch[1]
        const chapterMatches = markersText.matchAll(/"timeDescription":\{"simpleText":"([^"]+)"\}.*?"title":\{"simpleText":"([^"]+)"\}/g)
        
        for (const match of chapterMatches) {
          const timeStr = match[1]
          const title = match[2]
          const seconds = this._parseTimeString(timeStr)
          
          chapters.push({
            title: title,
            timestamp: seconds,
            timeString: timeStr
          })
        }
        return
      }
      
      // Method 2: chapterRenderer format
      const chapterPattern = /"chapterRenderer":\{[^}]*"title":\{"simpleText":"([^"]+)"[^}]*"timeRangeStartMillis":(\d+)/g
      const chapterMatches = [...content.matchAll(chapterPattern)]
      
      if (chapterMatches.length > 0) {
        for (const match of chapterMatches) {
          const title = match[1]
          const milliseconds = parseInt(match[2])
          const seconds = Math.floor(milliseconds / 1000)
          const timeString = this.formatSecondsToTime(seconds)
          
          chapters.push({
            title: title,
            timestamp: seconds,
            timeString: timeString
          })
        }
        return
      }
      
      // Method 3: ytInitialData format
      if (content.includes('ytInitialData')) {
        const ytDataMatch = content.match(/var ytInitialData = (\{.+?\});/)
        if (ytDataMatch) {
          this._extractChaptersFromYtData(ytDataMatch[1], chapters)
        }
      }
    } catch (parseError) {
      console.warn("Error parsing chapter data:", parseError.message)
    }
  }

  /**
   * Extract chapters from ytInitialData JSON
   */
  _extractChaptersFromYtData(ytDataString, chapters) {
    try {
      const ytData = JSON.parse(ytDataString)
      const panels = ytData?.engagementPanels || []
      
      for (const panel of panels) {
        const renderer = panel?.engagementPanelSectionListRenderer
        if (renderer?.content?.macroMarkersListRenderer) {
          const markers = renderer.content.macroMarkersListRenderer.contents || []
          
          for (const marker of markers) {
            const macroMarker = marker?.macroMarkersListItemRenderer
            if (macroMarker) {
              const title = macroMarker.title?.simpleText || ''
              const timeDesc = macroMarker.timeDescription?.simpleText || ''
              
              if (title && timeDesc) {
                const seconds = this._parseTimeString(timeDesc)
                chapters.push({
                  title: title,
                  timestamp: seconds,
                  timeString: timeDesc
                })
              }
            }
          }
        }
      }
    } catch (parseError) {
      console.warn("Could not parse ytInitialData:", parseError.message)
    }
  }

  /**
   * Parse time string (HH:MM:SS or MM:SS) to seconds
   */
  _parseTimeString(timeStr) {
    const timeParts = timeStr.split(':').map(Number)
    let seconds = 0
    
    if (timeParts.length === 2) {
      seconds = timeParts[0] * 60 + timeParts[1]
    } else if (timeParts.length === 3) {
      seconds = timeParts[0] * 3600 + timeParts[1] * 60 + timeParts[2]
    }
    
    return seconds
  }

  /**
   * Remove duplicate chapters based on timestamp
   */
  _deduplicateChapters(chapters) {
    const uniqueChapters = []
    const seenTimestamps = new Set()
    
    chapters.sort((a, b) => a.timestamp - b.timestamp)
    
    for (const chapter of chapters) {
      if (!seenTimestamps.has(chapter.timestamp)) {
        seenTimestamps.add(chapter.timestamp)
        uniqueChapters.push(chapter)
      }
    }
    
    return uniqueChapters
  }
}

// Export singleton instance
module.exports = new YouTubeService()

// Also export the class for testing purposes
module.exports.YouTubeService = YouTubeService
