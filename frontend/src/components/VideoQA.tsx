"use client"

import { useState, useEffect, useRef } from "react"
import { Send, Plus, Trash2, Loader2, Image as ImageIcon, Sparkles, Zap, AlertCircle, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { toast } from "@/hooks/use-toast"
import Image from "next/image"
import Link from "next/link"

// Helper to convert File to base64 Data URI with smart resizing for OCR quality
// Resizes to max 1920px on the longest side (preserves detail for text extraction)
// while keeping the payload manageable for the vision model's attention mechanism
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const MAX_SIDE = 1920   // enough for clear text, not so large it hurts model attention
    const QUALITY  = 0.92   // high quality JPEG — preserves fine text strokes

    const img = new window.Image()
    const objectUrl = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(objectUrl)

      let { width, height } = img

      // Scale down only if larger than MAX_SIDE (never upscale)
      if (width > MAX_SIDE || height > MAX_SIDE) {
        const ratio = MAX_SIDE / Math.max(width, height)
        width  = Math.round(width  * ratio)
        height = Math.round(height * ratio)
      }

      const canvas = document.createElement("canvas")
      canvas.width  = width
      canvas.height = height

      const ctx = canvas.getContext("2d")!
      // White background so transparent PNGs don't become black on JPEG conversion
      ctx.fillStyle = "#ffffff"
      ctx.fillRect(0, 0, width, height)
      ctx.drawImage(img, 0, 0, width, height)

      // Use original type if PNG (lossless), else JPEG at high quality
      const outputType = file.type === "image/png" ? "image/png" : "image/jpeg"
      const dataUrl = canvas.toDataURL(outputType, QUALITY)
      resolve(dataUrl)
    }

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      // Fallback: send original without resizing
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload  = () => resolve(reader.result as string)
      reader.onerror = reject
    }

    img.src = objectUrl
  })
}



