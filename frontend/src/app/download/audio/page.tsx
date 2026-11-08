"use client"

import { API_BASE } from "@/lib/api"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Progress } from "@/components/ui/progress"
import { Checkbox } from "@/components/ui/checkbox"
import { Slider } from "@/components/ui/slider"
import { FileAudio, Download, Settings, HardDrive, Play, Pause, Volume2, AlertCircle, VolumeX, SkipBack, SkipForward, Gauge } from "lucide-react"
import Link from "next/link"
import Navbar from "@/components/landing/Navbar"
import featuresData from "@/data/features.json"
import { Feature } from "@/types/features"
import { useDarkMode } from "@/hooks/use-dark-mode"
import PremiumGuard, { usePremiumGuard } from "@/components/PremiumGuard"

const features: Feature[] = featuresData

interface AudioFormat {
  quality: string
  format: string
  fileSize?: string
  bitrate?: number
  available: boolean
  type: string
}

interface VideoFormats {
  video: any[]
  audio: AudioFormat[]
}

export default function AudioDownloadPage() {
  const [url, setUrl] = useState("")
  const [selectedQuality, setSelectedQuality] = useState("128kbps") // Changed to a more common default
  const [selectedFormat, setSelectedFormat] = useState("mp3")
  const [selectedSampleRate, setSelectedSampleRate] = useState("44100")
  // Advanced audio options — wired through to the yt-dlp post-processing
  const [normalizeLevels, setNormalizeLevels] = useState(false)
  const [trimSilence, setTrimSilence] = useState(false)
  const [embedArtwork, setEmbedArtwork] = useState(false)
  const [availableFormats, setAvailableFormats] = useState<VideoFormats | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [videoId, setVideoId] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [audioRef, setAudioRef] = useState<HTMLAudioElement | null>(null)
  const [isAudioLoading, setIsAudioLoading] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState(0)
  const [showAudioPlayer, setShowAudioPlayer] = useState(false)
  const [audioCurrentTime, setAudioCurrentTime] = useState(0)
  const [audioDuration, setAudioDuration] = useState(0)
  const [audioVolume, setAudioVolume] = useState(1)
  const [audioPlaybackRate, setAudioPlaybackRate] = useState(1)
  const [downloadId, setDownloadId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [downloadHistory, setDownloadHistory] = useState<any[]>([])
  const [animatedProgress, setAnimatedProgress] = useState(0)
  const [videoTitle, setVideoTitle] = useState<string | null>(null)
  const [videoThumbnail, setVideoThumbnail] = useState<string | null>(null)
  const [videoDuration, setVideoDuration] = useState<number | null>(null)
  const [isAudioSeekable, setIsAudioSeekable] = useState(true)
  const [pendingSeekTime, setPendingSeekTime] = useState<number | null>(null)

  // Navbar state
  const [activeFeature, setActiveFeature] = useState(features[0])
  const [showNavbar, setShowNavbar] = useState(true)
  const { darkMode, toggleDarkMode, mounted } = useDarkMode()

  // Premium guard
  const { showPremiumModal, premiumMessage, premiumTitle, checkPremiumFeature, triggerPremiumModal, closePremiumModal } = usePremiumGuard()

  const audioQualityOptions = [
    { quality: "320kbps", format: "MP3", fileSize: "9.2 MB", bitrate: "320 kbps", available: true },
    { quality: "256kbps", format: "MP3", fileSize: "7.4 MB", bitrate: "256 kbps", available: true },
    { quality: "192kbps", format: "MP3", fileSize: "5.5 MB", bitrate: "192 kbps", available: true },
    { quality: "128kbps", format: "MP3", fileSize: "3.7 MB", bitrate: "128 kbps", available: true },
    { quality: "96kbps", format: "MP3", fileSize: "2.8 MB", bitrate: "96 kbps", available: true },
  ]

  // Extract video ID from URL (supports standard, embed, short, and Shorts URLs)
  const extractVideoId = (url: string) => {
    const match = url.match(/(?:youtube\.com\/(?:shorts\/|[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/)
    return match ? match[1] : null
  }

  // Fetch available formats when URL changes (with debouncing)
  useEffect(() => {
    if (url) {
      const vId = extractVideoId(url)
      setVideoId(vId)
      
      if (vId) {
        // Add a small delay to prevent rapid API calls while user is typing
        const timeoutId = setTimeout(() => {
          fetchAvailableFormats()
        }, 500)
        
        return () => clearTimeout(timeoutId)
      }
    } else {
      setAvailableFormats(null)
      setVideoId(null)
      setError(null)
    }
  }, [url])

  // Fetch download history
  useEffect(() => {
    fetchDownloadHistory()
  }, [])

  // Animated progress effect
  useEffect(() => {
    if (downloadId && downloadProgress === 0) {
      // If real progress is 0, show an animated progress for better UX
      const interval = setInterval(() => {
        setAnimatedProgress(prev => {
          if (prev < 95) {
            return prev + Math.random() * 5
          }
          return prev
        })
      }, 1000)

      return () => clearInterval(interval)
    } else if (downloadProgress > 0) {
      // Use real progress when available
      setAnimatedProgress(downloadProgress)
    } else {
      // Reset animated progress when not downloading
      setAnimatedProgress(0)
    }
  }, [downloadId, downloadProgress])

  // Cleanup audio when component unmounts
  useEffect(() => {
    return () => {
      if (audioRef) {
        audioRef.pause()
        audioRef.src = ""
        setAudioRef(null)
        setIsPlaying(false)
        setShowAudioPlayer(false)
        setIsAudioSeekable(true) // Reset seekable state
      }
    }
  }, [])

  const fetchDownloadHistory = async () => {
    try {
      const response = await fetch(`${API_BASE}/downloads/history?limit=5&format=audio`)
      if (response.ok) {
        const data = await response.json()
        setDownloadHistory(data.downloads || [])
      }
    } catch (error) {
      console.warn('Download history unavailable (backend may be restarting):', (error as Error).message)
    }
  }

  const fetchAvailableFormats = async () => {
    if (!url) return
    
    setIsLoading(true)
    setError(null)
    
    try {
      const token = localStorage.getItem("token")
      const response = await fetch(`${API_BASE}/downloads/formats`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` }),
        },
        body: JSON.stringify({ youtube_url: url }),
      })

      if (!response.ok) {
        throw new Error('Failed to fetch formats')
      }

      const formats = await response.json()
      setAvailableFormats(formats)
      
      // Extract video metadata (title, thumbnail, duration)
      if (formats.title) {
        setVideoTitle(formats.title)
      }
      if (formats.thumbnail) {
        setVideoThumbnail(formats.thumbnail)
      }
      if (formats.duration) {
        setVideoDuration(formats.duration)
        // Also set audio duration immediately so it's available for the player
        setAudioDuration(formats.duration)
      }
      
      // Set the best available audio quality
      if (formats.audio && formats.audio.length > 0) {
        // Sort by bitrate descending and pick the highest quality available
        const sortedAudio = formats.audio
          .filter((f: AudioFormat) => f.available)
          .sort((a: AudioFormat, b: AudioFormat) => (b.bitrate || 0) - (a.bitrate || 0))
        
        if (sortedAudio.length > 0) {
          setSelectedQuality(sortedAudio[0].quality)
        }
      }
    } catch (error) {
      console.error('Error fetching formats:', error)
      const msg = 'Failed to load video formats. Please check the URL and try again.'
      setError(msg)
      triggerPremiumModal(msg, 'Audio Format Error')
    } finally {
      setIsLoading(false)
    }
  }

  const toggleAudioPreview = () => {
    if (!videoId) return

    if (isPlaying) {
      audioRef?.pause()
      setIsPlaying(false)
    } else {
      if (audioRef) {
        audioRef.play()
        setIsPlaying(true)
      } else {
        // Set loading state
        setIsAudioLoading(true)
        setError(null)
        setIsAudioSeekable(true) // Assume seekable initially, will be updated in onloadedmetadata
        setPendingSeekTime(null)
        
        // Create audio element for preview
        const audio = new Audio(`${API_BASE}/downloads/preview/${videoId}`)
        audio.crossOrigin = "anonymous"
        audio.volume = audioVolume
        audio.playbackRate = audioPlaybackRate
        
        // Set up event listeners
        audio.onended = () => {
          setIsPlaying(false)
          setAudioCurrentTime(0)
          // Don't hide player when audio ends naturally
        }
        audio.onerror = () => {
          // MediaError codes: 1 aborted, 2 network, 3 decode, 4 src-not-supported
          const err = audio.error
          const codeName = { 1: 'ABORTED', 2: 'NETWORK', 3: 'DECODE', 4: 'SRC_NOT_SUPPORTED' }[err?.code ?? 0] || 'UNKNOWN'
          console.error(`Audio error: ${codeName} — ${err?.message || 'no detail'}`)
          const hasProgress = audio.currentTime > 0 || audio.readyState >= 2
          if (!hasProgress) {
            setIsPlaying(false)
            setIsAudioLoading(false)
            setError('Audio preview not available')
            setShowAudioPlayer(false)
            setIsAudioSeekable(true) // Reset seekable state
            triggerPremiumModal('Audio preview is not available for this video. Upgrade to Premium for reliable audio previews and downloads.', 'Audio Preview Unavailable')
          } else {
            // Ignore transient errors during seek/stream continuation
            setIsAudioLoading(false)
          }
        }
        audio.onloadedmetadata = () => {
          // Update duration from stream if available and we don't have it from API
          if (audio.duration && isFinite(audio.duration) && !videoDuration) {
            setAudioDuration(audio.duration)
          }
          // Check if audio is seekable (streams are usually not seekable)
          if (audio.seekable && audio.seekable.length > 0) {
            setIsAudioSeekable(true)
          } else {
            setIsAudioSeekable(false)
            console.log('⚠️ Audio stream is not seekable - seeking disabled for preview')
          }
        }
        audio.ontimeupdate = () => {
          setAudioCurrentTime(audio.currentTime)
        }
        audio.onloadstart = () => {
          setShowAudioPlayer(true)
        }
        audio.oncanplay = () => {
          setIsAudioLoading(false)
          setIsPlaying(true)
        }
        audio.onpause = () => {
          setIsPlaying(false)
        }
        audio.onplay = () => {
          setIsPlaying(true)
        }
        
        setAudioRef(audio)
        audio.play()
      }
    }
  }

  // Update audio settings when state changes
  const updateAudioVolume = (volume: number) => {
    setAudioVolume(volume)
    if (audioRef) {
      audioRef.volume = volume
    }
  }

  const updateAudioPlaybackRate = (rate: number) => {
    setAudioPlaybackRate(rate)
    if (audioRef) {
      audioRef.playbackRate = rate
    }
  }

  const seekAudio = (time: number) => {
    // Don't attempt to seek if audio is not seekable (streaming audio)
    if (!isAudioSeekable) {
      console.log('⚠️ Seeking not available for streaming preview')
      return
    }
    if (audioRef && isFinite(time) && time >= 0) {
      try {
        audioRef.currentTime = time
        setAudioCurrentTime(time)
      } catch (error) {
        console.error('Failed to seek:', error)
      }
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const startDownload = async () => {
    if (!url) return

    setError(null)
    setDownloadProgress(0)

    const payload = {
      youtube_url: url,
      format: 'audio', // Always use 'audio' for audio downloads
      quality: selectedQuality,
      options: {
        audio_format: selectedFormat, // Specify the audio format separately
        normalize: normalizeLevels,
        trimSilence: trimSilence,
        embedArtwork: embedArtwork,
        sampleRate: Number(selectedSampleRate),
      }
    }

    console.log('Sending download request with payload:', payload)

    try {
      const token = localStorage.getItem("token")
      const response = await fetch(`${API_BASE}/downloads`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` }),
        },
        body: JSON.stringify(payload),
      })

      console.log('Response status:', response.status, response.statusText)

      if (!response.ok) {
        const errorData = await response.json()
        console.warn('Server error:', errorData.error || errorData)
        throw new Error(errorData.error || 'Failed to start download')
      }

      const result = await response.json()
      console.log('Download started successfully:', result)
      setDownloadId(result.download_id)
      
      // Start polling for progress
      pollProgress(result.download_id)
      
    } catch (error) {
      console.error('Error starting download:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      setError(`Failed to start download: ${errorMessage}`)
      triggerPremiumModal(`Download failed: ${errorMessage}. Upgrade to Premium for reliable downloads with priority processing.`, 'Download Error')
    }
  }

  const pollProgress = async (downloadId: string) => {
    const poll = async () => {
      try {
        const token = localStorage.getItem("token")
        const response = await fetch(
          `${API_BASE}/downloads/${downloadId}`,
          {
            headers: {
              ...(token && { 'Authorization': `Bearer ${token}` }),
            }
          }
        )
        
        if (response.ok) {
          const download = await response.json()
          setDownloadProgress(download.progress || 0)
          
          if (download.status === 'completed') {
            // Download completed, provide download link
            const token = localStorage.getItem("token")
            const link = document.createElement('a')
            
            // Add token to URL if available
            const downloadUrl = token 
              ? `${API_BASE}/downloads/file/${downloadId}?token=${token}`
              : `${API_BASE}/downloads/file/${downloadId}`
            
            link.href = downloadUrl
            link.download = download.file_name || 'download.mp3'
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
            
            console.log('Download completed, file:', download.file_name)
            
            setDownloadId(null)
            setDownloadProgress(0)
            
            // Refresh download history
            fetchDownloadHistory()
          } else if (download.status === 'failed') {
            console.error('Download failed:', download.error_message)
            const failMsg = download.error_message || 'Download failed'
            setError(failMsg)
            triggerPremiumModal(`${failMsg}. Upgrade to Premium for reliable downloads with priority processing.`, 'Download Failed')
            setDownloadId(null)
            setDownloadProgress(0)
          } else {
            // Continue polling
            console.log('Download progress:', download.progress, '%, status:', download.status)
            setTimeout(poll, 2000)
          }
        } else {
          console.error('Failed to fetch download status:', response.status)
          // Don't stop polling on temporary errors
          setTimeout(poll, 2000)
        }
      } catch (error) {
        console.error('Error polling progress:', error)
        // Don't stop polling on network errors
        setTimeout(poll, 2000)
      }
    }
    
    poll()
  }

  const getAvailableQualities = () => {
    if (!availableFormats?.audio) {
      return audioQualityOptions
    }

    // Use actual available formats from the backend
    const uniqueQualities = new Map()
    
    availableFormats.audio.forEach((format, index) => {
      if (!uniqueQualities.has(format.quality)) {
        uniqueQualities.set(format.quality, {
          quality: format.quality,
          format: format.format.toUpperCase(),
          fileSize: format.fileSize || 'Unknown',
          bitrate: `${format.bitrate} kbps`,
          available: format.available
        })
      }
    })

    return Array.from(uniqueQualities.values()).sort((a, b) => {
      // Sort by bitrate descending
      const aBitrate = parseInt(a.quality)
      const bBitrate = parseInt(b.quality)
      return bBitrate - aBitrate
    })
  }

  // Don't render anything that depends on darkMode until mounted
  if (!mounted) {
    return <div className="min-h-screen" /> // Minimal fallback
  }

  return (
    <div className={`min-h-screen transition-colors duration-300 ${darkMode ? "dark bg-black-600" : "bg-gradient-to-br from-orange-50 to-red-50"}`}>
      <Navbar
        showNavbar={showNavbar}
        features={features}
        setActiveFeature={setActiveFeature}
        darkMode={darkMode}
        toggleDarkMode={toggleDarkMode}
      />
      <img src="/butterfly.webp" alt="butterfly" className="absolute right-0 butterfly" />
      <div className="pt-20 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex items-center justify-center mb-4">
              <FileAudio className="w-12 h-12 text-orange-500 mr-3" />
              <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-orange-500 to-red-600 bg-clip-text text-transparent">
                Audio Download
              </h1>
            </div>
            <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              Extract high-quality audio from YouTube videos with multiple format and bitrate options.
            </p>
            <div className="mt-4">
          </div>
        </div>

        <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-orange-200/50 dark:border-gray-700/50">
          <CardHeader>
            <CardTitle className="flex items-center text-gray-900 dark:text-white">
              <FileAudio className="w-5 h-5 mr-2 text-orange-500" />
              Audio Download Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Error Display */}
            {error && (
              <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <div className="flex items-center">
                  <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
                  <p className="text-red-700 dark:text-red-300">{error}</p>
                </div>
              </div>
            )}

            {/* URL Input */}
            <div className="space-y-3">
              <Label htmlFor="audio-url">YouTube Video URL</Label>
              <Input
                id="audio-url"
                type="url"
                placeholder="https://www.youtube.com/watch?v=..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="text-lg"
              />
              {videoId && (
                <div className="flex items-center space-x-2 mt-2">
                  <Button
                    onClick={toggleAudioPreview}
                    variant="outline"
                    size="sm"
                    className="flex items-center"
                    disabled={isAudioLoading}
                  >
                    {isAudioLoading ? (
                      <>
                        <div className="w-4 h-4 mr-1 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        Loading...
                      </>
                    ) : isPlaying ? (
                      <>
                        <Pause className="w-4 h-4 mr-1" />
                        <Volume2 className="w-4 h-4 mr-1" />
                        Pause Preview
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 mr-1" />
                        <Volume2 className="w-4 h-4 mr-1" />
                        Preview Audio
                      </>
                    )}
                  </Button>
                </div>
              )}

              {/* Enhanced Audio Player */}
              {showAudioPlayer && audioRef && (
                <div className="mt-4 p-4 bg-gradient-to-r from-orange-50 to-red-50 dark:from-gray-700 dark:to-gray-600 rounded-lg border border-orange-200 dark:border-gray-600">
                  <div className="space-y-4">
                    {/* Video Info (Thumbnail & Title) */}
                    {(videoThumbnail || videoTitle) && (
                      <div className="flex items-center space-x-4 pb-2 border-b border-orange-200 dark:border-gray-600">
                        {videoThumbnail && (
                          <div className="flex-shrink-0">
                            <img 
                              src={videoThumbnail} 
                              alt={videoTitle || 'Video thumbnail'}
                              className="w-16 h-16 rounded-full object-cover border-2 border-orange-300 dark:border-gray-500"
                            />
                          </div>
                        )}
                        {videoTitle && (
                          <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-semibold text-gray-800 dark:text-white truncate">
                              {videoTitle}
                            </h3>
                            <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                              Audio Preview
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Audio Progress Bar */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-300">
                        <span>{formatTime(isFinite(audioCurrentTime) && audioCurrentTime >= 0 ? audioCurrentTime : 0)}</span>
                        <span>{formatTime(isFinite(audioDuration) && audioDuration > 0 ? audioDuration : 0)}</span>
                      </div>
                      {!isAudioSeekable && (
                        <p className="text-xs text-orange-600 dark:text-orange-400 italic">
                          ⓘ Seeking not available during preview (download to skip around)
                        </p>
                      )}
                      <Slider
                        value={[
                          isFinite(pendingSeekTime ?? audioCurrentTime) && (pendingSeekTime ?? audioCurrentTime) >= 0
                            ? (pendingSeekTime ?? audioCurrentTime)
                            : 0
                        ]}
                        max={isFinite(audioDuration) && audioDuration > 0 ? audioDuration : 100}
                        step={1}
                        onValueChange={(value: number[]) => setPendingSeekTime(value[0])}
                        onValueCommit={(value: number[]) => {
                          setPendingSeekTime(null)
                          seekAudio(value[0])
                        }}
                        disabled={!isAudioSeekable}
                        className={`w-full ${!isAudioSeekable ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Volume Control */}
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          {audioVolume === 0 ? (
                            <VolumeX className="w-4 h-4 text-orange-500" />
                          ) : (
                            <Volume2 className="w-4 h-4 text-orange-500" />
                          )}
                          <Label className="text-sm font-medium">Volume</Label>
                          <span className="text-xs text-gray-500">{Math.round(audioVolume * 100)}%</span>
                        </div>
                        <Slider
                          value={[audioVolume]}
                          max={1}
                          step={0.1}
                          onValueChange={(value: number[]) => updateAudioVolume(value[0])}
                          className="w-full"
                        />
                      </div>

                      {/* Playback Speed Control */}
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <Gauge className="w-4 h-4 text-orange-500" />
                          <Label className="text-sm font-medium">Speed</Label>
                          <span className="text-xs text-gray-500">{audioPlaybackRate}x</span>
                        </div>
                        <Slider
                          value={[audioPlaybackRate]}
                          min={0.5}
                          max={2}
                          step={0.25}
                          onValueChange={(value: number[]) => updateAudioPlaybackRate(value[0])}
                          className="w-full"
                        />
                      </div>
                    </div>

                    {/* Quick Speed Buttons */}
                    <div className="flex items-center justify-center space-x-2">
                      <Button
                        onClick={() => updateAudioPlaybackRate(0.5)}
                        variant="outline"
                        size="sm"
                        className={`text-xs ${audioPlaybackRate === 0.5 ? 'bg-orange-100 dark:bg-orange-900 border-orange-300 dark:border-orange-700 text-orange-700 dark:text-orange-300' : ''}`}
                      >
                        0.5x
                      </Button>
                      <Button
                        onClick={() => updateAudioPlaybackRate(0.75)}
                        variant="outline"
                        size="sm"
                        className={`text-xs ${audioPlaybackRate === 0.75 ? 'bg-orange-100 dark:bg-orange-900 border-orange-300 dark:border-orange-700 text-orange-700 dark:text-orange-300' : ''}`}
                      >
                        0.75x
                      </Button>
                      <Button
                        onClick={() => updateAudioPlaybackRate(1)}
                        variant="outline"
                        size="sm"
                        className={`text-xs ${audioPlaybackRate === 1 ? 'bg-orange-100 dark:bg-orange-900 border-orange-300 dark:border-orange-700 text-orange-700 dark:text-orange-300' : ''}`}
                      >
                        1x
                      </Button>
                      <Button
                        onClick={() => updateAudioPlaybackRate(1.25)}
                        variant="outline"
                        size="sm"
                        className={`text-xs ${audioPlaybackRate === 1.25 ? 'bg-orange-100 dark:bg-orange-900 border-orange-300 dark:border-orange-700 text-orange-700 dark:text-orange-300' : ''}`}
                      >
                        1.25x
                      </Button>
                      <Button
                        onClick={() => updateAudioPlaybackRate(1.5)}
                        variant="outline"
                        size="sm"
                        className={`text-xs ${audioPlaybackRate === 1.5 ? 'bg-orange-100 dark:bg-orange-900 border-orange-300 dark:border-orange-700 text-orange-700 dark:text-orange-300' : ''}`}
                      >
                        1.5x
                      </Button>
                      <Button
                        onClick={() => updateAudioPlaybackRate(2)}
                        variant="outline"
                        size="sm"
                        className={`text-xs ${audioPlaybackRate === 2 ? 'bg-orange-100 dark:bg-orange-900 border-orange-300 dark:border-orange-700 text-orange-700 dark:text-orange-300' : ''}`}
                      >
                        2x
                      </Button>
                    </div>

                    {/* Additional Controls */}
                    <div className="flex items-center justify-center space-x-2">
                      <Button
                        onClick={() => seekAudio(Math.max(0, audioCurrentTime - 10))}
                        variant="outline"
                        size="sm"
                        className="flex items-center"
                        disabled={!isAudioSeekable}
                        title={!isAudioSeekable ? "Seeking not available in preview" : "Skip backward 10 seconds"}
                      >
                        <SkipBack className="w-4 h-4 mr-1" />
                        -10s
                      </Button>
                      <Button
                        onClick={toggleAudioPreview}
                        variant="outline"
                        size="sm"
                        className="flex items-center"
                        disabled={isAudioLoading}
                      >
                        {isAudioLoading ? (
                          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        ) : isPlaying ? (
                          <Pause className="w-4 h-4" />
                        ) : (
                          <Play className="w-4 h-4" />
                        )}
                      </Button>
                      <Button
                        onClick={() => seekAudio(Math.min(audioDuration, audioCurrentTime + 10))}
                        variant="outline"
                        size="sm"
                        className="flex items-center"
                        disabled={!isAudioSeekable}
                        title={!isAudioSeekable ? "Seeking not available in preview" : "Skip forward 10 seconds"}
                      >
                        <SkipForward className="w-4 h-4 mr-1" />
                        +10s
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Quality Settings */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                  <Settings className="w-5 h-5 mr-2 text-orange-500" />
                  Audio Quality
                </h3>

                <div className="space-y-3">
                  <Label>Bitrate</Label>
                  <Select value={selectedQuality} onValueChange={setSelectedQuality}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {getAvailableQualities().map((option, index) => (
                        <SelectItem 
                          key={`${option.quality}-${option.format}-${index}`} 
                          value={option.quality}
                          disabled={!option.available}
                        >
                          <div className="flex items-center justify-between w-full">
                            <span className={!option.available ? 'text-gray-400' : ''}>{option.bitrate}</span>
                            <span className={`text-sm ml-4 ${!option.available ? 'text-gray-400' : 'text-gray-500'}`}>
                              {option.fileSize} {!option.available && '(N/A)'}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="mt-8">Audio Format</Label>
                  <Select value={selectedFormat} onValueChange={setSelectedFormat}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mp3">MP3 (Recommended)</SelectItem>
                      <SelectItem value="aac">AAC (High Quality)</SelectItem>
                      <SelectItem value="ogg">OGG Vorbis</SelectItem>
                      <SelectItem value="wav">WAV (Lossless)</SelectItem>
                      <SelectItem value="flac">FLAC (Lossless)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Advanced Options */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                  <HardDrive className="w-5 h-5 mr-2 text-orange-500" />
                  Advanced Options
                </h3>

                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox id="normalize" checked={normalizeLevels} onCheckedChange={(v) => setNormalizeLevels(Boolean(v))} />
                    <Label htmlFor="normalize">Normalize audio levels</Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox id="trim-silence" checked={trimSilence} onCheckedChange={(v) => setTrimSilence(Boolean(v))} />
                    <Label htmlFor="trim-silence">Trim silence</Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox id="embed-artwork" checked={embedArtwork} onCheckedChange={(v) => setEmbedArtwork(Boolean(v))} />
                    <Label htmlFor="embed-artwork">Embed album artwork</Label>
                  </div>

                  {/* <div className="flex items-center space-x-2">
                    <Checkbox id="add-metadata" />
                    <Label htmlFor="add-metadata">Add ID3 tags</Label>
                  </div> */}
                </div>

                <div className="space-y-3">
                  <Label className="mt-8">Sample Rate</Label>
                  <Select value={selectedSampleRate} onValueChange={setSelectedSampleRate}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="48000">48 kHz (Studio Quality)</SelectItem>
                      <SelectItem value="44100">44.1 kHz (CD Quality)</SelectItem>
                      <SelectItem value="22050">22 kHz</SelectItem>
                      <SelectItem value="16000">16 kHz</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* File Size Estimation */}
            <div className="p-4 bg-gradient-to-r from-orange-50 to-red-50 dark:from-gray-700 dark:to-gray-600 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white">Estimated File Size</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-300">Based on selected bitrate and format</p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-orange-600">
                    {availableFormats?.audio.find(f => f.quality === selectedQuality)?.fileSize || 
                     audioQualityOptions.find((opt) => opt.quality === selectedQuality)?.fileSize || "Unknown"}
                  </div>
                  <div className="text-sm text-gray-500">
                    {selectedFormat.toUpperCase()} • {selectedQuality}
                  </div>
                </div>
              </div>
            </div>

            {/* Download Progress */}
            {downloadId && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Download Progress</Label>
                  <span className="text-sm text-gray-500">
                    {downloadProgress > 0 ? `${Math.round(downloadProgress)}%` : `${Math.round(animatedProgress)}%`}
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div 
                    className="bg-gradient-to-r from-orange-500 to-red-600 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${downloadProgress > 0 ? downloadProgress : animatedProgress}%` }}
                  ></div>
                </div>
                {downloadProgress === 0 && (
                  <p className="text-sm text-gray-500 text-center">Processing your download...</p>
                )}
              </div>
            )}

            <Button
              disabled={!url || isLoading || !!downloadId}
              onClick={startDownload}
              className="w-full bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white py-3 text-lg"
            >
              <Download className="w-5 h-5 mr-2" />
              {downloadId ? 'Downloading...' : isLoading ? 'Loading...' : 'Extract Audio'}
            </Button>
          </CardContent>
        </Card>

        {/* Download History */}
        {downloadHistory.length > 0 && (
          <Card className="mt-8 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-orange-200/50 dark:border-gray-700/50">
            <CardHeader>
              <CardTitle className="flex items-center text-gray-900 dark:text-white">
                <FileAudio className="w-5 h-5 mr-2 text-orange-500" />
                Recent Downloads
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 overflow-scroll">
                {downloadHistory.slice(0, 5).map((download) => (
                  <div 
                    key={download._id}
                    className="flex items-center space-x-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg relative"
                  >
                    {/* Thumbnail */}
                    <div className="flex-shrink-0">
                      <img
                        src={download.metadata?.thumbnail || `https://i.ytimg.com/vi/${download.video_id}/hqdefault.jpg`}
                        alt={download.metadata?.title || 'Video thumbnail'}
                        className="w-20 h-14 object-cover rounded-lg bg-gray-200 dark:bg-gray-600"
                        onError={(e) => {
                          e.currentTarget.src = `https://i.ytimg.com/vi/${download.video_id}/default.jpg`
                        }}
                      />
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-gray-900 dark:text-white truncate">
                        {download.metadata?.title || 'Unknown Title'}
                      </h4>
                      <div className="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400 mt-1">
                        <span className="flex items-center">
                          <FileAudio className="w-3 h-3 mr-1" />
                          {download.format?.toUpperCase()}
                        </span>
                        <span>{download.options?.audio_format?.toUpperCase() || 'MP3'}</span>
                        <span>{download.quality}</span>
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          download.status === 'completed' 
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                            : download.status === 'failed'
                            ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                            : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                        }`}>
                          {download.status}
                        </span>
                        <span>{new Date(download.created_at).toLocaleDateString()}</span>
                        {download.status === 'completed' && (
                      <Button
                        onClick={() => {
                          const link = document.createElement('a')
                          link.href = `${API_BASE}/downloads/file/${download._id}`
                          link.download = download.file_name || 'download'
                          document.body.appendChild(link)
                          link.click()
                          document.body.removeChild(link)
                        }}
                        variant="outline"
                        size="sm"
                        className="flex-shrink-2 p-2 mt-3 ml-9 text-black lg:invisible"
                      >
                        <Download className="w-4 h-4 mr-1 text-orange-500" />
                        Download
                      </Button>
                    )}
                      </div>
                      {download.file_size && (
                        <div className="text-xs text-orange-500 mt-1">
                          File size: {(download.file_size / (1024 * 1024)).toFixed(1)} MB
                        </div>
                      )}
                    </div>
                    
                    {/* Download Button */}
                    {download.status === 'completed' && (
                      <Button
                        onClick={() => {
                          const link = document.createElement('a')
                          link.href = `${API_BASE}/downloads/file/${download._id}`
                          link.download = download.file_name || 'download'
                          document.body.appendChild(link)
                          link.click()
                          document.body.removeChild(link)
                        }}
                        variant="outline"
                        size="sm"
                        className="flex-shrink-0 p-2 mt-4 absolute top-9 right-2 lg:visible invisible"
                      >
                        <Download className="w-4 h-4 mr-1 text-orange-500" />
                        Download
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
    <style jsx>{`
        .butterfly {
          width: 420px;
          height: 560px;
          top: 200px;
        }
        @media (max-width: 1330px) {
          .butterfly {
            width: 400px;
            height: 480px;
            top: 195px;
            right: 0;
          }
        }
        @media (max-width: 1220px) {
          .butterfly {
            width: 320px;
            height: 400px;
            top: 180px;
          }
        }
        @media (max-width: 1020px) {
          .butterfly {
            width: 340px;
            height: 400px;
            top: 350px;
          }
        }
        @media (max-width: 600px) {
          .butterfly {
            visibility: hidden;
          }
        }
      `}</style>

      {/* Premium Guard Modal */}
      <PremiumGuard
        isOpen={showPremiumModal}
        onClose={closePremiumModal}
        feature="audio extraction"
        title={premiumTitle || "Premium Feature - Audio Downloads"}
        message={premiumMessage || "Audio extraction and preview are premium features. Subscribe to extract high-quality audio from YouTube videos with advanced options."}
      />
    </div>
  )
}
