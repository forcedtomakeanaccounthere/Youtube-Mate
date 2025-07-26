"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { FileVideo, Download, Settings, HardDrive } from "lucide-react"
import Link from "next/link"

export default function VideoDownloadPage() {
  const [url, setUrl] = useState("")
  const [selectedQuality, setSelectedQuality] = useState("1080p")
  const [selectedFormat, setSelectedFormat] = useState("mp4")
  const [includeSubtitles, setIncludeSubtitles] = useState(false)

  const qualityOptions = [
    { quality: "4K", format: "MP4", fileSize: "2.1 GB", fps: 60 },
    { quality: "1440p", format: "MP4", fileSize: "1.2 GB", fps: 60 },
    { quality: "1080p", format: "MP4", fileSize: "650 MB", fps: 60 },
    { quality: "720p", format: "MP4", fileSize: "320 MB", fps: 30 },
    { quality: "480p", format: "MP4", fileSize: "180 MB", fps: 30 },
    { quality: "360p", format: "MP4", fileSize: "95 MB", fps: 30 },
  ]

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
                      {qualityOptions.map((option) => (
                        <SelectItem key={option.quality} value={option.quality}>
                          <div className="flex items-center justify-between w-full">
                            <span>
                              {option.quality} ({option.fps}fps)
                            </span>
                            <span className="text-sm text-gray-500 ml-4">{option.fileSize}</span>
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
                    {qualityOptions.find((opt) => opt.quality === selectedQuality)?.fileSize || "Unknown"}
                  </div>
                  <div className="text-sm text-gray-500">
                    {selectedFormat.toUpperCase()} • {selectedQuality}
                  </div>
                </div>
              </div>
            </div>

            <Button
              disabled={!url}
              className="w-full bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white py-3 text-lg"
            >
              <Download className="w-5 h-5 mr-2" />
              Start Download
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}