"use client"

import { useState, useEffect, use } from "react"
import Link from "next/link"
import "./drag-styles.css"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  ArrowLeft,
  Play,
  Pause,
  MoreVertical,
  Share2,
  Download,
  Users,
  Activity,
  Search,
  Grid3X3,
  List,
  Clock,
  Eye,
  ThumbsUp,
  Plus,
  GripVertical,
  UserPlus,
  ExternalLink,
  MessageSquare,
  Trash2,
  Heart,
} from "lucide-react"
import AuthGuard from "@/components/AuthGuard"
import { 
  DndContext, 
  closestCenter, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors,
  DragEndEvent 
} from "@dnd-kit/core"
import { 
  arrayMove, 
  SortableContext, 
  sortableKeyboardCoordinates, 
  useSortable,
  verticalListSortingStrategy
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

interface Video {
  id: string
  title: string
  channel: string
  duration: string
  thumbnail: string
  addedBy: string
  addedAt: string
  views: number
  likes: number
  description: string
  youtubeUrl: string
  position: number
}

interface Collaborator {
  id: string
  name: string
  avatar: string
  role: "admin" | "editor" | "viewer"
  joinedAt: string
  lastActive: string
}

interface Comment {
  id: string
  user: {
    name: string
    avatar: string
  }
  content: string
  timestamp: string
  replies: Comment[]
}

interface PlaylistData {
  id: string
  title: string
  description: string
  thumbnail: string
  isPublic: boolean
  isCollaborative: boolean
  owner: {
    name: string
    avatar: string
  }
  videos: Video[]
  collaborators: Collaborator[]
  comments: Comment[]
  activities: Activity[]
  stats: {
    totalViews: number
    totalDuration: string
    createdAt: string
    lastModified: string
  }
  tags: string[]
  category: string
  userRole: string | null
  isFavorite?: boolean
}

interface Activity {
  id: string
  user: string
  action: string
  details: any
  timestamp: string
}

export default function PlaylistViewPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const [playlist, setPlaylist] = useState<PlaylistData | null>(null)
  const [currentVideo, setCurrentVideo] = useState<Video | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [viewMode, setViewMode] = useState<"grid" | "list">("list")
  const [sortBy, setSortBy] = useState("order")
  const [loading, setLoading] = useState(true)
  const [isDragging, setIsDragging] = useState(false)
  const [showAddVideo, setShowAddVideo] = useState(false)
  const [newVideoUrl, setNewVideoUrl] = useState("")
  const [addingVideo, setAddingVideo] = useState(false)
  const [showAddCollaborator, setShowAddCollaborator] = useState(false)
  const [collaboratorEmail, setCollaboratorEmail] = useState("")
  const [collaboratorRole, setCollaboratorRole] = useState("viewer")
  const [addingCollaborator, setAddingCollaborator] = useState(false)
  const [removingCollaborator, setRemovingCollaborator] = useState<string | null>(null)
  const [commentText, setCommentText] = useState("")
  const [addingComment, setAddingComment] = useState(false)
  const [deletingComment, setDeletingComment] = useState<string | null>(null)
  const [user, setUser] = useState<{id: string, name: string, email: string, avatar: string} | null>(null)
  
  // Set up sensors for DnD
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Fetch user data when component mounts
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const token = localStorage.getItem("token")
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/auth/me`,
          {
            credentials: "include",
            headers: {
              ...(token && { Authorization: `Bearer ${token}` }),
            },
          }
        )

        if (response.ok) {
          const responseData = await response.json()
          console.log("User data fetched:", responseData) // Log to check structure
          
          // The backend returns the user object wrapped in a 'user' property
          const userData = responseData.user || responseData;
          
          setUser({
            id: userData.id || userData._id,
            name: userData.name,
            email: userData.email,
            avatar: userData.avatar || "/placeholder.svg"
          })
          
          // Just to verify
          console.log("User avatar set to:", userData.avatar || "/placeholder.svg")
        }
      } catch (error) {
        console.error("Error fetching user:", error)
      }
    }

    fetchUser()
  }, [])

  const toggleFavorite = async () => {
    if (!playlist) return

    try {
      const method = playlist.isFavorite ? "DELETE" : "POST"
      const token = localStorage.getItem("token")
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/playlists/${playlist.id}/favorite`,
        {
          method,
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            ...(token && { Authorization: `Bearer ${token}` }),
          },
        },
      )

      if (!response.ok) {
        throw new Error("Failed to toggle favorite")
      }

      const data = await response.json()
      
      // Update playlist state
      setPlaylist(prev => prev ? { ...prev, isFavorite: data.isFavorite } : null)

    } catch (error) {
      console.error("Error toggling favorite:", error)
      alert("Failed to update favorite status")
    }
  }

  const handleAddComment = async () => {
    if (!commentText.trim()) {
      return
    }
    
    setAddingComment(true)
    try {
      const token = localStorage.getItem("token")
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/playlists/${resolvedParams.id}/comments`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            ...(token && { Authorization: `Bearer ${token}` }),
          },
          body: JSON.stringify({
            content: commentText.trim(),
          }),
        }
      )

      if (response.ok) {
        setCommentText("")
        
        // Refresh playlist data to get updated comments
        const fetchPlaylist = async () => {
          try {
            const token = localStorage.getItem("token")
            const response = await fetch(
              `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/playlists/${resolvedParams.id}`,
              {
                credentials: "include",
                headers: {
                  ...(token && { Authorization: `Bearer ${token}` }),
                },
              }
            )

            if (response.ok) {
              const data = await response.json()
              setPlaylist(data)
            }
          } catch (error) {
            console.error("Error refreshing playlist:", error)
          }
        }
        fetchPlaylist()
      } else {
        const errorData = await response.json()
        alert(errorData.error || "Failed to add comment")
      }
    } catch (error) {
      console.error("Error adding comment:", error)
      alert("Failed to add comment")
    } finally {
      setAddingComment(false)
    }
  }

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm("Are you sure you want to delete this comment?")) return
    
    setDeletingComment(commentId)
    try {
      const token = localStorage.getItem("token")
      // Add console logs to see what's happening
      console.log("Deleting comment with ID:", commentId)
      console.log("User:", user)
      console.log("Playlist role:", playlist?.userRole)
      console.log(`Sending DELETE request to: /api/playlists/${resolvedParams.id}/comments/${commentId}`)
      
      // Create direct URL for the API call
      const apiUrl = `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/playlists/${resolvedParams.id}/comments/${commentId}`
      console.log("Full URL:", apiUrl)
      
      const response = await fetch(apiUrl, {
          method: "DELETE",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            ...(token && { Authorization: `Bearer ${token}` }),
          },
        }
      )

      console.log("Delete comment response status:", response.status)
      
      let data
      try {
        data = await response.json()
        console.log("Delete comment response data:", data)
      } catch (e) {
        console.log("No JSON response or parse error:", e)
      }

      if (response.ok) {
        console.log("Comment deleted successfully!")
        // Refresh playlist data to get updated comments
        const fetchPlaylist = async () => {
          try {
            const token = localStorage.getItem("token")
            const response = await fetch(
              `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/playlists/${resolvedParams.id}`,
              {
                credentials: "include",
                headers: {
                  ...(token && { Authorization: `Bearer ${token}` }),
                },
              }
            )

            if (response.ok) {
              const data = await response.json()
              setPlaylist(data)
            }
          } catch (error) {
            console.error("Error refreshing playlist:", error)
          }
        }
        fetchPlaylist()
      } else {
        alert(data?.error || `Failed to delete comment (status: ${response.status})`)
      }
    } catch (error) {
      console.error("Error deleting comment:", error)
      alert(`Failed to delete comment: ${error.message || "Unknown error"}`)
    } finally {
      setDeletingComment(null)
    }
  }

  const handleAddVideo = async () => {
    if (!newVideoUrl.trim()) {
      alert("Please enter a YouTube URL")
      return
    }

    setAddingVideo(true)
    try {
      const token = localStorage.getItem("token")
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/playlists/${resolvedParams.id}/items`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            ...(token && { Authorization: `Bearer ${token}` }),
          },
          body: JSON.stringify({
            youtube_url: newVideoUrl,
          }),
        }
      )

      if (response.ok) {
        setNewVideoUrl("")
        setShowAddVideo(false)
        // Refresh playlist data
        const fetchPlaylist = async () => {
          try {
            const token = localStorage.getItem("token")
            const response = await fetch(
              `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/playlists/${resolvedParams.id}`,
              {
                credentials: "include",
                headers: {
                  "Content-Type": "application/json",
                  ...(token && { Authorization: `Bearer ${token}` }),
                },
              }
            )

            if (response.ok) {
              const data = await response.json()
              setPlaylist(data)
            }
          } catch (error) {
            console.error("Error refreshing playlist:", error)
          }
        }
        fetchPlaylist()
      } else {
        const error = await response.json()
        alert(error.error || "Failed to add video")
      }
    } catch (error) {
      console.error("Error adding video:", error)
      alert("Failed to add video")
    } finally {
      setAddingVideo(false)
    }
  }
  
  // Create a SortableVideoItem component for drag-and-drop
  const SortableVideoItem = ({ video, index }: { video: Video; index: number }) => {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({
      id: video.id,
      disabled: sortBy !== "order"
    });
    
    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      zIndex: isDragging ? 9999 : undefined,
      opacity: isDragging ? 0.8 : undefined,
    };
    
    // Set data attribute for CSS styling during drag
    const dragAttributes = isDragging ? { 'data-dnd-dragging': 'true' } : {};
    
    return (
      <Card
        ref={setNodeRef}
        style={style}
        {...dragAttributes}
        className={`group hover:shadow-md transition-all duration-200 h-full select-none
          ${currentVideo?.id === video.id ? "ring-2 ring-red-500" : ""}
          relative
        `}
      >
        <CardContent className={`p-4 ${viewMode === "grid" ? "flex flex-col h-full" : ""}`}>
          <div className={viewMode === "grid" ? "flex flex-col gap-2 h-full" : "flex items-center gap-4"}>
            <div className="flex items-center gap-2 text-gray-500 w-8">
              <div 
                {...attributes}
                {...listeners}
                className="opacity-0 group-hover:opacity-100 transition-opacity cursor-grab flex flex-col items-center p-1 hover:bg-gray-100 rounded-full select-none drag-handle"
                style={{ touchAction: 'none' }}
                title={sortBy === "order" ? "Drag to reorder" : "Set sort to 'Playlist Order' to enable reordering"}
              >
                {/* YouTube-style three lines */}
                <div className="flex flex-col justify-center items-center gap-1">
                  <div className="w-4 h-0.5 bg-gray-500 rounded-full"></div>
                  <div className="w-4 h-0.5 bg-gray-500 rounded-full"></div>
                  <div className="w-4 h-0.5 bg-gray-500 rounded-full"></div>
                </div>
              </div>
              <span className="text-sm font-medium select-none">{index + 1}</span>
            </div>
            
            <div className={`relative ${viewMode === "grid" ? "w-full h-32" : ""}`}>
              <img
                src={video.thumbnail || "/placeholder.svg"}
                alt={video.title}
                className={`object-cover rounded cursor-pointer ${viewMode === "grid" ? "w-full h-32" : "w-32 h-20"}`}
                onClick={() => window.open(video.youtubeUrl, '_blank')}
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-200 rounded flex items-center justify-center">
                <Button
                  size="sm"
                  className="opacity-0 group-hover:opacity-100 transition-opacity bg-red-600 hover:bg-red-700"
                  onClick={() => window.open(video.youtubeUrl, '_blank')}
                >
                  <Play className="h-4 w-4" />
                </Button>
              </div>
              <div className="absolute bottom-1 right-1 bg-black/80 text-white text-xs px-1 rounded">
                {video.duration}
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <h3 
                className="font-semibold line-clamp-2 hover:text-red-600 transition-colors cursor-pointer"
                onClick={() => window.open(video.youtubeUrl, '_blank')}
              >
                {video.title}
              </h3>
              <p className="text-sm text-gray-600 mb-1">{video.channel}</p>
              <div className="flex items-center gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <Eye className="h-3 w-3" />
                  {video.views.toLocaleString()} views
                </span>
                <span className="flex items-center gap-1">
                  <ThumbsUp className="h-3 w-3" />
                  {video.likes.toLocaleString()}
                </span>
                <span>Added by {video.addedBy}</span>
                <span>{new Date(video.addedAt).toLocaleDateString()}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="sm" 
                className="opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => window.open(video.youtubeUrl, '_blank')}
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
              {playlist?.userRole === "owner" || playlist?.userRole === "admin" || playlist?.userRole === "editor" ? (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-red-600 hover:text-red-700"
                  onClick={() => handleDeleteVideo(video.id)}
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              ) : (
                <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over) return;
    
    // If the item didn't move, we don't need to do anything
    if (active.id === over.id) return;
    
    if (sortBy !== "order") {
      alert("You can only reorder videos when sorted by 'Playlist Order'");
      return;
    }
    
    // Create a new array of videos to update the UI immediately
    if (!playlist) return;
    
    const oldIndex = sortedVideos.findIndex(video => video.id === active.id);
    const newIndex = sortedVideos.findIndex(video => video.id === over.id);
    
    if (oldIndex === -1 || newIndex === -1) return;
    
    // Update the videos array
    const newVideos = arrayMove(sortedVideos, oldIndex, newIndex);
    const movedItem = sortedVideos[oldIndex];
    
    // Update the UI optimistically with the new order
    const updatedVideos = newVideos.map((video, idx) => ({
      ...video,
      position: idx
    }));
    
    const updatedPlaylist = {
      ...playlist,
      videos: updatedVideos
    };
    
    setPlaylist(updatedPlaylist);
    
    // Send the update to the server
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/playlists/${resolvedParams.id}/items/${movedItem.id}/move`,
        {
          method: "PUT",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            ...(token && { Authorization: `Bearer ${token}` }),
          },
          body: JSON.stringify({
            new_position: newIndex,
          }),
        }
      );
      
      if (!response.ok) {
        // If the request fails, revert the UI change
        const error = await response.json();
        console.error("Failed to update video position:", error);
        
        // Fetch fresh data
        const fetchPlaylist = async () => {
          try {
            const response = await fetch(
              `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/playlists/${resolvedParams.id}`,
              {
                credentials: "include",
                headers: {
                  ...(token && { Authorization: `Bearer ${token}` }),
                },
              }
            );
            
            if (response.ok) {
              const data = await response.json();
              setPlaylist(data);
            }
          } catch (error) {
            console.error("Error refreshing playlist:", error);
          }
        };
        fetchPlaylist();
      }
    } catch (error) {
      console.error("Error updating video position:", error);
      // Fetch fresh data
      const fetchPlaylist = async () => {
        try {
          const token = localStorage.getItem("token");
          const response = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/playlists/${resolvedParams.id}`,
            {
              credentials: "include",
              headers: {
                ...(token && { Authorization: `Bearer ${token}` }),
              },
            }
          );
          
          if (response.ok) {
            const data = await response.json();
            setPlaylist(data);
          }
        } catch (error) {
          console.error("Error refreshing playlist:", error);
        }
      };
      fetchPlaylist();
    }
  }

  const handleAddCollaborator = async () => {
    if (!collaboratorEmail.trim()) {
      alert("Please enter an email address")
      return
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(collaboratorEmail)) {
      alert("Please enter a valid email address")
      return
    }

    setAddingCollaborator(true)
    try {
      const token = localStorage.getItem("token")
      console.log("Token found:", !!token)
      
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/playlists/${resolvedParams.id}/collaborators`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            ...(token && { Authorization: `Bearer ${token}` }),
          },
          body: JSON.stringify({
            email: collaboratorEmail,
            permission_level: collaboratorRole,
          }),
        }
      )

      console.log("Response status:", response.status)
      const responseData = await response.json()
      console.log("Response data:", responseData)

      if (response.ok) {
        setCollaboratorEmail("")
        setCollaboratorRole("viewer")
        setShowAddCollaborator(false)
        alert("Collaboration invite sent successfully!")
        
        // Refresh playlist data
        const fetchPlaylist = async () => {
          try {
            const token = localStorage.getItem("token")
            const response = await fetch(
              `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/playlists/${resolvedParams.id}`,
              {
                credentials: "include",
                headers: {
                  "Content-Type": "application/json",
                  ...(token && { Authorization: `Bearer ${token}` }),
                },
              }
            )

            if (response.ok) {
              const data = await response.json()
              setPlaylist(data)
            }
          } catch (error) {
            console.error("Error refreshing playlist:", error)
          }
        }
        fetchPlaylist()
      } else {
        alert(responseData.error || "Failed to send collaboration invite")
      }
    } catch (error) {
      console.error("Error adding collaborator:", error)
      alert("Failed to send collaboration invite")
    } finally {
      setAddingCollaborator(false)
    }
  }

  const handleRemoveCollaborator = async (collaboratorId: string, collaboratorName: string) => {
    if (!confirm(`Are you sure you want to remove ${collaboratorName} from this playlist?`)) return
    
    setRemovingCollaborator(collaboratorId)
    try {
      const token = localStorage.getItem("token")
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/playlists/${resolvedParams.id}/collaborators/${collaboratorId}`,
        {
          method: "DELETE",
          credentials: "include",
          headers: {
            ...(token && { Authorization: `Bearer ${token}` }),
          },
        }
      )

      if (response.ok) {
        // Refresh playlist data
        const fetchPlaylist = async () => {
          try {
            const token = localStorage.getItem("token")
            const response = await fetch(
              `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/playlists/${resolvedParams.id}`,
              {
                credentials: "include",
                headers: {
                  ...(token && { Authorization: `Bearer ${token}` }),
                },
              }
            )

            if (response.ok) {
              const data = await response.json()
              setPlaylist(data)
            }
          } catch (error) {
            console.error("Error refreshing playlist:", error)
          }
        }
        fetchPlaylist()
      } else {
        const errorData = await response.json()
        alert(errorData.error || "Failed to remove collaborator")
      }
    } catch (error) {
      console.error("Error removing collaborator:", error)
      alert("Failed to remove collaborator")
    } finally {
      setRemovingCollaborator(null)
    }
  }

  const handleDeletePlaylist = async () => {
    if (!confirm("Are you sure you want to delete this playlist?")) return
    
    try {
      const token = localStorage.getItem("token")
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/playlists/${resolvedParams.id}`,
        {
          method: "DELETE",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            ...(token && { Authorization: `Bearer ${token}` }),
          },
        }
      )

      if (response.ok) {
        window.location.href = "/playlists"
      } else {
        alert("Failed to delete playlist")
      }
    } catch (error) {
      console.error("Error deleting playlist:", error)
      alert("Failed to delete playlist")
    }
  }

  const handlePlayAll = () => {
    if (playlist && playlist.videos.length > 0) {
      window.open(playlist.videos[0].youtubeUrl, '_blank')
    }
  }

  const handleSharePlaylist = async () => {
    const url = window.location.href
    try {
      await navigator.clipboard.writeText(url)
      alert("Playlist URL copied to clipboard!")
    } catch (error) {
      console.error("Failed to copy URL:", error)
      alert("Failed to copy URL")
    }
  }

  const handleExportPlaylist = async () => {
    if (!playlist) return
    
    const playlistData = {
      title: playlist.title,
      description: playlist.description,
      videos: playlist.videos.map(video => ({
        title: video.title,
        channel: video.channel,
        url: video.youtubeUrl,
        duration: video.duration
      }))
    }
    
    const blob = new Blob([JSON.stringify(playlistData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${playlist.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleDeleteVideo = async (videoId: string) => {
    if (!confirm("Are you sure you want to remove this video from the playlist?")) return
    
    try {
      const token = localStorage.getItem("token")
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/playlists/${resolvedParams.id}/items/${videoId}`,
        {
          method: "DELETE",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            ...(token && { Authorization: `Bearer ${token}` }),
          },
        }
      )

      if (response.ok) {
        // Refresh playlist data
        const fetchPlaylist = async () => {
          try {
            const token = localStorage.getItem("token")
            const response = await fetch(
              `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/playlists/${resolvedParams.id}`,
              {
                credentials: "include",
                headers: {
                  "Content-Type": "application/json",
                  ...(token && { Authorization: `Bearer ${token}` }),
                },
              }
            )

            if (response.ok) {
              const data = await response.json()
              setPlaylist(data)
            }
          } catch (error) {
            console.error("Error refreshing playlist:", error)
          }
        }
        fetchPlaylist()
      } else {
        alert("Failed to remove video")
      }
    } catch (error) {
      console.error("Error removing video:", error)
      alert("Failed to remove video")
    }
  }

  useEffect(() => {
    const fetchPlaylist = async () => {
      setLoading(true)
      try {
        const token = localStorage.getItem("token")
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/playlists/${resolvedParams.id}`,
          {
            credentials: "include",
            headers: {
              "Content-Type": "application/json",
              ...(token && { Authorization: `Bearer ${token}` }),
            },
          }
        )

        if (response.status === 403) {
          // Handle private playlist access denied
          alert("Cannot access private playlist. This playlist is private and you don't have permission to view it.")
          window.location.href = "/playlists"
          return
        }

        if (response.status === 404) {
          alert("Playlist not found.")
          window.location.href = "/playlists"
          return
        }

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: "Unknown error" }))
          throw new Error(errorData.error || `HTTP ${response.status}`)
        }

        const data = await response.json()
        console.log("Playlist data received:", data)
        console.log("Videos in playlist:", data.videos)
        console.log("Videos length:", data.videos?.length)
        setPlaylist(data)
        if (data.videos && data.videos.length > 0) {
          setCurrentVideo(data.videos[0])
        }
      } catch (error) {
        console.error("Error fetching playlist:", error)
        const errorMessage = error instanceof Error ? error.message : "Unknown error"
        if (errorMessage.includes("Failed to fetch") || errorMessage.includes("NetworkError")) {
          alert("Cannot connect to server. Please make sure the backend server is running.")
        } else {
          alert(`Error loading playlist: ${errorMessage}`)
        }
        window.location.href = "/playlists"
      } finally {
        setLoading(false)
      }
    }

    fetchPlaylist()
  }, [resolvedParams.id])

  const filteredVideos =
    playlist?.videos.filter(
      (video) =>
        video.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        video.channel.toLowerCase().includes(searchQuery.toLowerCase()),
    ) || []

  console.log("Filtered videos:", filteredVideos)
  console.log("Search query:", searchQuery)

  const sortedVideos = [...filteredVideos].sort((a, b) => {
    switch (sortBy) {
      case "title":
        return a.title.localeCompare(b.title)
      case "channel":
        return a.channel.localeCompare(b.channel)
      case "duration":
        return a.duration.localeCompare(b.duration)
      case "views":
        return b.views - a.views
      case "recent":
        return new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime()
      default:
        return 0
    }
  })

  console.log("Sorted videos:", sortedVideos)
  console.log("Sort by:", sortBy)

  // VideoCard component removed since it's been inlined

  if (loading) {
    return (
      <AuthGuard>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
        </div>
      </AuthGuard>
    )
  }

  if (!playlist) {
    return (
      <AuthGuard>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Playlist not found</h2>
          <p className="text-gray-600 mb-4">The playlist you're looking for doesn't exist.</p>
          <Link href="/playlists">
            <Button className="bg-red-600 hover:bg-red-700">Back to Playlists</Button>
          </Link>
        </div>
      </div>
      </AuthGuard>
    )
  }

  return (
    <AuthGuard>
      <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-start gap-6">
            <Link href="/playlists">
              <Button variant="ghost" size="sm" className="mt-2">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </Link>

            <img
              src={playlist.thumbnail || "/placeholder.svg"}
              alt={playlist.title}
              className="w-48 h-32 object-cover rounded-lg"
            />

            <div className="flex-1">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h1 className="text-3xl font-bold text-gray-900 mb-2">{playlist.title}</h1>
                  <p className="text-gray-600 mb-4">{playlist.description}</p>

                  <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
                    <span>{playlist.videos.length} videos</span>
                    <span className="flex items-center gap-1">
                      <Eye className="h-3 w-3" />
                      {playlist.stats.totalViews.toLocaleString()} views
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {playlist.stats.totalDuration}
                    </span>
                    <span>Updated {new Date(playlist.stats.lastModified).toLocaleDateString()}</span>
                  </div>

                  <div className="flex items-center gap-2 mb-4">
                    <img
                      src={playlist.owner.avatar || "/placeholder.svg"}
                      alt={playlist.owner.name}
                      className="w-8 h-8 rounded-full"
                    />
                    <span className="text-sm text-gray-600">Created by {playlist.owner.name}</span>
                    {playlist.isCollaborative && (
                      <Badge className="bg-blue-100 text-blue-800">
                        <Users className="h-3 w-3 mr-1" />
                        Collaborative
                      </Badge>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {playlist.tags.map((tag) => (
                      <Badge key={tag} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button 
                    className="bg-red-600 hover:bg-red-700"
                    onClick={handlePlayAll}
                  >
                    <Play className="h-4 w-4 mr-2" />
                    Play All
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={handleSharePlaylist}
                  >
                    <Share2 className="h-4 w-4 mr-2" />
                    Share
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={toggleFavorite}
                    className={playlist?.isFavorite ? "bg-red-50 border-red-200 text-red-600 hover:bg-red-100" : ""}
                  >
                    <Heart className={`h-4 w-4 mr-2 ${playlist?.isFavorite ? 'fill-red-500 text-red-500' : ''}`} />
                    {playlist?.isFavorite ? 'Unfavorite' : 'Favorite'}
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={handleExportPlaylist}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                  {playlist?.userRole === "owner" && (
                    <>
                      <Link href={`/playlists/${resolvedParams.id}/edit`}>
                        <Button variant="outline">
                          Edit
                        </Button>
                      </Link>
                      <Button 
                        variant="outline"
                        onClick={handleDeletePlaylist}
                        className="text-red-600 hover:text-red-700"
                      >
                        Delete
                      </Button>
                    </>
                  )}
                  <Button variant="outline">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs defaultValue="videos" className="space-y-6">
          <TabsList>
            <TabsTrigger value="videos">Videos ({playlist.videos.length})</TabsTrigger>
            <TabsTrigger value="collaborators">Collaborators ({playlist.collaborators.length})</TabsTrigger>
            <TabsTrigger value="comments">Comments ({playlist.comments.length})</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>

          <TabsContent value="videos" className="space-y-6">
            {/* Video Controls */}
            <div className="flex flex-col lg:flex-row gap-4 items-center justify-between bg-white p-4 rounded-lg border border-gray-200">
              <div className="flex-1 w-full lg:max-w-md">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Search videos..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 w-full lg:w-auto">
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-full lg:w-40">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="order">Playlist Order</SelectItem>
                    <SelectItem value="title">Title (A-Z)</SelectItem>
                    <SelectItem value="channel">Channel</SelectItem>
                    <SelectItem value="duration">Duration</SelectItem>
                    <SelectItem value="views">Most Views</SelectItem>
                    <SelectItem value="recent">Recently Added</SelectItem>
                  </SelectContent>
                </Select>

                <div className="flex border border-gray-200 rounded-md">
                  <Button
                    variant={viewMode === "list" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("list")}
                    className="rounded-r-none"
                  >
                    <List className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={viewMode === "grid" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("grid")}
                    className="rounded-l-none"
                  >
                    <Grid3X3 className="h-4 w-4" />
                  </Button>
                </div>

                {playlist.isCollaborative && (
                  <Button 
                    variant="outline"
                    onClick={() => setShowAddVideo(true)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Video
                  </Button>
                )}
              </div>
            </div>

            {/* Videos List */}
            {sortedVideos.length > 0 ? (
              <div className={isDragging ? "dragging" : ""}>
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragStart={() => setIsDragging(true)}
                  onDragEnd={(event) => {
                    setIsDragging(false);
                    handleDragEnd(event);
                  }}
                >
                  <SortableContext 
                    items={sortedVideos.map(video => video.id)} 
                    strategy={verticalListSortingStrategy}
                  >
                    <div 
                      className={viewMode === "grid" 
                        ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-4" 
                        : "space-y-2"
                      }
                    >
                      {sortedVideos.map((video, index) => (
                        <SortableVideoItem 
                          key={video.id} 
                          video={video} 
                          index={index}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              </div>
            ) : (
              <div className="text-center p-8 border border-dashed rounded-md my-4">
                <p className="text-gray-500 mb-4">No videos in this playlist</p>
                {playlist?.userRole === "admin" || playlist?.userRole === "editor" ? (
                  <Button 
                    onClick={() => setShowAddVideo(true)}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    <Plus className="h-4 w-4 mr-2" /> Add Video
                  </Button>
                ) : null}
              </div>
            )}
          </TabsContent>

          <TabsContent value="collaborators" className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Collaborators</h3>
              {(playlist.isCollaborative || playlist.userRole === "owner") && (
                <Button 
                  className="bg-red-600 hover:bg-red-700"
                  onClick={() => setShowAddCollaborator(true)}
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  Invite Collaborator
                </Button>
              )}
            </div>

            <div className="grid gap-4">
              {playlist.collaborators.map((collaborator) => (
                <Card key={collaborator.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <img
                          src={collaborator.avatar || "/placeholder.svg"}
                          alt={collaborator.name}
                          className="w-10 h-10 rounded-full"
                        />
                        <div>
                          <h4 className="font-semibold">{collaborator.name}</h4>
                          <p className="text-sm text-gray-600">
                            Joined {new Date(collaborator.joinedAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={collaborator.role === "admin" ? "default" : "secondary"}>
                          {collaborator.role}
                        </Badge>
                        {/* Show remove button if user is owner or admin, but don't allow removing admins unless user is owner */}
                        {(playlist.userRole === "owner" || (playlist.userRole === "admin" && collaborator.role !== "admin")) && (
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleRemoveCollaborator(collaborator.id, collaborator.name)}
                            disabled={removingCollaborator === collaborator.id}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            {removingCollaborator === collaborator.id ? "Removing..." : "Remove"}
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="comments" className="space-y-6">
            {/* Comment Form */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  {/* Display user avatar with better fallback handling */}
                  <img
                    src={user?.avatar && user.avatar !== "/placeholder.svg" && !user.avatar.includes("undefined")
                        ? user.avatar 
                        : "/placeholder.svg"}
                    alt="You"
                    className="w-8 h-8 rounded-full object-cover bg-gray-200"
                    onError={(e) => {
                      // If image fails to load, fallback to placeholder
                      console.log("Image failed to load, using placeholder");
                      e.currentTarget.src = "/placeholder.svg";
                    }}
                  />
                  <div className="flex-1">
                    <textarea
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      placeholder="Add a comment..."
                      className="w-full p-3 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 transition-all"
                      rows={3}
                    />
                    <div className="flex justify-end mt-2">
                      <Button 
                        className="bg-red-600 hover:bg-red-700"
                        disabled={!commentText.trim() || addingComment}
                        onClick={handleAddComment}
                      >
                        {addingComment ? "Posting..." : "Post Comment"}
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {/* Comments List */}
            <div className="space-y-4">
              {playlist.comments && playlist.comments.length > 0 ? (
                playlist.comments.map((comment) => (
                  <Card key={comment.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <img
                          src={comment.user.avatar || "/placeholder.svg"}
                          alt={comment.user.name}
                          className="w-8 h-8 rounded-full object-cover"
                          onError={(e) => {
                            // If image fails to load, fallback to placeholder
                            e.currentTarget.src = "/placeholder.svg";
                          }}
                        />
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-sm">{comment.user.name}</span>
                              <span className="text-xs text-gray-500">
                                {new Date(comment.timestamp).toLocaleDateString()}
                              </span>
                            </div>
                            {/* Only show delete button to comment owner, playlist owner, or admins */}
                            {(user?.name === comment.user.name || playlist?.userRole === "owner" || playlist?.userRole === "admin") && (
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => handleDeleteComment(comment.id)}
                                disabled={deletingComment === comment.id}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                          <p className="text-gray-700">{comment.content}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <Card>
                  <CardContent className="p-8 text-center">
                    <div className="text-gray-500">
                      <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <h3 className="text-lg font-semibold mb-2">No comments yet</h3>
                      <p className="text-sm">Be the first to comment on this playlist!</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="activity" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Recent Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {playlist?.activities && playlist.activities.length > 0 ? (
                    playlist.activities.map((activity) => (
                      <div key={activity.id} className="flex items-start gap-3 pb-4 border-b border-gray-100">
                        <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                        <div>
                          <p className="text-sm">
                            <span className="font-semibold">{activity.user}</span> {activity.action}
                          </p>
                          <p className="text-xs text-gray-500">
                            {new Date(activity.timestamp).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center text-gray-500 py-8">
                      No recent activity
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Add Video Dialog */}
      {showAddVideo && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4">Add Video to Playlist</h3>
            <div className="space-y-4">
              <div>
                <Label htmlFor="videoUrl">YouTube URL</Label>
                <Input
                  id="videoUrl"
                  value={newVideoUrl}
                  onChange={(e) => setNewVideoUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="mt-1"
                />
              </div>
              <div className="flex gap-3">
                <Button
                  onClick={handleAddVideo}
                  disabled={addingVideo}
                  className="bg-red-600 hover:bg-red-700 flex-1"
                >
                  {addingVideo ? "Adding..." : "Add Video"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowAddVideo(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Collaborator Dialog */}
      {showAddCollaborator && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4">Invite Collaborator</h3>
            <div className="space-y-4">
              <div>
                <Label htmlFor="collaboratorEmail">Email Address</Label>
                <Input
                  id="collaboratorEmail"
                  type="email"
                  value={collaboratorEmail}
                  onChange={(e) => setCollaboratorEmail(e.target.value)}
                  placeholder="user@example.com"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="collaboratorRole">Permission Level</Label>
                <Select value={collaboratorRole} onValueChange={setCollaboratorRole}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="viewer">Viewer - Can view playlist</SelectItem>
                    <SelectItem value="editor">Editor - Can add/remove videos</SelectItem>
                    <SelectItem value="admin">Admin - Can manage collaborators</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-3">
                <Button
                  onClick={handleAddCollaborator}
                  disabled={addingCollaborator}
                  className="bg-red-600 hover:bg-red-700 flex-1"
                >
                  {addingCollaborator ? "Sending..." : "Send Invite"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowAddCollaborator(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
    </AuthGuard>
  )
}