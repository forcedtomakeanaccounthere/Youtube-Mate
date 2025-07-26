"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { FileAudio, Download, Settings, HardDrive } from "lucide-react"
import Link from "next/link"

export default function AudioDownloadPage() {
  const [url, setUrl] = useState("")
  const [selectedQuality, setSelectedQuality] = useState("320kbps")
  const [selectedFormat, setSelectedFormat] = useState("mp3")

  const audioQualityOptions = [
    { quality: "320kbps", format: "MP3", fileSize: "9.2 MB", bitrate: "320 kbps" },
    { quality: "256kbps", format: "MP3", fileSize: "7.4 MB", bitrate: "256 kbps" },
    { quality: "192kbps", format: "MP3", fileSize: "5.5 MB", bitrate: "192 kbps" },
    { quality: "128kbps", format: "MP3", fileSize: "3.7 MB", bitrate: "128 kbps" },
    { quality: "96kbps", format: "MP3", fileSize: "2.8 MB", bitrate: "96 kbps" },
  ]

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
                      {audioQualityOptions.map((option) => (
                        <SelectItem key={option.quality} value={option.quality}>
                          <div className="flex items-center justify-between w-full">
                            <span>{option.bitrate}</span>
                            <span className="text-sm text-gray-500 ml-4">{option.fileSize}</span>
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
                    {audioQualityOptions.find((opt) => opt.quality === selectedQuality)?.fileSize || "Unknown"}
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
              Extract Audio
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}