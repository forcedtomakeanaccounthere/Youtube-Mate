"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { FileAudio, Download, Settings, HardDrive, Play, Pause, Volume2, AlertCircle } from "lucide-react"
import Link from "next/link"

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
  const [availableFormats, setAvailableFormats] = useState<VideoFormats | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [videoId, setVideoId] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [audioRef, setAudioRef] = useState<HTMLAudioElement | null>(null)
  const [downloadProgress, setDownloadProgress] = useState(0)
  const [downloadId, setDownloadId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const audioQualityOptions = [
    { quality: "320kbps", format: "MP3", fileSize: "9.2 MB", bitrate: "320 kbps", available: true },
    { quality: "256kbps", format: "MP3", fileSize: "7.4 MB", bitrate: "256 kbps", available: true },
    { quality: "192kbps", format: "MP3", fileSize: "5.5 MB", bitrate: "192 kbps", available: true },
    { quality: "128kbps", format: "MP3", fileSize: "3.7 MB", bitrate: "128 kbps", available: true },
    { quality: "96kbps", format: "MP3", fileSize: "2.8 MB", bitrate: "96 kbps", available: true },
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

  const fetchAvailableFormats = async () => {
    if (!url) return
    
    setIsLoading(true)
    setError(null)
    
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/downloads/formats`, {
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
      setError('Failed to load video formats. Please check the URL and try again.')
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
        // Create audio element for preview
        const audio = new Audio(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/downloads/preview/${videoId}`)
        audio.crossOrigin = "anonymous"
        audio.onended = () => setIsPlaying(false)
        audio.onerror = () => {
          setIsPlaying(false)
          setError('Audio preview not available')
        }
        audio.onloadstart = () => setIsPlaying(true)
        
        setAudioRef(audio)
        audio.play()
      }
    }
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
        audio_format: selectedFormat // Specify the audio format separately
      }
    }

    console.log('Sending download request with payload:', payload)

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/downloads`, {
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
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/downloads/${downloadId}`)
        
        if (response.ok) {
          const download = await response.json()
          setDownloadProgress(download.progress || 0)
          
          if (download.status === 'completed') {
            // Download completed, provide download link
            const link = document.createElement('a')
            link.href = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/downloads/file/${downloadId}`
            link.download = download.file_name || 'download.mp3'
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
            
            setDownloadId(null)
            setDownloadProgress(0)
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 dark:from-gray-900 dark:to-gray-800 py-8 px-4 sm:px-6 lg:px-8">
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
            <Link href="/download" className="text-orange-600 hover:text-orange-500">
              ← Back to Media Downloader
            </Link>
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
            <div className="space-y-2">
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
                  >
                    {isPlaying ? <Pause className="w-4 h-4 mr-1" /> : <Play className="w-4 h-4 mr-1" />}
                    <Volume2 className="w-4 h-4 mr-1" />
                    {isPlaying ? 'Pause Preview' : 'Preview Audio'}
                  </Button>
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

                <div className="space-y-2">
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
                  <Label>Audio Format</Label>
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
                    <Checkbox id="normalize" />
                    <Label htmlFor="normalize">Normalize audio levels</Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox id="trim-silence" />
                    <Label htmlFor="trim-silence">Trim silence</Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox id="embed-artwork" />
                    <Label htmlFor="embed-artwork">Embed album artwork</Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox id="add-metadata" />
                    <Label htmlFor="add-metadata">Add ID3 tags</Label>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Sample Rate</Label>
                  <Select defaultValue="44100">
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
              {downloadId ? 'Downloading...' : isLoading ? 'Loading...' : 'Extract Audio'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}