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
import { List, Download, Settings, HardDrive, Play, Clock } from "lucide-react"
import Image from "next/image"
import Link from "next/link"

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

  // Mock playlist data
  const mockPlaylistVideos: PlaylistVideo[] = [
    {
      id: "1",
      title: "Introduction to Web Development",
      thumbnail: "/placeholder.svg?height=90&width=160&text=Video+1",
      duration: "15:30",
      channel: "Tech Academy",
      selected: true,
    },
    {
      id: "2",
      title: "HTML Fundamentals",
      thumbnail: "/placeholder.svg?height=90&width=160&text=Video+2",
      duration: "22:45",
      channel: "Tech Academy",
      selected: true,
    },
    {
      id: "3",
      title: "CSS Styling Basics",
      thumbnail: "/placeholder.svg?height=90&width=160&text=Video+3",
      duration: "18:20",
      channel: "Tech Academy",
      selected: true,
    },
    {
      id: "4",
      title: "JavaScript Essentials",
      thumbnail: "/placeholder.svg?height=90&width=160&text=Video+4",
      duration: "35:15",
      channel: "Tech Academy",
      selected: false,
    },
    {
      id: "5",
      title: "React Framework Introduction",
      thumbnail: "/placeholder.svg?height=90&width=160&text=Video+5",
      duration: "28:40",
      channel: "Tech Academy",
      selected: true,
    },
  ]

  const loadPlaylist = () => {
    setIsLoading(true)
    setTimeout(() => {
      setPlaylistVideos(mockPlaylistVideos)
      setIsLoading(false)
    }, 2000)
  }

  const toggleVideoSelection = (videoId: string) => {
    setPlaylistVideos((prev) =>
      prev.map((video) => (video.id === videoId ? { ...video, selected: !video.selected } : video)),
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 dark:from-gray-900 dark:to-gray-800 py-8 px-4 sm:px-6 lg:px-8">
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
            <Link href="/download" className="text-orange-600 hover:text-orange-500">
              ← Back to Media Downloader
            </Link>
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
                      <Label>Video Quality</Label>
                      <Select value={selectedQuality} onValueChange={setSelectedQuality}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="4K">4K (2160p)</SelectItem>
                          <SelectItem value="1440p">1440p (2K)</SelectItem>
                          <SelectItem value="1080p">1080p (Full HD)</SelectItem>
                          <SelectItem value="720p">720p (HD)</SelectItem>
                          <SelectItem value="480p">480p</SelectItem>
                          <SelectItem value="360p">360p</SelectItem>
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
                          <SelectItem value="mp4">MP4 (Video)</SelectItem>
                          <SelectItem value="mp3">MP3 (Audio Only)</SelectItem>
                          <SelectItem value="webm">WEBM</SelectItem>
                          <SelectItem value="mkv">MKV</SelectItem>
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
                      {selectedFormat === "mp3" ? "~45 MB" : "~2.1 GB"}
                    </span>
                  </div>

                  <Button
                    disabled={selectedCount === 0}
                    className="w-full bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white mt-4"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download Selected ({selectedCount})
                  </Button>
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
              <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-orange-200/50 dark:border-gray-700/50">
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
                    {playlistVideos.map((video, index) => (
                      <div
                        key={video.id}
                        className={`p-4 rounded-lg border-2 transition-all cursor-pointer ${
                          video.selected
                            ? "border-orange-500 bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20"
                            : "border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50"
                        }`}
                        onClick={() => toggleVideoSelection(video.id)}
                      >
                        <div className="flex items-start space-x-4">
                          <div className="flex items-center space-x-3">
                            <Checkbox checked={video.selected} onChange={() => toggleVideoSelection(video.id)} />
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
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-gray-900 dark:text-white line-clamp-2 mb-1">
                              {video.title}
                            </h4>
                            <div className="flex items-center space-x-4 text-sm text-gray-500">
                              <span className="flex items-center">
                                <Play className="w-3 h-3 mr-1" />
                                {video.channel}
                              </span>
                              <span className="flex items-center">
                                <Clock className="w-3 h-3 mr-1" />
                                {video.duration}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center">
                            {video.selected ? (
                              <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                                Selected
                              </Badge>
                            ) : (
                              <Badge variant="outline">Not Selected</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
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
  )
}