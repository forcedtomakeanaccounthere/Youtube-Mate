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
    // First, try to get basic playlist info and video IDs using yt-dlp
    try {
      const { spawn } = require('child_process')
      const path = require('path')
      
      // Render installs yt-dlp into the backend virtualenv during the build.
      const executable = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp'
      const virtualenvPath = path.join(__dirname, '..', '.venv', process.platform === 'win32' ? 'Scripts' : 'bin', executable)
      const userPath = path.join(require('os').homedir(), '.local', 'bin', executable)
      const YT_DLP_PATH = process.env.YT_DLP_PATH || (fs.existsSync(virtualenvPath) ? virtualenvPath : (fs.existsSync(userPath) ? userPath : executable))
      
      // Cookies file path
      const COOKIES_FILE = path.join(__dirname, '../www.youtube.com_cookies.txt')
      const fs = require('fs')
      
      const ytdlpResult = await new Promise((resolve, reject) => {
        const args = [
          '--dump-json',
          '--flat-playlist',
          '--no-warnings'
        ]
        
        // Add cookies if file exists
        if (fs.existsSync(COOKIES_FILE)) {
          args.push('--cookies', COOKIES_FILE)
        }
        
        args.push(playlistUrl)
        
        const ytdlp = spawn(YT_DLP_PATH, args)
        let output = ''
        let errorOutput = ''
        
        ytdlp.stdout.on('data', (data) => {
          output += data.toString()
        })
        
        ytdlp.stderr.on('data', (data) => {
          errorOutput += data.toString()
        })
        
        ytdlp.on('close', (code) => {
          if (code === 0 && output.trim()) {
            resolve(output.trim())
          } else {
            reject(new Error(`yt-dlp failed with code ${code}: ${errorOutput}`))
          }
        })
      })
      
      // Parse yt-dlp output
      const lines = ytdlpResult.split('\n')
      const playlistInfo = JSON.parse(lines[0])
      const videos = []
      
      // Process each video line
      for (let i = 1; i < lines.length && i <= 51; i++) { // Limit to 50 videos
        try {
          const videoData = JSON.parse(lines[i])
          videos.push({
            video_id: videoData.id,
            title: videoData.title || 'Unknown Title',
            thumbnail: videoData.thumbnail || `https://img.youtube.com/vi/${videoData.id}/mqdefault.jpg`,
            channel: videoData.uploader || videoData.channel || 'Unknown',
            duration: videoData.duration_string || 'Unknown',
            position: i - 1,
            url: `https://www.youtube.com/watch?v=${videoData.id}`
          })
        } catch (parseError) {
          console.warn('Failed to parse video data:', parseError.message)
        }
      }
      
      return {
        id: playlistId,
        title: playlistInfo.title || 'Unknown Playlist',
        description: playlistInfo.description || '',
        thumbnail: playlistInfo.thumbnail || '',
        channel: playlistInfo.uploader || playlistInfo.channel || 'Unknown Channel',
        videos: videos
      }
      
    } catch (ytdlpError) {
      console.warn('yt-dlp approach failed, falling back to web scraping:', ytdlpError.message)
    }
    
    // Fallback to web scraping
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

    // Try to extract videos from YouTube's initial data JSON
    let videos = []
    const seenVideoIds = new Set()

    // Look for ytInitialData in script tags
    const scriptTags = $('script').get()
    console.log(`Found ${scriptTags.length} script tags to search`)
    
    for (const script of scriptTags) {
      const scriptContent = $(script).html() || ''
      
      if (scriptContent.includes('var ytInitialData')) {
        console.log('Found ytInitialData script tag')
        try {
          // Extract JSON data from the script
          const jsonMatch = scriptContent.match(/var ytInitialData\s*=\s*({.+?});/)
          if (jsonMatch) {
            console.log('Successfully matched ytInitialData JSON')
            const ytData = JSON.parse(jsonMatch[1])
            
            // Navigate through the complex YouTube data structure
            const contents = ytData?.contents?.twoColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents?.[0]?.playlistVideoListRenderer?.contents
            
            console.log('Contents found:', !!contents, 'isArray:', Array.isArray(contents), 'length:', contents?.length)
            
            if (contents && Array.isArray(contents)) {
              contents.forEach((item, index) => {
                if (videos.length >= 50) return // Limit to 50 videos
                
                const videoRenderer = item.playlistVideoRenderer
                if (videoRenderer && videoRenderer.videoId) {
                  const videoId = videoRenderer.videoId;
                  const videoTitle = videoRenderer.title?.runs?.[0]?.text ||
                    videoRenderer.title?.simpleText ||
                    "Unknown Title";

                  // Robust channel extraction for each video
                  let videoChannel = channel; // fallback to playlist channel
                  if (
                    videoRenderer.shortBylineText &&
                    Array.isArray(videoRenderer.shortBylineText.runs) &&
                    videoRenderer.shortBylineText.runs[0]?.text
                  ) {
                    videoChannel = videoRenderer.shortBylineText.runs[0].text;
                  } else if (
                    videoRenderer.ownerText &&
                    Array.isArray(videoRenderer.ownerText.runs) &&
                    videoRenderer.ownerText.runs[0]?.text
                  ) {
                    videoChannel = videoRenderer.ownerText.runs[0].text;
                  }

                  if (!seenVideoIds.has(videoId) && videoTitle !== "Unknown Title") {
                    seenVideoIds.add(videoId);
                    videos.push({
                      video_id: videoId,
                      title: videoTitle.substring(0, 100),
                      thumbnail: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
                      channel: videoChannel,
                      duration: videoRenderer.lengthText?.simpleText || "Unknown",
                      position: index,
                    });
                  }
                }
              })
            }
          }
        } catch (parseError) {
          console.warn('Failed to parse ytInitialData:', parseError.message)
        }
      }
    }

    // Fallback to traditional HTML parsing if JSON parsing failed
    if (videos.length === 0) {
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
            
            // Try to extract channel information from nearby elements
            let videoChannel = "Unknown"
            
            // Look for channel information in various possible selectors
            const channelSelectors = [
              '#channel-name',
              '.ytd-channel-name',
              '#byline-container a',
              '[href*="/channel/"]',
              '[href*="/user/"]',
              '[href*="/@"]'
            ]
            
            channelSelectors.forEach(channelSelector => {
              if (videoChannel === "Unknown") {
                const channelElement = $(element).find(channelSelector).first()
                if (channelElement.length > 0) {
                  const channelText = channelElement.text().trim()
                  if (channelText && channelText !== "") {
                    videoChannel = channelText
                  }
                }
              }
            })
            
            // If still no channel, try parent elements
            if (videoChannel === "Unknown") {
              const parentChannelElement = $(element).closest('[aria-label]').find('a[href*="/channel/"]')
              if (parentChannelElement.length > 0) {
                videoChannel = parentChannelElement.text().trim() || "Unknown"
              }
            }
            
            videos.push({
              video_id: videoId,
              title: videoTitle.substring(0, 100), // Limit title length
              thumbnail: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
              channel: videoChannel,
              duration: "Unknown",
              position: videos.length,
            })
          }
        })
      })
    }

    // If we still couldn't extract videos, return basic info anyway
    if (videos.length === 0) {
      console.warn('No videos found in playlist via web scraping, returning sample data for testing')
      // Return sample data for testing - remove this in production
      return {
        id: playlistId,
        title: title || "Sample Playlist",
        description: description || "Sample playlist for testing",
        thumbnail: thumbnail,
        channel: channel || "Sample Channel",
        videos: [
          {
            video_id: "dQw4w9WgXcQ",
            title: "Sample Video 1 - Never Gonna Give You Up",
            thumbnail: "https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg",
            channel: "Rick Astley",
            duration: "3:33",
            position: 0
          },
          {
            video_id: "9bZkp7q19f0",
            title: "Sample Video 2 - PSY - GANGNAM STYLE",
            thumbnail: "https://img.youtube.com/vi/9bZkp7q19f0/mqdefault.jpg",
            channel: "officialpsy",
            duration: "4:12",
            position: 1
          },
          {
            video_id: "kJQP7kiw5Fk",
            title: "Sample Video 3 - Despacito",
            thumbnail: "https://img.youtube.com/vi/kJQP7kiw5Fk/mqdefault.jpg",
            channel: "Luis Fonsi",
            duration: "4:41",
            position: 2
          }
        ],
        error: "Could not extract videos from this playlist. Using sample data for testing."
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
    // Add more specific debugging
    console.log("Playlist extraction failed. Returning empty playlist structure.")
    return {
      id: playlistId,
      title: "Unknown Playlist",
      description: "",
      thumbnail: "",
      channel: "Unknown Channel",
      videos: [],
      error: "Failed to extract playlist data"
    }
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