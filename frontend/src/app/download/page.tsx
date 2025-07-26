"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Download,
  Play,
  Pause,
  X,
  Clock,
  FileVideo,
  FileAudio,
  List,
  AlertCircle,
  CheckCircle,
  Eye,
  Calendar,
  HardDrive,
  Settings,
  RotateCcw,
} from "lucide-react"
import Image from "next/image"

interface VideoData {
  id: string
  title: string
  thumbnail: string
  duration: string
  channel: string
  views: string
  uploadDate: string
  description: string
}

interface QualityOption {
  quality: string
  format: string
  fileSize: string
  fps?: number
}

interface DownloadItem {
  id: string
  url: string
  title: string
  thumbnail: string
  format: string
  quality: string
  progress: number
  status: "pending" | "downloading" | "completed" | "paused" | "error"
  fileSize: string
  downloadedSize: string
  speed: string
  eta: string
  error?: string
}

interface HistoryItem {
  id: string
  title: string
  thumbnail: string
  format: string
  quality: string
  downloadDate: string
  fileSize: string
  filePath: string
}

export default function MediaDownloaderPage() {
  const [url, setUrl] = useState("")
  const [videoData, setVideoData] = useState<VideoData | null>(null)
  const [isValidUrl, setIsValidUrl] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [selectedFormat, setSelectedFormat] = useState("mp4")
  const [selectedQuality, setSelectedQuality] = useState("1080p")
  const [includeSubtitles, setIncludeSubtitles] = useState(false)
  const [downloadQueue, setDownloadQueue] = useState<DownloadItem[]>([])
  const [downloadHistory, setDownloadHistory] = useState<HistoryItem[]>([])
  const [scheduledDownloads, setScheduledDownloads] = useState<any[]>([])

  // Mock data
  const mockVideoData: VideoData = {
    id: "dQw4w9WgXcQ",
    title: "Rick Astley - Never Gonna Give You Up (Official Video)",
    thumbnail: "/placeholder.svg?height=180&width=320&text=YouTube+Video+Thumbnail",
    duration: "3:33",
    channel: "Rick Astley",
    views: "1.4B views",
    uploadDate: "Oct 25, 2009",
    description: "The official video for Rick Astley's 'Never Gonna Give You Up'...",
  }

  const qualityOptions: QualityOption[] = [
    { quality: "4K", format: "MP4", fileSize: "2.1 GB", fps: 60 },
    { quality: "1440p", format: "MP4", fileSize: "1.2 GB", fps: 60 },
    { quality: "1080p", format: "MP4", fileSize: "650 MB", fps: 60 },
    { quality: "720p", format: "MP4", fileSize: "320 MB", fps: 30 },
    { quality: "480p", format: "MP4", fileSize: "180 MB", fps: 30 },
    { quality: "360p", format: "MP4", fileSize: "95 MB", fps: 30 },
  ]

  const audioQualityOptions: QualityOption[] = [
    { quality: "320kbps", format: "MP3", fileSize: "9.2 MB" },
    { quality: "256kbps", format: "MP3", fileSize: "7.4 MB" },
    { quality: "192kbps", format: "MP3", fileSize: "5.5 MB" },
    { quality: "128kbps", format: "MP3", fileSize: "3.7 MB" },
  ]

  const validateYouTubeUrl = (url: string): boolean => {
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|embed\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
    return youtubeRegex.test(url)
  }

  useEffect(() => {
    if (url) {
      const isValid = validateYouTubeUrl(url)
      setIsValidUrl(isValid)

      if (isValid) {
        setIsLoading(true)
        setTimeout(() => {
          setVideoData(mockVideoData)
          setIsLoading(false)
        }, 1000)
      } else {
        setVideoData(null)
      }
    } else {
      setIsValidUrl(false)
      setVideoData(null)
    }
  }, [url])

  const handleDownload = () => {
    if (!videoData) return

    const newDownload: DownloadItem = {
      id: Date.now().toString(),
      url,
      title: videoData.title,
      thumbnail: videoData.thumbnail,
      format: selectedFormat.toUpperCase(),
      quality: selectedQuality,
      progress: 0,
      status: "pending",
      fileSize: getEstimatedFileSize(),
      downloadedSize: "0 MB",
      speed: "0 MB/s",
      eta: "Calculating...",
    }

    setDownloadQueue((prev) => [...prev, newDownload])

    // Simulate download progress
    setTimeout(() => {
      simulateDownload(newDownload.id)
    }, 1000)
  }

  const getEstimatedFileSize = (): string => {
    const options = selectedFormat === "mp3" ? audioQualityOptions : qualityOptions
    const option = options.find((opt) => opt.quality === selectedQuality)
    return option?.fileSize || "Unknown"
  }

  const simulateDownload = (downloadId: string) => {
    const interval = setInterval(() => {
      setDownloadQueue((prev) =>
        prev.map((item) => {
          if (item.id === downloadId) {
            const newProgress = Math.min(item.progress + Math.random() * 10, 100)
            const isCompleted = newProgress >= 100

            if (isCompleted) {
              clearInterval(interval)
              // Add to history
              const historyItem: HistoryItem = {
                id: item.id,
                title: item.title,
                thumbnail: item.thumbnail,
                format: item.format,
                quality: item.quality,
                downloadDate: new Date().toISOString(),
                fileSize: item.fileSize,
                filePath: `/downloads/${item.title}.${item.format.toLowerCase()}`,
              }
              setDownloadHistory((prev) => [historyItem, ...prev])
            }

            return {
              ...item,
              progress: newProgress,
              status: isCompleted ? "completed" : "downloading",
              downloadedSize: isCompleted ? item.fileSize : `${Math.round((newProgress / 100) * 650)} MB`,
              speed: isCompleted ? "0 MB/s" : `${(Math.random() * 5 + 1).toFixed(1)} MB/s`,
              eta: isCompleted ? "Completed" : `${Math.round((100 - newProgress) / 10)} min`,
            }
          }
          return item
        }),
      )
    }, 500)
  }

  const pauseDownload = (downloadId: string) => {
    setDownloadQueue((prev) =>
      prev.map((item) => (item.id === downloadId ? { ...item, status: "paused" as const } : item)),
    )
  }

  const resumeDownload = (downloadId: string) => {
    setDownloadQueue((prev) =>
      prev.map((item) => (item.id === downloadId ? { ...item, status: "downloading" as const } : item)),
    )
    simulateDownload(downloadId)
  }

  const removeFromQueue = (downloadId: string) => {
    setDownloadQueue((prev) => prev.filter((item) => item.id !== downloadId))
  }

  const clearHistory = () => {
    setDownloadHistory([])
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 dark:from-gray-900 dark:to-gray-800 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <Download className="w-12 h-12 text-orange-500 mr-3" />
            <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-orange-500 to-red-600 bg-clip-text text-transparent">
              Media Downloader
            </h1>
          </div>
          <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Download YouTube videos and audio in high quality with support for multiple formats and batch processing.
          </p>
        </div>

        <Tabs defaultValue="video" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 max-w-md mx-auto">
            <TabsTrigger value="video" className="flex items-center space-x-2">
              <FileVideo className="w-4 h-4" />
              <span>Video</span>
            </TabsTrigger>
            <TabsTrigger value="audio" className="flex items-center space-x-2">
              <FileAudio className="w-4 h-4" />
              <span>Audio</span>
            </TabsTrigger>
            <TabsTrigger value="playlist" className="flex items-center space-x-2">
              <List className="w-4 h-4" />
              <span>Playlist</span>
            </TabsTrigger>
          </TabsList>

          {/* Video Download Tab */}
          <TabsContent value="video" className="space-y-6">
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Input Form */}
              <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-orange-200/50 dark:border-gray-700/50">
                <CardHeader>
                  <CardTitle className="flex items-center text-gray-900 dark:text-white">
                    <FileVideo className="w-5 h-5 mr-2 text-orange-500" />
                    Video Download
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* URL Input */}
                  <div className="space-y-2">
                    <Label htmlFor="video-url">YouTube URL</Label>
                    <div className="relative">
                      <Input
                        id="video-url"
                        type="url"
                        placeholder="https://www.youtube.com/watch?v=..."
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        className={`pr-10 ${isValidUrl ? "border-green-500" : url && !isValidUrl ? "border-red-500" : ""}`}
                      />
                      {url && (
                        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                          {isValidUrl ? (
                            <CheckCircle className="w-5 h-5 text-green-500" />
                          ) : (
                            <AlertCircle className="w-5 h-5 text-red-500" />
                          )}
                        </div>
                      )}
                    </div>
                    {url && !isValidUrl && <p className="text-sm text-red-500">Please enter a valid YouTube URL</p>}
                  </div>

                  {/* Quality Selector */}
                  <div className="space-y-2">
                    <Label>Video Quality</Label>
                    <Select value={selectedQuality} onValueChange={setSelectedQuality}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {qualityOptions.map((option) => (
                          <SelectItem key={option.quality} value={option.quality}>
                            <div className="flex items-center justify-between w-full">
                              <span>
                                {option.quality} ({option.format})
                              </span>
                              <span className="text-sm text-gray-500 ml-4">{option.fileSize}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Format Options */}
                  <div className="space-y-2">
                    <Label>Format</Label>
                    <Select value={selectedFormat} onValueChange={setSelectedFormat}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mp4">MP4 (Recommended)</SelectItem>
                        <SelectItem value="webm">WEBM</SelectItem>
                        <SelectItem value="mkv">MKV</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Additional Options */}
                  <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="subtitles"
                        checked={includeSubtitles}
                        onCheckedChange={(checked) => setIncludeSubtitles(checked as boolean)}
                      />
                      <Label htmlFor="subtitles">Include subtitles</Label>
                    </div>
                  </div>

                  <Button
                    onClick={handleDownload}
                    disabled={!isValidUrl || isLoading}
                    className="w-full bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white"
                  >
                    {isLoading ? "Loading..." : "Add to Download Queue"}
                  </Button>
                </CardContent>
              </Card>

              {/* Video Preview */}
              {videoData && (
                <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-orange-200/50 dark:border-gray-700/50">
                  <CardHeader>
                    <CardTitle className="flex items-center text-gray-900 dark:text-white">
                      <Eye className="w-5 h-5 mr-2 text-orange-500" />
                      Video Preview
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="relative">
                      <Image
                        src={videoData.thumbnail || "/placeholder.svg"}
                        alt={videoData.title}
                        width={320}
                        height={180}
                        className="w-full rounded-lg object-cover"
                      />
                      <Badge className="absolute bottom-2 right-2 bg-black/80 text-white">{videoData.duration}</Badge>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white line-clamp-2">{videoData.title}</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                        {videoData.channel} • {videoData.views}
                      </p>
                      <p className="text-sm text-gray-500 mt-1">Uploaded {videoData.uploadDate}</p>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center text-sm text-gray-500">
                        <HardDrive className="w-4 h-4 mr-1" />
                        Estimated size: {getEstimatedFileSize()}
                      </div>
                      <div className="flex items-center text-sm text-gray-500">
                        <Settings className="w-4 h-4 mr-1" />
                        Format: {selectedFormat.toUpperCase()} • Quality: {selectedQuality}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* Audio Download Tab */}
          <TabsContent value="audio" className="space-y-6">
            <div className="grid lg:grid-cols-2 gap-6">
              <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-orange-200/50 dark:border-gray-700/50">
                <CardHeader>
                  <CardTitle className="flex items-center text-gray-900 dark:text-white">
                    <FileAudio className="w-5 h-5 mr-2 text-orange-500" />
                    Audio Download
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="audio-url">YouTube URL</Label>
                    <Input
                      id="audio-url"
                      type="url"
                      placeholder="https://www.youtube.com/watch?v=..."
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Audio Quality</Label>
                    <Select value={selectedQuality} onValueChange={setSelectedQuality}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {audioQualityOptions.map((option) => (
                          <SelectItem key={option.quality} value={option.quality}>
                            <div className="flex items-center justify-between w-full">
                              <span>
                                {option.quality} ({option.format})
                              </span>
                              <span className="text-sm text-gray-500 ml-4">{option.fileSize}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Format</Label>
                    <Select value="mp3" onValueChange={() => {}}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mp3">MP3 (Recommended)</SelectItem>
                        <SelectItem value="aac">AAC</SelectItem>
                        <SelectItem value="ogg">OGG</SelectItem>
                        <SelectItem value="wav">WAV</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Button
                    onClick={handleDownload}
                    disabled={!isValidUrl || isLoading}
                    className="w-full bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white"
                  >
                    Add to Download Queue
                  </Button>
                </CardContent>
              </Card>

              {videoData && (
                <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-orange-200/50 dark:border-gray-700/50">
                  <CardHeader>
                    <CardTitle className="flex items-center text-gray-900 dark:text-white">
                      <FileAudio className="w-5 h-5 mr-2 text-orange-500" />
                      Audio Preview
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="relative">
                      <Image
                        src={videoData.thumbnail || "/placeholder.svg"}
                        alt={videoData.title}
                        width={320}
                        height={180}
                        className="w-full rounded-lg object-cover"
                      />
                      <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center">
                        <FileAudio className="w-16 h-16 text-white" />
                      </div>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white line-clamp-2">{videoData.title}</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                        {videoData.channel} • {videoData.duration}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* Playlist Download Tab */}
          <TabsContent value="playlist" className="space-y-6">
            <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-orange-200/50 dark:border-gray-700/50">
              <CardHeader>
                <CardTitle className="flex items-center text-gray-900 dark:text-white">
                  <List className="w-5 h-5 mr-2 text-orange-500" />
                  Playlist Download
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="playlist-url">YouTube Playlist URL</Label>
                  <Input
                    id="playlist-url"
                    type="url"
                    placeholder="https://www.youtube.com/playlist?list=..."
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Video Quality</Label>
                    <Select value={selectedQuality} onValueChange={setSelectedQuality}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {qualityOptions.map((option) => (
                          <SelectItem key={option.quality} value={option.quality}>
                            {option.quality} ({option.format})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Format</Label>
                    <Select value={selectedFormat} onValueChange={setSelectedFormat}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mp4">MP4</SelectItem>
                        <SelectItem value="mp3">MP3 (Audio Only)</SelectItem>
                        <SelectItem value="webm">WEBM</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex items-center space-x-2">
                    <Checkbox id="playlist-subtitles" />
                    <Label htmlFor="playlist-subtitles">Include subtitles for all videos</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="playlist-numbering" />
                    <Label htmlFor="playlist-numbering">Add playlist numbering to filenames</Label>
                  </div>
                </div>

                <Button
                  disabled={!isValidUrl || isLoading}
                  className="w-full bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white"
                >
                  Download Entire Playlist
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Download Queue */}
        {downloadQueue.length > 0 && (
          <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-orange-200/50 dark:border-gray-700/50 mt-6">
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-gray-900 dark:text-white">
                <div className="flex items-center">
                  <Download className="w-5 h-5 mr-2 text-orange-500" />
                  Download Queue ({downloadQueue.length})
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDownloadQueue([])}
                  className="text-red-600 hover:text-red-700"
                >
                  Clear All
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {downloadQueue.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 bg-gradient-to-r from-orange-50 to-red-50 dark:from-gray-700 dark:to-gray-600 rounded-lg"
                  >
                    <div className="flex items-start space-x-4">
                      <Image
                        src={item.thumbnail || "/placeholder.svg"}
                        alt={item.title}
                        width={80}
                        height={45}
                        className="rounded object-cover"
                      />
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-gray-900 dark:text-white line-clamp-1">{item.title}</h4>
                        <div className="flex items-center space-x-4 text-sm text-gray-500 mt-1">
                          <span>
                            {item.format} • {item.quality}
                          </span>
                          <span>{item.fileSize}</span>
                          <Badge
                            variant={
                              item.status === "completed"
                                ? "default"
                                : item.status === "error"
                                  ? "destructive"
                                  : item.status === "downloading"
                                    ? "secondary"
                                    : "outline"
                            }
                          >
                            {item.status}
                          </Badge>
                        </div>
                        <div className="mt-2">
                          <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-300 mb-1">
                            <span>
                              {item.downloadedSize} / {item.fileSize}
                            </span>
                            <span>{item.progress.toFixed(1)}%</span>
                          </div>
                          <Progress value={item.progress} className="h-2" />
                          {item.status === "downloading" && (
                            <div className="flex items-center justify-between text-xs text-gray-500 mt-1">
                              <span>{item.speed}</span>
                              <span>ETA: {item.eta}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        {item.status === "downloading" && (
                          <Button size="sm" variant="outline" onClick={() => pauseDownload(item.id)}>
                            <Pause className="w-4 h-4" />
                          </Button>
                        )}
                        {item.status === "paused" && (
                          <Button size="sm" variant="outline" onClick={() => resumeDownload(item.id)}>
                            <Play className="w-4 h-4" />
                          </Button>
                        )}
                        {item.status === "error" && (
                          <Button size="sm" variant="outline" onClick={() => resumeDownload(item.id)}>
                            <RotateCcw className="w-4 h-4" />
                          </Button>
                        )}
                        <Button size="sm" variant="outline" onClick={() => removeFromQueue(item.id)}>
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Download History */}
        {downloadHistory.length > 0 && (
          <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-orange-200/50 dark:border-gray-700/50 mt-6">
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-gray-900 dark:text-white">
                <div className="flex items-center">
                  <Clock className="w-5 h-5 mr-2 text-orange-500" />
                  Download History ({downloadHistory.length})
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearHistory}
                  className="text-red-600 hover:text-red-700 bg-transparent"
                >
                  Clear History
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {downloadHistory.map((item) => (
                  <div key={item.id} className="flex items-center space-x-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <Image
                      src={item.thumbnail || "/placeholder.svg"}
                      alt={item.title}
                      width={60}
                      height={34}
                      className="rounded object-cover"
                    />
                    <div className="flex-1 min-w-0">
                      <h5 className="font-medium text-gray-900 dark:text-white line-clamp-1">{item.title}</h5>
                      <div className="flex items-center space-x-4 text-sm text-gray-500">
                        <span>
                          {item.format} • {item.quality}
                        </span>
                        <span>{item.fileSize}</span>
                        <span className="flex items-center">
                          <Calendar className="w-3 h-3 mr-1" />
                          {new Date(item.downloadDate).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant="default" className="bg-green-100 text-green-800">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Completed
                      </Badge>
                      <Button size="sm" variant="outline">
                        Open File
                      </Button>
                    </div>
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