"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { List, Download, Settings, HardDrive, Play, Clock, CheckCircle, AlertCircle } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import Navbar from "@/components/landing/Navbar"
import featuresData from "@/data/features.json"
import { Feature } from "@/types/features"
import { useDarkMode } from "@/hooks/use-dark-mode"

const features: Feature[] = featuresData

interface PlaylistVideo {
  id: string
  title: string
  thumbnail: string
  duration: string
  channel: string
  selected: boolean
}

export default function PlaylistDownloadPage() {
  const [url, setUrl] = useState("")
  const [selectedQuality, setSelectedQuality] = useState("1080p")
  const [selectedFormat, setSelectedFormat] = useState("mp4")
  const [playlistVideos, setPlaylistVideos] = useState<PlaylistVideo[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState<{ [key: string]: number }>({})
  const [downloadStatus, setDownloadStatus] = useState<string>("")
  const [currentDownloadIndex, setCurrentDownloadIndex] = useState(-1)
  const [videoDownloadStates, setVideoDownloadStates] = useState<{[key: string]: {
    status: 'pending' | 'downloading' | 'completed' | 'failed'
    progress: number
    downloadId?: string
    error?: string
  }}>({})
  const [completedDownloads, setCompletedDownloads] = useState(0)

  // Navbar state
  const [activeFeature, setActiveFeature] = useState(features[0])
  const [showNavbar, setShowNavbar] = useState(true)
  const { darkMode, toggleDarkMode, mounted } = useDarkMode()

  const loadPlaylist = async () => {
    if (!url.trim()) return

    setIsLoading(true)
    try {
      const token = localStorage.getItem("token")
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'}/downloads/playlist/info?url=${encodeURIComponent(url)}&_t=${Date.now()}`, {
        headers: {
          ...(token && { 'Authorization': `Bearer ${token}` }),
          'Cache-Control': 'no-cache',
        },
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch playlist')
      }

      const playlistData = await response.json()
      
      console.log('Full playlist response:', playlistData)
      console.log('Playlist channel field:', playlistData.channel)
      console.log('Sample video:', playlistData.videos[0])
      
      // Convert API response to our format using real YouTube video IDs
      const videos: PlaylistVideo[] = playlistData.videos.map((video: any, index: number) => ({
        id: video.id || `fallback-${index}`, // Use index as fallback if ID is missing
        title: video.title || 'Unknown Title',
        thumbnail: video.thumbnail || "/placeholder.svg?height=90&width=160&text=Video",
        duration: video.duration || "0:00",
        channel: video.channel || playlistData.channel || "Unknown",
        selected: true, // Default to selected
      }))

      console.log('Mapped videos with channels:', videos.map(v => ({ id: v.id, title: v.title, channel: v.channel })))
      
      setPlaylistVideos(videos)
      setDownloadStatus(`Loaded ${videos.length} videos from playlist`)
    } catch (error) {
      console.error('Error loading playlist:', error)
      setDownloadStatus(`Error loading playlist: ${error instanceof Error ? error.message : 'Unknown error'}`)
      setPlaylistVideos([]) // Clear any existing data on error
    } finally {
      setIsLoading(false)
    }
  }

  const handleDownload = async () => {
    const selectedVideos = playlistVideos.filter(video => video.selected)
    
    if (selectedVideos.length === 0) return

    setIsDownloading(true)
    setCurrentDownloadIndex(0)
    setCompletedDownloads(0)
    setDownloadStatus("Starting playlist download...")

    // Initialize download states for all selected videos
    const initialStates: {[key: string]: any} = {}
    selectedVideos.forEach(video => {
      initialStates[video.id] = {
        status: 'pending',
        progress: 0
      }
    })
    setVideoDownloadStates(initialStates)

    try {
      // Download videos sequentially
      for (let i = 0; i < selectedVideos.length; i++) {
        const video = selectedVideos[i]
        setCurrentDownloadIndex(i)
        setDownloadStatus(`Downloading ${i + 1}/${selectedVideos.length}: ${video.title}`)

        // Update video state to downloading
        setVideoDownloadStates(prev => ({
          ...prev,
          [video.id]: { ...prev[video.id], status: 'downloading' }
        }))

        try {
          await downloadSingleVideo(video, i + 1, selectedVideos.length)
          
          // Mark as completed
          setVideoDownloadStates(prev => ({
            ...prev,
            [video.id]: { ...prev[video.id], status: 'completed', progress: 100 }
          }))
          
          setCompletedDownloads(prev => prev + 1)
        } catch (error) {
          console.error(`Error downloading video ${video.title}:`, error)
          
          // Mark as failed
          setVideoDownloadStates(prev => ({
            ...prev,
            [video.id]: { 
              ...prev[video.id], 
              status: 'failed', 
              error: error instanceof Error ? error.message : 'Unknown error'
            }
          }))
        }
      }

      setDownloadStatus(`Playlist download completed! ${completedDownloads + 1}/${selectedVideos.length} videos downloaded.`)
    } catch (error) {
      console.error('Playlist download error:', error)
      setDownloadStatus(`Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`)
    } finally {
      setIsDownloading(false)
      setCurrentDownloadIndex(-1)
    }
  }

  const downloadSingleVideo = async (video: PlaylistVideo, currentIndex: number, totalVideos: number): Promise<void> => {
    return new Promise(async (resolve, reject) => {
      try {
        // Start individual video download
        const payload = {
          youtube_url: `https://www.youtube.com/watch?v=${video.id}`,
          format: selectedFormat === 'mp3' ? 'audio' : 'video',
          quality: selectedQuality,
          options: selectedFormat === 'mp3' ? 
            { audio_format: selectedFormat } : 
            { video_format: selectedFormat }
        }

        console.log('Downloading video:', video.title, 'ID:', video.id, 'URL:', payload.youtube_url)
        
        // Get authentication token
        const token = localStorage.getItem("token")
        
        // Skip videos with fallback IDs (they don't have real YouTube IDs)
        if (video.id.startsWith('fallback-')) {
          throw new Error('Video does not have a valid YouTube ID')
        }

        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'}/downloads`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` }),
          },
          body: JSON.stringify(payload),
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Failed to start download')
        }

        const result = await response.json()
        const downloadId = result.download_id

        // Update download state with ID
        setVideoDownloadStates(prev => ({
          ...prev,
          [video.id]: { ...prev[video.id], downloadId }
        }))

        // Poll for progress
        await pollVideoProgress(downloadId, video.id)
        resolve()
      } catch (error) {
        reject(error)
      }
    })
  }

  const pollVideoProgress = async (downloadId: string, videoId: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      const poll = async () => {
        try {
          const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'}/downloads/${downloadId}`)

          if (response.ok) {
            const download = await response.json()
            
            // Update progress
            setVideoDownloadStates(prev => ({
              ...prev,
              [videoId]: { ...prev[videoId], progress: download.progress || 0 }
            }))

            if (download.status === 'completed') {
              // Auto-download the file
              const link = document.createElement('a')
              link.href = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'}/downloads/file/${downloadId}`
              link.download = download.file_name || `${playlistVideos.find(v => v.id === videoId)?.title || 'download'}.${selectedFormat}`
              document.body.appendChild(link)
              link.click()
              document.body.removeChild(link)
              
              resolve()
            } else if (download.status === 'failed') {
              reject(new Error(download.error_message || 'Download failed'))
            } else {
              // Continue polling
              setTimeout(poll, 2000)
            }
          } else {
            reject(new Error('Failed to check download status'))
          }
        } catch (error) {
          reject(error)
        }
      }

      poll()
    })
  }

  const toggleVideoSelection = (videoId: string) => {
    setPlaylistVideos((prev) =>
      prev.map((video) => 
        video.id === videoId 
          ? { ...video, selected: !video.selected }
          : video
      )
    )
  }

  const selectAll = () => {
    setPlaylistVideos((prev) => prev.map((video) => ({ ...video, selected: true })))
  }

  const deselectAll = () => {
    setPlaylistVideos((prev) => prev.map((video) => ({ ...video, selected: false })))
  }

  const selectedCount = playlistVideos.filter((video) => video.selected).length
  const totalDuration = playlistVideos
    .filter((video) => video.selected)
    .reduce((total, video) => {
      const [minutes, seconds] = video.duration.split(":").map(Number)
      return total + minutes * 60 + seconds
    }, 0)

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`
  }

  // Add this function above your component return
  const estimateSize = () => {
    // Average MB per minute for each format (rough estimate)
    const avgMbPerMinute: Record<string, number> = {
      mp3: 1,      // audio only
      mp4: 8,      // video
      webm: 7,
      mkv: 10,
    };

    const selectedVideos = playlistVideos.filter((video) => video.selected);

    let totalMinutes = selectedVideos.reduce((sum, video) => {
      const [min, sec] = video.duration.split(":").map(Number);
      return sum + min + sec / 60;
    }, 0);

    const avg = avgMbPerMinute[selectedFormat] || 8;
    const estSize = Math.round(totalMinutes * avg);

    return estSize > 0 ? `~${estSize} MB` : "~0 MB";
  };

  // Don't render anything that depends on darkMode until mounted
  if (!mounted) {
    return <div className="min-h-screen" /> // Minimal fallback
  }

  return (
    <div className={`min-h-screen transition-colors duration-300 ${darkMode ? "dark bg-gradient-to-br from-gray-900 dark:to-gray-800" : "bg-gradient-to-br from-orange-50 to-red-50"}`}>
      <Navbar
        showNavbar={showNavbar}
        features={features}
        setActiveFeature={setActiveFeature}
        darkMode={darkMode}
        toggleDarkMode={toggleDarkMode}
      />
      <div className="pt-20 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex items-center justify-center mb-4">
              <List className="w-12 h-12 text-orange-500 mr-3" />
              <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-orange-500 to-red-600 bg-clip-text text-transparent">
                Playlist Download
              </h1>
            </div>
            <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              Download entire YouTube playlists with selective video choosing and batch processing.
            </p>
            <div className="mt-4">
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Settings Panel */}
          <div className="lg:col-span-1 space-y-6">
            <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-orange-200/50 dark:border-gray-700/50">
              <CardHeader>
                <CardTitle className="flex items-center text-gray-900 dark:text-white">
                  <Settings className="w-5 h-5 mr-2 text-orange-500" />
                  Playlist Settings
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

                <Button
                  onClick={loadPlaylist}
                  disabled={!url || isLoading}
                  className="w-full bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white"
                >
                  {isLoading ? "Loading Playlist..." : "Load Playlist"}
                </Button>

                {playlistVideos.length > 0 && (
                  <>
                    <div className="space-y-2">
                      <Label>{selectedFormat === 'mp3' ? 'Audio Quality' : 'Video Quality'}</Label>
                      <Select value={selectedQuality} onValueChange={setSelectedQuality}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {selectedFormat === 'mp3' ? (
                            <>
                              <SelectItem value="highestaudio">Highest Quality</SelectItem>
                              <SelectItem value="320k">320 kbps</SelectItem>
                              <SelectItem value="256k">256 kbps</SelectItem>
                              <SelectItem value="192k">192 kbps</SelectItem>
                              <SelectItem value="128k">128 kbps</SelectItem>
                            </>
                          ) : (
                            <>
                              <SelectItem value="4K">4K (2160p)</SelectItem>
                              <SelectItem value="1440p">1440p (2K)</SelectItem>
                              <SelectItem value="1080p">1080p (Full HD)</SelectItem>
                              <SelectItem value="720p">720p (HD)</SelectItem>
                              <SelectItem value="480p">480p</SelectItem>
                              <SelectItem value="360p">360p</SelectItem>
                            </>
                          )}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Format</Label>
                      <Select value={selectedFormat} onValueChange={(value) => {
                        setSelectedFormat(value);
                        // Reset quality to appropriate default when format changes
                        if (value === 'mp3') {
                          setSelectedQuality('highestaudio');
                        } else {
                          setSelectedQuality('1080p');
                        }
                      }}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="mp4">MP4 (Video)</SelectItem>
                          <SelectItem value="mp3">MP3 (Audio Only)</SelectItem>
                          <SelectItem value="webm">WEBM</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                      <div className="flex items-center space-x-2">
                        <Checkbox id="playlist-subtitles" />
                        <Label htmlFor="playlist-subtitles">Include subtitles</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox id="playlist-numbering" />
                        <Label htmlFor="playlist-numbering">Add numbering to filenames</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox id="create-folder" />
                        <Label htmlFor="create-folder">Create playlist folder</Label>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Download Summary */}
            {playlistVideos.length > 0 && (
              <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-orange-200/50 dark:border-gray-700/50">
                <CardHeader>
                  <CardTitle className="flex items-center text-gray-900 dark:text-white">
                    <HardDrive className="w-5 h-5 mr-2 text-orange-500" />
                    Download Summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-300">Selected Videos:</span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {selectedCount} / {playlistVideos.length}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-300">Total Duration:</span>
                    <span className="font-semibold text-gray-900 dark:text-white">{formatDuration(totalDuration)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-300">Format:</span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {selectedFormat.toUpperCase()} • {selectedQuality}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-300">Est. Size:</span>
                    <span className="font-semibold text-orange-600">
                      {estimateSize()}
                    </span>
                  </div>

                  <Button
                    onClick={handleDownload}
                    disabled={selectedCount === 0 || isDownloading}
                    className="w-full bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white mt-4"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    {isDownloading ? `Downloading... (${completedDownloads + 1}/${selectedCount})` : `Download Selected (${selectedCount})`}
                  </Button>

                  {downloadStatus && (
                    <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                      <p className="text-sm text-blue-800 dark:text-blue-200 mb-2">{downloadStatus}</p>
                      {isDownloading && selectedCount > 0 && (
                        <div className="space-y-2">
                          <div className="flex justify-between text-xs text-blue-600 dark:text-blue-300">
                            <span>Overall Progress</span>
                            <span>{completedDownloads}/{selectedCount} completed</span>
                          </div>
                          <Progress 
                            value={(completedDownloads / selectedCount) * 100} 
                            className="h-2"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Playlist Videos */}
          <div className="lg:col-span-2">
            {isLoading && (
              <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-orange-200/50 dark:border-gray-700/50">
                <CardContent className="p-8 text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500 mx-auto mb-4"></div>
                  <p className="text-gray-600 dark:text-gray-300">Loading playlist videos...</p>
                  <Progress value={65} className="mt-4 max-w-xs mx-auto" />
                </CardContent>
              </Card>
            )}

            {playlistVideos.length > 0 && (
              <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-orange-200/50 dark:border-gray-700/50 max-h-[775px] overflow-y-scroll">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center text-gray-900 dark:text-white">
                      <List className="w-5 h-5 mr-2 text-orange-500" />
                      Playlist Videos ({playlistVideos.length})
                    </CardTitle>
                    <div className="flex items-center space-x-2">
                      <Button variant="outline" size="sm" onClick={selectAll}>
                        Select All
                      </Button>
                      <Button variant="outline" size="sm" onClick={deselectAll}>
                        Deselect All
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {playlistVideos.map((video, index) => {
                      const downloadState = videoDownloadStates[video.id]
                      const isCurrentlyDownloading = currentDownloadIndex === index && isDownloading
                      
                      return (
                        <div
                          key={`${video.id}-${index}`}
                          className={`p-4 rounded-lg border-2 transition-all ${
                            video.selected
                              ? "border-orange-500 bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20"
                              : "border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50"
                          }`}
                        >
                          <div className="flex items-start space-x-4">
                            <div className="flex items-center space-x-3">
                              <Checkbox 
                                checked={video.selected} 
                                onCheckedChange={() => toggleVideoSelection(video.id)}
                                disabled={isDownloading}
                              />
                              <div className="text-sm font-medium text-gray-500 dark:text-gray-400 w-8">{index + 1}</div>
                            </div>
                            <div className="relative">
                              <Image
                                src={video.thumbnail || "/placeholder.svg"}
                                alt={video.title}
                                width={160}
                                height={90}
                                className="rounded object-cover"
                              />
                              <Badge className="absolute bottom-1 right-1 bg-black/80 text-white text-xs">
                                {video.duration}
                              </Badge>
                              {/* Download status overlay */}
                              {downloadState && downloadState.status === 'downloading' && (
                                <div className="absolute inset-0 bg-black/60 rounded flex items-center justify-center">
                                  <div className="text-center text-white">
                                    <Download className="w-6 h-6 animate-bounce mx-auto mb-1" />
                                    <div className="text-xs">Downloading...</div>
                                  </div>
                                </div>
                              )}
                              {downloadState && downloadState.status === 'completed' && (
                                <div className="absolute inset-0 bg-green-600/80 rounded flex items-center justify-center">
                                  <div className="text-center text-white">
                                    <CheckCircle className="w-6 h-6 mx-auto mb-1" />
                                    <div className="text-xs">Completed</div>
                                  </div>
                                </div>
                              )}
                              {downloadState && downloadState.status === 'failed' && (
                                <div className="absolute inset-0 bg-red-600/80 rounded flex items-center justify-center">
                                  <div className="text-center text-white">
                                    <AlertCircle className="w-6 h-6 mx-auto mb-1" />
                                    <div className="text-xs">Failed</div>
                                  </div>
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium text-gray-900 dark:text-white line-clamp-2 mb-1">
                                {video.title}
                              </h4>
                              <div className="flex items-center space-x-4 text-sm text-gray-500 mb-2">
                                <span className="flex items-center">
                                  <Play className="w-3 h-3 mr-1" />
                                  {video.channel}
                                </span>
                                <span className="flex items-center">
                                  <Clock className="w-3 h-3 mr-1" />
                                  {video.duration}
                                </span>
                              </div>
                              
                              {/* Download progress bar */}
                              {downloadState && video.selected && (
                                <div className="space-y-1">
                                  <div className="flex items-center justify-between text-xs">
                                    <span className={`font-medium ${
                                      downloadState.status === 'completed' ? 'text-green-600' :
                                      downloadState.status === 'failed' ? 'text-red-600' :
                                      downloadState.status === 'downloading' ? 'text-blue-600' :
                                      'text-gray-500'
                                    }`}>
                                      {downloadState.status === 'completed' ? 'Download Complete' :
                                       downloadState.status === 'failed' ? `Failed: ${downloadState.error || 'Unknown error'}` :
                                       downloadState.status === 'downloading' ? `Downloading... ${Math.round(downloadState.progress)}%` :
                                       'Pending'}
                                    </span>
                                    {downloadState.status === 'downloading' && (
                                      <span className="text-gray-500">{Math.round(downloadState.progress)}%</span>
                                    )}
                                  </div>
                                  {(downloadState.status === 'downloading' || downloadState.status === 'completed') && (
                                    <Progress 
                                      value={downloadState.progress} 
                                      className="h-2"
                                    />
                                  )}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center">
                              {!video.selected ? (
                                <Badge variant="outline">Not Selected</Badge>
                              ) : downloadState ? (
                                <Badge className={
                                  downloadState.status === 'completed' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                                  downloadState.status === 'failed' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                                  downloadState.status === 'downloading' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                                  'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                                }>
                                  {downloadState.status === 'completed' ? 'Downloaded' :
                                   downloadState.status === 'failed' ? 'Failed' :
                                   downloadState.status === 'downloading' ? 'Downloading' :
                                   'Queued'}
                                </Badge>
                              ) : (
                                <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                                  Selected
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {!isLoading && playlistVideos.length === 0 && url && (
              <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-orange-200/50 dark:border-gray-700/50">
                <CardContent className="p-8 text-center">
                  <List className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No Playlist Found</h3>
                  <p className="text-gray-600 dark:text-gray-300">
                    Please check the playlist URL and make sure it's public.
                  </p>
                </CardContent>
              </Card>
            )}

            {!url && (
              <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-orange-200/50 dark:border-gray-700/50">
                <CardContent className="p-8 text-center">
                  <List className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Enter Playlist URL</h3>
                  <p className="text-gray-600 dark:text-gray-300">
                    Paste a YouTube playlist URL to get started with batch downloading.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
    </div>
  )
}
