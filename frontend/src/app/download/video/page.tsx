"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { FileVideo, Download, Settings, HardDrive, Play, Pause, Video, AlertCircle } from "lucide-react"
import Link from "next/link"

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

  const videoQualityOptions = [
    { quality: "2160p", format: "MP4", fileSize: "2.1 GB", fps: 60, available: true },
    { quality: "1440p", format: "MP4", fileSize: "1.2 GB", fps: 60, available: true },
    { quality: "1080p", format: "MP4", fileSize: "650 MB", fps: 30, available: true },
    { quality: "720p", format: "MP4", fileSize: "320 MB", fps: 30, available: true },
    { quality: "480p", format: "MP4", fileSize: "180 MB", fps: 30, available: true },
    { quality: "360p", format: "MP4", fileSize: "95 MB", fps: 30, available: true },
  ]

  // Extract video ID from URL
  const extractVideoId = (url: string) => {
    const match = url.match(/(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/)
    return match ? match[1] : null
  }

  // Fetch available formats when URL changes
  useEffect(() => {
    if (url) {
      const vId = extractVideoId(url)
      setVideoId(vId)
      
      if (vId) {
        fetchAvailableFormats()
      }
    } else {
      setAvailableFormats(null)
      setVideoId(null)
    }
  }, [url])

  // Fetch download history
  useEffect(() => {
    fetchDownloadHistory()
  }, [])

  const fetchAvailableFormats = async () => {
    if (!url) return
    
    setIsLoading(true)
    setError(null)
    
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001'}/api/downloads/formats`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
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
      setError('Failed to load video formats. Please check the URL and try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const fetchDownloadHistory = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001'}/api/downloads/history?limit=5`)
      if (response.ok) {
        const data = await response.json()
        setDownloadHistory(data.downloads || [])
      }
    } catch (error) {
      console.error('Error fetching download history:', error)
    }
  }

  const startDownload = async () => {
    if (!url) return

    setError(null)
    setDownloadProgress(0)

    const payload = {
      youtube_url: url,
      format: 'video', // Use 'video' for video downloads
      quality: selectedQuality,
      options: {
        video_format: selectedFormat,
        include_subtitles: includeSubtitles
      }
    }

    console.log('Sending video download request with payload:', payload)

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001'}/api/downloads`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      console.log('Response status:', response.status, response.statusText)

      if (!response.ok) {
        const errorData = await response.json()
        console.error('Server error response:', errorData)
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
    }
  }

  const pollProgress = async (downloadId: string) => {
    const poll = async () => {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001'}/api/downloads/${downloadId}`)
        
        if (response.ok) {
          const download = await response.json()
          setDownloadProgress(download.progress || 0)
          
          if (download.status === 'completed') {
            // Download completed, provide download link
            const link = document.createElement('a')
            link.href = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001'}/api/downloads/file/${downloadId}`
            link.download = download.file_name || 'download.mp4'
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
            
            setDownloadId(null)
            setDownloadProgress(0)
            
            // Refresh download history
            fetchDownloadHistory()
          } else if (download.status === 'failed') {
            setError(download.error_message || 'Download failed')
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 dark:from-gray-900 dark:to-gray-800 py-8 px-4 sm:px-6 lg:px-8">
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
            <Link href="/download" className="text-orange-600 hover:text-orange-500">
              ← Back to Media Downloader
            </Link>
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
                    onClick={() => window.open(`https://www.youtube.com/watch?v=${videoId}`, '_blank')}
                    variant="outline"
                    size="sm"
                    className="flex items-center"
                  >
                    <Video className="w-4 h-4 mr-1" />
                    Preview Video
                  </Button>
                </div>
              )}
            </div>

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
                              {option.quality} ({option.fps}fps) {option.hasAudio ? '🔊' : '🔇'}
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
                  <Label>Video Format</Label>
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
                  <span className="text-sm text-gray-500">{downloadProgress}%</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div 
                    className="bg-gradient-to-r from-orange-500 to-red-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${downloadProgress}%` }}
                  ></div>
                </div>
              </div>
            )}

            <Button
              disabled={!url || isLoading || !!downloadId}
              onClick={startDownload}
              className="w-full bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white py-3 text-lg"
            >
              <Download className="w-5 h-5 mr-2" />
              {downloadId ? 'Downloading...' : isLoading ? 'Loading...' : 'Download Video'}
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
              <div className="space-y-4">
                {downloadHistory.slice(0, 5).map((download) => (
                  <div 
                    key={download._id}
                    className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg"
                  >
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900 dark:text-white truncate">
                        {download.metadata?.title || 'Unknown Title'}
                      </h4>
                      <div className="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400 mt-1">
                        <span>{download.format?.toUpperCase()}</span>
                        <span>{download.quality}</span>
                        <span>{download.status}</span>
                        <span>{new Date(download.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                    {download.status === 'completed' && (
                      <Button
                        onClick={() => {
                          const link = document.createElement('a')
                          link.href = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001'}/api/downloads/file/${download._id}`
                          link.download = download.file_name || 'download'
                          document.body.appendChild(link)
                          link.click()
                          document.body.removeChild(link)
                        }}
                        variant="outline"
                        size="sm"
                      >
                        <Download className="w-4 h-4 mr-1" />
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
  )
}