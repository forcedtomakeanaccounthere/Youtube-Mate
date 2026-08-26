"use client"

import { API_BASE } from "@/lib/api"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { FileVideo, Download, Settings, HardDrive, Play, Pause, Video, AlertCircle } from "lucide-react"
import Link from "next/link"
import Navbar from "@/components/landing/Navbar"
import featuresData from "@/data/features.json"
import { Feature } from "@/types/features"
import { useDarkMode } from "@/hooks/use-dark-mode"
import PremiumGuard, { usePremiumGuard } from "@/components/PremiumGuard"

const features: Feature[] = featuresData

interface VideoFormat {
  quality: string
  format: string
  fileSize?: string
  fps?: number
  available: boolean
  type: string
  hasAudio?: boolean
}

interface VideoFormats {
  video: VideoFormat[]
  audio: any[]
}

export default function VideoDownloadPage() {
  const [url, setUrl] = useState("")
  const [selectedQuality, setSelectedQuality] = useState("720p") // More common default
  const [selectedFormat, setSelectedFormat] = useState("mp4")
  const [availableFormats, setAvailableFormats] = useState<VideoFormats | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [videoId, setVideoId] = useState<string | null>(null)
  const [downloadProgress, setDownloadProgress] = useState(0)
  const [downloadId, setDownloadId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [includeSubtitles, setIncludeSubtitles] = useState(false)
  const [downloadHistory, setDownloadHistory] = useState<any[]>([])
  const [animatedProgress, setAnimatedProgress] = useState(0)
  const [showVideoPreview, setShowVideoPreview] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)

  // Navbar state
  const [activeFeature, setActiveFeature] = useState(features[0])
  const [showNavbar, setShowNavbar] = useState(true)
  const { darkMode, toggleDarkMode, mounted } = useDarkMode()

  // Premium guard
  const { showPremiumModal, premiumMessage, premiumTitle, checkPremiumFeature, triggerPremiumModal, closePremiumModal } = usePremiumGuard()

  const videoQualityOptions = [
    { quality: "2160p", format: "MP4", fileSize: "2.1 GB", fps: 60, available: true },
    { quality: "1440p", format: "MP4", fileSize: "1.2 GB", fps: 60, available: true },
    { quality: "1080p", format: "MP4", fileSize: "650 MB", fps: 30, available: true },
    { quality: "720p", format: "MP4", fileSize: "320 MB", fps: 30, available: true },
    { quality: "480p", format: "MP4", fileSize: "180 MB", fps: 30, available: true },
    { quality: "360p", format: "MP4", fileSize: "95 MB", fps: 30, available: true },
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

      // Set the best available video quality
      if (formats.video && formats.video.length > 0) {
        // Sort by quality descending and pick the best quality available
        const sortedVideo = formats.video
          .filter((f: VideoFormat) => f.available)
          .sort((a: VideoFormat, b: VideoFormat) => {
            const aRes = parseInt(a.quality) || 0
            const bRes = parseInt(b.quality) || 0
            return bRes - aRes
          })

        if (sortedVideo.length > 0) {
          setSelectedQuality(sortedVideo[0].quality)
        }
      }
    } catch (error) {
      console.error('Error fetching formats:', error)
      const msg = 'Failed to load video formats. Please check the URL and try again.'
      setError(msg)
      triggerPremiumModal(msg, 'Video Format Error')
    } finally {
      setIsLoading(false)
    }
  }

  const fetchDownloadHistory = async () => {
    try {
      const response = await fetch(`${API_BASE}/downloads/history?limit=5&format=video`)
      if (response.ok) {
        const data = await response.json()
        setDownloadHistory(data.downloads || [])
      }
    } catch (error) {
      console.error('Error fetching download history:', error)
    }
  }

  const startDownload = async () => {
    if (!url || isDownloading) return

    setError(null)
    setDownloadProgress(0)
    setIsDownloading(true)

    const payload = {
      youtube_url: url,
      format: 'video',
      quality: selectedQuality,
    }

    console.log('Starting video download with payload:', payload)

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

      if (!response.ok) {
        const errorData = await response.json()
        console.error('Server error response:', errorData)
        throw new Error(errorData.error || 'Failed to start download')
      }

      const result = await response.json()
      setDownloadId(result.download_id)
      
      // Start polling for progress
      pollProgress(result.download_id)
    } catch (error) {
      console.error('Error starting download:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to start download'
      setError(errorMessage)
      triggerPremiumModal(`Download failed: ${errorMessage}. Upgrade to Premium for reliable downloads with priority processing.`, 'Download Error')
      setIsDownloading(false)
      setDownloadId(null)
    }
  }

  const pollProgress = async (downloadId: string) => {
    const poll = async () => {
      try {
        const response = await fetch(`${API_BASE}/downloads/${downloadId}`)

        if (response.ok) {
          const download = await response.json()
          setDownloadProgress(download.progress || 0)

          if (download.status === 'completed') {
            // Download completed, provide download link
            const link = document.createElement('a')
            link.href = `${API_BASE}/downloads/file/${downloadId}`
            link.download = download.file_name || 'download.mp4'
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)

            setDownloadId(null)
            setDownloadProgress(0)

            // Refresh download history
            fetchDownloadHistory()
          } else if (download.status === 'failed') {
            const failMsg = download.error_message || 'Download failed'
            setError(failMsg)
            triggerPremiumModal(`${failMsg}. Upgrade to Premium for reliable downloads with priority processing.`, 'Download Failed')
            setDownloadId(null)
            setDownloadProgress(0)
          } else {
            // Continue polling
            setTimeout(poll, 2000)
          }
        }
      } catch (error) {
        console.error('Error polling progress:', error)
      }
    }

    poll()
  }

  const getAvailableQualities = () => {
    if (!availableFormats?.video) {
      return videoQualityOptions
    }

    // Use actual available formats from the backend
    const uniqueQualities = new Map()

    availableFormats.video.forEach((format) => {
      if (!uniqueQualities.has(format.quality)) {
        uniqueQualities.set(format.quality, {
          quality: format.quality,
          format: format.format.toUpperCase(),
          fileSize: format.fileSize || 'Unknown',
          fps: format.fps || 30,
          available: format.available,
          hasAudio: format.hasAudio
        })
      }
    })

    return Array.from(uniqueQualities.values()).sort((a, b) => {
      // Sort by resolution descending
      const aRes = parseInt(a.quality) || 0
      const bRes = parseInt(b.quality) || 0
      return bRes - aRes
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
              <FileVideo className="w-12 h-12 text-orange-500 mr-3" />
              <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-orange-500 to-red-600 bg-clip-text text-transparent">
                Video Download
              </h1>
            </div>
            <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              Download YouTube videos in high quality with multiple format options and advanced settings.
            </p>
            <div className="mt-4">
          </div>
        </div>

        <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-orange-200/50 dark:border-gray-700/50">
          <CardHeader>
            <CardTitle className="flex items-center text-gray-900 dark:text-white">
              <FileVideo className="w-5 h-5 mr-2 text-orange-500" />
              Video Download Settings
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
            <div className="space-y-2">
              <Label htmlFor="video-url">YouTube Video URL</Label>
              <Input
                id="video-url"
                type="url"
                placeholder="https://www.youtube.com/watch?v=..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="text-lg"
              />
              {videoId && (
                <div className="flex items-center space-x-2 mt-2">
                  <Button
                    onClick={() => setShowVideoPreview(!showVideoPreview)}
                    variant="outline"
                    size="sm"
                    className="flex items-center"
                  >
                    <Video className="w-4 h-4 mr-1" />
                    {showVideoPreview ? 'Hide Preview' : 'Preview Video'}
                  </Button>
                </div>
              )}
            </div>

            {/* Video Preview Section */}
            {showVideoPreview && videoId && (
              <div className="mb-6 bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg">
                <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white flex items-center">
                  <Video className="w-5 h-5 mr-2 text-orange-500" />
                  Video Preview
                </h3>
                <div className="aspect-video w-full bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden">
                  <iframe
                    width="100%"
                    height="100%"
                    src={`https://www.youtube.com/embed/${videoId}`}
                    title="Video Preview"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="w-full h-full"
                  ></iframe>
                </div>
              </div>
            )}

            <div className="grid md:grid-cols-2 gap-6">
              {/* Quality Settings */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                  <Settings className="w-5 h-5 mr-2 text-orange-500" />
                  Quality Settings
                </h3>

                <div className="space-y-2">
                  <Label>Video Quality</Label>
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
                            <span className={!option.available ? 'text-gray-400' : ''}>
                              {option.quality} ({option.fps}fps)
                            </span>
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
                  <Label className="mt-8">Video Format</Label>
                  <Select value={selectedFormat} onValueChange={setSelectedFormat}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mp4">MP4 (Recommended)</SelectItem>
                      <SelectItem value="webm">WEBM</SelectItem>
                      <SelectItem value="mkv">MKV (High Quality)</SelectItem>
                      <SelectItem value="avi">AVI</SelectItem>
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
                    <Checkbox
                      id="subtitles"
                      checked={includeSubtitles}
                      onCheckedChange={(checked) => setIncludeSubtitles(checked as boolean)}
                    />
                    <Label htmlFor="subtitles">Download subtitles</Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox id="thumbnail" />
                    <Label htmlFor="thumbnail">Download thumbnail</Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox id="description" />
                    <Label htmlFor="description">Save video description</Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox id="metadata" />
                    <Label htmlFor="metadata">Embed metadata</Label>
                  </div>
                </div>
              </div>
            </div>

            {/* File Size Estimation */}
            <div className="p-4 bg-gradient-to-r from-orange-50 to-red-50 dark:from-gray-700 dark:to-gray-600 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white">Estimated Download Size</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-300">Based on selected quality and format</p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-orange-600">
                    {availableFormats?.video.find(f => f.quality === selectedQuality)?.fileSize ||
                      videoQualityOptions.find((opt) => opt.quality === selectedQuality)?.fileSize || "Unknown"}
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
              disabled={!url || isLoading || isDownloading}
              onClick={startDownload}
              className="w-full bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white py-3 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-5 h-5 mr-2" />
              {isDownloading ? (
                <>
                  <div className="w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Downloading...
                </>
              ) : isLoading ? (
                'Loading...'
              ) : (
                'Download Video'
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Download History */}
        {downloadHistory.length > 0 && (
          <Card className="mt-8 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-orange-200/50 dark:border-gray-700/50">
            <CardHeader>
              <CardTitle className="flex items-center text-gray-900 dark:text-white">
                <FileVideo className="w-5 h-5 mr-2 text-orange-500" />
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
                          <FileVideo className="w-3 h-3 mr-1" />
                          {download.format?.toUpperCase()}
                        </span>
                        <span>{download.quality}</span>
                        <span className={`px-2 py-1 rounded-full text-xs ${download.status === 'completed'
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                            : download.status === 'failed'
                              ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                              : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                          }`}>
                          {download.status}
                        </span>
                        <span>{new Date(download.created_at).toLocaleDateString()}</span>
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
                        className="flex-shrink-2 p-2 mt-4 absolute top-9 right-2 lg:visible invisible"
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
          width: 360px;
          height: 500px;
          top: 195px;
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
        feature="video downloading"
        title={premiumTitle || "Premium Feature - Video Downloads"}
        message={premiumMessage || "Video downloading is a premium feature. Subscribe to download high-quality videos from YouTube with support for up to 4K resolution."}
      />
    </div>
  )
}
