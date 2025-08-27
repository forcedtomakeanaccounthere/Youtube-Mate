"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import {
  Download,
  FileVideo,
  FileAudio,
  List,
  ArrowRight,
  Monitor,
  Smartphone,
  Tv,
  Radio,
  Users,
  Clock,
  Settings,
  Music,
  Headphones,
  Video,
} from "lucide-react"
import Link from "next/link"
import Navbar from "@/components/landing/Navbar"
import featuresData from "@/data/features.json"
import { Feature } from "@/types/features"
import { useDarkMode } from "@/hooks/use-dark-mode"

const features: Feature[] = featuresData

export default function MediaDownloaderPage() {
  const [selectedTab, setSelectedTab] = useState("video")

  // Navbar state
  const [activeFeature, setActiveFeature] = useState(features[0])
  const [showNavbar, setShowNavbar] = useState(true)
  const { darkMode, toggleDarkMode, mounted } = useDarkMode()

  const videoFeatures = [
    { icon: Monitor, title: "4K Quality", description: "Download videos up to 4K resolution" },
    { icon: Video, title: "Multiple Formats", description: "MP4, AVI, MKV, and more" },
    { icon: Settings, title: "Custom Settings", description: "Choose quality, format, and subtitles" },
    { icon: Smartphone, title: "Mobile Optimized", description: "Perfect for mobile devices" },
  ]

  const audioFeatures = [
    { icon: Headphones, title: "High Quality", description: "Up to 320kbps MP3 quality" },
    { icon: Music, title: "Multiple Formats", description: "MP3, AAC, FLAC, and WAV" },
    { icon: Radio, title: "Audio Only", description: "Extract audio from any video" },
    { icon: Clock, title: "Fast Processing", description: "Quick audio extraction" },
  ]

  const playlistFeatures = [
    { icon: List, title: "Bulk Download", description: "Download entire playlists at once" },
    { icon: Users, title: "Collaborative", description: "Share and manage playlists" },
    { icon: Settings, title: "Batch Settings", description: "Apply settings to all videos" },
    { icon: Tv, title: "Smart Organization", description: "Auto-organize by creator or date" },
  ]

  const getTabIcon = (tab: string) => {
    switch (tab) {
      case "video": return <FileVideo className="w-8 h-8" />
      case "audio": return <FileAudio className="w-8 h-8" />
      case "playlist": return <List className="w-8 h-8" />
      default: return <Download className="w-5 h-5" />
    }
  }

  const getTabColor = (tab: string) => {
    switch (tab) {
      case "video": return "from-blue-500 to-purple-600"
      case "audio": return "from-green-500 to-teal-600"
      case "playlist": return "from-orange-500 to-red-600"
      default: return "from-gray-500 to-gray-600"
    }
  }

  const getTabDescription = (tab: string) => {
    switch (tab) {
      case "video":
        return "Download YouTube videos in multiple formats and qualities. Perfect for offline viewing with support for 4K, subtitles, and various video formats."
      case "audio":
        return "Extract high-quality audio from YouTube videos. Support for multiple audio formats including MP3, AAC, FLAC with customizable bitrates."
      case "playlist":
        return "Download entire YouTube playlists with batch processing. Organize, collaborate, and manage large collections of videos efficiently."
      default: return ""
    }
  }

  const getFeatures = (tab: string) => {
    switch (tab) {
      case "video": return videoFeatures
      case "audio": return audioFeatures
      case "playlist": return playlistFeatures
      default: return []
    }
  }

  const getRoute = (tab: string) => {
    switch (tab) {
      case "video": return "/download/video"
      case "audio": return "/download/audio"
      case "playlist": return "/download/playlist"
      default: return "/download"
    }
  }

  // Don't render anything that depends on darkMode until mounted
  if (!mounted) {
    return <div className="min-h-screen" /> // Minimal fallback
  }

  return (
    <div className={`min-h-screen transition-colors duration-300 ${darkMode ? "dark bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900" : "bg-gradient-to-br from-orange-50 via-white to-red-50"}`}>
      <Navbar
        showNavbar={showNavbar}
        features={features}
        setActiveFeature={setActiveFeature}
        darkMode={darkMode}
        toggleDarkMode={toggleDarkMode}
      />
      <img src="/2.png" alt="stripes" className="absolute right-0 stripes" />
      <div className="pt-20 px-4 py-12">
        <div className="container mx-auto max-w-6xl">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="flex items-center justify-center mb-6">
              <Download className="w-12 h-12 text-orange-500 mr-4" />
              <h1 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-orange-500 to-red-600 bg-clip-text text-transparent">
                Media Downloader
              </h1>
            </div>
            <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              Choose your download type and explore the features. Each option provides specialized tools for different media needs.
            </p>
          </div>

          <Tabs defaultValue="audio" className="space-y-8" onValueChange={setSelectedTab}>
            <TabsList className="grid w-full grid-cols-3 max-w-md mx-auto">
              <TabsTrigger value="video" className="flex items-center space-x-2">
                <FileVideo className="w-8 h-8" />
                <span>Video</span>
              </TabsTrigger>
              <TabsTrigger value="audio" className="flex items-center space-x-2">
                <FileAudio className="w-8 h-8" />
                <span>Audio</span>
              </TabsTrigger>
              <TabsTrigger value="playlist" className="flex items-center space-x-2">
                <List className="w-8 h-8" />
                <span>Playlist</span>
              </TabsTrigger>
            </TabsList>

            {/* Video Tab */}
            <TabsContent value="video" className="space-y-8">
              <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-orange-200/50 dark:border-gray-700/50">
                <CardHeader className="text-center pb-4">
                  <div className="flex items-center justify-center mb-4">
                    <div className={`p-4 rounded-full bg-gradient-to-r ${getTabColor("video")} text-white`}>
                      {getTabIcon("video")}
                    </div>
                  </div>
                  <CardTitle className="text-2xl text-gray-900 dark:text-white mb-2">
                    Video Download
                  </CardTitle>
                  <p className="text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
                    {getTabDescription("video")}
                  </p>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Features Grid */}
                  <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {getFeatures("video").map((feature, index) => (
                      <div key={index} className="p-4 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg border border-blue-200/50 dark:border-blue-700/50">
                        <feature.icon className="w-8 h-8 text-blue-600 dark:text-blue-400 mb-3" />
                        <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                          {feature.title}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                          {feature.description}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Supported Formats */}
                  <div className="border-t pt-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                      Supported Formats & Qualities
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                        MP4
                      </Badge>
                      <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                        AVI
                      </Badge>
                      <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                        MKV
                      </Badge>
                      <Badge variant="secondary" className="bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300">
                        4K (2160p)
                      </Badge>
                      <Badge variant="secondary" className="bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300">
                        1080p HD
                      </Badge>
                      <Badge variant="secondary" className="bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300">
                        720p
                      </Badge>
                      <Badge variant="secondary" className="bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300">
                        480p
                      </Badge>
                    </div>
                  </div>

                  {/* Try Now Button */}
                  <div className="flex justify-center pt-4">
                    <Link href={getRoute("video")}>
                      <Button
                        size="lg"
                        className={`bg-gradient-to-r ${getTabColor("video")} hover:shadow-lg transition-all duration-300 text-white px-8 py-3`}
                      >
                        Try Video Download
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Audio Tab */}
            <TabsContent value="audio" className="space-y-8">
              <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-orange-200/50 dark:border-gray-700/50">
                <CardHeader className="text-center pb-4">
                  <div className="flex items-center justify-center mb-4">
                    <div className={`p-4 rounded-full bg-gradient-to-r ${getTabColor("audio")} text-white`}>
                      {getTabIcon("audio")}
                    </div>
                  </div>
                  <CardTitle className="text-2xl text-gray-900 dark:text-white mb-2">
                    Audio Download
                  </CardTitle>
                  <p className="text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
                    {getTabDescription("audio")}
                  </p>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Features Grid */}
                  <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {getFeatures("audio").map((feature, index) => (
                      <div key={index} className="p-4 bg-gradient-to-br from-green-50 to-teal-50 dark:from-green-900/20 dark:to-teal-900/20 rounded-lg border border-green-200/50 dark:border-green-700/50">
                        <feature.icon className="w-8 h-8 text-green-600 dark:text-green-400 mb-3" />
                        <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                          {feature.title}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                          {feature.description}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Supported Formats */}
                  <div className="border-t pt-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                      Supported Audio Formats & Quality
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300">
                        MP3
                      </Badge>
                      <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300">
                        AAC
                      </Badge>
                      <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300">
                        FLAC
                      </Badge>
                      <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300">
                        WAV
                      </Badge>
                      <Badge variant="secondary" className="bg-teal-100 text-teal-700 dark:bg-teal-900/50 dark:text-teal-300">
                        320kbps
                      </Badge>
                      <Badge variant="secondary" className="bg-teal-100 text-teal-700 dark:bg-teal-900/50 dark:text-teal-300">
                        256kbps
                      </Badge>
                      <Badge variant="secondary" className="bg-teal-100 text-teal-700 dark:bg-teal-900/50 dark:text-teal-300">
                        128kbps
                      </Badge>
                    </div>
                  </div>

                  {/* Try Now Button */}
                  <div className="flex justify-center pt-4">
                    <Link href={getRoute("audio")}>
                      <Button
                        size="lg"
                        className={`bg-gradient-to-r ${getTabColor("audio")} hover:shadow-lg transition-all duration-300 text-white px-8 py-3`}
                      >
                        Try Audio Download
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Playlist Tab */}
            <TabsContent value="playlist" className="space-y-8">
              <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-orange-200/50 dark:border-gray-700/50">
                <CardHeader className="text-center pb-4">
                  <div className="flex items-center justify-center mb-4">
                    <div className={`p-4 rounded-full bg-gradient-to-r ${getTabColor("playlist")} text-white`}>
                      {getTabIcon("playlist")}
                    </div>
                  </div>
                  <CardTitle className="text-2xl text-gray-900 dark:text-white mb-2">
                    Playlist Download
                  </CardTitle>
                  <p className="text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
                    {getTabDescription("playlist")}
                  </p>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Features Grid */}
                  <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {getFeatures("playlist").map((feature, index) => (
                      <div key={index} className="p-4 bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 rounded-lg border border-orange-200/50 dark:border-orange-700/50">
                        <feature.icon className="w-8 h-8 text-orange-600 dark:text-orange-400 mb-3" />
                        <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                          {feature.title}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                          {feature.description}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Supported Features */}
                  <div className="border-t pt-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                      Playlist Features
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary" className="bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300">
                        Batch Download
                      </Badge>
                      <Badge variant="secondary" className="bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300">
                        Auto-Organization
                      </Badge>
                      <Badge variant="secondary" className="bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300">
                        Progress Tracking
                      </Badge>
                      <Badge variant="secondary" className="bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300">
                        Collaborative
                      </Badge>
                      <Badge variant="secondary" className="bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300">
                        Smart Resume
                      </Badge>
                      <Badge variant="secondary" className="bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300">
                        Queue Management
                      </Badge>
                    </div>
                  </div>

                  {/* Try Now Button */}
                  <div className="flex justify-center pt-4">
                    <Link href={getRoute("playlist")}>
                      <Button
                        size="lg"
                        className={`bg-gradient-to-r ${getTabColor("playlist")} hover:shadow-lg transition-all duration-300 text-white px-8 py-3`}
                      >
                        Try Playlist Download
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Bottom CTA Section */}
          <div className="mt-16 text-center">
            <div className="bg-gradient-to-r from-orange-500 to-red-600 rounded-2xl p-8 text-white">
              <h2 className="text-3xl font-bold mb-4">
                Ready to Start Downloading?
              </h2>
              <p className="text-xl opacity-90 mb-6 max-w-2xl mx-auto">
                Choose any download type above to get started with high-quality media downloads from YouTube.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/download/video">
                  <Button size="lg" variant="secondary" className="bg-white text-orange-600 hover:bg-gray-100">
                    Start with Video
                  </Button>
                </Link>
                <Link href="/download/audio">
                  <Button size="lg" variant="secondary" className="bg-white text-orange-600 hover:bg-gray-100">
                    Try Audio First
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
      <style jsx>{`
        .stripes {
          width: 520px;
          height: 600px;
          top: 120px;
        }
        @media (max-width: 1400px) {
          .stripes {
            width: 440px;
            height: 500px;
            top: 197px;
            right: 0;
          }
        }
        @media (max-width: 1155px) {
          .stripes {
            width: 390px;
            height: 450px;
            top: 240px;
          }
        }
        @media (max-width: 1020px) {
          .stripes {
            width: 340px;
            height: 400px;
            top: 350px;
          }
        }
        @media (max-width: 600px) {
          .stripes {
            visibility: hidden;
          }
        }
      `}</style>
    </div>
    
  )
}