// Helper to render inline markdown (bold, italic, code)
const renderInlineMarkdown = (text: string): React.ReactNode => {
  if (!text) return null

  // Regex to match **bold**, *italic*, _italic_, `code`
  const regex = /(\*\*[^*]+\*\*|_[^_]+_|\*[^*]+\*|`[^`]+`)/g
  const parts = text.split(regex)

  if (parts.length === 1) {
    return text
  }

  return parts.map((part, index) => {
    if (!part) return null
    if (part.startsWith("**") && part.endsWith("**") && part.length >= 4) {
      return (
        <strong key={index} className="font-bold text-gray-900 dark:text-white">
          {renderInlineMarkdown(part.slice(2, -2))}
        </strong>
      )
    }
    if (
      (part.startsWith("*") && part.endsWith("*") && part.length >= 2) ||
      (part.startsWith("_") && part.endsWith("_") && part.length >= 2)
    ) {
      return <em key={index}>{part.slice(1, -1)}</em>
    }
    if (part.startsWith("`") && part.endsWith("`") && part.length >= 2) {
      return (
        <code key={index} className="bg-gray-200 dark:bg-gray-800 px-1 py-0.5 rounded text-xs font-mono">
          {part.slice(1, -1)}
        </code>
      )
    }
    return part
  })
}

// Full Markdown Component for AI responses
const FormatMarkdown = ({ content }: { content: string }) => {
  if (!content) return null

  const lines = content.split("\n")
  const elements: React.ReactNode[] = []
  let currentList: { type: "ul" | "ol"; items: React.ReactNode[] } | null = null

  const flushList = () => {
    if (currentList) {
      const ListTag = currentList.type === "ul" ? "ul" : "ol"
      const listClass =
        currentList.type === "ul"
          ? "list-disc space-y-1.5 my-2 pl-5"
          : "list-decimal space-y-1.5 my-2 pl-5"
      elements.push(
        <ListTag key={`list-${elements.length}`} className={listClass}>
          {currentList.items.map((item, idx) => (
            <li key={idx} className="text-gray-800 dark:text-gray-200 leading-relaxed">
              {item}
            </li>
          ))}
        </ListTag>
      )
      currentList = null
    }
  }

  lines.forEach((rawLine, idx) => {
    const line = rawLine.trim()

    // Empty line -> flush list
    if (!line) {
      flushList()
      return
    }

    // Horizontal rule
    if (line === "---" || line === "***" || line === "___") {
      flushList()
      elements.push(<hr key={`hr-${idx}`} className="my-4 border-gray-300 dark:border-gray-600" />)
      return
    }

    // Headings (#, ##, ###, ####)
    if (line.startsWith("# ")) {
      flushList()
      elements.push(
        <h1 key={`h1-${idx}`} className="text-xl font-bold text-gray-900 dark:text-white mt-4 mb-2">
          {renderInlineMarkdown(line.slice(2))}
        </h1>
      )
      return
    }
    if (line.startsWith("## ")) {
      flushList()
      elements.push(
        <h2 key={`h2-${idx}`} className="text-lg font-bold text-gray-900 dark:text-white mt-3 mb-2">
          {renderInlineMarkdown(line.slice(3))}
        </h2>
      )
      return
    }
    if (line.startsWith("### ")) {
      flushList()
      elements.push(
        <h3 key={`h3-${idx}`} className="text-base font-bold text-gray-900 dark:text-white mt-3 mb-1.5">
          {renderInlineMarkdown(line.slice(4))}
        </h3>
      )
      return
    }
    if (line.startsWith("#### ")) {
      flushList()
      elements.push(
        <h4 key={`h4-${idx}`} className="text-sm font-bold text-gray-900 dark:text-white mt-2 mb-1">
          {renderInlineMarkdown(line.slice(5))}
        </h4>
      )
      return
    }

    // Unordered List (- or *)
    if (line.startsWith("- ") || line.startsWith("* ")) {
      if (!currentList || currentList.type !== "ul") {
        flushList()
        currentList = { type: "ul", items: [] }
      }
      currentList.items.push(renderInlineMarkdown(line.slice(2)))
      return
    }

    // Ordered List (1. , 2. , etc.)
    const olMatch = line.match(/^(\d+)\.\s+(.+)$/)
    if (olMatch) {
      if (!currentList || currentList.type !== "ol") {
        flushList()
        currentList = { type: "ol", items: [] }
      }
      currentList.items.push(renderInlineMarkdown(olMatch[2]))
      return
    }

    // Standard paragraph or bold heading
    flushList()
    elements.push(
      <p key={`p-${idx}`} className="my-1.5 text-gray-800 dark:text-gray-200 leading-relaxed break-words">
        {renderInlineMarkdown(line)}
      </p>
    )
  })

  flushList()

  return <div className="space-y-1 text-sm">{elements}</div>
}

interface Message {
  role: "user" | "assistant"
  content: string
  timestamp: Date
  responseType?: "premium" | "standard"
  images?: { url: string; analyzed: boolean }[]
  tokensUsed?: number
}

interface Session {
  sessionId: string
  title: string
  messages?: Message[]
  messageCount?: number
  lastMessage?: string
  createdAt: Date
  updatedAt: Date
}

interface VideoMetadata {
  title: string
  thumbnail: string
  duration: string
  channel: string | { name: string; url: string; thumbnail: string }
  uploadDate: string
}

interface VideoQAProps {
  videoId: string
  videoUrl: string
  videoMetadata: VideoMetadata
}

const MAX_QUESTION_LENGTH = 500
const MAX_IMAGES = 2

export default function VideoQA({ videoId, videoUrl, videoMetadata }: VideoQAProps) {
  const [sessions, setSessions] = useState<Session[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [inputMessage, setInputMessage] = useState("")
  const [selectedImages, setSelectedImages] = useState<File[]>([])
  const [imagePreviewUrls, setImagePreviewUrls] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [usage, setUsage] = useState({
    premiumRemaining: 2,
    standardRemaining: 3,
    imagesRemaining: 2,
  })
  const [selectedQuestionType, setSelectedQuestionType] = useState<"premium" | "standard">("premium")
  const [hasTranscript, setHasTranscript] = useState<boolean>(true)
  const [transcriptReason, setTranscriptReason] = useState<string | null>(null)
  // Streaming state — content accumulates here while SSE is live
  const [streamingMessage, setStreamingMessage] = useState<string | null>(null)
  const [streamingType, setStreamingType] = useState<"premium" | "standard" | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Fetch usage on mount
  useEffect(() => {
    fetchUsage()
  }, [])

  // Load sessions when component mounts
  useEffect(() => {
    loadSessions()
  }, [videoId])

  // Load active session messages
  useEffect(() => {
    if (activeSessionId) {
      loadSessionMessages(activeSessionId)
    }
  }, [activeSessionId])

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Auto-select question type based on remaining questions and transcript availability
  useEffect(() => {
    if (!hasTranscript) {
      setSelectedQuestionType("premium")
    } else if (usage.premiumRemaining > 0) {
      setSelectedQuestionType("premium")
    } else if (usage.standardRemaining > 0) {
      setSelectedQuestionType("standard")
    }
  }, [usage, hasTranscript])

  const fetchUsage = async () => {
    try {
      const token = localStorage.getItem("token")
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'}/video-qa/usage`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setUsage({
          premiumRemaining: data.premiumRemaining,
          standardRemaining: data.standardRemaining,
          imagesRemaining: data.imagesRemaining,
        })
      }
    } catch (error) {
      console.error("Error fetching usage:", error)
    }
  }

  const loadSessions = async () => {
    setIsLoading(true)
    try {
      const token = localStorage.getItem("token")
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'}/video-qa/sessions/${videoId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      )

      if (response.ok) {
        const data = await response.json()
        setSessions(data.sessions || [])
        
        if (typeof data.hasTranscript === 'boolean') {
          setHasTranscript(data.hasTranscript)
          if (!data.hasTranscript) {
            setSelectedQuestionType("premium")
            setTranscriptReason(data.reason || "No captions or transcript available for this video.")
          } else {
            setTranscriptReason(null)
          }
        }

        // Auto-select first session if exists, or create one if none exist
        if (data.sessions && data.sessions.length > 0 && !activeSessionId) {
          setActiveSessionId(data.sessions[0].sessionId)
        } else if (!data.sessions || data.sessions.length === 0) {
          // No sessions exist, create one automatically
          await createNewSession()
        }
      }
    } catch (error) {
      console.error("Error loading sessions:", error)
      toast({
        title: "Error",
        description: "Failed to load chat sessions",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const loadSessionMessages = async (sessionId: string) => {
    try {
      const token = localStorage.getItem("token")
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'}/video-qa/session/${sessionId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      )

      if (response.ok) {
        const data = await response.json()
        setMessages(data.session.messages || [])
      }
    } catch (error) {
      console.error("Error loading session messages:", error)
    }
  }

  const createNewSession = async () => {
    try {
      const token = localStorage.getItem("token")
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'}/video-qa/session/create`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            videoId,
            videoUrl,
            videoMetadata,
          }),
        }
      )

      if (response.ok) {
        const data = await response.json()
        setActiveSessionId(data.sessionId)
        setMessages([])
        await loadSessions()
        return data.sessionId
      }
    } catch (error) {
      console.error("Error creating session:", error)
      toast({
        title: "Error",
        description: "Failed to create new chat session",
        variant: "destructive",
      })
    }
  }

  const deleteSession = async (sessionId: string) => {
    try {
      const token = localStorage.getItem("token")
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'}/video-qa/session/${sessionId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      )

      if (response.ok) {
        await loadSessions()
        if (activeSessionId === sessionId) {
          setActiveSessionId(null)
          setMessages([])
        }
      }
    } catch (error) {
      console.error("Error deleting session:", error)
      toast({
        title: "Error",
        description: "Failed to delete session",
        variant: "destructive",
      })
    }
  }

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    
    if (files.length + selectedImages.length > MAX_IMAGES) {
      toast({
        title: "Too many images",
        description: `You can only upload ${MAX_IMAGES} images per question`,
        variant: "destructive",
      })
      return
    }

    if (usage.imagesRemaining < files.length) {
      toast({
        title: "Daily image limit",
        description: `You only have ${usage.imagesRemaining} image uploads remaining today`,
        variant: "destructive",
      })
      return
    }

    const newImages = [...selectedImages, ...files].slice(0, MAX_IMAGES)
    setSelectedImages(newImages)

    // Create preview URLs
    const urls = newImages.map((file) => URL.createObjectURL(file))
    setImagePreviewUrls(urls)
  }

  const removeImage = (index: number) => {
    const newImages = selectedImages.filter((_, i) => i !== index)
    setSelectedImages(newImages)
    
    URL.revokeObjectURL(imagePreviewUrls[index])
    const newUrls = imagePreviewUrls.filter((_, i) => i !== index)
    setImagePreviewUrls(newUrls)
  }

  const sendMessage = async () => {
    if (!inputMessage.trim() && selectedImages.length === 0) return
    if (!activeSessionId) {
      toast({
        title: "No active session",
        description: "Please create a chat session first",
        variant: "destructive",
      })
      return
    }

    if (inputMessage.length > MAX_QUESTION_LENGTH) {
      toast({
        title: "Question too long",
        description: `Please keep your question under ${MAX_QUESTION_LENGTH} characters`,
        variant: "destructive",
      })
      return
    }

    if (usage.premiumRemaining === 0 && usage.standardRemaining === 0) {
      toast({
        title: "Daily limit reached",
        description: "You've used all your daily questions. Upgrade to premium for unlimited access.",
        variant: "destructive",
      })
      return
    }

    const capturedInput = inputMessage
    const capturedImages = [...selectedImages]

    setIsSending(true)
    setStreamingMessage("")
    setStreamingType(selectedQuestionType)

    // Immediately append user bubble
    const imageUrls = await Promise.all(capturedImages.map((file) => fileToBase64(file)))
    const userMessage: Message = {
      role: "user",
      content: capturedInput,
      timestamp: new Date(),
      images: imageUrls.map((url) => ({ url, analyzed: true })),
    }
    setMessages((prev) => [...prev, userMessage])

    // Clear input immediately so user can see progress
    setInputMessage("")
    setSelectedImages([])
    setImagePreviewUrls([])

    const token = localStorage.getItem("token")
    const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api"

    try {
      const response = await fetch(`${API_BASE}/video-qa/ask/stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          videoId,
          videoUrl,
          sessionId: activeSessionId,
          question: capturedInput,
          questionType: selectedQuestionType,
          images: imageUrls,
        }),
      })

      if (!response.ok || !response.body) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || errorData.error || "Failed to send message")
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ""
      let sseBuffer = ""
      let finalType: "premium" | "standard" = selectedQuestionType
      let finalUsage = null
      let fallbackUsed = false

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        sseBuffer += decoder.decode(value, { stream: true })
        const lines = sseBuffer.split("\n")
        sseBuffer = lines.pop() ?? ""

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue
          const raw = line.slice(6).trim()
          if (!raw) continue

          try {
            const evt = JSON.parse(raw)
            // Identify by the event line above this data line – use a simpler approach:
            // Backend sends `event: chunk\ndata: {text}` — but fetch ReadableStream gives us raw bytes
            // We parse SSE by looking at the previous event: line
            // Handle based on presence of keys
            if (typeof evt.text === "string") {
              // chunk event
              accumulated += evt.text
              setStreamingMessage(accumulated)
            } else if (evt.responseType) {
              // done event
              finalType = evt.responseType as "premium" | "standard"
              finalUsage = evt.usage
              fallbackUsed = evt.fallbackUsed
            } else if (evt.message) {
              // error event
              throw new Error(evt.message)
            }
          } catch (parseErr: any) {
            if (parseErr.message && !parseErr.message.includes("JSON")) throw parseErr
          }
        }
      }

      // Commit streaming bubble to real messages
      const assistantMessage: Message = {
        role: "assistant",
        content: accumulated,
        timestamp: new Date(),
        responseType: finalType,
      }
      setMessages((prev) => [...prev, assistantMessage])
      setStreamingMessage(null)
      setStreamingType(null)

      if (fallbackUsed) {
        toast({
          title: "Note",
          description: "Premium service temporarily unavailable. Used standard response instead.",
        })
      }

      if (finalUsage) setUsage(finalUsage)

      // Reload sessions to update titles in sidebar
      await loadSessions()
    } catch (error: any) {
      console.error("Error sending message:", error)
      setStreamingMessage(null)
      setStreamingType(null)
      // Remove the optimistic user bubble on error
      setMessages((prev) => prev.slice(0, -1))
      setInputMessage(capturedInput)
      setSelectedImages(capturedImages)
      setImagePreviewUrls(capturedImages.map((f) => URL.createObjectURL(f)))

      const displayMessage = error.message?.includes("limit")
        ? error.message
        : error.message?.includes("Validation")
        ? "Please check your input and try again."
        : error.message?.includes("transcript")
        ? error.message
        : "We're having trouble processing your question right now. Please try again."

      toast({
        title: "Error",
        description: displayMessage,
        variant: "destructive",
      })
    } finally {
      setIsSending(false)
    }
  }

  const channelName = typeof videoMetadata.channel === "object" ? videoMetadata.channel.name : videoMetadata.channel

  const isOutOfQuestions = usage.premiumRemaining === 0 && usage.standardRemaining === 0

  return (
    <div className="w-full">
      <div className="grid lg:grid-cols-4 gap-6">
      {/* Left Sidebar: Video Info */}
      <div className="lg:col-span-1 space-y-4">
        <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-orange-200/50 dark:border-gray-700/50">
          <CardContent className="p-4">
            <Image
              src={videoMetadata.thumbnail || "/placeholder.svg"}
              alt="Video thumbnail"
              width={280}
              height={157}
              className="rounded-lg shadow-md w-full"
            />
            <h3 className="font-semibold text-sm mt-3 text-gray-900 dark:text-white line-clamp-2">
              {videoMetadata.title}
            </h3>
            <div className="text-xs text-gray-600 dark:text-gray-400 mt-2 space-y-1">
              <div>{channelName}</div>
              <div>{videoMetadata.duration}</div>
              <div>{videoMetadata.uploadDate}</div>
            </div>
          </CardContent>
        </Card>

        {/* Chat Sessions */}
        <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-orange-200/50 dark:border-gray-700/50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm text-gray-900 dark:text-white">Chat History</CardTitle>
              <Button size="sm" variant="ghost" onClick={createNewSession} className="h-7 w-7 p-0">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-48">
              {sessions.length === 0 ? (
                <div className="p-4 text-center text-sm text-gray-500">No chat sessions yet</div>
              ) : (
                <div className="space-y-1 px-3 pb-3">
                  {sessions.map((session) => (
                    <div
                      key={session.sessionId}
                      className={`p-2 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors group ${
                        activeSessionId === session.sessionId ? "bg-orange-50 dark:bg-orange-900/20" : ""
                      }`}
                      onClick={() => setActiveSessionId(session.sessionId)}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex-1 min-w-0 overflow-hidden">
                          <div className="text-xs font-medium text-gray-900 dark:text-white break-words line-clamp-2">
                            {session.title}
                          </div>
                          <div className="text-xs text-gray-500 break-words line-clamp-1">{session.lastMessage || "New chat"}</div>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 flex-shrink-0"
                          onClick={(e) => {
                            e.stopPropagation()
                            deleteSession(session.sessionId)
                          }}
                        >
                          <Trash2 className="w-3 h-3 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Right: Chat Panel */}
      <div className="lg:col-span-3 min-h-0 flex flex-col">
        <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-orange-200/50 dark:border-gray-700/50 flex flex-col h-[calc(100vh-8rem)] min-h-[600px] overflow-hidden">
          <CardHeader className="pb-3 flex-shrink-0 border-b border-gray-100 dark:border-gray-700/50">
            <div className="flex items-center justify-between">
              <CardTitle className="text-gray-900 dark:text-white text-lg">Ask Questions About This Video</CardTitle>
              <div className="flex items-center space-x-2 text-xs">
                <Badge variant="outline" className="bg-purple-50 border-purple-200 text-purple-700 dark:bg-purple-900/30 dark:border-purple-800 dark:text-purple-300">
                  <Sparkles className="w-3 h-3 mr-1" />
                  {usage.premiumRemaining} Premium
                </Badge>
                <Badge variant="outline" className="bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-300">
                  <Zap className="w-3 h-3 mr-1" />
                  {usage.standardRemaining} Standard
                </Badge>
              </div>
            </div>
          </CardHeader>

          <CardContent className="flex-1 flex flex-col p-0 min-h-0 overflow-hidden">
            {/* Messages Scroll Area */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0">
              {!activeSessionId ? (
                <div className="flex items-center justify-center h-full text-gray-500">
                  <div className="text-center">
                    <p className="mb-2">No active chat session</p>
                    <Button onClick={createNewSession} variant="outline">
                      <Plus className="w-4 h-4 mr-2" />
                      Create New Chat
                    </Button>
                  </div>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex items-center justify-center h-full text-gray-500">
                  <div className="text-center max-w-md">
                    <Sparkles className="w-12 h-12 mx-auto mb-4 text-orange-500" />
                    <p className="text-lg font-medium mb-2">Start asking questions!</p>
                    <p className="text-sm">
                      Ask anything about this video. Get {usage.premiumRemaining} premium responses (powered by Gemini)
                      and {usage.standardRemaining} standard responses per day.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  {messages.map((message, index) => (
                    <div
                      key={index}
                      className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[90%] md:max-w-[85%] rounded-xl p-4 shadow-sm ${
                          message.role === "user"
                            ? "bg-gradient-to-r from-orange-500 to-amber-600 text-white"
                            : "bg-gray-100 dark:bg-gray-700/80 text-gray-900 dark:text-white border border-gray-200/50 dark:border-gray-600/50"
                        }`}
                      >
                        {message.images && message.images.length > 0 && (
                          <div className="flex gap-2 mb-3 flex-wrap">
                            {message.images.map((img, imgIdx) => (
                              <Image
                                key={imgIdx}
                                src={img.url}
                                alt="Uploaded"
                                width={120}
                                height={120}
                                className="rounded-lg object-cover border border-white/20"
                              />
                            ))}
                          </div>
                        )}
                        <div className="text-sm break-words overflow-hidden">
                          {message.role === "assistant" ? (
                            <FormatMarkdown content={message.content} />
                          ) : (
                            <div className="whitespace-pre-wrap">{message.content}</div>
                          )}
                        </div>
                        <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-black/5 dark:border-white/10 text-xs opacity-75 flex-wrap gap-2">
                          <span>{new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          {message.responseType && (
                            <Badge
                              variant="outline"
                              className={`text-[10px] uppercase tracking-wider font-semibold ${
                                message.responseType === "premium"
                                  ? "bg-purple-100 border-purple-300 text-purple-700 dark:bg-purple-950 dark:border-purple-800 dark:text-purple-300"
                                  : "bg-blue-100 border-blue-300 text-blue-700 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-300"
                              }`}
                            >
                              {message.responseType}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Live streaming bubble */}
                  {streamingMessage !== null && (
                    <div className="flex justify-start">
                      <div className="max-w-[90%] md:max-w-[85%] rounded-xl p-4 shadow-sm bg-gray-100 dark:bg-gray-700/80 text-gray-900 dark:text-white border border-gray-200/50 dark:border-gray-600/50">
                        <div className="text-sm break-words overflow-hidden">
                          {streamingMessage.length > 0 ? (
                            <>
                              <FormatMarkdown content={streamingMessage} />
                              <span className="inline-block w-0.5 h-4 bg-orange-500 animate-pulse ml-0.5 align-middle" />
                            </>
                          ) : (
                            <div className="flex items-center gap-1.5 text-gray-400 dark:text-gray-500 text-xs">
                              <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-bounce [animation-delay:0ms]" />
                              <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-bounce [animation-delay:150ms]" />
                              <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-bounce [animation-delay:300ms]" />
                              <span className="ml-1">Thinking…</span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-black/5 dark:border-white/10 text-xs opacity-75">
                          <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          <Badge
                            variant="outline"
                            className={`text-[10px] uppercase tracking-wider font-semibold ${
                              streamingType === "premium"
                                ? "bg-purple-100 border-purple-300 text-purple-700 dark:bg-purple-950 dark:border-purple-800 dark:text-purple-300"
                                : "bg-blue-100 border-blue-300 text-blue-700 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-300"
                            }`}
                          >
                            {streamingType}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {/* Input Area */}
            <div className="p-4 border-t border-gray-200 dark:border-gray-700">
              {isOutOfQuestions ? (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-center">
                  <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
                  <p className="text-sm font-medium text-red-700 dark:text-red-300 mb-2">
                    You are out of free credits for today
                  </p>
                  <Link href="/subscription">
                    <Button size="sm" className="bg-gradient-to-r from-orange-500 to-red-600 text-white">
                      Upgrade to Premium
                    </Button>
                  </Link>
                </div>
              ) : (
                <>
                  {/* Image Previews */}
                  {imagePreviewUrls.length > 0 && (
                    <div className="flex gap-2 mb-2">
                      {imagePreviewUrls.map((url, index) => (
                        <div key={index} className="relative">
                          <Image src={url} alt="Preview" width={80} height={80} className="rounded" />
                          <Button
                            size="sm"
                            variant="destructive"
                            className="absolute -top-2 -right-2 h-5 w-5 p-0 rounded-full"
                            onClick={() => removeImage(index)}
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex items-end space-x-2">
                    <div className="flex-1">
                      <textarea
                        placeholder="Ask a question about this video..."
                        value={inputMessage}
                        onChange={(e) => setInputMessage(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault()
                            sendMessage()
                          }
                        }}
                        maxLength={MAX_QUESTION_LENGTH}
                        disabled={isSending || isOutOfQuestions}
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 dark:bg-gray-800 dark:text-white resize-none"
                      />
                      <div className="flex items-center justify-between mt-1 text-xs text-gray-500">
                        <span>
                          {inputMessage.length}/{MAX_QUESTION_LENGTH}
                        </span>
                        <span className="text-[10px]">
                          {usage.imagesRemaining > 0 && `${usage.imagesRemaining} images remaining today`}
                        </span>
                      </div>
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={handleImageSelect}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isSending || usage.imagesRemaining === 0 || selectedImages.length >= MAX_IMAGES}
                    >
                      <ImageIcon className="w-4 h-4" />
                    </Button>
                    <Button
                      onClick={sendMessage}
                      disabled={isSending || (!inputMessage.trim() && selectedImages.length === 0)}
                      className="bg-gradient-to-r from-orange-500 to-red-600 text-white"
                    >
                      {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </Button>
                  </div>

                  {/* Missing Transcript Notice */}
                  {!hasTranscript && (
                    <div className="mb-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                      <div>
                        <span className="font-semibold">Standard Mode Unavailable:</span> This video has no captions/transcript available. Standard mode (Mistral) requires transcript context. Please use <strong>Premium Mode (Gemini)</strong> instead.
                      </div>
                    </div>
                  )}

                  {/* Question Type Selector */}
                  <div className="flex items-center justify-center space-x-3 mt-3">
                    <Button
                      size="sm"
                      variant={selectedQuestionType === "premium" ? "default" : "outline"}
                      onClick={() => setSelectedQuestionType("premium")}
                      disabled={usage.premiumRemaining === 0}
                      className={
                        selectedQuestionType === "premium"
                          ? "bg-gradient-to-r from-purple-500 to-pink-600 text-white"
                          : ""
                      }
                    >
                      <Sparkles className="w-3 h-3 mr-1" />
                      Premium ({usage.premiumRemaining})
                    </Button>
                    <Button
                      size="sm"
                      variant={selectedQuestionType === "standard" ? "default" : "outline"}
                      onClick={() => {
                        if (!hasTranscript) {
                          toast({
                            title: "Standard Mode Unavailable",
                            description: "This video has no captions or transcript. Standard mode requires transcript context. Please use Premium mode.",
                            variant: "destructive",
                          })
                          return
                        }
                        setSelectedQuestionType("standard")
                      }}
                      disabled={usage.standardRemaining === 0 || !hasTranscript}
                      className={
                        selectedQuestionType === "standard"
                          ? "bg-gradient-to-r from-blue-500 to-cyan-600 text-white"
                          : ""
                      }
                    >
                      <Zap className="w-3 h-3 mr-1" />
                      Standard ({usage.standardRemaining})
                    </Button>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      </div>
    </div>
  )
}
