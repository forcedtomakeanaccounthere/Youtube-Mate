"use client"

import { useState, useRef, useEffect, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import {
  Play,
  Download,
  Search,
  Clock,
  FileText,
  Loader2,
  Copy,
  CheckCircle,
  AlertCircle,
  Languages,
  Moon,
  Sun,
  MessageCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Checkbox } from "@/components/ui/checkbox"
import Image from "next/image"
import Link from "next/link"
import { toast } from "@/hooks/use-toast"
import Navbar from "@/components/landing/Navbar"
import AuthGuard from "@/components/AuthGuard"
import VideoQA from "@/components/VideoQA"
import featuresData from "@/data/features.json"
import { Feature } from "@/types/features"
import { useDarkMode } from "@/hooks/use-dark-mode"

const features: Feature[] = featuresData

interface TranscriptSegment {
  id: string
  start: number
  end: number
  text: string
  speaker?: string
  confidence?: number
}

interface VideoInfo {
  title: string
  duration: string
  thumbnail: string
  channel: string | { name: string; url: string; thumbnail: string }
  views: string
  uploadDate: string
}

interface Summary {
  brief: string
  detailed: string
  bulletPoints: string[]
  keyMoments: Array<{
    timestamp: number
    endTimestamp?: number
    timeLabel?: string
    text: string
  }>
}

const languages = [
  { code: "en", name: "English", flag: "🇺🇸" },
  { code: "es", name: "Spanish", flag: "🇪🇸" },
  { code: "fr", name: "French", flag: "🇫🇷" },
  { code: "de", name: "German", flag: "🇩🇪" },
  { code: "it", name: "Italian", flag: "🇮🇹" },
  { code: "pt", name: "Portuguese", flag: "🇵🇹" },
  { code: "ru", name: "Russian", flag: "🇷🇺" },
  { code: "ja", name: "Japanese", flag: "🇯🇵" },
  { code: "ko", name: "Korean", flag: "🇰🇷" },
  { code: "zh", name: "Chinese", flag: "🇨🇳" },
  { code: "ar", name: "Arabic", flag: "🇸🇦" },
  { code: "hi", name: "Hindi", flag: "🇮🇳" },
]

const summaryTypes = [
  { value: "brief", label: "Brief Summary", description: "2-3 sentences overview" },
  { value: "detailed", label: "Detailed Summary", description: "Comprehensive analysis" },
  { value: "bullets", label: "Bullet Points", description: "Key points in list format" },
  { value: "keyMoments", label: "Key Moments", description: "Important timestamps" },
]

const exportFormats = [
  { value: "txt", label: "Text (.txt)", icon: <FileText className="w-4 h-4" /> },
  { value: "pdf", label: "PDF (.pdf)", icon: <FileText className="w-4 h-4" /> },
  { value: "json", label: "JSON (.json)", icon: <FileText className="w-4 h-4" /> },
  { value: "srt", label: "Subtitles (.srt)", icon: <FileText className="w-4 h-4" /> },
]

function TranscriptPageContent() {
  const searchParams = useSearchParams()
  const [youtubeUrl, setYoutubeUrl] = useState("")
  const [selectedLanguage, setSelectedLanguage] = useState("en")
  const [isProcessing, setIsProcessing] = useState(false)
  const [isRegeneratingSummary, setIsRegeneratingSummary] = useState(false)
  const [progress, setProgress] = useState(0)
  const [processingStep, setProcessingStep] = useState("")
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null)
  const [transcript, setTranscript] = useState<TranscriptSegment[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedSummaryType, setSelectedSummaryType] = useState("brief")
  const [showSpeakers, setShowSpeakers] = useState(true)
  const [showTimestamps, setShowTimestamps] = useState(true)
  const [highlightKeywords, setHighlightKeywords] = useState(true)
  const [currentTime, setCurrentTime] = useState(0)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState("")
  const [summaryError, setSummaryError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState("transcript")

  // Navbar state
  const [activeFeature, setActiveFeature] = useState(features[0])
  const [showNavbar, setShowNavbar] = useState(true)
  const { darkMode, toggleDarkMode, mounted } = useDarkMode()

  const transcriptRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  // Check for tab parameter in URL
  useEffect(() => {
    const tab = searchParams.get("tab")
    if (tab === "qa") {
      setActiveTab("qa")
    }
  }, [searchParams])

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
    }
    return `${minutes}:${secs.toString().padStart(2, "0")}`
  }

  const validateYouTubeUrl = (url: string) => {
    const regex = /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
    return regex.test(url)
  }

  const extractVideoId = (url: string) => {
    const regex = /(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
    const match = url.match(regex)
    return match ? match[1] : null
  }

  const handleSummaryTypeChange = async (newType: string) => {
    setSelectedSummaryType(newType)
    
    // If we have existing transcript data, regenerate summary
    if (transcript.length > 0 && summary) {
      setIsRegeneratingSummary(true)
      
      try {
        // Get authentication token
        const token = localStorage.getItem("token")
        if (!token) {
          toast({
            title: "Error",
            description: "Authentication required. Please log in.",
            variant: "destructive",
          })
          return
        }

        // Make API call to regenerate summary with new type
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'}/transcript/regenerate-summary`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            segments: transcript,
            summaryType: newType,
            language: selectedLanguage,
            videoInfo: videoInfo,
            hasActualCaptions: !!(summary),
            videoId: extractVideoId(youtubeUrl) || null,
          }),
        })

        if (response.ok) {
          const data = await response.json()
          if (data.summaryError) {
            setSummaryError(data.summaryError)
          } else {
            setSummary(data.summary)
            setSummaryError(null)
          }
        } else {
          throw new Error('Failed to regenerate summary')
        }
      } catch (error) {
        console.error('Error regenerating summary:', error)
        toast({
          title: "Error",
          description: "Failed to regenerate summary. Please try again.",
          variant: "destructive",
        })
      } finally {
        setIsRegeneratingSummary(false)
      }
    }
  }

  const handleUrlSubmit = async () => {
    if (!validateYouTubeUrl(youtubeUrl)) {
      setError("Please enter a valid YouTube URL")
      return
    }

    setError("")
    setIsProcessing(true)
    setProgress(0)
    setProcessingStep("Connecting to YouTube...")

    try {
      // Get authentication token
      const token = localStorage.getItem("token")
      if (!token) {
        setError("Authentication required. Please log in.")
        setIsProcessing(false)
        return
      }

      // Start transcript processing
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'}/transcript`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          youtubeUrl,
          language: selectedLanguage,
          summaryType: selectedSummaryType,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to start transcript processing')
      }

      const result = await response.json()
      
      // Check if we got a completed transcript directly (existing transcript)
      if (result.videoInfo && result.content) {
        setVideoInfo(result.videoInfo)
        setTranscript(result.content || [])
        setSummary(result.summary || {
          brief: "",
          detailed: "",
          bulletPoints: [],
          keyMoments: [],
        })
        setProgress(100)
        setProcessingStep("Done!")
        setIsProcessing(false)
        setActiveTab("transcript")
        setTimeout(() => contentRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 300)
        
        // Check if this is cached data
        const isCached = result.expiresAt && new Date(result.expiresAt) > new Date()
        
        // Show notification if transcript is AI-generated or no captions available
        if (result.transcriptMethod && result.transcriptMethod.includes('ai-generated')) {
          toast({
            title: "Notice",
            description: result.hasActualCaptions === false 
              ? "This video does not have captions available. Showing AI-generated content based on video title and metadata."
              : "Transcript generated using AI as captions could not be extracted.",
            variant: "default",
          })
        } else if (isCached) {
          toast({
            title: "Using Cached Data",
            description: "This transcript was recently fetched. Loaded instantly from cache!",
            variant: "default",
          })
        }
        return
      }

      // Handle polling case (new transcript being processed)
      const transcriptId = result.transcriptId
      if (!transcriptId) {
        throw new Error('No transcript ID received')
      }

      // Poll for processing status
      const pollStatus = async () => {
        try {
          const statusResponse = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'}/transcript/${transcriptId}/status`,
            {
              headers: {
                'Authorization': `Bearer ${token}`,
              }
            }
          )
          if (!statusResponse.ok) return

          const statusData = await statusResponse.json()
          const p = statusData.progress || 0
          setProgress(p)

          // Set human-readable step messages based on progress
          if (p < 20) setProcessingStep("Fetching video information...")
          else if (p < 40) setProcessingStep("Extracting transcript & captions...")
          else if (p < 65) setProcessingStep("Processing transcript segments...")
          else if (p < 85) setProcessingStep("Generating AI summary...")
          else if (p < 100) setProcessingStep("Finalising results...")
          else setProcessingStep("Almost ready!")

          if (statusData.status === 'completed') {
            // Fetch the completed transcript
            const transcriptResponse = await fetch(
              `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'}/transcript/${transcriptId}`,
              {
                headers: {
                  'Authorization': `Bearer ${token}`,
                }
              }
            )
            if (transcriptResponse.ok) {
              const transcriptData = await transcriptResponse.json()
              
              // Set video info
              setVideoInfo(transcriptData.videoInfo)
              
              // Set transcript segments
              setTranscript(transcriptData.content || [])
              
              // Set summary
              setSummary(transcriptData.summary || {
                brief: "",
                detailed: "",
                bulletPoints: [],
                keyMoments: [],
              })
              
              // Set summary error if all providers failed
              setSummaryError(transcriptData.summaryError || null)
              
              setProgress(100)
              setProcessingStep("Done!")
              setIsProcessing(false)
              setActiveTab("transcript")
              setTimeout(() => contentRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 300)
              
              // Show notification if transcript is AI-generated or no captions available
              if (transcriptData.transcriptMethod && transcriptData.transcriptMethod.includes('ai-generated')) {
                toast({
                  title: "Notice",
                  description: transcriptData.hasActualCaptions === false 
                    ? "This video does not have captions available. Showing AI-generated content based on video title and metadata."
                    : "Transcript generated using AI as captions could not be extracted.",
                  variant: "default",
                })
              }
            }
          } else if (statusData.status === 'failed') {
            setIsProcessing(false)
            throw new Error(statusData.error || 'Processing failed')
          } else if (statusData.status === 'processing') {
            // Continue polling
            setTimeout(pollStatus, 2000)
          }
        } catch (error) {
          console.error('Error polling status:', error)
          setTimeout(pollStatus, 3000) // Retry after longer delay
        }
      }

      // Start polling
      setTimeout(pollStatus, 1000)

    } catch (err) {
      console.error('Error:', err)
      setError(err instanceof Error ? err.message : "Failed to process video. Please try again.")
      setIsProcessing(false)
      setProgress(0)
      
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to process video. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleTimestampClick = (timestamp: number) => {
    setCurrentTime(timestamp)
    // In a real implementation, this would seek the video player
  }

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error("Failed to copy text:", err)
    }
  }

  const handleExport = (format: string) => {
    // Mock export functionality
    const filename = `transcript_${Date.now()}.${format}`
    console.log(`Exporting as ${format}: ${filename}`)

    // In a real implementation, this would generate and download the file
    const element = document.createElement("a")
    const content =
      format === "json"
        ? JSON.stringify({ videoInfo, transcript, summary }, null, 2)
        : transcript.map((segment) => `[${formatTime(segment.start)}] ${segment.text}`).join("\n")

    const file = new Blob([content], { type: "text/plain" })
    element.href = URL.createObjectURL(file)
    element.download = filename
    document.body.appendChild(element)
    element.click()
    document.body.removeChild(element)
  }

  const filteredTranscript = transcript.filter((segment) =>
    segment.text.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const highlightText = (text: string, query: string) => {
    if (!query || !highlightKeywords) return text

    const regex = new RegExp(`(${query})`, "gi")
    const parts = text.split(regex)

    return parts.map((part, index) =>
      regex.test(part) ? (
        <mark key={index} className="bg-orange-200 dark:bg-orange-800 px-1 rounded">
          {part}
        </mark>
      ) : (
        part
      ),
    )
  }

  // Don't render anything that depends on darkMode until mounted
  if (!mounted) {
    return <div className="min-h-screen" /> // Minimal fallback
  }

  return (
    <AuthGuard
      message="You need to be logged in to use the transcript feature. Please log in to continue."
      title="Authentication Required"
    >
      <div
        className={`min-h-screen transition-colors duration-300 ${darkMode ? "dark bg-gray-900" : "bg-gradient-to-br from-orange-50 to-red-50"}`}
      >
      <Navbar
        showNavbar={showNavbar}
        features={features}
        setActiveFeature={setActiveFeature}
        darkMode={darkMode}
        toggleDarkMode={toggleDarkMode}
      />
      <div className="pt-20 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          {/* Page Header */}
          <div className="text-center mb-8">
            <div className="flex items-center justify-center mb-4">
              <FileText className="w-12 h-12 text-orange-500 mr-3" />
              <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-orange-500 to-red-600 bg-clip-text text-transparent">
                Transcript & Summary
              </h1>
            </div>
          <p className="mt-5 text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Generate accurate transcripts and AI-powered summaries from YouTube videos with advanced features
          </p>
        </div>

        <img src="/disco.webp" alt="disco ball" className="lg:w-[420px] lg:h-[600px] lg:top-[68px] md:w-[250px] md:h-[360px] md:top-[70px] absolute right-0 invisible md:visible" />

        {/* URL Input Section */}
        <Card className="mb-8 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-orange-200/50 dark:border-gray-700/50">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-gray-900 dark:text-white">
              <Languages className="w-5 h-5 text-orange-500" />
              <span>Video Input & Settings</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-8">
                <div>
                  <Label htmlFor="youtube-url" className="text-gray-700 dark:text-gray-300 mb-3">
                    YouTube URL
                  </Label>
                  <Input
                    id="youtube-url"
                    type="url"
                    placeholder="https://www.youtube.com/watch?v=..."
                    value={youtubeUrl}
                    onChange={(e) => setYoutubeUrl(e.target.value)}
                    className="mt-1"
                  />
                  {error && (
                    <p className="text-red-500 text-sm mt-1 flex items-center">
                      <AlertCircle className="w-4 h-4 mr-1" />
                      {error}
                    </p>
                  )}
                </div>

                <div>
                  <Label className="text-gray-700 dark:text-gray-300 mb-2 mt-4">Language</Label>
                  <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {languages.map((lang) => (
                        <SelectItem key={lang.code} value={lang.code}>
                          <span className="flex items-center space-x-2">
                            <span>{lang.flag}</span>
                            <span>{lang.name}</span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-7">
                <div>
                  <Label className="text-gray-700 dark:text-gray-300 mb-3">Summary Type</Label>
                  <Select value={selectedSummaryType} onValueChange={handleSummaryTypeChange}>
                    <SelectTrigger className="mt-1 p-7">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {summaryTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          <div>
                            <div className="font-medium mb-1">{type.label}</div>
                            <div className="text-sm text-gray-500">{type.description}</div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3">
                  <Label className="text-gray-700 dark:text-gray-300 mb-5">Display Options</Label>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="show-speakers" 
                        checked={showSpeakers} 
                        onCheckedChange={(checked) => setShowSpeakers(checked === true)} 
                      />
                      <Label htmlFor="show-speakers" className="text-sm">
                        Show speaker identification
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="show-timestamps"
                        checked={showTimestamps}
                        onCheckedChange={(checked) => setShowTimestamps(checked === true)}
                      />
                      <Label htmlFor="show-timestamps" className="text-sm">
                        Show timestamps
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="highlight-keywords"
                        checked={highlightKeywords}
                        onCheckedChange={(checked) => setHighlightKeywords(checked === true)}
                      />
                      <Label htmlFor="highlight-keywords" className="text-sm">
                        Highlight search keywords
                      </Label>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <Button
                onClick={handleUrlSubmit}
                disabled={isProcessing || !youtubeUrl}
                className="w-full bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing Video...
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4 mr-2" />
                    Generate Transcript & Summary
                  </>
                )}
              </Button>

              {/* Q&A Button - Always clickable */}
              <Button
                onClick={async () => {
                  if (!youtubeUrl) {
                    toast({
                      title: "URL Required",
                      description: "Please enter a YouTube URL first",
                      variant: "destructive",
                    })
                    return
                  }

                  // If no transcript exists, fetch it in background
                  if (!videoInfo || transcript.length === 0) {
                    setIsProcessing(true)
                    try {
                      const token = localStorage.getItem("token")
                      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'}/transcript`, {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          'Authorization': `Bearer ${token}`,
                        },
                        body: JSON.stringify({
                          youtubeUrl,
                          language: selectedLanguage,
                          summaryType: 'brief',
                        }),
                      })

                      if (response.ok) {
                        const result = await response.json()
                        
                        if (result.videoInfo && result.content) {
                          setVideoInfo(result.videoInfo)
                          setTranscript(result.content || [])
                          setSummary(result.summary || { brief: "", detailed: "", bulletPoints: [], keyMoments: [] })
                        } else {
                          // Start polling for completion
                          const transcriptId = result.transcriptId
                          const pollStatus = async () => {
                            const statusResponse = await fetch(
                              `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'}/transcript/${transcriptId}/status`,
                              { headers: { 'Authorization': `Bearer ${token}` } }
                            )
                            if (statusResponse.ok) {
                              const statusData = await statusResponse.json()
                              if (statusData.status === 'completed') {
                                const transcriptResponse = await fetch(
                                  `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'}/transcript/${transcriptId}`,
                                  { headers: { 'Authorization': `Bearer ${token}` } }
                                )
                                if (transcriptResponse.ok) {
                                  const transcriptData = await transcriptResponse.json()
                                  setVideoInfo(transcriptData.videoInfo)
                                  setTranscript(transcriptData.content || [])
                                  setSummary(transcriptData.summary || { brief: "", detailed: "", bulletPoints: [], keyMoments: [] })
                                  setIsProcessing(false)
                                  setActiveTab("qa")
                                  const url = new URL(window.location.href)
                                  url.searchParams.set("tab", "qa")
                                  window.history.pushState({}, "", url)
                                }
                              } else if (statusData.status !== 'failed') {
                                setTimeout(pollStatus, 2000)
                              }
                            }
                          }
                          setTimeout(pollStatus, 1000)
                          return
                        }
                      }
                    } catch (error) {
                      console.error('Error fetching transcript:', error)
                      toast({
                        title: "Error",
                        description: "Failed to fetch transcript. Please try again.",
                        variant: "destructive",
                      })
                    } finally {
                      setIsProcessing(false)
                    }
                  }

                  // Switch to Q&A tab
                  setActiveTab("qa")
                  const url = new URL(window.location.href)
                  url.searchParams.set("tab", "qa")
                  window.history.pushState({}, "", url)
                }}
                disabled={isProcessing || !youtubeUrl}
                className="w-full bg-gradient-to-r from-orange-600 to-red-700 hover:from-orange-700 hover:to-red-800 text-white"
              >
                <MessageCircle className="w-4 h-4 mr-2" />
                Ask Questions From Video
              </Button>
            </div>

            {isProcessing && (
              <div className="space-y-3 mt-2">
                {/* Step description with animated dots */}
                <div className="flex items-center gap-2 text-sm text-orange-600 dark:text-orange-400 font-medium">
                  <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
                  <span>{processingStep || "Processing video..."}</span>
                </div>
                {/* Labelled progress bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                    <span>Progress</span>
                    <span>{Math.round(progress)}%</span>
                  </div>
                  <Progress value={progress} className="w-full h-2" />
                </div>
                <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
                  This may take 10–30 seconds for a new video. Please wait&hellip;
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Main Content - Show either Transcript/Summary view OR Q&A view */}
        <div ref={contentRef}>
        {activeTab === "qa" ? (
          /* Q&A Full Page View */
          videoInfo && (
            <VideoQA
              videoId={extractVideoId(youtubeUrl) || ""}
              videoUrl={youtubeUrl}
              videoMetadata={{
                title: videoInfo.title,
                thumbnail: videoInfo.thumbnail,
                duration: videoInfo.duration,
                channel: videoInfo.channel,
                uploadDate: videoInfo.uploadDate,
              }}
            />
          )
        ) : (
          /* Original Transcript/Summary View */
          <>
        {/* Video Info */}
        {videoInfo && (
          <Card className="mb-8 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-orange-200/50 dark:border-gray-700/50">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row gap-6">
                <div className="flex-shrink-0">
                  <Image
                    src={videoInfo.thumbnail || "/placeholder.svg"}
                    alt="Video thumbnail"
                    width={320}
                    height={180}
                    className="rounded-lg shadow-md"
                  />
                </div>
                <div className="flex-1 space-y-3">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">{videoInfo.title}</h2>
                  <div className="flex flex-wrap gap-4 text-sm text-gray-600 dark:text-gray-400">
                    <span className="flex items-center">
                      <Clock className="w-4 h-4 mr-1" />
                      {videoInfo.duration}
                    </span>
                    <span>{typeof videoInfo.channel === 'object' ? videoInfo.channel.name : videoInfo.channel}</span>
                    <span>{videoInfo.views}</span>
                    <span>{videoInfo.uploadDate}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge
                      variant="secondary"
                      className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200"
                    >
                      {languages.find((l) => l.code === selectedLanguage)?.name}
                    </Badge>
                    <Badge
                      variant="secondary"
                      className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                    >
                      Transcript Ready
                    </Badge>
                    <Badge
                      variant="secondary"
                      className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                    >
                      Summary Generated
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main Content */}
        {transcript.length > 0 && (
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Transcript & Summary */}
            <div className="lg:col-span-2">
              <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-orange-200/50 dark:border-gray-700/50">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-gray-900 dark:text-white">Content</CardTitle>
                    <div className="flex items-center space-x-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCopy(transcript.map((s) => s.text).join(" "))}
                        className="text-gray-600 dark:text-gray-400"
                      >
                        {copied ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      </Button>
                      <Select value="txt" onValueChange={handleExport}>
                        <SelectTrigger className="w-44">
                          <Download className="w-4 h-4 mr-1 flex-shrink-0" />
                          <SelectValue placeholder="Export" />
                        </SelectTrigger>
                        <SelectContent className="w-auto min-w-[180px] z-50" align="end">
                          {exportFormats.map((format) => (
                            <SelectItem key={format.value} value={format.value} className="cursor-pointer">
                              <div className="flex items-center space-x-2 py-1">
                                <span className="flex-shrink-0">{format.icon}</span>
                                <span className="whitespace-nowrap text-sm">{format.label}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Tabs value={activeTab} onValueChange={(value) => {
                    setActiveTab(value)
                    // Update URL with tab parameter
                    const url = new URL(window.location.href)
                    if (value === "qa") {
                      url.searchParams.set("tab", "qa")
                    } else {
                      url.searchParams.delete("tab")
                    }
                    window.history.pushState({}, "", url)
                  }}>
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="transcript">Transcript</TabsTrigger>
                      <TabsTrigger value="summary">Summary</TabsTrigger>
                      {/* <TabsTrigger value="qa">
                        <MessageCircle className="w-4 h-4 mr-1" />
                        Q&A
                      </TabsTrigger> */}
                    </TabsList>

                    <TabsContent value="transcript" className="mt-6">
                      <div className="space-y-4">
                        {/* Search */}
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                          <Input
                            placeholder="Search in transcript..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10"
                          />
                        </div>

                        {/* Transcript */}
                        <div
                          ref={transcriptRef}
                          className="max-h-96 overflow-y-auto space-y-3 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg"
                        >
                          {filteredTranscript.map((segment) => (
                            <div
                              key={segment.id}
                              className="flex space-x-3 p-3 rounded-lg hover:bg-white dark:hover:bg-gray-800 transition-colors cursor-pointer"
                              onClick={() => handleTimestampClick(segment.start)}
                            >
                              {showTimestamps && (
                                <div className="flex-shrink-0">
                                  <Badge variant="outline" className="text-xs font-mono">
                                    {formatTime(segment.start)}
                                  </Badge>
                                </div>
                              )}
                              <div className="flex-1">
                                {showSpeakers && segment.speaker && (
                                  <div className="text-sm font-medium text-orange-600 dark:text-orange-400 mb-1">
                                    {segment.speaker}
                                  </div>
                                )}
                                <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                                  {highlightText(segment.text, searchQuery)}
                                </p>
                                {segment.confidence && (
                                  <div className="text-xs text-gray-500 mt-1">
                                    Confidence: {Math.round(segment.confidence * 100)}%
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value="summary" className="mt-6">
                      {summaryError ? (
                        <div className="p-6 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                          <div className="flex items-start space-x-3">
                            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                            <div className="flex-1">
                              <h3 className="font-semibold text-red-800 dark:text-red-200 mb-2">
                                Summary Generation Failed
                              </h3>
                              <p className="text-sm text-red-700 dark:text-red-300 mb-3">
                                We couldn't generate a summary for this video at the moment. This could be due to:
                              </p>
                              <ul className="text-sm text-red-700 dark:text-red-300 space-y-1 mb-3 list-disc list-inside">
                                <li>AI model temporarily overloaded or unavailable</li>
                                <li>API rate limits or quota exceeded</li>
                                <li>Network connectivity issues</li>
                              </ul>
                              <details className="text-xs">
                                <summary className="cursor-pointer text-red-600 dark:text-red-400 hover:underline mb-2">
                                  Technical details
                                </summary>
                                <pre className="bg-red-100 dark:bg-red-900/40 p-2 rounded overflow-x-auto text-red-800 dark:text-red-200">
                                  {summaryError}
                                </pre>
                              </details>
                              <p className="text-sm text-red-700 dark:text-red-300 mt-3">
                                💡 <strong>Tip:</strong> The transcript is still available on the Transcript tab. 
                                You can try regenerating the summary later by switching summary types.
                              </p>
                            </div>
                          </div>
                        </div>
                      ) : isRegeneratingSummary ? (
                        <div className="flex items-center justify-center py-12">
                          <div className="text-center">
                            <Loader2 className="w-8 h-8 animate-spin text-orange-500 mx-auto mb-4" />
                            <p className="text-gray-600 dark:text-gray-400">Regenerating summary...</p>
                          </div>
                        </div>
                      ) : summary && (
                        <div className="space-y-6">
                          {selectedSummaryType === "brief" && (
                            <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
                              <h3 className="font-semibold text-orange-800 dark:text-orange-200 mb-2">Brief Summary</h3>
                              <p className="text-gray-700 dark:text-gray-300">{summary.brief}</p>
                            </div>
                          )}

                          {selectedSummaryType === "detailed" && (
                            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                              <h3 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">Detailed Summary</h3>
                              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">{summary.detailed}</p>
                            </div>
                          )}

                          {selectedSummaryType === "bullets" && (
                            <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                              <h3 className="font-semibold text-green-800 dark:text-green-200 mb-3">Key Points</h3>
                              <ul className="space-y-2">
                                {summary.bulletPoints.map((point, index) => (
                                  <li key={index} className="flex items-start space-x-2">
                                    <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0"></div>
                                    <span className="text-gray-700 dark:text-gray-300">{point}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {selectedSummaryType === "keyMoments" && (
                            <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                              <h3 className="font-semibold text-purple-800 dark:text-purple-200 mb-3">Key Moments</h3>
                              <div className="space-y-3">
                                {summary.keyMoments.map((moment, index) => (
                                  <div
                                    key={index}
                                    className="flex items-start space-x-3 p-3 bg-white dark:bg-gray-800 rounded-lg cursor-pointer hover:shadow-md transition-shadow"
                                    onClick={() => handleTimestampClick(moment.timestamp)}
                                  >
                                    <Badge variant="outline" className="font-mono text-xs whitespace-nowrap">
                                      {moment.timeLabel || formatTime(moment.timestamp)}
                                    </Badge>
                                    <p className="text-gray-700 dark:bg-gray-300 flex-1">{moment.text}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="qa" className="mt-6">
                      {videoInfo && (
                        <VideoQA
                          videoId={extractVideoId(youtubeUrl) || ""}
                          videoUrl={youtubeUrl}
                          videoMetadata={{
                            title: videoInfo.title,
                            thumbnail: videoInfo.thumbnail,
                            duration: videoInfo.duration,
                            channel: videoInfo.channel,
                            uploadDate: videoInfo.uploadDate,
                          }}
                        />
                      )}
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Quick Stats */}
              <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-orange-200/50 dark:border-gray-700/50">
                <CardHeader>
                  <CardTitle className="text-lg text-gray-900 dark:text-white">Statistics</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Total Words</span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {transcript.reduce((acc, segment) => acc + segment.text.split(" ").length, 0)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Segments</span>
                    <span className="font-semibold text-gray-900 dark:text-white">{transcript.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Speakers</span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {new Set(transcript.map((s) => s.speaker).filter(Boolean)).size}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Avg. Confidence</span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {Math.round(
                        (transcript.reduce((acc, s) => acc + (s.confidence || 0), 0) / transcript.length) * 100,
                      )}
                      %
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Quick Actions */}
              <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-orange-200/50 dark:border-gray-700/50">
                <CardHeader>
                  <CardTitle className="text-lg text-gray-900 dark:text-white">Quick Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button
                    variant="outline"
                    className="w-full justify-start bg-transparent"
                    onClick={() => handleCopy(transcript.map((s) => s.text).join(" "))}
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    Copy Full Transcript
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start bg-transparent"
                    onClick={() => summary && handleCopy(summary.brief)}
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Copy Summary
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start bg-transparent"
                    onClick={() => handleExport("srt")}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download Subtitles
                  </Button>
                </CardContent>
              </Card>

              {/* Language Info */}
              {/* <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-orange-200/50 dark:border-gray-700/50">
                <CardHeader>
                  <CardTitle className="text-lg text-gray-900 dark:text-white">Language Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center space-x-3">
                    <span className="text-2xl">{languages.find((l) => l.code === selectedLanguage)?.flag}</span>
                    <div>
                      <div className="font-semibold text-gray-900 dark:text-white">
                        {languages.find((l) => l.code === selectedLanguage)?.name}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">Auto-detected from video</div>
                    </div>
                  </div>
                </CardContent>
              </Card> */}
            </div>
          </div>
        )}
        </>
        )}
        </div>{/* end contentRef wrapper */}
        </div>
        </div>
      </div>
    </AuthGuard>
  )
}

export default function TranscriptPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <TranscriptPageContent />
    </Suspense>
  )
}
