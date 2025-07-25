"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import {
  Copy,
  QrCode,
  Link,
  Clock,
  Eye,
  Calendar,
  AlertCircle,
  CheckCircle,
  Play,
  ExternalLink,
  Trash2,
  Plus,
} from "lucide-react"
import Image from "next/image"
import { toast } from "@/hooks/use-toast"

interface VideoData {
  id: string
  title: string
  thumbnail: string
  duration: string
  durationSeconds: number
  channel: string
  views: string
}

interface ShortenedURL {
  id: string
  originalUrl: string
  shortUrl: string
  customAlias?: string
  timestamp?: string
  videoData: VideoData
  analytics: boolean
  clicks: number
  createdAt: string
  expiryDate?: string
  qrCode: string
}

interface BulkURL {
  id: string
  url: string
  customAlias?: string
  timestamp?: string
  status: "pending" | "processing" | "completed" | "error"
  error?: string
}

export default function URLShortenerPage() {
  const [url, setUrl] = useState("")
  const [customAlias, setCustomAlias] = useState("")
  const [timestamp, setTimestamp] = useState({ hours: 0, minutes: 0, seconds: 0 })
  const [videoData, setVideoData] = useState<VideoData | null>(null)
  const [isValidUrl, setIsValidUrl] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [analytics, setAnalytics] = useState(true)
  const [customDomain, setCustomDomain] = useState("ytmate.co")
  const [expiryDate, setExpiryDate] = useState("")
  const [shortenedUrls, setShortenedUrls] = useState<ShortenedURL[]>([])
  const [bulkUrls, setBulkUrls] = useState<BulkURL[]>([])
  const [bulkInput, setBulkInput] = useState("")
  const [timestampError, setTimestampError] = useState("")

  // Mock video data for demonstration
  const mockVideoData: VideoData = {
    id: "dQw4w9WgXcQ",
    title: "Rick Astley - Never Gonna Give You Up (Official Video)",
    thumbnail: "/placeholder.svg?height=180&width=320&text=YouTube+Video+Thumbnail",
    duration: "3:33",
    durationSeconds: 213,
    channel: "Rick Astley",
    views: "1.4B views",
  }

  const validateYouTubeUrl = (url: string): boolean => {
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|embed\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
    return youtubeRegex.test(url)
  }

  const extractVideoId = (url: string): string | null => {
    const match = url.match(/(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/)
    return match ? match[1] : null
  }

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
    }
    return `${minutes}:${secs.toString().padStart(2, "0")}`
  }

  const validateTimestamp = () => {
    const totalSeconds = timestamp.hours * 3600 + timestamp.minutes * 60 + timestamp.seconds
    if (videoData && totalSeconds > videoData.durationSeconds) {
      setTimestampError(`Timestamp cannot exceed video duration (${videoData.duration})`)
      return false
    }
    setTimestampError("")
    return true
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

  useEffect(() => {
    validateTimestamp()
  }, [timestamp, videoData])

  const generateShortUrl = () => {
    if (!isValidUrl || !videoData || !validateTimestamp()) return

    const timestampString =
      timestamp.hours > 0 || timestamp.minutes > 0 || timestamp.seconds > 0
        ? `${timestamp.hours}h${timestamp.minutes}m${timestamp.seconds}s`
        : undefined

    const shortId = customAlias || Math.random().toString(36).substring(2, 8)
    const shortUrl = `https://${customDomain}/${shortId}`

    const newShortenedUrl: ShortenedURL = {
      id: Date.now().toString(),
      originalUrl: url,
      shortUrl,
      customAlias: customAlias || undefined,
      timestamp: timestampString,
      videoData,
      analytics,
      clicks: 0,
      createdAt: new Date().toISOString(),
      expiryDate: expiryDate || undefined,
      qrCode: `data:image/svg+xml;base64,${btoa(`<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect width="200" height="200" fill="white"/><text x="100" y="100" textAnchor="middle" fontSize="12" fill="black">QR Code for ${shortUrl}</text></svg>`)}`,
    }

    setShortenedUrls((prev) => [newShortenedUrl, ...prev])

    setUrl("")
    setCustomAlias("")
    setTimestamp({ hours: 0, minutes: 0, seconds: 0 })
    setVideoData(null)
    setExpiryDate("")

    toast({
      title: "URL Shortened Successfully!",
      description: "Your shortened URL has been generated and copied to clipboard.",
    })
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast({
      title: "Copied!",
      description: "URL copied to clipboard.",
    })
  }

  const addBulkUrl = () => {
    const urls = bulkInput.split("\n").filter((url) => url.trim())
    const newBulkUrls: BulkURL[] = urls.map((url) => ({
      id: Date.now().toString() + Math.random(),
      url: url.trim(),
      status: "pending",
    }))

    setBulkUrls((prev) => [...prev, ...newBulkUrls])
    setBulkInput("")
  }

  const processBulkUrls = () => {
    setBulkUrls((prev) => prev.map((item) => ({ ...item, status: "processing" })))

    setTimeout(() => {
      setBulkUrls((prev) =>
        prev.map((item) => ({
          ...item,
          status: validateYouTubeUrl(item.url) ? "completed" : "error",
          error: validateYouTubeUrl(item.url) ? undefined : "Invalid YouTube URL",
        })),
      )
    }, 2000)
  }

  const removeBulkUrl = (id: string) => {
    setBulkUrls((prev) => prev.filter((item) => item.id !== id))
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 dark:from-gray-900 dark:to-gray-800 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <Link className="w-12 h-12 text-orange-500 mr-3" />
            <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-orange-500 to-red-600 bg-clip-text text-transparent">
              URL Shortener
            </h1>
          </div>
          <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Create shortened YouTube URLs with custom timestamps, analytics, and QR codes for easy sharing.
          </p>
        </div>

        <Tabs defaultValue="single" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 max-w-md mx-auto">
            <TabsTrigger value="single">Single URL</TabsTrigger>
            <TabsTrigger value="bulk">Bulk URLs</TabsTrigger>
          </TabsList>

          <TabsContent value="single" className="space-y-6">
            <div className={`grid ${videoData ? "lg:grid-cols-2" : "lg:grid-cols-1"} gap-6`}>
              <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-orange-200/50 dark:border-gray-700/50">
                <CardHeader>
                  <CardTitle className="flex items-center text-gray-900 dark:text-white">
                    <Link className="w-5 h-5 mr-2 text-orange-500" />
                    Shorten YouTube URL
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="url">YouTube URL</Label>
                    <div className="relative">
                      <Input
                        id="url"
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

                  <div className="space-y-2">
                    <Label htmlFor="alias">Custom Alias (Optional)</Label>
                    <Input
                      id="alias"
                      placeholder="my-custom-link"
                      value={customAlias}
                      onChange={(e) => setCustomAlias(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Start Time (Optional)</Label>
                    <div className="flex items-center space-x-2">
                      <div className="flex items-center space-x-1">
                        <Input
                          type="number"
                          min="0"
                          max="23"
                          value={timestamp.hours}
                          onChange={(e) =>
                            setTimestamp((prev) => ({ ...prev, hours: Number.parseInt(e.target.value) || 0 }))
                          }
                          className="w-16 text-center"
                        />
                        <span className="text-sm text-gray-500">h</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Input
                          type="number"
                          min="0"
                          max="59"
                          value={timestamp.minutes}
                          onChange={(e) =>
                            setTimestamp((prev) => ({ ...prev, minutes: Number.parseInt(e.target.value) || 0 }))
                          }
                          className="w-16 text-center"
                        />
                        <span className="text-sm text-gray-500">m</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Input
                          type="number"
                          min="0"
                          max="59"
                          value={timestamp.seconds}
                          onChange={(e) =>
                            setTimestamp((prev) => ({ ...prev, seconds: Number.parseInt(e.target.value) || 0 }))
                          }
                          className="w-16 text-center"
                        />
                        <span className="text-sm text-gray-500">s</span>
                      </div>
                    </div>
                    {timestampError && (
                      <p className="text-sm text-red-500 flex items-center">
                        <AlertCircle className="w-4 h-4 mr-1" />
                        {timestampError}
                      </p>
                    )}
                  </div>

                  <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="analytics">Enable Analytics</Label>
                      <Switch id="analytics" checked={analytics} onCheckedChange={setAnalytics} />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="domain">Custom Domain</Label>
                      <Select value={customDomain} onValueChange={setCustomDomain}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ytmate.co">ytmate.co</SelectItem>
                          <SelectItem value="short.ytmate.com">short.ytmate.com</SelectItem>
                          <SelectItem value="yt.link">yt.link</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="expiry">Expiry Date (Optional)</Label>
                      <Input
                        id="expiry"
                        type="date"
                        value={expiryDate}
                        onChange={(e) => setExpiryDate(e.target.value)}
                        min={new Date().toISOString().split("T")[0]}
                      />
                    </div>
                  </div>

                  <Button
                    onClick={generateShortUrl}
                    disabled={!isValidUrl || isLoading || !!timestampError}
                    className="w-full bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white"
                  >
                    {isLoading ? "Loading..." : "Shorten URL"}
                  </Button>
                </CardContent>
              </Card>

              {videoData && (
                <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-orange-200/50 dark:border-gray-700/50">
                  <CardHeader>
                    <CardTitle className="flex items-center text-gray-900 dark:text-white">
                      <Play className="w-5 h-5 mr-2 text-orange-500" />
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
                    </div>
                    <div className="flex items-center text-sm text-gray-500">
                      <Clock className="w-4 h-4 mr-1" />
                      Total Duration: {videoData.duration} ({videoData.durationSeconds}s)
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="bulk" className="space-y-6">
            <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-orange-200/50 dark:border-gray-700/50">
              <CardHeader>
                <CardTitle className="flex items-center text-gray-900 dark:text-white">
                  <Plus className="w-5 h-5 mr-2 text-orange-500" />
                  Bulk URL Shortening
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="bulk-urls">YouTube URLs (one per line)</Label>
                  <Textarea
                    id="bulk-urls"
                    placeholder="https://www.youtube.com/watch?v=...
https://www.youtube.com/watch?v=...
https://youtu.be/..."
                    value={bulkInput}
                    onChange={(e) => setBulkInput(e.target.value)}
                    rows={6}
                  />
                </div>
                <div className="flex space-x-2">
                  <Button onClick={addBulkUrl} variant="outline">
                    Add URLs
                  </Button>
                  <Button
                    onClick={processBulkUrls}
                    disabled={bulkUrls.length === 0}
                    className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white"
                  >
                    Process All
                  </Button>
                </div>

                {bulkUrls.length > 0 && (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {bulkUrls.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{item.url}</p>
                          {item.error && <p className="text-xs text-red-500">{item.error}</p>}
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge
                            variant={
                              item.status === "completed"
                                ? "default"
                                : item.status === "error"
                                  ? "destructive"
                                  : item.status === "processing"
                                    ? "secondary"
                                    : "outline"
                            }
                          >
                            {item.status}
                          </Badge>
                          <Button size="sm" variant="ghost" onClick={() => removeBulkUrl(item.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {shortenedUrls.length > 0 && (
          <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-orange-200/50 dark:border-gray-700/50">
            <CardHeader>
              <CardTitle className="flex items-center text-gray-900 dark:text-white">
                <CheckCircle className="w-5 h-5 mr-2 text-green-500" />
                Generated Short URLs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {shortenedUrls.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 bg-gradient-to-r from-orange-50 to-red-50 dark:from-gray-700 dark:to-gray-600 rounded-lg"
                  >
                    <div className="grid md:grid-cols-3 gap-4">
                      <div className="flex items-center space-x-3">
                        <Image
                          src={item.videoData.thumbnail || "/placeholder.svg"}
                          alt={item.videoData.title}
                          width={80}
                          height={45}
                          className="rounded object-cover"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-900 dark:text-white line-clamp-2">
                            {item.videoData.title}
                          </p>
                          <p className="text-xs text-gray-500">{item.videoData.channel}</p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <Input value={item.shortUrl} readOnly className="text-sm" />
                          <Button size="sm" variant="outline" onClick={() => copyToClipboard(item.shortUrl)}>
                            <Copy className="w-4 h-4" />
                          </Button>
                        </div>
                        <div className="flex items-center space-x-4 text-xs text-gray-500">
                          {item.timestamp && (
                            <span className="flex items-center">
                              <Clock className="w-3 h-3 mr-1" />
                              {item.timestamp}
                            </span>
                          )}
                          {item.analytics && (
                            <span className="flex items-center">
                              <Eye className="w-3 h-3 mr-1" />
                              {item.clicks} clicks
                            </span>
                          )}
                          {item.expiryDate && (
                            <span className="flex items-center">
                              <Calendar className="w-3 h-3 mr-1" />
                              Expires: {new Date(item.expiryDate).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-end space-x-2">
                        <Button size="sm" variant="outline">
                          <QrCode className="w-4 h-4 mr-1" />
                          QR Code
                        </Button>
                        <Button size="sm" variant="outline">
                          <ExternalLink className="w-4 h-4 mr-1" />
                          Visit
                        </Button>
                      </div>
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