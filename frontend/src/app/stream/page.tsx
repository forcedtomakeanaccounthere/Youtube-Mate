"use client"

import { useState, useRef, useEffect, useCallback, Suspense } from "react"
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation"
import {
  Play,
  Pause,
  Users,
  MessageCircle,
  Send,
  Smile,
  Volume2,
  VolumeX,
  Copy,
  CheckCircle,
  Plus,
  Pin,
  Video,
  VideoOff,
  Mic,
  MicOff,
  Monitor,
  LogOut,
  Settings,
  Link,
  Mail,
  X,
  Reply,
  Edit3,
  Crown,
  ListVideo,
  Trash2,
  SkipForward,
  PhoneOff,
  Repeat,
  RotateCcw,
  RotateCw,
  Sparkles,
  Zap,
  Heart,
  MessageSquare,
  Shield,
  Loader2,
  ChevronUp,
  ChevronDown,
  GripVertical,
  Maximize2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import Navbar from "@/components/landing/Navbar"
import AuthGuard from "@/components/AuthGuard"
import featuresData from "@/data/features.json"
import { Feature } from "@/types/features"
import { useDarkMode } from "@/hooks/use-dark-mode"
import { toast } from "@/hooks/use-toast"
import { io, Socket } from "socket.io-client"

const features: Feature[] = featuresData
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api"
const SOCKET_BASE = API_BASE.replace(/\/api\/?$/, "")

// Emoji sets for reactions — 5 main always visible, plus expanded set
const QUICK_EMOJIS = ["👍", "❤️", "😂", "😮", "🔥"]
const FULL_EMOJIS = ["👍", "❤️", "😂", "😮", "🔥", "👏", "🎉", "💯", "👀", "🤯", "💀", "😍", "😢", "🥳", "💪"]

interface ChatMessage {
  id: string
  userId: string
  userName: string
  text: string
  timestamp: Date
  replyTo?: { id: string; userName: string; text: string }
}

interface Participant {
  id: string
  name: string
  isHost: boolean
  isMuted: boolean
  isVideoOn: boolean
  isPinned: boolean
  isSpeaking: boolean
  stream?: MediaStream | null
}

interface FloatingEmoji {
  id: string
  emoji: string
  x: number
  delay: number
  drift: number
  duration: number
}

interface Room {
  id: string
  name: string
  videoUrl: string
  videoId: string
  joinPolicy: "open" | "approval"
  participants: Participant[]
  controlsLocked?: boolean
  loopEnabled?: boolean
}

interface QueueItem {
  id: string
  videoId: string
  title: string
  thumbnail?: string
  duration?: string
  url: string
  addedBy: string
}

interface JoinRequest {
  id: string
  name: string
  requestedAt: string
  requesterId?: string
  decision?: "pending" | "approved" | "rejected"
}

interface RoomSocketPayload {
  id: string
  name: string
  slug?: string
  videoUrl: string
  videoId: string
  joinPolicy: "open" | "approval"
  status: "waiting" | "live" | "ended"
  queue: QueueItem[]
  currentQueueIndex: number
  controlsLocked?: boolean
  loopEnabled?: boolean
  messages?: Array<{
    id: string
    userId: string
    userName: string
    text: string
    timestamp: string | Date
    replyTo?: { id: string; userName: string; text: string }
  }>
  playback?: {
    isPlaying: boolean
    currentTime: number
    playbackRate: number
    updatedAt?: string | Date
    updatedBy?: string
  }
}

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
}

function extractVideoId(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/(?:shorts\/|[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/)
  return match ? match[1] : null
}

function generateRoomCode(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz"
  const randomPart = (length: number) => Array.from({ length }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join("")
  return `${randomPart(3)}-${randomPart(4)}-${randomPart(3)}`
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
}

function roomStorageKey(roomId: string): string {
  return `stream-room-${roomId}`
}

function getOrCreateHostId(): string {
  if (typeof window === "undefined") {
    return `host-${Date.now()}-${Math.floor(Math.random() * 1000)}`
  }

  const storageKey = "stream-host-id"
  const existing = localStorage.getItem(storageKey)
  if (existing) return existing

  const created = `host-${Date.now()}-${Math.floor(Math.random() * 100000)}`
  localStorage.setItem(storageKey, created)
  return created
}

function getOrCreateGuestId(): string {
  if (typeof window === "undefined") {
    return `guest-${Date.now()}-${Math.floor(Math.random() * 1000)}`
  }

  const storageKey = "stream-guest-id"
  const existing = localStorage.getItem(storageKey)
  if (existing) return existing

  const created = `guest-${Date.now()}-${Math.floor(Math.random() * 100000)}`
  localStorage.setItem(storageKey, created)
  return created
}

function approvalStorageKey(roomId: string): string {
  return `stream-approval-${roomId}`
}

export default function StreamPage() {
  const pathname = usePathname()

  return (
    <AuthGuard
      redirectTo={`/login?redirect=${encodeURIComponent(pathname || "/stream")}`}
      title="Login Required"
      message="You need to be logged in to use Group Streaming. Please log in to create or join a room."
    >
      <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-orange-500" /></div>}>
        <StreamPageContent />
      </Suspense>
    </AuthGuard>
  )
}

export function StreamPageContent() {
  const router = useRouter()
  const params = useParams<{ streamName?: string; streamId?: string }>()
  const searchParams = useSearchParams()
  const routeStreamId = typeof params?.streamId === "string" ? params.streamId.toLowerCase() : ""
  const routeStreamName = typeof params?.streamName === "string" ? params.streamName.replace(/-/g, " ") : ""
  const socketRef = useRef<Socket | null>(null)
  const mySocketIdRef = useRef<string>("")
  const hostIdentityRef = useRef<string>("")
  const guestIdentityRef = useRef<string>("")
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map())
  const remoteStreamsRef = useRef<Map<string, MediaStream>>(new Map())
  const suppressPlayerSyncRef = useRef(false)
  const latestPlayerTimeRef = useRef(0)
  const lastPlaybackEmitRef = useRef(0)
  const playbackStateRef = useRef({ isPlaying: false, currentTime: 0, playbackRate: 1 })
  const pendingPlaybackRef = useRef<{ isPlaying: boolean; currentTime: number; playbackRate: number } | null>(null)
  const playerReadyRef = useRef(false)
  const joinedRoomRef = useRef(false)
  const rejoinPendingRef = useRef(false)
  const roomCodeRef = useRef("")
  const userNameRef = useRef("")
  const isHostRef = useRef(false)
  const joinRequestRef = useRef<string | null>(null)
  const currentViewRef = useRef<"lobby" | "room">("lobby")
  const scrubValueRef = useRef(0)

  // Navbar state
  const [activeFeature, setActiveFeature] = useState<Feature | null>(null)
  const [showNavbar, setShowNavbar] = useState(true)
  const { darkMode, toggleDarkMode, mounted } = useDarkMode()

  // Room state
  const [currentView, setCurrentView] = useState<"lobby" | "room">("lobby")
  const [room, setRoom] = useState<Room | null>(null)
  const [roomStatus, setRoomStatus] = useState<"waiting" | "live" | "ended">("waiting")
  const [roomCode, setRoomCode] = useState("")
  const [roomName, setRoomName] = useState("")
  const [videoUrl, setVideoUrl] = useState("")
  const [userName, setUserName] = useState("")
  const [isHost, setIsHost] = useState(false)
  const [joinPolicy, setJoinPolicy] = useState<"open" | "approval">("open")
  const [pendingJoinRequests, setPendingJoinRequests] = useState<JoinRequest[]>([])
  const [showJoinRequestsDialog, setShowJoinRequestsDialog] = useState(false)
  const [myJoinRequestId, setMyJoinRequestId] = useState<string | null>(null)
  const [isAwaitingApproval, setIsAwaitingApproval] = useState(false)
  const [mySocketId, setMySocketId] = useState("")

  // Player state
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [controlsLocked, setControlsLocked] = useState(false)
  const [loopEnabled, setLoopEnabled] = useState(false)
  const [playerCurrentTime, setPlayerCurrentTime] = useState(0)
  const [playerDuration, setPlayerDuration] = useState(0)
  const [isPlayerReady, setIsPlayerReady] = useState(false)
  const [isScrubbing, setIsScrubbing] = useState(false)
  const playerRef = useRef<HTMLIFrameElement>(null)
  const videoStageRef = useRef<HTMLDivElement>(null)
  const pinnedStageRef = useRef<HTMLDivElement>(null)

  // Participant state
  const [participants, setParticipants] = useState<Participant[]>([])
  const [myMic, setMyMic] = useState(false)
  const [myVideo, setMyVideo] = useState(false)
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState("")
  const [showChat, setShowChat] = useState(true)
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)

  // Emoji reactions
  const [floatingEmojis, setFloatingEmojis] = useState<FloatingEmoji[]>([])
  const [showFullEmojiPicker, setShowFullEmojiPicker] = useState(false)

  // Video Queue
  const [videoQueue, setVideoQueue] = useState<QueueItem[]>([])
  const [currentQueueIndex, setCurrentQueueIndex] = useState(0)
  const [newQueueUrl, setNewQueueUrl] = useState("")
  const [playlistUrl, setPlaylistUrl] = useState("")
  const [isFetchingVideoInfo, setIsFetchingVideoInfo] = useState(false)
  const [isImportingPlaylist, setIsImportingPlaylist] = useState(false)
  const [showQueuePanel, setShowQueuePanel] = useState(false)

  // Dialogs
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showJoinDialog, setShowJoinDialog] = useState(false)
  const [showInviteDialog, setShowInviteDialog] = useState(false)
  const [showNameDialog, setShowNameDialog] = useState(false)
  const [inviteEmail, setInviteEmail] = useState("")
  const [newDisplayName, setNewDisplayName] = useState("")
  const [copiedLink, setCopiedLink] = useState(false)
  const [isSendingInvite, setIsSendingInvite] = useState(false)
  const [showSettingsDialog, setShowSettingsDialog] = useState(false)
  const [showEndMeetingDialog, setShowEndMeetingDialog] = useState(false)
  const [rejoinOffer, setRejoinOffer] = useState<{ roomId: string; roomName: string; expiresAt: number } | null>(null)
  const [rejoinRemainingMs, setRejoinRemainingMs] = useState(0)

  // Editing room name
  const [editingRoomName, setEditingRoomName] = useState(false)
  const [editRoomNameValue, setEditRoomNameValue] = useState("")

  useEffect(() => {
    hostIdentityRef.current = getOrCreateHostId()
    guestIdentityRef.current = getOrCreateGuestId()
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    const storedName = localStorage.getItem("stream-display-name")
    if (storedName && !userName.trim()) {
      setUserName(storedName)
    }
  }, [userName])

  useEffect(() => {
    if (typeof window === "undefined") return
    if (userName.trim()) {
      localStorage.setItem("stream-display-name", userName.trim())
    }
  }, [userName])

  useEffect(() => {
    roomCodeRef.current = roomCode
  }, [roomCode])

  useEffect(() => {
    userNameRef.current = userName
  }, [userName])

  useEffect(() => {
    isHostRef.current = isHost
  }, [isHost])

  useEffect(() => {
    joinRequestRef.current = myJoinRequestId
  }, [myJoinRequestId])

  useEffect(() => {
    currentViewRef.current = currentView
  }, [currentView])

  useEffect(() => {
    if (!rejoinOffer) return
    const tick = () => {
      const remaining = rejoinOffer.expiresAt - Date.now()
      if (remaining <= 0) {
        setRejoinOffer(null)
        setRejoinRemainingMs(0)
        return
      }
      setRejoinRemainingMs(remaining)
    }
    tick()
    const interval = window.setInterval(tick, 100)
    return () => window.clearInterval(interval)
  }, [rejoinOffer])

  const getStreamPath = useCallback((name: string, id: string) => {
    return `/stream/${slugify(name || "stream-room")}/${id}`
  }, [])

  const getInviteLink = useCallback(() => {
    if (typeof window === "undefined") return ""
    const id = room?.id || roomCode
    const name = room?.name || roomName || "stream-room"
    if (!id) return ""
    const query = (room?.joinPolicy || joinPolicy) === "approval" ? "?approval=1&join=1" : "?join=1"
    return `${window.location.origin}${getStreamPath(name, id)}${query}`
  }, [room, roomCode, roomName, joinPolicy, getStreamPath])

  const fetchVideoInfo = useCallback(async (url: string) => {
    const response = await fetch(`${API_BASE}/youtube/video/info?url=${encodeURIComponent(url)}`)
    if (!response.ok) {
      throw new Error("Failed to fetch video details")
    }
    return await response.json()
  }, [])

  const fetchRoomRecord = useCallback(async (targetRoomId: string) => {
    const response = await fetch(`${API_BASE}/stream/rooms/${targetRoomId}`)
    const result = await response.json()
    if (!response.ok) {
      throw new Error(result.error || "Failed to fetch room")
    }
    return result.room
  }, [])

  const createRoomRecord = useCallback(async (roomData: Room, queueData: QueueItem[], queueIndex: number) => {
    const response = await fetch(`${API_BASE}/stream/rooms`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roomId: roomData.id,
        name: roomData.name,
        videoUrl: roomData.videoUrl,
        videoId: roomData.videoId,
        joinPolicy: roomData.joinPolicy,
        queue: queueData,
        currentQueueIndex: queueIndex,
        hostId: hostIdentityRef.current,
        hostName: userName.trim() || "Host",
      }),
    })

    const result = await response.json()
    if (!response.ok) {
      throw new Error(result.error || "Failed to create room")
    }
    return result.room
  }, [])

  const syncRoomRecord = useCallback(async (roomData: Room, queueData: QueueItem[], queueIndex: number) => {
    const response = await fetch(`${API_BASE}/stream/rooms/${roomData.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: roomData.name,
        videoUrl: roomData.videoUrl,
        videoId: roomData.videoId,
        joinPolicy: roomData.joinPolicy,
        queue: queueData,
        currentQueueIndex: queueIndex,
      }),
    })

    const result = await response.json()
    if (!response.ok) {
      throw new Error(result.error || "Failed to sync room")
    }
    return result.room
  }, [])

  const createJoinRequest = useCallback(async (targetRoomId: string, name: string) => {
    const response = await fetch(`${API_BASE}/stream/join-requests`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roomId: targetRoomId,
        name,
        requesterId: guestIdentityRef.current,
      }),
    })

    const result = await response.json()
    if (!response.ok) {
      throw new Error(result.error || "Failed to create join request")
    }

    return { request: result.request as JoinRequest, decision: result.decision as "pending" | "approved" | "rejected" }
  }, [])

  const fetchPendingJoinRequests = useCallback(async (targetRoomId: string) => {
    const response = await fetch(`${API_BASE}/stream/join-requests/${targetRoomId}`)
    const result = await response.json()
    if (!response.ok) {
      throw new Error(result.error || "Failed to fetch join requests")
    }
    return (result.requests || []) as JoinRequest[]
  }, [])

  const fetchJoinDecision = useCallback(async (targetRoomId: string, requestId: string) => {
    const response = await fetch(`${API_BASE}/stream/join-requests/${targetRoomId}/${requestId}/decision`)
    const result = await response.json()
    if (!response.ok) {
      throw new Error(result.error || "Failed to fetch join decision")
    }
    return (result.decision || "pending") as "pending" | "approved" | "rejected"
  }, [])

  const submitJoinDecision = useCallback(async (targetRoomId: string, requestId: string, decision: "approved" | "rejected") => {
    const response = await fetch(`${API_BASE}/stream/join-requests/${targetRoomId}/${requestId}/decision`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision }),
    })
    const result = await response.json()
    if (!response.ok) {
      throw new Error(result.error || "Failed to update join decision")
    }
  }, [])

  const hydrateRoomFromStorage = useCallback((id: string) => {
    if (typeof window === "undefined") return null
    try {
      const raw = localStorage.getItem(roomStorageKey(id))
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  }, [])

  const persistRoomToStorage = useCallback((roomData: Room, queueData: QueueItem[], queueIndex: number) => {
    if (typeof window === "undefined") return
    localStorage.setItem(
      roomStorageKey(roomData.id),
      JSON.stringify({
        id: roomData.id,
        name: roomData.name,
        videoUrl: roomData.videoUrl,
        videoId: roomData.videoId,
        joinPolicy: roomData.joinPolicy,
        queue: queueData,
        currentQueueIndex: queueIndex,
      }),
    )
  }, [])

  const readApprovalFromStorage = useCallback((targetRoomId: string) => {
    if (typeof window === "undefined") return null
    try {
      const raw = localStorage.getItem(approvalStorageKey(targetRoomId))
      if (!raw) return null
      const parsed = JSON.parse(raw)
      if (!parsed?.requestId) return null
      return parsed as { requestId: string; decision: "pending" | "approved" | "rejected" }
    } catch {
      return null
    }
  }, [])

  const writeApprovalToStorage = useCallback((targetRoomId: string, requestId: string, decision: "pending" | "approved" | "rejected") => {
    if (typeof window === "undefined") return
    localStorage.setItem(approvalStorageKey(targetRoomId), JSON.stringify({ requestId, decision }))
  }, [])

  const sendPlayerCommand = useCallback((func: string, args: (string | number | boolean)[] = []) => {
    const targetWindow = playerRef.current?.contentWindow
    if (!targetWindow) return
    targetWindow.postMessage(JSON.stringify({ event: "command", func, args }), "*")
  }, [])

  const mergeParticipants = useCallback((incoming: Participant[]) => {
    setParticipants(() =>
      incoming.map((participant) => {
        const stream = participant.id === mySocketIdRef.current
          ? localStream
          : remoteStreamsRef.current.get(participant.id) || null
        return {
          ...participant,
          stream,
          isPinned: false,
        }
      }),
    )
  }, [localStream])

  const applyPlaybackSync = useCallback((payload: { isPlaying: boolean; currentTime: number; playbackRate?: number }) => {
    const playbackRate = Number(payload.playbackRate || 1) || 1
    const nextTime = Math.max(0, Number(payload.currentTime || 0))
    const nextState = { isPlaying: payload.isPlaying, currentTime: nextTime, playbackRate }

    playbackStateRef.current = nextState
    latestPlayerTimeRef.current = nextTime
    setIsPlaying(payload.isPlaying)
    if (!isScrubbing) {
      setPlayerCurrentTime(nextTime)
    }

    if (!playerReadyRef.current) {
      pendingPlaybackRef.current = nextState
      return
    }

    suppressPlayerSyncRef.current = true
    sendPlayerCommand("setPlaybackRate", [playbackRate])
    sendPlayerCommand("seekTo", [nextTime, true])
    sendPlayerCommand(payload.isPlaying ? "playVideo" : "pauseVideo")

    window.setTimeout(() => {
      suppressPlayerSyncRef.current = false
    }, 900)
  }, [sendPlayerCommand, isScrubbing])

  const buildLocalRoomFromSocket = useCallback((roomPayload: RoomSocketPayload): Room => {
    return {
      id: roomPayload.id,
      name: roomPayload.name,
      videoUrl: roomPayload.videoUrl,
      videoId: roomPayload.videoId,
      joinPolicy: roomPayload.joinPolicy,
      participants: [],
      controlsLocked: Boolean(roomPayload.controlsLocked),
      loopEnabled: Boolean(roomPayload.loopEnabled),
    }
  }, [])

  const emitQueueUpdate = useCallback((queue: QueueItem[], queueIndex: number) => {
    if (!socketRef.current) return
    socketRef.current.emit("stream:queue:update", {
      queue,
      currentQueueIndex: queueIndex,
    })
  }, [])

  const startPlaybackAtIndex = useCallback((nextIndex: number) => {
    const nextItem = videoQueue[nextIndex]
    if (!nextItem) return

    setCurrentQueueIndex(nextIndex)
    setRoom((prev) => (prev ? { ...prev, videoId: nextItem.videoId, videoUrl: nextItem.url } : prev))
    emitQueueUpdate([...videoQueue], nextIndex)

    latestPlayerTimeRef.current = 0
    playbackStateRef.current = { isPlaying: true, currentTime: 0, playbackRate: 1 }
    setIsPlaying(true)
    setPlayerCurrentTime(0)

    sendPlayerCommand("loadVideoById", [nextItem.videoId, 0])
    sendPlayerCommand("playVideo")

    socketRef.current?.emit("stream:playback:update", {
      action: "play",
      isPlaying: true,
      currentTime: 0,
      playbackRate: 1,
    })
  }, [emitQueueUpdate, sendPlayerCommand, videoQueue])

  const closeAllPeerConnections = useCallback(() => {
    peerConnectionsRef.current.forEach((connection) => {
      connection.onicecandidate = null
      connection.ontrack = null
      connection.close()
    })
    peerConnectionsRef.current.clear()
    remoteStreamsRef.current.clear()
  }, [])

  const createPeerConnection = useCallback((remoteId: string, shouldOffer: boolean) => {
    if (!socketRef.current) return null
    if (peerConnectionsRef.current.has(remoteId)) {
      return peerConnectionsRef.current.get(remoteId) || null
    }

    const connection = new RTCPeerConnection(ICE_SERVERS)
    peerConnectionsRef.current.set(remoteId, connection)

    connection.onicecandidate = (event) => {
      if (!event.candidate || !socketRef.current) return
      socketRef.current.emit("stream:webrtc:ice-candidate", {
        to: remoteId,
        candidate: event.candidate,
      })
    }

    connection.ontrack = (event) => {
      const [stream] = event.streams
      if (!stream) return
      remoteStreamsRef.current.set(remoteId, stream)
      setParticipants((prev) => prev.map((p) => (p.id === remoteId ? { ...p, stream } : p)))
    }

    if (localStream) {
      const senders = connection.getSenders()
      localStream.getTracks().forEach((track) => {
        const alreadyAdded = senders.some((sender) => sender.track && sender.track.id === track.id)
        if (!alreadyAdded) {
          connection.addTrack(track, localStream)
        }
      })
    }

    if (shouldOffer) {
      connection
        .createOffer()
        .then((offer) => connection.setLocalDescription(offer))
        .then(() => {
          if (!socketRef.current || !connection.localDescription) return
          socketRef.current.emit("stream:webrtc:offer", {
            to: remoteId,
            offer: connection.localDescription,
          })
        })
        .catch((error) => {
          console.error("Failed to create WebRTC offer", error)
        })
    }

    return connection
  }, [localStream])

  const handleJoinResult = useCallback((result: {
    ok: boolean
    error?: string
    reason?: string
    room?: RoomSocketPayload
    participants?: Participant[]
    selfId?: string
    isHost?: boolean
  }, targetRoomCode: string, asHost: boolean) => {
    if (!result.ok || !result.room) {
      if (asHost) {
        setRoomCode(targetRoomCode)
        setShowJoinDialog(true)
      }
      toast({
        title: "Join Failed",
        description: result.error || "Could not join this stream.",
        variant: "destructive",
      })
      return
    }

    const localRoom = buildLocalRoomFromSocket(result.room)
    setRoom(localRoom)
    setRoomStatus(result.room.status)
    setRoomCode(localRoom.id)
    setCurrentView("room")
    setShowJoinDialog(false)
    setIsHost(Boolean(result.isHost))
    setVideoQueue(Array.isArray(result.room.queue) ? result.room.queue : [])
    setCurrentQueueIndex(Number.isInteger(result.room.currentQueueIndex) ? result.room.currentQueueIndex : 0)
    setControlsLocked(Boolean(result.room.controlsLocked))
    setLoopEnabled(Boolean(result.room.loopEnabled))

    if (Array.isArray(result.room.messages)) {
      setMessages(
        result.room.messages.map((message) => ({
          id: message.id,
          userId: message.userId,
          userName: message.userName,
          text: message.text,
          timestamp: new Date(message.timestamp),
          replyTo: message.replyTo,
        })),
      )
    }

    const selfId = String(result.selfId || "")
    mySocketIdRef.current = selfId
    setMySocketId(selfId)

    if (Array.isArray(result.participants)) {
      mergeParticipants(result.participants)
    }

    if (result.room.playback) {
      applyPlaybackSync(result.room.playback)
    }

    joinedRoomRef.current = true
    rejoinPendingRef.current = false
  }, [applyPlaybackSync, buildLocalRoomFromSocket, mergeParticipants])

  const emitJoin = useCallback((socket: Socket, targetRoomCode: string, targetName: string, asHost: boolean, requestId?: string | null) => {
    socket.emit("stream:join", {
      roomCode: targetRoomCode,
      name: targetName,
      hostId: asHost ? hostIdentityRef.current : undefined,
      requestId: requestId || undefined,
    }, (result: {
      ok: boolean
      error?: string
      reason?: string
      room?: RoomSocketPayload
      participants?: Participant[]
      selfId?: string
      isHost?: boolean
    }) => {
      handleJoinResult(result, targetRoomCode, asHost)
    })
  }, [handleJoinResult])

  const connectSocket = useCallback(() => {
    if (socketRef.current) {
      if (!socketRef.current.connected) {
        socketRef.current.connect()
      }
      return socketRef.current
    }

    const socket = io(SOCKET_BASE, {
      transports: ["websocket", "polling"],
      withCredentials: true,
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 800,
      timeout: 10000,
    })

    socket.on("connect", () => {
      if (rejoinPendingRef.current && currentViewRef.current === "room" && roomCodeRef.current) {
        emitJoin(
          socket,
          roomCodeRef.current,
          userNameRef.current.trim() || "Guest",
          isHostRef.current,
          joinRequestRef.current,
        )
      }
    })

    socket.on("disconnect", () => {
      if (currentViewRef.current === "room") {
        rejoinPendingRef.current = true
        joinedRoomRef.current = false
      }
    })

    socket.on("stream:state", (payload: { room: RoomSocketPayload; participants: Participant[] }) => {
      const roomPayload = payload?.room
      if (!roomPayload) return
      setRoom(buildLocalRoomFromSocket(roomPayload))
      setRoomStatus(roomPayload.status)
      setVideoQueue(Array.isArray(roomPayload.queue) ? roomPayload.queue : [])
      setCurrentQueueIndex(Number.isInteger(roomPayload.currentQueueIndex) ? roomPayload.currentQueueIndex : 0)
      setControlsLocked(Boolean(roomPayload.controlsLocked))
      setLoopEnabled(Boolean(roomPayload.loopEnabled))
      if (Array.isArray(roomPayload.messages)) {
        setMessages(
          roomPayload.messages.map((message) => ({
            id: message.id,
            userId: message.userId,
            userName: message.userName,
            text: message.text,
            timestamp: new Date(message.timestamp),
            replyTo: message.replyTo,
          })),
        )
      }
      if (roomPayload.playback) {
        applyPlaybackSync(roomPayload.playback)
      }
      if (Array.isArray(payload.participants)) {
        mergeParticipants(payload.participants)
      }
    })

    socket.on("stream:participants", (payload: { participants: Participant[] }) => {
      const incoming = Array.isArray(payload?.participants) ? payload.participants : []
      mergeParticipants(incoming)

      const remoteIds = incoming.map((p) => p.id).filter((id) => id && id !== mySocketIdRef.current)

      peerConnectionsRef.current.forEach((connection, peerId) => {
        if (!remoteIds.includes(peerId)) {
          connection.close()
          peerConnectionsRef.current.delete(peerId)
          remoteStreamsRef.current.delete(peerId)
        }
      })

      remoteIds.forEach((peerId) => {
        if (peerConnectionsRef.current.has(peerId)) return
        const shouldOffer = mySocketIdRef.current < peerId
        createPeerConnection(peerId, shouldOffer)
      })
    })

    socket.on("stream:participant:media", (payload: { participantId: string; isMuted: boolean; isVideoOn: boolean; isSpeaking: boolean }) => {
      setParticipants((prev) =>
        prev.map((participant) =>
          participant.id === payload.participantId
            ? {
                ...participant,
                isMuted: Boolean(payload.isMuted),
                isVideoOn: Boolean(payload.isVideoOn),
                isSpeaking: Boolean(payload.isSpeaking),
              }
            : participant,
        ),
      )
    })

    socket.on("stream:chat:new", (message: { id: string; userId: string; userName: string; text: string; timestamp: string | Date; replyTo?: { id: string; userName: string; text: string } }) => {
      setMessages((prev) => [
        ...prev,
        {
          id: message.id,
          userId: message.userId,
          userName: message.userName,
          text: message.text,
          timestamp: new Date(message.timestamp),
          replyTo: message.replyTo,
        },
      ])
    })

    socket.on("stream:reaction", (reaction: { id: string; emoji: string; userId: string }) => {
      if (reaction.userId === mySocketIdRef.current) return
      const count = 2 + Math.floor(Math.random() * 2)
      const newEmojis: FloatingEmoji[] = Array.from({ length: count }, (_, i) => ({
        id: `${Date.now()}-${i}`,
        emoji: reaction.emoji,
        x: 10 + Math.random() * 80,
        delay: i * 120,
        drift: -40 + Math.random() * 80,
        duration: 2.6 + Math.random() * 1.2,
      }))
      setFloatingEmojis((prev) => [...prev, ...newEmojis])
    })

    socket.on("stream:playback:sync", (payload: { action: string; isPlaying: boolean; currentTime: number; playbackRate?: number }) => {
      applyPlaybackSync(payload)
    })

    socket.on("stream:controls:sync", (payload: { controlsLocked?: boolean; loopEnabled?: boolean }) => {
      if (typeof payload?.controlsLocked === "boolean") {
        setControlsLocked(payload.controlsLocked)
      }
      if (typeof payload?.loopEnabled === "boolean") {
        setLoopEnabled(payload.loopEnabled)
      }
    })

    socket.on("stream:ended", () => {
      toast({ title: "Stream Ended", description: "Host ended this stream." })
      setRoomStatus("ended")
      closeAllPeerConnections()
      if (socketRef.current) {
        socketRef.current.disconnect()
        socketRef.current = null
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop())
        localStreamRef.current = null
      }
      setCurrentView("lobby")
      setRoom(null)
      setMessages([])
      setParticipants([])
      setVideoQueue([])
      setCurrentQueueIndex(0)
      setMySocketId("")
      mySocketIdRef.current = ""
      setPendingJoinRequests([])
      setMyJoinRequestId(null)
      setIsAwaitingApproval(false)
      setIsPlaying(false)
      setIsMuted(false)
      setMyMic(false)
      setMyVideo(false)
      setShowChat(true)
      setShowQueuePanel(false)
      joinedRoomRef.current = false
      rejoinPendingRef.current = false
      router.replace("/stream", { scroll: false })
    })

    socket.on("stream:host:offline", () => {
      toast({
        title: "Host Offline",
        description: "Host disconnected. New joins are paused until host returns.",
        variant: "destructive",
      })
    })

    socket.on("stream:webrtc:offer", async (payload: { from: string; offer: RTCSessionDescriptionInit }) => {
      try {
        const connection = createPeerConnection(payload.from, false)
        if (!connection) return
        await connection.setRemoteDescription(new RTCSessionDescription(payload.offer))
        const answer = await connection.createAnswer()
        await connection.setLocalDescription(answer)

        socket.emit("stream:webrtc:answer", {
          to: payload.from,
          answer: connection.localDescription,
        })
      } catch (error) {
        console.error("Failed to process WebRTC offer", error)
      }
    })

    socket.on("stream:webrtc:answer", async (payload: { from: string; answer: RTCSessionDescriptionInit }) => {
      try {
        const connection = peerConnectionsRef.current.get(payload.from)
        if (!connection) return
        await connection.setRemoteDescription(new RTCSessionDescription(payload.answer))
      } catch (error) {
        console.error("Failed to process WebRTC answer", error)
      }
    })

    socket.on("stream:webrtc:ice-candidate", async (payload: { from: string; candidate: RTCIceCandidateInit }) => {
      try {
        const connection = peerConnectionsRef.current.get(payload.from)
        if (!connection || !payload.candidate) return
        await connection.addIceCandidate(new RTCIceCandidate(payload.candidate))
      } catch (error) {
        console.error("Failed to process ICE candidate", error)
      }
    })

    socketRef.current = socket
    return socket
  }, [applyPlaybackSync, buildLocalRoomFromSocket, closeAllPeerConnections, createPeerConnection, emitJoin, mergeParticipants, router])

  const joinRoomSocket = useCallback((targetRoomCode: string, targetName: string, asHost: boolean, requestId?: string | null) => {
    const socket = connectSocket()
    emitJoin(socket, targetRoomCode, targetName, asHost, requestId)
  }, [connectSocket, emitJoin])

  // Auto-detect host ownership on direct route access
  useEffect(() => {
    if (currentView !== "lobby" || !routeStreamId || !hostIdentityRef.current || isAwaitingApproval) return

    const checkHostOwnership = async () => {
      try {
        const roomRecord = await fetchRoomRecord(routeStreamId)
        if (!roomRecord) {
          // Room not found or error, let the join dialog handle it
          setRoomCode(routeStreamId)
          if (routeStreamName) setRoomName(routeStreamName)
          setShowJoinDialog(true)
          return
        }

        // Check if this user is the host of this room
        if (roomRecord.hostId === hostIdentityRef.current) {
          // Auto-join as host, skip dialog
          setRoomCode(routeStreamId)
          if (routeStreamName) setRoomName(routeStreamName)
          // Use existing userName or default to "Host"
          const displayName = userName.trim() || "Host"
          joinRoomSocket(routeStreamId, displayName, true)
        } else {
          const storedQueue = Array.isArray(roomRecord.queue) ? roomRecord.queue : []
          const storedApproval = readApprovalFromStorage(routeStreamId)
          if (roomRecord.joinPolicy === "approval" && storedApproval?.requestId) {
            setRoomCode(routeStreamId)
            if (routeStreamName) setRoomName(routeStreamName)

            if (storedApproval.decision === "pending") {
              setMyJoinRequestId(storedApproval.requestId)
              setIsAwaitingApproval(true)
              setShowJoinDialog(false)
              return
            }

            if (storedApproval.decision === "approved") {
              setMyJoinRequestId(storedApproval.requestId)
              setIsAwaitingApproval(false)
              setRoom({
                id: roomRecord.id,
                name: roomRecord.name,
                videoUrl: roomRecord.videoUrl,
                videoId: roomRecord.videoId,
                joinPolicy: roomRecord.joinPolicy,
                participants: [],
                controlsLocked: Boolean(roomRecord.controlsLocked),
                loopEnabled: Boolean(roomRecord.loopEnabled),
              })
              setRoomStatus(roomRecord.status)
              setVideoQueue(storedQueue)
              setCurrentQueueIndex(Number.isInteger(roomRecord.currentQueueIndex) ? roomRecord.currentQueueIndex : 0)
              setCurrentView("room")
              setShowJoinDialog(false)
              joinRoomSocket(routeStreamId, userName.trim() || "Guest", false, storedApproval.requestId)
              router.replace(getStreamPath(roomRecord.name || routeStreamName || "Streaming Room", routeStreamId), { scroll: false })
              return
            }

            if (storedApproval.decision === "rejected") {
              setIsAwaitingApproval(false)
              setMyJoinRequestId(null)
              setShowJoinDialog(false)
              toast({ title: "Join Rejected", description: "Host rejected your join request.", variant: "destructive" })
              return
            }
          }

          // Not a host, allow dialog to show
          setRoomCode(routeStreamId)
          if (routeStreamName) setRoomName(routeStreamName)
          setShowJoinDialog(true)
        }
      } catch (error) {
        // If error (room ended, etc.), let other effects handle it
        console.log("Host check failed (expected if stream ended or not found):", error)
        setRoomCode(routeStreamId)
        if (routeStreamName) setRoomName(routeStreamName)
        setShowJoinDialog(true)
      }
    }

    checkHostOwnership()
  }, [routeStreamId, hostIdentityRef, currentView, fetchRoomRecord, routeStreamName, userName, joinRoomSocket, isAwaitingApproval, readApprovalFromStorage, router, getStreamPath])

  // Auto-open join dialog for slug route or join query (for non-host users)
  useEffect(() => {
    const shouldJoinFromQuery = searchParams.get("join")
    if (currentView !== "lobby" || routeStreamId) return

    if (shouldJoinFromQuery) {
      setRoomCode(String(shouldJoinFromQuery).toLowerCase())
      setShowJoinDialog(true)
    }
  }, [searchParams, currentView, routeStreamId])

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Remove floating emojis after animation
  useEffect(() => {
    if (floatingEmojis.length === 0) return
    const timer = setTimeout(() => {
      setFloatingEmojis((prev) => prev.filter((e) => Date.now() - Number(e.id.split("-")[0]) < 3000))
    }, 3100)
    return () => clearTimeout(timer)
  }, [floatingEmojis])

  // Cleanup media stream on unmount
  useEffect(() => {
    return () => {
      closeAllPeerConnections()
      if (socketRef.current) {
        socketRef.current.disconnect()
        socketRef.current = null
      }
      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop())
      }
    }
  }, [closeAllPeerConnections, localStream])

  // Keep local participant stream and peer senders in sync after media changes.
  useEffect(() => {
    localStreamRef.current = localStream
    const selfId = mySocketIdRef.current
    if (selfId) {
      setParticipants((prev) => prev.map((participant) => (participant.id === selfId ? { ...participant, stream: localStream } : participant)))
    }

    peerConnectionsRef.current.forEach((connection, peerId) => {
      const senders = connection.getSenders()
      let needsRenegotiation = false

      if (!localStream) {
        senders.forEach((sender) => {
          if (sender.track) {
            sender.replaceTrack(null).catch(() => {})
          }
        })
        return
      }

       const activeKinds = new Set(localStream.getTracks().map((track) => track.kind))
       senders.forEach((sender) => {
         if (sender.track && !activeKinds.has(sender.track.kind)) {
           sender.replaceTrack(null).catch(() => {})
         }
       })

      localStream.getTracks().forEach((track) => {
        const sender = senders.find((entry) => entry.track?.kind === track.kind)
        if (sender) {
          sender.replaceTrack(track).catch(() => {})
        } else {
          connection.addTrack(track, localStream)
          needsRenegotiation = true
        }
      })

      if (needsRenegotiation && socketRef.current && connection.signalingState === "stable") {
        connection
          .createOffer()
          .then((offer) => connection.setLocalDescription(offer))
          .then(() => {
            if (!socketRef.current || !connection.localDescription) return
            socketRef.current.emit("stream:webrtc:offer", {
              to: peerId,
              offer: connection.localDescription,
            })
          })
          .catch(() => {})
      }
    })
  }, [localStream, mySocketId])

  // Request camera/mic
  const requestMedia = async (video: boolean, audio: boolean, merge = false) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: video
          ? {
              width: { ideal: 1280 },
              height: { ideal: 720 },
              frameRate: { ideal: 24, max: 30 },
            }
          : false,
        audio,
      })

      if (merge && localStreamRef.current) {
        const merged = new MediaStream([
          ...localStreamRef.current.getTracks(),
          ...stream.getTracks(),
        ])
        setLocalStream(merged)
        return merged
      }

      setLocalStream(stream)
      return stream
    } catch (err) {
      console.error("Media access error:", err)
      toast({
        title: "Camera/Mic Error",
        description: "Could not access your camera or microphone. Please check permissions.",
        variant: "destructive",
      })
      return null
    }
  }

  const stopMediaTracks = (kind: "audio" | "video") => {
    const current = localStreamRef.current
    if (!current) return
    current.getTracks().forEach((track) => {
      if (track.kind === kind) {
        track.stop()
        current.removeTrack(track)
      }
    })
    const remaining = current.getTracks()
    if (remaining.length === 0) {
      setLocalStream(null)
    } else {
      setLocalStream(new MediaStream(remaining))
    }
  }

  // Keep room data persisted for link-join and invite flows
  useEffect(() => {
    if (!room || currentView !== "room") return
    persistRoomToStorage(room, videoQueue, currentQueueIndex)
  }, [room, currentView, videoQueue, currentQueueIndex, persistRoomToStorage])

  useEffect(() => {
    if (currentView !== "room" || !isPlayerReady) return
    const interval = window.setInterval(() => {
      sendPlayerCommand("getCurrentTime")
      sendPlayerCommand("getDuration")
    }, 1000)
    return () => window.clearInterval(interval)
  }, [currentView, isPlayerReady, sendPlayerCommand])

  useEffect(() => {
    playerReadyRef.current = false
    setIsPlayerReady(false)
  }, [room?.videoId])

  useEffect(() => {
    if (!room || currentView !== "room" || !isHost) return

    const timer = setTimeout(() => {
      syncRoomRecord(room, videoQueue, currentQueueIndex).catch(() => {
        // Keep local room operational even if sync fails.
      })
    }, 300)

    return () => clearTimeout(timer)
  }, [room, currentView, isHost, videoQueue, currentQueueIndex, syncRoomRecord])

  // Host watches pending join requests in approval mode
  useEffect(() => {
    if (!room || !isHost || room.joinPolicy !== "approval") {
      setPendingJoinRequests([])
      return
    }

    let active = true
    const readPending = async () => {
      try {
        const list = await fetchPendingJoinRequests(room.id)
        if (active) {
          setPendingJoinRequests(list)
        }
      } catch {
        if (active) {
          setPendingJoinRequests([])
        }
      }
    }

    readPending()
    const interval = setInterval(readPending, 1500)
    return () => {
      active = false
      clearInterval(interval)
    }
  }, [room, isHost, fetchPendingJoinRequests])

  // Guest waits for host approval decision
  useEffect(() => {
    if (!roomCode || !myJoinRequestId || !isAwaitingApproval) return

    const interval = setInterval(async () => {
      try {
        const decision = await fetchJoinDecision(roomCode, myJoinRequestId)
        if (decision === "approved") {
          setIsAwaitingApproval(false)
          const serverRoom = await fetchRoomRecord(roomCode)
          const approvedName = userName.trim() || "Guest"
          writeApprovalToStorage(roomCode, myJoinRequestId, "approved")
          setRoom({
            id: roomCode,
            name: serverRoom?.name || roomName || "Streaming Room",
            videoUrl: serverRoom?.videoUrl || "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            videoId: serverRoom?.videoId || "dQw4w9WgXcQ",
            joinPolicy: (serverRoom?.joinPolicy || "approval") as "open" | "approval",
            participants: [],
          })
          joinRoomSocket(roomCode, approvedName, false, myJoinRequestId)
          router.replace(getStreamPath(serverRoom?.name || roomName || "Streaming Room", roomCode), { scroll: false })
        } else if (decision === "rejected") {
          setIsAwaitingApproval(false)
          writeApprovalToStorage(roomCode, myJoinRequestId, "rejected")
          setMyJoinRequestId(null)
          toast({ title: "Join Request Rejected", description: "Host rejected your join request.", variant: "destructive" })
        }
      } catch {
        // Keep polling until host responds.
      }
    }, 1200)

    return () => clearInterval(interval)
  }, [roomCode, myJoinRequestId, isAwaitingApproval, roomName, userName, fetchJoinDecision, fetchRoomRecord, joinRoomSocket, router, getStreamPath, writeApprovalToStorage])

  // Sync playback and autoplay next queue item when YouTube player ends
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== "https://www.youtube.com") return

      let payload: any = event.data
      if (typeof payload === "string") {
        try {
          payload = JSON.parse(payload)
        } catch {
          return
        }
      }

      if (payload?.event === "onStateChange") {
        if (suppressPlayerSyncRef.current) return

        if (controlsLocked && !isHost) {
          applyPlaybackSync(playbackStateRef.current)
          return
        }

        if (payload.info === 1 || payload.info === 2) {
          const now = Date.now()
          if (now - lastPlaybackEmitRef.current > 250) {
            lastPlaybackEmitRef.current = now
            const nextPlaying = payload.info === 1
            setIsPlaying(nextPlaying)
            socketRef.current?.emit("stream:playback:update", {
              action: nextPlaying ? "play" : "pause",
              isPlaying: nextPlaying,
              currentTime: latestPlayerTimeRef.current,
              playbackRate: 1,
            })
          }
        }
      }

      if (payload?.event === "infoDelivery") {
        const currentTime = Number(payload?.info?.currentTime)
        const duration = Number(payload?.info?.duration)
        if (Number.isFinite(currentTime)) {
          latestPlayerTimeRef.current = currentTime
          playbackStateRef.current = {
            ...playbackStateRef.current,
            currentTime,
          }
          if (!isScrubbing) {
            setPlayerCurrentTime(currentTime)
          }
        }

        if (Number.isFinite(duration) && duration > 0) {
          setPlayerDuration(duration)
        }

        if (!suppressPlayerSyncRef.current && Number.isFinite(currentTime) && Date.now() - lastPlaybackEmitRef.current > 2000) {
          lastPlaybackEmitRef.current = Date.now()
          socketRef.current?.emit("stream:playback:update", {
            action: "sync",
            isPlaying,
            currentTime,
            playbackRate: 1,
          })
        }
      }

      const endedByStateChange = payload?.event === "onStateChange" && payload?.info === 0
      const endedByInfoDelivery = payload?.event === "infoDelivery" && payload?.info?.playerState === 0
      if (!endedByStateChange && !endedByInfoDelivery) return

      if (!isHost) return

      if (loopEnabled) {
        latestPlayerTimeRef.current = 0
        playbackStateRef.current = { isPlaying: true, currentTime: 0, playbackRate: 1 }
        setIsPlaying(true)
        setPlayerCurrentTime(0)
        sendPlayerCommand("seekTo", [0, true])
        sendPlayerCommand("playVideo")
        socketRef.current?.emit("stream:playback:update", {
          action: "loop",
          isPlaying: true,
          currentTime: 0,
          playbackRate: 1,
        })
        return
      }

      if (currentQueueIndex < videoQueue.length - 1) {
        const nextIndex = currentQueueIndex + 1
        const nextItem = videoQueue[nextIndex]
        if (nextItem) {
          startPlaybackAtIndex(nextIndex)
          toast({ title: "Now Playing", description: `Playing: ${nextItem.title}` })
        }
      }
    }

    window.addEventListener("message", onMessage)
    return () => window.removeEventListener("message", onMessage)
  }, [applyPlaybackSync, controlsLocked, isHost, isPlaying, isScrubbing, loopEnabled, sendPlayerCommand, startPlaybackAtIndex, videoQueue, currentQueueIndex])

  // Create Room
  const handleCreateRoom = async () => {
    if (!videoUrl || !roomName) {
      toast({ title: "Missing fields", description: "Please enter a room name and YouTube URL.", variant: "destructive" })
      return
    }
    const vId = extractVideoId(videoUrl)
    if (!vId) {
      toast({ title: "Invalid URL", description: "Please enter a valid YouTube video URL.", variant: "destructive" })
      return
    }
    setIsFetchingVideoInfo(true)
    const code = generateRoomCode()
    const name = userName.trim() || "Host"
    let videoTitle = "Queued Video"
    let thumbnail = ""
    let duration = ""

    try {
      const meta = await fetchVideoInfo(videoUrl)
      videoTitle = meta.title || videoTitle
      thumbnail = meta.thumbnail || ""
      duration = meta.duration || ""
    } catch (error) {
      console.error("Failed to fetch initial video info:", error)
    } finally {
      setIsFetchingVideoInfo(false)
    }

    const initialQueueItem: QueueItem = {
      id: `q-${Date.now()}`,
      videoId: vId,
      title: videoTitle,
      thumbnail,
      duration,
      url: `https://youtube.com/watch?v=${vId}`,
      addedBy: name,
    }

    const newRoom: Room = {
      id: code,
      name: roomName,
      videoUrl,
      videoId: vId,
      joinPolicy,
      participants: [],
    }

    let serverRoom: RoomSocketPayload | null = null

    try {
      serverRoom = await createRoomRecord(newRoom, [initialQueueItem], 0)
    } catch (error) {
      toast({
        title: "Create Failed",
        description: "Could not create room on server. Please try again.",
        variant: "destructive",
      })
      console.error("Failed to create backend room:", error)
      return
    }

    const finalRoomId = serverRoom?.id || code
    const finalRoomName = serverRoom?.name || roomName
    const finalQueueIndex = Number.isInteger(serverRoom?.currentQueueIndex) ? Number(serverRoom?.currentQueueIndex) : 0
    const finalQueue = Array.isArray(serverRoom?.queue) ? serverRoom.queue : [initialQueueItem]

    setRoom({
      id: finalRoomId,
      name: finalRoomName,
      videoUrl: serverRoom?.videoUrl || videoUrl,
      videoId: serverRoom?.videoId || vId,
      joinPolicy: (serverRoom?.joinPolicy || joinPolicy) as "open" | "approval",
      participants: [],
    })
    setRoomCode(finalRoomId)
    setIsHost(true)
    setParticipants([])
    setVideoQueue(finalQueue)
    setCurrentQueueIndex(finalQueueIndex)
    setCurrentView("room")
    setShowCreateDialog(false)

    persistRoomToStorage(
      {
        id: finalRoomId,
        name: finalRoomName,
        videoUrl: serverRoom?.videoUrl || videoUrl,
        videoId: serverRoom?.videoId || vId,
        joinPolicy: (serverRoom?.joinPolicy || joinPolicy) as "open" | "approval",
        participants: [],
      },
      finalQueue,
      finalQueueIndex,
    )

    joinRoomSocket(finalRoomId, name, true)

    router.replace(getStreamPath(finalRoomName, finalRoomId), { scroll: false })
    setMessages([
      {
        id: "system-1",
        userId: "system",
        userName: "System",
        text: `Room "${finalRoomName}" created! Share the code ${finalRoomId} to invite others.`,
        timestamp: new Date(),
      },
    ])
    toast({ title: "Room Created!", description: `Room code: ${finalRoomId}` })
  }

  // Join Room
  function completeJoinRoom(targetRoom: Room, queueData: QueueItem[]) {
    const name = userName.trim() || "Guest"

    setRoom(targetRoom)
    setIsHost(false)
    setParticipants([])
    setVideoQueue(queueData)
    setCurrentView("room")
    setShowJoinDialog(false)

    joinRoomSocket(targetRoom.id, name, false, myJoinRequestId)
    router.replace(getStreamPath(targetRoom.name, targetRoom.id), { scroll: false })
    toast({ title: "Joined!", description: `Welcome to the room, ${name}!` })
  }

  const attemptJoinWithCode = useCallback(async (targetRoomCode: string) => {
    if (!targetRoomCode) {
      toast({ title: "Missing code", description: "Please enter a room code.", variant: "destructive" })
      return
    }

    let serverRoom: any = null
    try {
      serverRoom = await fetchRoomRecord(targetRoomCode)
    } catch (error) {
      const description = error instanceof Error ? error.message : "This room does not exist or has expired."
      const title = /ended|expired/i.test(description) ? "Stream Expired" : "Room Not Found"
      toast({ title, description, variant: "destructive" })
      return
    }

    const storedQueue = Array.isArray(serverRoom?.queue) ? serverRoom.queue : []

    const nextRoom: Room = {
      id: targetRoomCode,
      name: serverRoom?.name || routeStreamName || "Streaming Room",
      videoUrl: serverRoom?.videoUrl || "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      videoId: serverRoom?.videoId || "dQw4w9WgXcQ",
      joinPolicy: serverRoom?.joinPolicy || (searchParams.get("approval") === "1" ? "approval" : "open"),
      participants: [],
      controlsLocked: Boolean(serverRoom?.controlsLocked),
      loopEnabled: Boolean(serverRoom?.loopEnabled),
    }

    if (serverRoom?.status === "ended") {
      toast({ title: "Stream Expired", description: "This stream has ended and can no longer be joined.", variant: "destructive" })
      return
    }

    if (serverRoom?.status === "waiting") {
      toast({ title: "Stream Not Started", description: "Host has not started streaming yet.", variant: "destructive" })
      return
    }

    if (nextRoom.joinPolicy === "approval") {
      const storedApproval = readApprovalFromStorage(targetRoomCode)
      if (storedApproval?.requestId) {
        setMyJoinRequestId(storedApproval.requestId)
        if (storedApproval.decision === "approved") {
          setIsAwaitingApproval(false)
          completeJoinRoom(nextRoom, storedQueue)
          return
        }
        if (storedApproval.decision === "pending") {
          setIsAwaitingApproval(true)
          setShowJoinDialog(false)
          toast({ title: "Join Request Pending", description: "Waiting for host approval." })
          return
        }
        if (storedApproval.decision === "rejected") {
          setIsAwaitingApproval(false)
          toast({ title: "Join Rejected", description: "Host rejected your join request.", variant: "destructive" })
          return
        }
      }

      try {
        const { request: joinRequest, decision } = await createJoinRequest(targetRoomCode, userName.trim() || "Guest")
        setMyJoinRequestId(joinRequest.id)
        writeApprovalToStorage(targetRoomCode, joinRequest.id, decision)
        setShowJoinDialog(false)

        if (decision === "approved") {
          setIsAwaitingApproval(false)
          completeJoinRoom(nextRoom, storedQueue)
          return
        }

        if (decision === "rejected") {
          setIsAwaitingApproval(false)
          toast({ title: "Join Rejected", description: "Host rejected your join request.", variant: "destructive" })
          return
        }

        setIsAwaitingApproval(true)
        toast({ title: "Join Request Sent", description: "Waiting for host approval." })
      } catch (error) {
        toast({
          title: "Join Request Failed",
          description: error instanceof Error ? error.message : "Unable to request approval right now.",
          variant: "destructive",
        })
      }
      return
    }

    completeJoinRoom(nextRoom, storedQueue)
  }, [completeJoinRoom, createJoinRequest, fetchRoomRecord, readApprovalFromStorage, routeStreamName, searchParams, userName, writeApprovalToStorage])

  const handleJoinRoom = async () => {
    const targetRoomCode = (routeStreamId || roomCode).trim().toLowerCase()
    await attemptJoinWithCode(targetRoomCode)
  }

  const handleRejoinOffer = async () => {
    if (!rejoinOffer) return
    const targetRoomCode = rejoinOffer.roomId.trim().toLowerCase()
    setRejoinOffer(null)
    setRejoinRemainingMs(0)
    setRoomCode(targetRoomCode)
    setRoomName(rejoinOffer.roomName)
    await attemptJoinWithCode(targetRoomCode)
  }

  // Leave Room
  const handleLeaveRoom = () => {
    const shouldOfferRejoin = roomStatus === "live" && roomCode
    closeAllPeerConnections()
    if (socketRef.current) {
      socketRef.current.disconnect()
      socketRef.current = null
    }

    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop())
      setLocalStream(null)
    }

    mySocketIdRef.current = ""
    setMySocketId("")
    setCurrentView("lobby")
    setRoom(null)
    setMessages([])
    setParticipants([])
    setVideoQueue([])
    setCurrentQueueIndex(0)
    setPendingJoinRequests([])
    setMyJoinRequestId(null)
    setIsAwaitingApproval(false)
    setIsPlaying(false)
    setIsMuted(false)
    setMyMic(false)
    setMyVideo(false)
    setShowChat(true)
    setShowQueuePanel(false)
    joinedRoomRef.current = false
    rejoinPendingRef.current = false
    if (shouldOfferRejoin) {
      const expiresAt = Date.now() + 5000
      setRejoinOffer({ roomId: roomCode, roomName: room?.name || "Streaming Room", expiresAt })
    } else {
      setRejoinOffer(null)
    }
    setRejoinRemainingMs(0)
    router.replace("/stream", { scroll: false })
    toast({ title: "Left Room", description: "You have left the streaming room." })
  }

  // End Meeting (host only)
  const handleEndMeeting = () => {
    if (socketRef.current) {
      socketRef.current.emit("stream:end", (result: { ok: boolean; error?: string }) => {
        if (!result?.ok) {
          toast({ title: "End Failed", description: result?.error || "Could not end meeting.", variant: "destructive" })
          return
        }
        handleLeaveRoom()
        setShowEndMeetingDialog(false)
        toast({ title: "Meeting Ended", description: "The meeting has been ended for all participants." })
      })
      return
    }

    handleLeaveRoom()
    setShowEndMeetingDialog(false)
  }

  // Send Chat Message
  const handleSendMessage = () => {
    if (!chatInput.trim()) return
    if (!socketRef.current) {
      toast({ title: "Not Connected", description: "Realtime connection is not available.", variant: "destructive" })
      return
    }

    socketRef.current.emit("stream:chat:send", {
      text: chatInput.trim(),
      replyTo: replyingTo ? { id: replyingTo.id, userName: replyingTo.userName, text: replyingTo.text } : undefined,
    })

    setChatInput("")
    setReplyingTo(null)
  }

  // Send Emoji Reaction — Google Meet style floating
  const handleEmojiReaction = (emoji: string) => {
    const count = 3 + Math.floor(Math.random() * 3) // 3-5 emojis per reaction
    const newEmojis: FloatingEmoji[] = Array.from({ length: count }, (_, i) => ({
      id: `${Date.now()}-${i}`,
      emoji,
      x: 10 + Math.random() * 80,
      delay: i * 150,
      drift: -40 + Math.random() * 80,
      duration: 2.8 + Math.random() * 1.2,
    }))
    setFloatingEmojis((prev) => [...prev, ...newEmojis])
    socketRef.current?.emit("stream:reaction", { emoji })
    setShowFullEmojiPicker(false)
  }

  const canControlPlayback = isHost || !controlsLocked

  const handleTogglePlayPause = () => {
    if (!canControlPlayback) return
    const nextPlaying = !isPlaying
    setIsPlaying(nextPlaying)
    playbackStateRef.current = {
      ...playbackStateRef.current,
      isPlaying: nextPlaying,
      currentTime: latestPlayerTimeRef.current,
    }
    suppressPlayerSyncRef.current = true
    sendPlayerCommand(nextPlaying ? "playVideo" : "pauseVideo")
    lastPlaybackEmitRef.current = Date.now()
    socketRef.current?.emit("stream:playback:update", {
      action: nextPlaying ? "play" : "pause",
      isPlaying: nextPlaying,
      currentTime: latestPlayerTimeRef.current,
      playbackRate: 1,
    })
    window.setTimeout(() => {
      suppressPlayerSyncRef.current = false
    }, 600)
  }

  const handleSeekCommit = (time: number) => {
    if (!canControlPlayback) return
    const maxTime = Number.isFinite(playerDuration) && playerDuration > 0 ? playerDuration : time
    const nextTime = Math.max(0, Math.min(maxTime, time))

    setPlayerCurrentTime(nextTime)
    latestPlayerTimeRef.current = nextTime
    playbackStateRef.current = {
      ...playbackStateRef.current,
      currentTime: nextTime,
    }

    suppressPlayerSyncRef.current = true
    sendPlayerCommand("seekTo", [nextTime, true])
    if (isPlaying) {
      sendPlayerCommand("playVideo")
    }
    lastPlaybackEmitRef.current = Date.now()
    socketRef.current?.emit("stream:playback:update", {
      action: "seek",
      isPlaying,
      currentTime: nextTime,
      playbackRate: 1,
    })
    window.setTimeout(() => {
      suppressPlayerSyncRef.current = false
    }, 600)
  }

  const handleScrubChange = (value: number) => {
    if (!canControlPlayback) return
    scrubValueRef.current = value
    setPlayerCurrentTime(value)
  }

  const handleScrubCommit = () => {
    if (!canControlPlayback) return
    setIsScrubbing(false)
    handleSeekCommit(scrubValueRef.current)
  }

  const handleSkipBy = (seconds: number) => {
    if (!canControlPlayback) return
    const nextTime = latestPlayerTimeRef.current + seconds
    handleSeekCommit(nextTime)
  }

  const handleToggleControlsLock = () => {
    if (!isHost) return
    const nextLocked = !controlsLocked
    setControlsLocked(nextLocked)
    socketRef.current?.emit("stream:controls:update", { controlsLocked: nextLocked })
  }

  const handleToggleLoop = () => {
    if (!isHost) return
    const nextLoop = !loopEnabled
    setLoopEnabled(nextLoop)
    socketRef.current?.emit("stream:controls:update", { loopEnabled: nextLoop })
  }

  const handleToggleFullscreen = async () => {
    const target = pinnedParticipant ? pinnedStageRef.current : videoStageRef.current
    if (!target) return

    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen()
        return
      }

      const request = target.requestFullscreen || (target as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> }).webkitRequestFullscreen
      if (request) {
        await request.call(target)
      }
    } catch (error) {
      console.error("Failed to toggle fullscreen", error)
    }
  }

  // Toggle Mic
  const handleToggleMic = async () => {
    const nextMic = !myMic
    if (!myMic) {
      const existingAudio = localStreamRef.current?.getAudioTracks() || []
      if (existingAudio.length > 0) {
        existingAudio.forEach((t) => (t.enabled = true))
        setMyMic(true)
      } else {
        const stream = await requestMedia(false, true, Boolean(localStreamRef.current))
        if (stream) {
          setMyMic(true)
        } else {
          return
        }
      }
    } else {
      stopMediaTracks("audio")
      setMyMic(false)
    }

    const selfId = mySocketIdRef.current
    setParticipants((prev) =>
      prev.map((p) => (p.id === selfId ? { ...p, isMuted: !nextMic } : p))
    )
    socketRef.current?.emit("stream:media:state", {
      isMuted: !nextMic,
      isVideoOn: myVideo,
      isSpeaking: nextMic,
    })
  }

  // Toggle Video
  const handleToggleVideo = async () => {
    const nextVideo = !myVideo
    if (!myVideo) {
      const existingVideo = localStreamRef.current?.getVideoTracks() || []
      if (existingVideo.length > 0) {
        existingVideo.forEach((t) => (t.enabled = true))
        setMyVideo(true)
      } else {
        const stream = await requestMedia(true, false, Boolean(localStreamRef.current))
        if (stream) {
          setMyVideo(true)
        } else {
          return
        }
      }
    } else {
      stopMediaTracks("video")
      setMyVideo(false)
    }

    const selfId = mySocketIdRef.current
    setParticipants((prev) =>
      prev.map((p) => (p.id === selfId ? { ...p, isVideoOn: nextVideo } : p))
    )
    socketRef.current?.emit("stream:media:state", {
      isMuted: !myMic,
      isVideoOn: nextVideo,
      isSpeaking: myMic,
    })
  }

  // Pin participant — toggle
  const handlePinParticipant = (participantId: string) => {
    setParticipants((prev) =>
      prev.map((p) => ({
        ...p,
        isPinned: p.id === participantId ? !p.isPinned : false,
      }))
    )
  }

  // Copy invite link
  const handleCopyLink = () => {
    const link = getInviteLink()
    if (!link) return
    navigator.clipboard.writeText(link)
    setCopiedLink(true)
    setTimeout(() => setCopiedLink(false), 2000)
    toast({ title: "Copied!", description: "Invite link copied to clipboard." })
  }

  // Send invite email
  const handleSendInvite = async () => {
    if (!inviteEmail.trim()) return
    const token = localStorage.getItem("token")
    if (!token) {
      toast({ title: "Login Required", description: "Please login to send invite emails.", variant: "destructive" })
      return
    }

    setIsSendingInvite(true)
    try {
      const response = await fetch(`${API_BASE}/stream/invite-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          email: inviteEmail.trim(),
          roomId: room?.id,
          roomName: room?.name,
          inviteLink: getInviteLink(),
          joinPolicy: room?.joinPolicy || joinPolicy,
        }),
      })

      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.error || "Failed to send invite email")
      }

      toast({ title: "Invite Sent!", description: `Invitation sent to ${inviteEmail.trim()}` })
      setInviteEmail("")
    } catch (error) {
      toast({
        title: "Invite Failed",
        description: error instanceof Error ? error.message : "Failed to send invite email.",
        variant: "destructive",
      })
    } finally {
      setIsSendingInvite(false)
    }
  }

  // Change display name
  const handleChangeName = () => {
    if (!newDisplayName.trim()) return
    setUserName(newDisplayName.trim())
    const selfId = mySocketIdRef.current
    setParticipants((prev) =>
      prev.map((p) => (p.id === selfId ? { ...p, name: newDisplayName.trim() } : p))
    )
    socketRef.current?.emit("stream:participant:rename", { name: newDisplayName.trim() })
    setShowNameDialog(false)
    toast({ title: "Name Updated", description: `Display name is now "${newDisplayName.trim()}"` })
  }

  // Edit room name
  const handleSaveRoomName = () => {
    if (!editRoomNameValue.trim() || !room) return
    setRoom({ ...room, name: editRoomNameValue.trim() })
    setEditingRoomName(false)
    router.replace(getStreamPath(editRoomNameValue.trim(), room.id), { scroll: false })
  }

  // Video Queue: Add
  const handleAddToQueue = async () => {
    const vId = extractVideoId(newQueueUrl)
    if (!vId) {
      toast({ title: "Invalid URL", description: "Please enter a valid YouTube URL.", variant: "destructive" })
      return
    }

    setIsFetchingVideoInfo(true)
    let title = "Queued Video"
    let thumbnail = ""
    let duration = ""
    try {
      const info = await fetchVideoInfo(newQueueUrl)
      title = info.title || title
      thumbnail = info.thumbnail || ""
      duration = info.duration || ""
    } catch (error) {
      console.error("Failed to fetch queue video info:", error)
    } finally {
      setIsFetchingVideoInfo(false)
    }

    setVideoQueue((prev) => {
      const item: QueueItem = {
        id: `q-${Date.now()}`,
        videoId: vId,
        title,
        thumbnail,
        duration,
        url: `https://youtube.com/watch?v=${vId}`,
        addedBy: userName.trim() || (isHost ? "Host" : "Guest"),
      }
      const next = [...prev, item]
      emitQueueUpdate(next, currentQueueIndex)
      return next
    })
    setNewQueueUrl("")
    toast({ title: "Added to Queue", description: "Video added to the queue." })
  }

  const handleImportPlaylist = async () => {
    if (!playlistUrl.trim()) {
      toast({ title: "Playlist URL Required", description: "Please paste a public YouTube playlist URL.", variant: "destructive" })
      return
    }

    setIsImportingPlaylist(true)
    try {
      const response = await fetch(`${API_BASE}/youtube/playlist/info?url=${encodeURIComponent(playlistUrl.trim())}`)
      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.error || "Failed to import playlist")
      }

      const importedItems: QueueItem[] = (result.videos || []).map((video: any, idx: number) => ({
        id: `q-${Date.now()}-${idx}`,
        videoId: video.id,
        title: video.title || `Playlist Video ${idx + 1}`,
        thumbnail: video.thumbnail || "",
        duration: video.duration || "",
        url: video.url || `https://youtube.com/watch?v=${video.id}`,
        addedBy: userName.trim() || (isHost ? "Host" : "Guest"),
      }))

      setVideoQueue((prev) => {
        const existing = new Set(prev.map((item) => item.videoId))
        const freshItems = importedItems.filter((item) => !existing.has(item.videoId))
        const merged = [...prev, ...freshItems]
        let nextIndex = currentQueueIndex

        if (prev.length === 0 && merged.length > 0) {
          const first = merged[0]
          nextIndex = 0
          setCurrentQueueIndex(0)
          setRoom((current) => (current ? { ...current, videoId: first.videoId, videoUrl: first.url } : current))
        }

        emitQueueUpdate(merged, nextIndex)

        return merged
      })

      setPlaylistUrl("")
      toast({ title: "Playlist Imported", description: `Imported ${importedItems.length} videos from playlist.` })
    } catch (error) {
      toast({
        title: "Import Failed",
        description: error instanceof Error ? error.message : "Unable to import this playlist.",
        variant: "destructive",
      })
    } finally {
      setIsImportingPlaylist(false)
    }
  }

  const playQueueItem = (index: number) => {
    if (!canControlPlayback) return
    const item = videoQueue[index]
    if (!item) return
    startPlaybackAtIndex(index)
  }

  // Video Queue: Play next
  const handlePlayNext = () => {
    if (!canControlPlayback) return
    if (videoQueue.length === 0 || currentQueueIndex >= videoQueue.length - 1) return
    const nextIndex = currentQueueIndex + 1
    const next = videoQueue[nextIndex]
    if (!next) return
    startPlaybackAtIndex(nextIndex)
    toast({ title: "Now Playing", description: `Playing: ${next.title}` })
  }

  const handleMoveQueueItem = (index: number, direction: "up" | "down") => {
    setVideoQueue((prev) => {
      const target = direction === "up" ? index - 1 : index + 1
      if (target < 0 || target >= prev.length) return prev

      const next = [...prev]
      const [moved] = next.splice(index, 1)
      next.splice(target, 0, moved)

      let nextQueueIndex = currentQueueIndex

      if (currentQueueIndex === index) {
        nextQueueIndex = target
        setCurrentQueueIndex(target)
      } else if (currentQueueIndex === target) {
        nextQueueIndex = index
        setCurrentQueueIndex(index)
      }

      emitQueueUpdate(next, nextQueueIndex)

      return next
    })
  }

  // Video Queue: Remove
  const handleRemoveFromQueue = (queueId: string) => {
    setVideoQueue((prev) => {
      const index = prev.findIndex((item) => item.id === queueId)
      if (index === -1) return prev
      const next = prev.filter((item) => item.id !== queueId)
      let nextQueueIndex = currentQueueIndex

      if (next.length === 0) {
        nextQueueIndex = 0
        setCurrentQueueIndex(0)
      } else if (index < currentQueueIndex) {
        nextQueueIndex = Math.max(0, currentQueueIndex - 1)
        setCurrentQueueIndex(nextQueueIndex)
      } else if (index === currentQueueIndex) {
        const fallback = Math.min(currentQueueIndex, next.length - 1)
        nextQueueIndex = fallback
        setCurrentQueueIndex(fallback)
        const current = next[fallback]
        if (current) {
          setRoom((roomState) => roomState ? { ...roomState, videoId: current.videoId, videoUrl: current.url } : roomState)
        }
      }

      emitQueueUpdate(next, nextQueueIndex)

      return next
    })
  }

  const handleClearQueue = () => {
    setVideoQueue([])
    setCurrentQueueIndex(0)
    emitQueueUpdate([], 0)
    toast({ title: "Queue Cleared", description: "All queued videos were removed." })
  }

  const handleApproveJoinRequest = async (requestId: string) => {
    if (!room) return
    try {
      await submitJoinDecision(room.id, requestId, "approved")
      const pending = pendingJoinRequests.filter((request) => request.id !== requestId)
      setPendingJoinRequests(pending)
      toast({ title: "Join Approved", description: "Participant can now join the stream." })
    } catch (error) {
      toast({
        title: "Approval Failed",
        description: error instanceof Error ? error.message : "Unable to approve this request.",
        variant: "destructive",
      })
    }
  }

  const handleRejectJoinRequest = async (requestId: string) => {
    if (!room) return
    try {
      await submitJoinDecision(room.id, requestId, "rejected")
      const pending = pendingJoinRequests.filter((request) => request.id !== requestId)
      setPendingJoinRequests(pending)
      toast({ title: "Join Rejected", description: "Participant request was rejected." })
    } catch (error) {
      toast({
        title: "Reject Failed",
        description: error instanceof Error ? error.message : "Unable to reject this request.",
        variant: "destructive",
      })
    }
  }

  const handleIframeLoad = () => {
    const targetWindow = playerRef.current?.contentWindow
    if (!targetWindow) return

    targetWindow.postMessage(JSON.stringify({ event: "command", func: "addEventListener", args: ["onStateChange"] }), "*")
    targetWindow.postMessage(JSON.stringify({ event: "command", func: "addEventListener", args: ["onReady"] }), "*")
    targetWindow.postMessage(JSON.stringify({ event: "command", func: "addEventListener", args: ["onPlaybackRateChange"] }), "*")

    playerReadyRef.current = true
    setIsPlayerReady(true)

    if (pendingPlaybackRef.current) {
      const pending = pendingPlaybackRef.current
      pendingPlaybackRef.current = null
      applyPlaybackSync(pending)
    }
  }

  // Format time
  const formatTime = (time: Date) => time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  const formatPlaybackTime = (seconds: number) => {
    if (!Number.isFinite(seconds) || seconds <= 0) return "0:00"
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const pinnedParticipant = participants.find((p) => p.isPinned)
  const rejoinProgress = rejoinOffer ? Math.max(0, Math.min(1, rejoinRemainingMs / 5000)) : 0

  if (!mounted) return null

  // ═══════════════════════════════════════════════════════════════
  // LOBBY VIEW
  // ═══════════════════════════════════════════════════════════════
  if (currentView === "lobby") {
    return (
      <div className={`min-h-screen transition-colors duration-300 relative overflow-hidden ${darkMode ? "dark bg-gray-950" : "bg-gradient-to-br from-orange-50 via-white to-red-100"}`}>
        <div className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-orange-200/35 blur-3xl dark:bg-orange-900/20" />
        <div className="pointer-events-none absolute top-36 -right-24 h-80 w-80 rounded-full bg-red-200/35 blur-3xl dark:bg-red-900/20" />
        <Navbar showNavbar={showNavbar} features={features} setActiveFeature={setActiveFeature} darkMode={darkMode} toggleDarkMode={toggleDarkMode} />

        <main className="pt-24 pb-16 px-4 sm:px-6 relative z-10">
          <div className="max-w-5xl mx-auto">
            {/* Hero Section */}
            <div className="text-center mb-16">
              <div className="flex items-center justify-center gap-4 mb-6">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-orange-500 to-red-600 rounded-2xl shadow-xl shadow-orange-200/50 dark:shadow-orange-900/30">
                  <Users className="w-8 h-8 text-white" />
                </div>
                <h1 className="text-4xl md:text-5xl font-bold">
                  <span className="bg-gradient-to-r from-orange-500 via-red-500 to-rose-700 bg-clip-text text-transparent">
                    Group Streaming
                  </span>
                </h1>
              </div>
              <p className="text-lg text-gray-600 dark:text-gray-300 max-w-3xl mx-auto leading-relaxed">
                Watch YouTube videos together with friends in real-time. Create a private room, share a link, and enjoy synced playback with live chat, emoji reactions, and video calls.
              </p>
            </div>

            <img src="/camera (1).webp" alt="camera" className="lg:w-[300px] lg:h-[620px] lg:top-[60px] md:w-[130px] md:h-[230px] md:top-[40px] absolute right-0 w-[126px] h-[210px] top-[40px] invisible sm:visible" />

            {/* Action Cards */}
            <div className="grid md:grid-cols-2 gap-8 mb-16 max-w-3xl mx-auto">
              {/* Create Room Card */}
              <Card
                className="cursor-pointer group relative overflow-hidden bg-white/80 dark:bg-gray-800/70 backdrop-blur-sm hover:shadow-2xl hover:shadow-orange-200/30 dark:hover:shadow-orange-900/20 transition-all duration-500 border-orange-200/60 dark:border-gray-700/60 hover:border-orange-400 dark:hover:border-orange-500 hover:-translate-y-1"
                onClick={() => setShowCreateDialog(true)}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-red-500/5 group-hover:from-orange-500/10 group-hover:to-red-500/10 transition-all duration-500" />
                <CardContent className="relative p-8 md:p-10 text-center">
                  <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-red-600 rounded-2xl mx-auto mb-5 flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-all duration-500 shadow-lg shadow-orange-200/40">
                    <Plus className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">Create Room</h3>
                  <p className="text-gray-500 dark:text-gray-400 leading-relaxed">
                    Start a new streaming session. Pick a video, name your room, and invite friends to watch together.
                  </p>
                </CardContent>
              </Card>

              {/* Join Room Card */}
              <Card
                className="cursor-pointer group relative overflow-hidden bg-white/80 dark:bg-gray-800/70 backdrop-blur-sm hover:shadow-2xl hover:shadow-red-200/30 dark:hover:shadow-red-900/20 transition-all duration-500 border-red-200/60 dark:border-gray-700/60 hover:border-red-400 dark:hover:border-red-500 hover:-translate-y-1"
                onClick={() => setShowJoinDialog(true)}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-rose-700/10 group-hover:from-red-500/10 group-hover:to-rose-700/15 transition-all duration-500" />
                <CardContent className="relative p-8 md:p-10 text-center">
                  <div className="w-16 h-16 bg-gradient-to-br from-red-500 to-rose-700 rounded-2xl mx-auto mb-5 flex items-center justify-center group-hover:scale-110 group-hover:-rotate-3 transition-all duration-500 shadow-lg shadow-red-200/40 dark:shadow-red-900/30">
                    <Link className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">Join Room</h3>
                  <p className="text-gray-500 dark:text-gray-400 leading-relaxed">
                    Got a room code or invite link? Jump into an existing session and start watching instantly.
                  </p>
                </CardContent>
              </Card>
            </div>

            {isAwaitingApproval && (
              <Card className="max-w-3xl mx-auto mb-10 bg-white/80 dark:bg-gray-800/70 backdrop-blur-sm border-orange-200/60 dark:border-gray-700/60">
                <CardContent className="py-6 text-center">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Join request sent</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300">Waiting for host approval. Keep this page open and we will join automatically once approved.</p>
                </CardContent>
              </Card>
            )}

            {/* Feature Highlights */}
            <div className="mb-16">
              <h2 className="text-center text-2xl font-bold text-gray-900 dark:text-white mb-8">
                Everything you need for a <span className="text-orange-500">watch party</span>
              </h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {[
                  {
                    icon: <Play className="w-6 h-6" />,
                    title: "Synchronized Playback",
                    description: "Everyone watches the same frame at the same time. Play, pause, and seek stays in sync across all viewers.",
                    gradient: "from-orange-500 to-red-500",
                    bg: "bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-950/30 dark:to-red-900/20",
                  },
                  {
                    icon: <Video className="w-6 h-6" />,
                    title: "Video & Audio Calls",
                    description: "Turn on your camera and mic to see and hear friends while watching. Just like being in the same room.",
                    gradient: "from-orange-500 to-rose-600",
                    bg: "bg-gradient-to-br from-orange-50 to-rose-50 dark:from-orange-950/30 dark:to-rose-900/20",
                  },
                  {
                    icon: <Smile className="w-6 h-6" />,
                    title: "Live Emoji Reactions",
                    description: "React with floating emojis that everyone can see — express yourself in real-time.",
                    gradient: "from-red-500 to-rose-700",
                    bg: "bg-gradient-to-br from-red-50 to-rose-100/80 dark:from-red-950/30 dark:to-rose-900/20",
                  },
                  {
                    icon: <MessageSquare className="w-6 h-6" />,
                    title: "Live Chat with Replies",
                    description: "Chat alongside the video with threaded replies. Share thoughts, links, and reactions without interrupting playback.",
                    gradient: "from-orange-600 to-red-600",
                    bg: "bg-gradient-to-br from-orange-100/80 to-red-100/80 dark:from-orange-950/35 dark:to-red-900/25",
                  },
                  {
                    icon: <ListVideo className="w-6 h-6" />,
                    title: "Video Queue",
                    description: "Queue up multiple videos for a seamless watch party. Anyone can add to the queue, and the next video plays automatically.",
                    gradient: "from-red-500 to-rose-700",
                    bg: "bg-gradient-to-br from-red-50 to-orange-100 dark:from-red-950/35 dark:to-orange-900/25",
                  },
                  {
                    icon: <Shield className="w-6 h-6" />,
                    title: "Host Controls",
                    description: "As the host, manage your room — rename it, end the meeting, control playback, and keep things running smoothly.",
                    gradient: "from-orange-500 to-red-700",
                    bg: "bg-gradient-to-br from-orange-50 to-red-100/80 dark:from-orange-950/35 dark:to-red-900/25",
                  },
                ].map((feature, i) => (
                  <div
                    key={i}
                    className={`${feature.bg} rounded-2xl p-6 border border-orange-200/60 dark:border-gray-700/60 backdrop-blur-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5`}
                  >
                    <div className={`w-12 h-12 bg-gradient-to-br ${feature.gradient} rounded-xl flex items-center justify-center mb-4 text-white shadow-md`}>
                      {feature.icon}
                    </div>
                    <h3 className="font-bold text-gray-900 dark:text-white mb-2 text-lg">{feature.title}</h3>
                    <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">{feature.description}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* How it works */}
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-8">
                Get started in <span className="text-orange-500">3 simple steps</span>
              </h2>
              <div className="grid md:grid-cols-3 gap-8 max-w-3xl mx-auto">
                {[
                  { step: "1", title: "Create a Room", desc: "Pick a YouTube video and name your room." },
                  { step: "2", title: "Share the Link", desc: "Send the invite code or link to your friends." },
                  { step: "3", title: "Watch Together", desc: "Enjoy synced playback, chat, and reactions!" },
                ].map((item, i) => (
                  <div key={i} className="flex flex-col items-center">
                    <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-600 rounded-full flex items-center justify-center text-white font-bold text-lg mb-4 shadow-lg">
                      {item.step}
                    </div>
                    <h3 className="font-bold text-gray-900 dark:text-white mb-1">{item.title}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>

        {/* Create Room Dialog */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent className="max-w-md bg-white/90 dark:bg-gray-900/90 backdrop-blur-md border-orange-200/60 dark:border-gray-700/60">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-red-600 rounded-lg flex items-center justify-center">
                  <Plus className="w-4 h-4 text-white" />
                </div>
                Create Streaming Room
              </DialogTitle>
              <DialogDescription>Set up a room to watch YouTube videos with friends.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="display-name">Your Display Name</Label>
                <Input id="display-name" placeholder="Enter your name" value={userName} onChange={(e) => setUserName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="room-name">Room Name</Label>
                <Input id="room-name" placeholder="e.g. Movie Night, Study Session" value={roomName} onChange={(e) => setRoomName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="video-url">YouTube Video URL</Label>
                <Input id="video-url" placeholder="https://youtube.com/watch?v=..." value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Join Policy</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant={joinPolicy === "open" ? "default" : "outline"}
                    className={joinPolicy === "open" ? "bg-gradient-to-r from-orange-500 to-red-600 text-white" : ""}
                    onClick={() => setJoinPolicy("open")}
                  >
                    Anyone with link
                  </Button>
                  <Button
                    type="button"
                    variant={joinPolicy === "approval" ? "default" : "outline"}
                    className={joinPolicy === "approval" ? "bg-gradient-to-r from-orange-500 to-red-600 text-white" : ""}
                    onClick={() => setJoinPolicy("approval")}
                  >
                    Host approval
                  </Button>
                </div>
              </div>
            </div>
            <DialogFooter className="mt-2">
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
              <Button onClick={handleCreateRoom} disabled={isFetchingVideoInfo} className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white">
                {isFetchingVideoInfo ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Create Room
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Join Room Dialog */}
        <Dialog open={showJoinDialog} onOpenChange={setShowJoinDialog}>
          <DialogContent className="max-w-md bg-white/90 dark:bg-gray-900/90 backdrop-blur-md border-orange-200/60 dark:border-gray-700/60">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-red-500 to-rose-700 rounded-lg flex items-center justify-center">
                  <Link className="w-4 h-4 text-white" />
                </div>
                Join Streaming Room
              </DialogTitle>
              <DialogDescription>Enter the room code shared by the host.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="join-name">Your Display Name</Label>
                <Input id="join-name" placeholder="Enter your name" value={userName} onChange={(e) => setUserName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="room-code">Room Code</Label>
                <Input
                  id="room-code"
                  placeholder="e.g. ynj-rnfd-uhx"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toLowerCase())}
                  maxLength={12}
                  className="text-center text-xl tracking-[0.18em] font-mono font-bold"
                />
              </div>
            </div>
            <DialogFooter className="mt-2">
              <Button variant="outline" onClick={() => setShowJoinDialog(false)}>Cancel</Button>
              <Button onClick={handleJoinRoom} className="bg-gradient-to-r from-red-500 to-rose-700 hover:from-red-600 hover:to-rose-800 text-white">
                Join Room
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {rejoinOffer && rejoinRemainingMs > 0 && (
          <div className="fixed bottom-6 right-6 z-50">
            <div className="flex items-center gap-3 rounded-2xl bg-white/90 dark:bg-gray-900/90 backdrop-blur-md border border-orange-200/60 dark:border-gray-800 px-4 py-3 shadow-xl">
              <div
                className="h-10 w-10 rounded-full flex items-center justify-center"
                style={{
                  background: `conic-gradient(#f97316 ${Math.round(rejoinProgress * 360)}deg, rgba(251, 191, 36, 0.2) 0deg)`,
                }}
              >
                <div className="h-8 w-8 rounded-full bg-white dark:bg-gray-900" />
              </div>
              <div className="text-sm">
                <p className="font-semibold text-gray-900 dark:text-white">Left the stream</p>
                <p className="text-xs text-gray-500">Rejoin within 5 seconds</p>
              </div>
              <Button
                size="sm"
                className="bg-gradient-to-r from-orange-500 to-red-600 text-white"
                onClick={handleRejoinOffer}
              >
                Rejoin
              </Button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════
  // ROOM VIEW
  // ═══════════════════════════════════════════════════════════════
  return (
    <div className={`h-dvh min-h-dvh flex flex-col overflow-hidden relative ${darkMode ? "dark bg-gray-950 text-white" : "bg-gradient-to-br from-orange-50 via-white to-red-100 text-gray-900"}`}>
      <div className="pointer-events-none absolute -top-24 left-0 h-72 w-72 rounded-full bg-orange-200/30 blur-3xl dark:bg-orange-900/20" />
      {/* Room Top Bar */}
      <div className="flex items-center justify-between px-3 md:px-5 py-2.5 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-b border-orange-200/60 dark:border-gray-800/80 z-20">
        <div className="flex items-center space-x-3 min-w-0">
          <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-red-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <Play className="w-4 h-4 text-white" />
          </div>
          {editingRoomName ? (
            <div className="flex items-center space-x-1">
              <Input
                value={editRoomNameValue}
                onChange={(e) => setEditRoomNameValue(e.target.value)}
                className="h-7 text-sm w-40"
                onKeyDown={(e) => e.key === "Enter" && handleSaveRoomName()}
                autoFocus
              />
              <Button size="sm" variant="ghost" className="h-7 px-2" onClick={handleSaveRoomName}>
                <CheckCircle className="w-4 h-4 text-green-500" />
              </Button>
              <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setEditingRoomName(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center space-x-2 min-w-0">
              <h2 className="font-semibold truncate text-sm md:text-base">{room?.name}</h2>
              {isHost && (
                <button
                  onClick={() => { setEditRoomNameValue(room?.name || ""); setEditingRoomName(true) }}
                  className="text-gray-400 hover:text-orange-500 transition-colors"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
          <Badge variant="secondary" className="text-xs flex-shrink-0 font-mono tracking-wider">{room?.id}</Badge>
        </div>

        <div className="flex items-center space-x-1 md:space-x-2">
          <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 text-xs border border-orange-200/70 dark:border-orange-800/60">
            <Users className="w-3 h-3 mr-1" /> {participants.length}
          </Badge>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowInviteDialog(true)}>
            <Mail className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowQueuePanel(!showQueuePanel)}>
            <ListVideo className={`w-4 h-4 ${showQueuePanel ? "text-orange-500" : ""}`} />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowChat(!showChat)}>
            <MessageCircle className={`w-4 h-4 ${showChat ? "text-orange-500" : ""}`} />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowSettingsDialog(true)}>
            <Settings className="w-4 h-4" />
          </Button>
          {isHost && room?.joinPolicy === "approval" && (
            <Button variant="ghost" size="icon" className="h-8 w-8 relative" onClick={() => setShowJoinRequestsDialog(true)} title="Join requests">
              <Users className="w-4 h-4" />
              {pendingJoinRequests.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-orange-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center">
                  {pendingJoinRequests.length}
                </span>
              )}
            </Button>
          )}
          {isHost ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
              onClick={() => setShowEndMeetingDialog(true)}
            >
              <PhoneOff className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
              onClick={handleLeaveRoom}
            >
              <LogOut className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 min-h-0 flex overflow-hidden relative z-10">
        {/* Video + Participants Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Video Player */}
          <div ref={videoStageRef} className="relative flex-1 bg-black group">
            <iframe
              ref={playerRef}
              src={`https://www.youtube.com/embed/${room?.videoId}?autoplay=1&enablejsapi=1&controls=0&disablekb=1&rel=0&modestbranding=1&playsinline=1&origin=${typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"}`}
              className="w-full h-full"
              style={{ pointerEvents: "none" }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              title="YouTube Video"
              onLoad={handleIframeLoad}
            />

            {/* Hover Playback Overlay (YouTube-style) */}
            <div
              className={`absolute left-1/2 bottom-5 z-20 w-[min(94vw,1100px)] -translate-x-1/2 rounded-[24px] border border-white/10 bg-gradient-to-b from-black/75 via-black/55 to-black/35 px-4 py-3 shadow-2xl shadow-black/40 backdrop-blur-md transition-opacity duration-200 ${
                isScrubbing ? "opacity-100" : "opacity-0 group-hover:opacity-100"
              }`}
            >
              <div className="flex items-center gap-2 md:gap-3">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 rounded-full border-white/15 bg-white/10 text-white hover:bg-white/18 hover:border-orange-300/50"
                  onClick={handleTogglePlayPause}
                  disabled={!canControlPlayback || !isPlayerReady}
                  title={isPlaying ? "Pause" : "Play"}
                >
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="relative h-9 w-9 rounded-full border-white/15 bg-white/10 text-white hover:bg-white/18 hover:border-orange-300/50"
                  onClick={() => handleSkipBy(-10)}
                  disabled={!canControlPlayback || !isPlayerReady}
                  title="Back 10s"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span className="absolute -bottom-0.5 text-[8px] font-bold text-white/90">10</span>
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="relative h-9 w-9 rounded-full border-white/15 bg-white/10 text-white hover:bg-white/18 hover:border-orange-300/50"
                  onClick={() => handleSkipBy(10)}
                  disabled={!canControlPlayback || !isPlayerReady}
                  title="Forward 10s"
                >
                  <RotateCw className="w-4 h-4" />
                  <span className="absolute -bottom-0.5 text-[8px] font-bold text-white/90">10</span>
                </Button>

                <span className="hidden md:block text-[11px] font-medium text-white/75 w-12 text-right">
                  {formatPlaybackTime(playerCurrentTime)}
                </span>

                <div className="flex-1 flex items-center gap-3 min-w-0">
                  <input
                    type="range"
                    min={0}
                    max={Math.max(1, Math.floor(playerDuration || 0))}
                    value={Math.min(playerCurrentTime, playerDuration || 0)}
                    onMouseDown={() => {
                      setIsScrubbing(true)
                      scrubValueRef.current = playerCurrentTime
                    }}
                    onTouchStart={() => {
                      setIsScrubbing(true)
                      scrubValueRef.current = playerCurrentTime
                    }}
                    onMouseUp={handleScrubCommit}
                    onTouchEnd={handleScrubCommit}
                    onChange={(e) => handleScrubChange(Number(e.target.value))}
                    disabled={!canControlPlayback || !isPlayerReady || playerDuration <= 0}
                    className="stream-range flex-1"
                  />
                </div>

                <span className="hidden md:block text-[11px] font-medium text-white/75 w-12">
                  {formatPlaybackTime(playerDuration)}
                </span>

                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 rounded-full border-white/15 bg-white/10 text-white hover:bg-white/18 hover:border-orange-300/50"
                  onClick={handleToggleFullscreen}
                  title="Fullscreen"
                >
                  <Maximize2 className="w-4 h-4" />
                </Button>

                {isHost && (
                  <Button
                    variant="outline"
                    size="icon"
                    className={`h-9 w-9 rounded-full border-white/15 ${controlsLocked ? "bg-orange-500 text-white" : "bg-white/10 text-white hover:bg-white/18 hover:border-orange-300/50"}`}
                    onClick={handleToggleControlsLock}
                    title={controlsLocked ? "Unlock controls" : "Lock controls"}
                  >
                    <Shield className="w-4 h-4" />
                  </Button>
                )}

                {isHost && (
                  <Button
                    variant="outline"
                    size="icon"
                    className={`h-9 w-9 rounded-full border-white/15 ${loopEnabled ? "bg-orange-500 text-white" : "bg-white/10 text-white hover:bg-white/18 hover:border-orange-300/50"}`}
                    onClick={handleToggleLoop}
                    title={loopEnabled ? "Disable loop" : "Loop current video"}
                  >
                    <Repeat className="w-4 h-4" />
                  </Button>
                )}
              </div>

              {!canControlPlayback && (
                <div className="mt-2 text-[10px] uppercase tracking-[0.2em] text-white/55">Playback locked by host</div>
              )}
            </div>

            {/* Floating Emoji Reactions — Google Meet style */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              {floatingEmojis.map((fe) => (
                <div
                  key={fe.id}
                  className="absolute text-4xl animate-emoji-float"
                  style={{
                    left: `${fe.x}%`,
                    bottom: "0%",
                    animationDelay: `${fe.delay}ms`,
                    animationDuration: `${fe.duration}s`,
                    ["--drift" as string]: `${fe.drift}px`,
                  }}
                >
                  {fe.emoji}
                </div>
              ))}
            </div>

            {/* Full Emoji Picker Overlay */}
            {showFullEmojiPicker && (
              <div className="absolute bottom-28 right-5 left-auto bg-white/90 dark:bg-gray-800/90 backdrop-blur-md rounded-2xl p-4 shadow-2xl border border-orange-200/60 dark:border-orange-900/40 z-20">
                <div className="grid grid-cols-5 gap-2">
                  {FULL_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => handleEmojiReaction(emoji)}
                        className="text-2xl hover:scale-125 transition-transform p-2 rounded-xl hover:bg-orange-100 dark:hover:bg-orange-900/30"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Always-visible Quick Reaction Bar — bottom center of video */}
            <div className="absolute bottom-24 right-5 flex items-center gap-1 bg-gradient-to-r from-orange-900/80 to-red-900/80 backdrop-blur-md rounded-full px-2 py-1.5 z-20 border border-orange-200/20 shadow-lg shadow-black/20">
              {QUICK_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => handleEmojiReaction(emoji)}
                  className="text-xl hover:scale-125 transition-all duration-200 px-1.5 py-0.5 rounded-full hover:bg-white/15"
                  title={`React with ${emoji}`}
                >
                  {emoji}
                </button>
              ))}
              <div className="w-px h-6 bg-white/20 mx-1" />
              <button
                onClick={() => setShowFullEmojiPicker(!showFullEmojiPicker)}
                className="text-white/80 hover:text-white hover:scale-110 transition-all px-1.5 py-0.5 rounded-full hover:bg-white/15"
                title="More reactions"
              >
                <Smile className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Participant Tiles + Pinned View */}
          <div className="bg-white/70 dark:bg-gray-900/70 backdrop-blur-sm border-t border-orange-200/60 dark:border-gray-800">
            {/* Pinned participant — larger view */}
            {pinnedParticipant && (
              <div className="p-2 border-b border-orange-200/60 dark:border-gray-800">
                <div ref={pinnedStageRef} className="relative w-full max-w-xs mx-auto aspect-video bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-800 rounded-xl overflow-hidden border-2 border-orange-500 shadow-lg shadow-orange-200/30 dark:shadow-orange-900/20">
                  {pinnedParticipant.stream ? (
                    <video
                      autoPlay
                      muted={pinnedParticipant.id === mySocketId}
                      playsInline
                      className="w-full h-full object-cover"
                      ref={(el) => {
                        if (!el || !pinnedParticipant.stream) return
                        el.srcObject = pinnedParticipant.stream
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-4xl font-bold text-gray-500 dark:text-gray-400">
                        {pinnedParticipant.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent p-2 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      {pinnedParticipant.isHost && <Crown className="w-3.5 h-3.5 text-orange-400" />}
                      <span className="text-xs text-white font-medium">{pinnedParticipant.name}</span>
                    </div>
                    <button onClick={() => handlePinParticipant(pinnedParticipant.id)} className="text-orange-400 hover:text-orange-300">
                      <Pin className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Horizontal tile strip */}
            <div className="h-20 md:h-24 flex items-center px-2 md:px-4 space-x-2 overflow-x-auto">
              {participants.map((p) => (
                <div
                  key={p.id}
                  className={`relative flex-shrink-0 w-14 h-14 md:w-[4.5rem] md:h-[4.5rem] rounded-xl overflow-hidden border-2 transition-all cursor-pointer group ${
                    p.isPinned
                      ? "border-orange-500 shadow-lg shadow-orange-200/30 ring-2 ring-orange-300/50"
                      : p.isSpeaking
                      ? "border-green-500"
                      : "border-gray-300/70 dark:border-gray-600/70 hover:border-orange-300"
                  }`}
                  onClick={() => handlePinParticipant(p.id)}
                  title={`${p.name}${p.isHost ? " (Host)" : ""} — Click to ${p.isPinned ? "unpin" : "pin"}`}
                >
                  {p.stream ? (
                    <video
                      ref={(el) => {
                        if (!el || !p.stream) return
                        el.srcObject = p.stream
                      }}
                      autoPlay
                      muted={p.id === mySocketId}
                      playsInline
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-800 flex items-center justify-center">
                      <span className="text-lg font-bold text-gray-600 dark:text-gray-300">{p.name.charAt(0).toUpperCase()}</span>
                    </div>
                  )}

                  {/* Bottom label */}
                  <div className="absolute bottom-0 left-0 right-0 bg-black/60 flex items-center justify-center py-0.5">
                    <span className="text-[10px] text-white truncate px-1 max-w-full">{p.name}</span>
                  </div>

                  {/* Status icons */}
                  {p.isMuted && (
                    <div className="absolute top-0.5 right-0.5 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
                      <MicOff className="w-2.5 h-2.5 text-white" />
                    </div>
                  )}
                  {p.isHost && (
                    <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-orange-500 rounded-full flex items-center justify-center">
                      <Crown className="w-2.5 h-2.5 text-white" />
                    </div>
                  )}

                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Pin className="w-4 h-4 text-white" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Control Bar */}
          <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-t border-orange-200/60 dark:border-gray-800 px-4 py-2.5 flex items-center justify-center space-x-2 md:space-x-3">
            <Button
              variant={myMic ? "default" : "outline"}
              size="icon"
              className={`rounded-full h-11 w-11 transition-all ${myMic ? "bg-orange-500 hover:bg-orange-600 text-white shadow-md shadow-orange-200/50" : "hover:border-orange-300"}`}
              onClick={handleToggleMic}
              title={myMic ? "Mute" : "Unmute"}
            >
              {myMic ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
            </Button>
            <Button
              variant={myVideo ? "default" : "outline"}
              size="icon"
              className={`rounded-full h-11 w-11 transition-all ${myVideo ? "bg-orange-500 hover:bg-orange-600 text-white shadow-md shadow-orange-200/50" : "hover:border-orange-300"}`}
              onClick={handleToggleVideo}
              title={myVideo ? "Turn off camera" : "Turn on camera"}
            >
              {myVideo ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
            </Button>

            <div className="w-px h-7 bg-gray-200 dark:bg-gray-700 mx-1" />

            <Button
              variant="outline"
              size="icon"
              className="rounded-full h-11 w-11 hover:border-orange-300"
              onClick={() => setShowNameDialog(true)}
              title="Change display name"
            >
              <Edit3 className="w-5 h-5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="rounded-full h-11 w-11 hover:border-orange-300"
              onClick={handleCopyLink}
              title="Copy invite link"
            >
              {copiedLink ? <CheckCircle className="w-5 h-5 text-green-500" /> : <Copy className="w-5 h-5" />}
            </Button>
            {videoQueue.length > 0 && (
              <Button
                variant="outline"
                size="icon"
                className="rounded-full h-11 w-11 hover:border-orange-300 relative"
                onClick={handlePlayNext}
                title="Play next in queue"
              >
                <SkipForward className="w-5 h-5" />
                <span className="absolute -top-1 -right-1 bg-orange-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center">
                  {videoQueue.length}
                </span>
              </Button>
            )}

            <div className="w-px h-7 bg-gray-200 dark:bg-gray-700 mx-1" />

            {isHost ? (
              <Button
                variant="destructive"
                size="icon"
                className="rounded-full h-11 w-11"
                onClick={() => setShowEndMeetingDialog(true)}
                title="End meeting for all"
              >
                <PhoneOff className="w-5 h-5" />
              </Button>
            ) : (
              <Button
                variant="destructive"
                size="icon"
                className="rounded-full h-11 w-11"
                onClick={handleLeaveRoom}
                title="Leave room"
              >
                <LogOut className="w-5 h-5" />
              </Button>
            )}
          </div>
        </div>

        {/* Queue Panel */}
        {showQueuePanel && (
          <div className="w-80 hidden md:flex flex-col bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-l border-orange-200/60 dark:border-gray-800">
            <div className="px-4 py-3 border-b border-orange-200/60 dark:border-gray-800 flex items-center justify-between">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <ListVideo className="w-4 h-4 text-orange-500" /> Video Queue
              </h3>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowQueuePanel(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="p-3 border-b border-orange-200/60 dark:border-gray-800">
              <div className="flex items-center space-x-2">
                <Input
                  placeholder="YouTube URL..."
                  value={newQueueUrl}
                  onChange={(e) => setNewQueueUrl(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddToQueue()}
                  className="text-xs"
                />
                <Button size="icon" className="h-8 w-8 bg-orange-500 hover:bg-orange-600 text-white flex-shrink-0" onClick={handleAddToQueue} disabled={isFetchingVideoInfo}>
                  {isFetchingVideoInfo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                </Button>
              </div>
              <div className="flex items-center space-x-2 mt-2">
                <Input
                  placeholder="Import playlist URL..."
                  value={playlistUrl}
                  onChange={(e) => setPlaylistUrl(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleImportPlaylist()}
                  className="text-xs"
                />
                <Button size="sm" className="bg-gradient-to-r from-orange-500 to-red-600 text-white text-xs" onClick={handleImportPlaylist} disabled={isImportingPlaylist}>
                  {isImportingPlaylist ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Import"}
                </Button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {videoQueue.length === 0 ? (
                <div className="text-center py-8">
                  <ListVideo className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                  <p className="text-xs text-gray-400">Queue is empty</p>
                  <p className="text-[10px] text-gray-400">Add a YouTube URL above</p>
                </div>
              ) : (
                videoQueue.map((item, i) => (
                  <div
                    key={item.id}
                    className={`p-2 rounded-lg border transition-all ${
                      i === currentQueueIndex
                        ? "bg-gradient-to-r from-orange-100 to-red-100 dark:from-orange-900/30 dark:to-red-900/20 border-orange-400/60"
                        : "bg-gradient-to-r from-orange-50 to-red-50 dark:from-gray-800 dark:to-gray-800 border-orange-200/50 dark:border-gray-700"
                    }`}
                  >
                    <div className="flex items-start space-x-2">
                      <button title="Drag/order" className="mt-1 text-gray-400 hover:text-gray-600">
                        <GripVertical className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => playQueueItem(i)} className="flex items-start space-x-2 flex-1 min-w-0 text-left">
                        <img
                          src={item.thumbnail || "https://placehold.co/72x40/png"}
                          alt={item.title}
                          className="w-[72px] h-10 rounded object-cover flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium line-clamp-2">{item.title}</p>
                          <p className="text-[10px] text-gray-400">#{i + 1} • by {item.addedBy}</p>
                          {item.duration ? <p className="text-[10px] text-gray-400">{item.duration}</p> : null}
                        </div>
                      </button>
                      <div className="flex flex-col items-center gap-1">
                        <button onClick={() => handleMoveQueueItem(i, "up")} disabled={i === 0} className="text-gray-400 hover:text-orange-500 disabled:opacity-30">
                          <ChevronUp className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleMoveQueueItem(i, "down")} disabled={i === videoQueue.length - 1} className="text-gray-400 hover:text-orange-500 disabled:opacity-30">
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleRemoveFromQueue(item.id)} className="text-gray-400 hover:text-red-500 transition-colors mt-1">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {videoQueue.length > 0 && (
              <div className="p-3 border-t border-orange-200/60 dark:border-gray-800">
                <Button size="sm" className="w-full bg-gradient-to-r from-orange-500 to-red-600 text-white text-xs" onClick={handlePlayNext}>
                  <SkipForward className="w-3.5 h-3.5 mr-1" /> Play Next
                </Button>
                <Button size="sm" variant="outline" className="w-full mt-2 text-xs border-red-200 text-red-600 hover:bg-red-50" onClick={handleClearQueue}>
                  <Trash2 className="w-3.5 h-3.5 mr-1" /> Clear Queue
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Chat Sidebar */}
        {showChat && (
          <div className="w-80 hidden md:flex flex-col bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-l border-orange-200/60 dark:border-gray-800">
            {/* Chat Header */}
            <div className="px-4 py-3 border-b border-orange-200/60 dark:border-gray-800 flex items-center justify-between">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-orange-500" /> Live Chat
              </h3>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowChat(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {messages.map((msg) => (
                <div key={msg.id} className="group">
                  {msg.userId === "system" ? (
                    <div className="text-center">
                      <span className="text-xs text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded-full">
                        {msg.text}
                      </span>
                    </div>
                  ) : (
                    <div className="relative">
                      {msg.replyTo && (
                        <div className="ml-2 mb-1 pl-2 border-l-2 border-orange-300 dark:border-orange-600">
                          <p className="text-[10px] text-gray-400">Replying to {msg.replyTo.userName}</p>
                          <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">{msg.replyTo.text}</p>
                        </div>
                      )}
                      <div className="flex items-start space-x-2">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <span className="text-[10px] text-white font-bold">{msg.userName.charAt(0).toUpperCase()}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline space-x-2">
                            <span className="text-xs font-semibold">{msg.userName}</span>
                            <span className="text-[10px] text-gray-400">{formatTime(msg.timestamp)}</span>
                          </div>
                          <p className="text-sm text-gray-700 dark:text-gray-300 break-words">{msg.text}</p>
                        </div>
                        <button
                          onClick={() => setReplyingTo(msg)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-orange-500"
                        >
                          <Reply className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {/* Reply indicator */}
            {replyingTo && (
              <div className="px-3 py-2 bg-orange-50 dark:bg-orange-900/20 border-t border-orange-200 dark:border-orange-800 flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-xs text-orange-600 dark:text-orange-400 font-medium">Replying to {replyingTo.userName}</p>
                  <p className="text-xs text-gray-500 truncate">{replyingTo.text}</p>
                </div>
                <button onClick={() => setReplyingTo(null)} className="text-gray-400 hover:text-gray-600 ml-2">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Chat Input */}
            <div className="p-3 border-t border-orange-200/60 dark:border-gray-800">
              <div className="flex items-center space-x-2">
                <Input
                  placeholder="Type a message..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                  className="text-sm"
                />
                <Button
                  size="icon"
                  onClick={handleSendMessage}
                  disabled={!chatInput.trim()}
                  className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white h-9 w-9 flex-shrink-0"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ─── DIALOGS ─────────────────────────────── */}

      {/* Invite Dialog */}
      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent className="max-w-md bg-white/90 dark:bg-gray-900/90 backdrop-blur-md border-orange-200/60 dark:border-gray-700/60">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-orange-500" /> Invite People
            </DialogTitle>
            <DialogDescription>Share the room code or send an email invitation.</DialogDescription>
          </DialogHeader>
          <Tabs defaultValue="link">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="link">Share Link</TabsTrigger>
              <TabsTrigger value="email">Email Invite</TabsTrigger>
            </TabsList>
            <TabsContent value="link" className="space-y-4 mt-4">
              <div className="flex items-center space-x-2">
                <Input readOnly value={getInviteLink()} className="text-sm" />
                <Button size="icon" onClick={handleCopyLink}>
                  {copiedLink ? <CheckCircle className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
              <div className="text-center py-2">
                <p className="text-sm text-gray-500 mb-1">Room Code</p>
                <p className="text-4xl font-mono font-bold tracking-[0.3em] text-orange-500">{room?.id}</p>
              </div>
            </TabsContent>
            <TabsContent value="email" className="space-y-4 mt-4">
              <div className="flex items-center space-x-2">
                <Input
                  placeholder="friend@email.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSendInvite()}
                />
                <Button onClick={handleSendInvite} disabled={!inviteEmail.trim() || isSendingInvite} className="bg-gradient-to-r from-orange-500 to-red-600 text-white">
                  {isSendingInvite ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Mail className="w-4 h-4 mr-1" />} Send
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Join Requests Dialog */}
      <Dialog open={showJoinRequestsDialog} onOpenChange={setShowJoinRequestsDialog}>
        <DialogContent className="max-w-md bg-white/90 dark:bg-gray-900/90 backdrop-blur-md border-orange-200/60 dark:border-gray-700/60">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-orange-500" /> Pending Join Requests
            </DialogTitle>
            <DialogDescription>Approve or reject people waiting to join this stream.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 max-h-[320px] overflow-y-auto">
            {pendingJoinRequests.length === 0 ? (
              <p className="text-sm text-gray-500">No pending requests.</p>
            ) : (
              pendingJoinRequests.map((request) => (
                <div key={request.id} className="p-3 rounded-lg border border-orange-200/60 dark:border-gray-700/60 bg-white/70 dark:bg-gray-800/50">
                  <p className="font-medium text-sm">{request.name}</p>
                  <p className="text-xs text-gray-500 mb-2">Requested at {new Date(request.requestedAt).toLocaleTimeString()}</p>
                  <div className="flex gap-2">
                    <Button size="sm" className="bg-gradient-to-r from-orange-500 to-red-600 text-white" onClick={() => handleApproveJoinRequest(request.id)}>
                      Approve
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleRejectJoinRequest(request.id)}>
                      Reject
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Change Name Dialog */}
      <Dialog open={showNameDialog} onOpenChange={setShowNameDialog}>
        <DialogContent className="max-w-sm bg-white/90 dark:bg-gray-900/90 backdrop-blur-md border-orange-200/60 dark:border-gray-700/60">
          <DialogHeader>
            <DialogTitle>Change Display Name</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Enter new display name"
            value={newDisplayName}
            onChange={(e) => setNewDisplayName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleChangeName()}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNameDialog(false)}>Cancel</Button>
            <Button onClick={handleChangeName} className="bg-gradient-to-r from-orange-500 to-red-600 text-white">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* End Meeting Dialog (host only) */}
      <Dialog open={showEndMeetingDialog} onOpenChange={setShowEndMeetingDialog}>
        <DialogContent className="max-w-sm bg-white/90 dark:bg-gray-900/90 backdrop-blur-md border-orange-200/60 dark:border-gray-700/60">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-500">
              <PhoneOff className="w-5 h-5" /> End Meeting
            </DialogTitle>
            <DialogDescription>
              This will end the meeting for all participants. The room code will no longer be valid.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setShowEndMeetingDialog(false)} className="flex-1">Cancel</Button>
            <Button variant="destructive" onClick={handleEndMeeting} className="flex-1">End for All</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Settings Dialog */}
      <Dialog open={showSettingsDialog} onOpenChange={setShowSettingsDialog}>
        <DialogContent className="max-w-sm bg-white/90 dark:bg-gray-900/90 backdrop-blur-md border-orange-200/60 dark:border-gray-700/60">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-orange-500" /> Room Settings
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex items-center justify-between">
              <span className="text-sm">Dark Mode</span>
              <button
                onClick={toggleDarkMode}
                className={`w-11 h-6 rounded-full relative transition-colors duration-300 ${darkMode ? "bg-orange-500" : "bg-gray-300"}`}
              >
                <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transform transition-transform duration-300 ${darkMode ? "translate-x-[22px]" : "translate-x-0.5"}`} />
              </button>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Show Chat</span>
              <button
                onClick={() => setShowChat(!showChat)}
                className={`w-11 h-6 rounded-full relative transition-colors duration-300 ${showChat ? "bg-orange-500" : "bg-gray-300"}`}
              >
                <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transform transition-transform duration-300 ${showChat ? "translate-x-[22px]" : "translate-x-0.5"}`} />
              </button>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Video Queue Panel</span>
              <button
                onClick={() => setShowQueuePanel(!showQueuePanel)}
                className={`w-11 h-6 rounded-full relative transition-colors duration-300 ${showQueuePanel ? "bg-orange-500" : "bg-gray-300"}`}
              >
                <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transform transition-transform duration-300 ${showQueuePanel ? "translate-x-[22px]" : "translate-x-0.5"}`} />
              </button>
            </div>
            {isHost && (
              <div className="flex items-center justify-between">
                <span className="text-sm">Require Host Approval</span>
                <button
                  onClick={() => {
                    const updatedPolicy = (room?.joinPolicy || joinPolicy) === "approval" ? "open" : "approval"
                    setJoinPolicy(updatedPolicy)
                    setRoom((prev) => (prev ? { ...prev, joinPolicy: updatedPolicy } : prev))
                  }}
                  className={`w-11 h-6 rounded-full relative transition-colors duration-300 ${(room?.joinPolicy || joinPolicy) === "approval" ? "bg-orange-500" : "bg-gray-300"}`}
                >
                  <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transform transition-transform duration-300 ${(room?.joinPolicy || joinPolicy) === "approval" ? "translate-x-[22px]" : "translate-x-0.5"}`} />
                </button>
              </div>
            )}
            {isHost && (
              <div className="flex items-center justify-between">
                <span className="text-sm">Lock Playback Controls</span>
                <button
                  onClick={handleToggleControlsLock}
                  className={`w-11 h-6 rounded-full relative transition-colors duration-300 ${controlsLocked ? "bg-orange-500" : "bg-gray-300"}`}
                >
                  <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transform transition-transform duration-300 ${controlsLocked ? "translate-x-[22px]" : "translate-x-0.5"}`} />
                </button>
              </div>
            )}
            {isHost && (
              <div className="flex items-center justify-between">
                <span className="text-sm">Loop Current Video</span>
                <button
                  onClick={handleToggleLoop}
                  className={`w-11 h-6 rounded-full relative transition-colors duration-300 ${loopEnabled ? "bg-orange-500" : "bg-gray-300"}`}
                >
                  <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transform transition-transform duration-300 ${loopEnabled ? "translate-x-[22px]" : "translate-x-0.5"}`} />
                </button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Floating emoji animation */}
      <style jsx>{`
        .stream-range {
          appearance: none;
          height: 6px;
          border-radius: 9999px;
          background: linear-gradient(90deg, rgba(249, 115, 22, 0.95), rgba(239, 68, 68, 0.95));
          outline: none;
          box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.18);
        }
        .stream-range::-webkit-slider-thumb {
          appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 9999px;
          background: #ffffff;
          border: 3px solid #f97316;
          box-shadow: 0 6px 16px rgba(0, 0, 0, 0.28);
          cursor: pointer;
        }
        .stream-range::-moz-range-thumb {
          width: 16px;
          height: 16px;
          border-radius: 9999px;
          background: #ffffff;
          border: 3px solid #f97316;
          box-shadow: 0 6px 16px rgba(0, 0, 0, 0.28);
          cursor: pointer;
        }
        .stream-range::-webkit-slider-runnable-track {
          height: 6px;
          border-radius: 9999px;
          background: transparent;
        }
        .stream-range::-moz-range-track {
          height: 6px;
          border-radius: 9999px;
          background: transparent;
        }
        @keyframes emoji-float {
          0% {
            opacity: 1;
            transform: translate3d(0, 0, 0) scale(1) rotate(0deg);
          }
          25% {
            opacity: 0.95;
            transform: translate3d(calc(var(--drift) * 0.35), -22vh, 0) scale(1.15) rotate(-4deg);
          }
          50% {
            opacity: 0.75;
            transform: translate3d(calc(var(--drift) * -0.22), -48vh, 0) scale(1.05) rotate(3deg);
          }
          80% {
            opacity: 0.12;
            transform: translate3d(calc(var(--drift) * 0.45), -80vh, 0) scale(0.82) rotate(-2deg);
          }
          100% {
            opacity: 0;
            transform: translate3d(calc(var(--drift) * -0.2), -100vh, 0) scale(0.7) rotate(0deg);
          }
        }
        .animate-emoji-float {
          animation: emoji-float linear forwards;
          will-change: transform, opacity;
        }
      `}</style>
    </div>
  )
}
