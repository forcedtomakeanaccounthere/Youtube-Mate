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
import { useToast } from "@/hooks/use-toast"
import { LinkIcon } from "lucide-react"
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
  Edit,
} from "lucide-react"
import AuthGuard from "@/components/AuthGuard"
import Navbar from "@/components/landing/Navbar"
import { useDarkMode } from "@/hooks/use-dark-mode"
import featuresData from "@/data/features.json"
import { Feature } from "@/types/features"
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

const features: Feature[] = featuresData

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
  role: "owner" | "admin" | "editor" | "viewer"
  joinedAt: string
  lastActive: string
}

interface Comment {
  id: string
  user: {
    id: string
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
  
  // Navbar state
  const [activeFeature, setActiveFeature] = useState(features[0])
  const [showNavbar, setShowNavbar] = useState(true)
  const { darkMode, toggleDarkMode, mounted } = useDarkMode()
  const { toast } = useToast()
  
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
          console.log("User data fetched:", responseData)
          
          const userData = responseData.user || responseData;
          
          setUser({
            id: userData.id || userData._id,
            name: userData.name,
            email: userData.email,
            avatar: userData.avatar || "/placeholder.svg"
          })
          
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
      
      setPlaylist(prev => prev ? { ...prev, isFavorite: data.isFavorite } : null)

      toast({
        title: data.isFavorite ? "Added to favorites" : "Removed from favorites",
        description: data.isFavorite ? "Playlist added to your favorites" : "Playlist removed from your favorites",
      })

    } catch (error) {
      console.error("Error toggling favorite:", error)
      toast({
        title: "Error",
        description: "Failed to update favorite status",
        variant: "destructive",
      })
    }
  }

  const handleAddCommentOLD = async () => {
    
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
        
        toast({
          title: "Comment added",
          description: "Your comment has been added successfully",
        })
      } else {
        const errorData = await response.json()
        console.error("Failed to add comment:", errorData)
        toast({
          title: "Error",
          description: errorData.error || "Failed to add comment",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error adding comment:", error)
      toast({
        title: "Error",
        description: "Failed to add comment",
        variant: "destructive",
      })
    } finally {
      setAddingComment(false)
    }
  }

  const handleDeleteCommentOLD = async (commentId: string) => {
    if (!confirm("Are you sure you want to delete this comment?")) return
    
    setDeletingComment(commentId)
    try {
      const token = localStorage.getItem("token")
      const apiUrl = `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/playlists/${resolvedParams.id}/comments/${commentId}`
      
      const response = await fetch(apiUrl, {
          method: "DELETE",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            ...(token && { Authorization: `Bearer ${token}` }),
          },
        }
      )

      let data
      try {
        data = await response.json()
      } catch (e) {
        console.log("No JSON response or parse error:", e)
      }

      if (response.ok) {
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
        
        toast({
          title: "Comment deleted",
          description: "Your comment has been deleted successfully",
        })
      } else {
        toast({
          title: "Error",
          description: data?.error || `Failed to delete comment (status: ${response.status})`,
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error deleting comment:", error)
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      toast({
        title: "Error",
        description: `Failed to delete comment: ${errorMessage}`,
        variant: "destructive",
      })
    } finally {
      setDeletingComment(null)
    }
  }

  const handleAddCollaborator = async () => {
    if (!collaboratorEmail.trim() || !playlist) return

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(collaboratorEmail.trim())) {
      toast({
        title: "Invalid email",
        description: "Please enter a valid email address",
        variant: "destructive",
      })
      return
    }

    // Check if user has permission to add collaborators
    if (playlist.userRole !== "owner" && playlist.userRole !== "admin") {
      toast({
        title: "Permission denied",
        description: "Only owners and admins can invite collaborators",
        variant: "destructive",
      })
      return
    }

    // Check if user can assign the selected role
    const canAssignRole = (
      (playlist.userRole === "owner") || 
      (playlist.userRole === "admin" && ["editor", "viewer"].includes(collaboratorRole)) ||
      (playlist.userRole === "editor" && collaboratorRole === "viewer")
    )

    if (!canAssignRole) {
      toast({
        title: "Permission denied",
        description: `You don't have permission to assign the "${collaboratorRole}" role`,
        variant: "destructive",
      })
      return
    }

    setAddingCollaborator(true)
    try {
      const token = localStorage.getItem("token")
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/playlists/${playlist.id}/collaborators`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            ...(token && { Authorization: `Bearer ${token}` }),
          },
          body: JSON.stringify({
            email: collaboratorEmail.trim(),
            permission_level: collaboratorRole,
          }),
        },
      )

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to send invitation")
      }

      const data = await response.json()
      
      // Refresh playlist data to show new collaborator
      // You might want to add the collaborator to the local state instead
      toast({
        title: "Invitation sent!",
        description: `Invitation sent to ${collaboratorEmail}`,
      })

      // Reset form and close dialog
      setCollaboratorEmail("")
      setCollaboratorRole("viewer")
      setShowAddCollaborator(false)

    } catch (error: any) {
      console.error("Error inviting collaborator:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to send invitation",
        variant: "destructive",
      })
    } finally {
      setAddingCollaborator(false)
    }
  }

  const handleAddVideo = async () => {
    if (!newVideoUrl.trim()) {
      toast({
        title: "Error",
        description: "Please enter a YouTube URL",
        variant: "destructive",
      })
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
                  ...(token && { Authorization: `Bearer ${token}` }),
                },
              }
            )

            if (response.ok) {
              const data = await response.json()
              setPlaylist(data)
              setLoading(false)
            }
          } catch (error) {
            console.error("Error refreshing playlist:", error)
            setLoading(false)
          }
        }
        fetchPlaylist()
        
        toast({
          title: "Video added",
          description: "Video has been added to the playlist",
        })
      } else {
        const errorData = await response.json()
        toast({
          title: "Error",
          description: errorData.error || "Failed to add video",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error adding video:", error)
      toast({
        title: "Error",
        description: "Failed to add video",
        variant: "destructive",
      })
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
    
    const dragAttributes = isDragging ? { 'data-dnd-dragging': 'true' } : {};
    
    return (
      <Card 
        ref={setNodeRef}
        style={style}
        {...dragAttributes}
        className={`group bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border-orange-200/50 dark:border-gray-700/50 hover:border-orange-300 dark:hover:border-gray-600 transition-all duration-200 ${
          viewMode === "grid" ? "h-full" : ""
        } overflow-hidden`}
      >
        <CardContent className={`p-3 sm:p-4 ${viewMode === "grid" ? "space-y-3" : "flex items-center space-x-2 sm:space-x-4"}`}>
          {viewMode === "list" && sortBy === "order" && (
            <div 
              {...attributes}
              {...listeners}
              className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-orange-500 flex-shrink-0"
            >
              <GripVertical className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
          )}
          
          <div className={`${viewMode === "list" ? "flex items-center space-x-2 sm:space-x-4 flex-1 min-w-0" : "space-y-3"}`}>
            <div className={`relative flex-shrink-0 ${viewMode === "grid" ? "w-full aspect-video" : "w-16 h-10 sm:w-20 sm:h-12"}`}>
              <img
                src={video.thumbnail}
                alt={video.title}
                className="w-full h-full object-cover rounded-md"
              />
              <div className="absolute bottom-0.5 right-0.5 sm:bottom-1 sm:right-1 bg-black/80 text-white text-xs px-1 rounded">
                {video.duration}
              </div>
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20 rounded-md">
                <Play className="h-4 w-4 sm:h-6 sm:w-6 text-white" />
              </div>
            </div>
            
            <div className={`${viewMode === "grid" ? "space-y-2" : "flex-1 min-w-0"}`}>
              <h4 className={`font-medium text-gray-900 dark:text-white ${viewMode === "grid" ? "text-sm line-clamp-2" : "text-sm sm:text-base"} line-clamp-2`}>
                {video.title}
              </h4>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 truncate">
                {video.channel}
              </p>
              {viewMode === "grid" && (
                <div className="flex items-center space-x-3 text-xs text-gray-500 dark:text-gray-400">
                  <span className="flex items-center space-x-1">
                    <Eye className="h-3 w-3 text-orange-500" />
                    <span>{video.views?.toLocaleString() || 0}</span>
                  </span>
                  <span className="flex items-center space-x-1">
                    <ThumbsUp className="h-3 w-3 text-orange-500" />
                    <span>{video.likes?.toLocaleString() || 0}</span>
                  </span>
                </div>
              )}
              {viewMode === "list" && (
                <div className="hidden sm:flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-400 pt-3">
                  <span className="flex items-center space-x-1 text-orange-500">
                    <Eye className="h-3 w-3 mr-1" />
                    <span>{video.views?.toLocaleString() || 0}</span>
                  </span>
                  <span className="text-orange-500 pl-2">Added {new Date(video.addedAt).toLocaleDateString()}</span>
                </div>
              )}
            </div>
          </div>
          
          <div className={`flex items-center space-x-1 sm:space-x-2 flex-shrink-0 ${viewMode === "grid" ? "justify-between" : ""}`}>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.open(video.youtubeUrl, '_blank')}
              className="text-gray-500 hover:text-orange-500 p-1 sm:p-2"
            >
              <ExternalLink className="h-3 w-3 sm:h-4 sm:w-4" />
            </Button>
            {(playlist?.userRole === "owner" || playlist?.userRole === "editor") && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDeleteVideo(video.id)}
                className="text-gray-500 hover:text-red-500 p-1 sm:p-2"
              >
                <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over || active.id === over.id || sortBy !== "order" || !playlist) return
    
    const oldIndex = sortedVideos.findIndex(video => video.id === active.id);
    const newIndex = sortedVideos.findIndex(video => video.id === over.id);
    
    if (oldIndex === -1 || newIndex === -1) return
    
    const newVideos = arrayMove(sortedVideos, oldIndex, newIndex);
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
      const token = localStorage.getItem("token")
      await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/playlists/${resolvedParams.id}/reorder`,
        {
          method: "PUT",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            ...(token && { Authorization: `Bearer ${token}` }),
          },
          body: JSON.stringify({
            videoIds: updatedVideos.map(v => v.id)
          }),
        }
      )
    } catch (error) {
      console.error("Error updating video order:", error)
      toast({
        title: "Error",
        description: "Failed to update video order",
        variant: "destructive",
      })
    }
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
        
        toast({
          title: "Video removed",
          description: "Video has been removed from the playlist",
        })
      } else {
        toast({
          title: "Error",
          description: "Failed to remove video",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error deleting video:", error)
      toast({
        title: "Error",
        description: "Failed to remove video",
        variant: "destructive",
      })
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
      toast({
        title: "Link copied",
        description: "Playlist URL copied to clipboard!",
      })
    } catch (error) {
      console.error("Failed to copy URL:", error)
      toast({
        title: "Error",
        description: "Failed to copy URL",
        variant: "destructive",
      })
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

  const handleDeletePlaylist = async () => {
    if (!confirm("Are you sure you want to delete this playlist? This action cannot be undone.")) return
    
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
        toast({
          title: "Playlist deleted",
          description: "Playlist has been deleted successfully",
        })
        window.location.href = "/playlists"
      } else {
        toast({
          title: "Error",
          description: "Failed to delete playlist",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error deleting playlist:", error)
      toast({
        title: "Error",
        description: "Failed to delete playlist",
        variant: "destructive",
      })
    }
  }

  const handleRemoveCollaborator = async (collaboratorId: string) => {
    if (!playlist) return

    // Check if user has permission to remove collaborators
    if (playlist.userRole !== "owner" && playlist.userRole !== "admin") {
      toast({
        title: "Permission denied",
        description: "Only owners and admins can remove collaborators",
        variant: "destructive",
      })
      return
    }

    if (!confirm("Are you sure you want to remove this collaborator?")) return

    setRemovingCollaborator(collaboratorId)
    try {
      const token = localStorage.getItem("token")
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/playlists/${playlist.id}/collaborators/${collaboratorId}`,
        {
          method: "DELETE",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            ...(token && { Authorization: `Bearer ${token}` }),
          },
        },
      )

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to remove collaborator")
      }

      // Update local state
      const updatedPlaylist = {
        ...playlist,
        collaborators: playlist.collaborators.filter(c => c.id !== collaboratorId)
      }
      setPlaylist(updatedPlaylist)
      
      toast({
        title: "Collaborator removed",
        description: "Collaborator has been removed from the playlist",
      })

    } catch (error: any) {
      console.error("Error removing collaborator:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to remove collaborator",
        variant: "destructive",
      })
    } finally {
      setRemovingCollaborator(null)
    }
  }

  const handleDeleteComment = async (commentId: string) => {
    if (!playlist) return

    setDeletingComment(commentId)
    try {
      const token = localStorage.getItem("token")
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/playlists/${playlist.id}/comments/${commentId}`,
        {
          method: "DELETE",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            ...(token && { Authorization: `Bearer ${token}` }),
          },
        },
      )

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to delete comment")
      }

      // Update local state
      const updatedPlaylist = {
        ...playlist,
        comments: playlist.comments.filter(c => c.id !== commentId)
      }
      setPlaylist(updatedPlaylist)
      
      toast({
        title: "Comment deleted",
        description: "Comment has been deleted",
      })

    } catch (error: any) {
      console.error("Error deleting comment:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to delete comment",
        variant: "destructive",
      })
    } finally {
      setDeletingComment(null)
    }
  }

  const handleAddComment = async () => {
    if (!commentText.trim() || !playlist) return

    setAddingComment(true)
    try {
      const token = localStorage.getItem("token")
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/playlists/${playlist.id}/comments`,
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
        },
      )

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to add comment")
      }

      const newComment = await response.json()
      
      // Update local state
      const updatedPlaylist = {
        ...playlist,
        comments: [...playlist.comments, newComment]
      }
      setPlaylist(updatedPlaylist)
      setCommentText("")
      
      toast({
        title: "Comment added",
        description: "Your comment has been added",
      })

    } catch (error: any) {
      console.error("Error adding comment:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to add comment",
        variant: "destructive",
      })
    } finally {
      setAddingComment(false)
    }
  }

  useEffect(() => {
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
        } else {
          console.error("Failed to fetch playlist")
        }
        setLoading(false)
      } catch (error) {
        console.error("Error fetching playlist:", error)
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

  const sortedVideos = [...filteredVideos].sort((a, b) => {
    switch (sortBy) {
      case "title":
        return a.title.localeCompare(b.title)
      case "channel":
        return a.channel.localeCompare(b.channel)
      case "duration":
        return a.duration.localeCompare(b.duration)
      case "views":
        return (b.views || 0) - (a.views || 0)
      case "recent":
        return new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime()
      default: // "order"
        return a.position - b.position
    }
  })

  // Don't render anything that depends on darkMode until mounted
  if (!mounted) {
    return <div className="min-h-screen" />
  }

  if (loading) {
    return (
      <AuthGuard>
        <div className={`min-h-screen transition-colors duration-300 ${darkMode ? "dark bg-gray-900" : "bg-gradient-to-br from-orange-50 to-red-50"} flex items-center justify-center`}>
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
        </div>
      </AuthGuard>
    )
  }

  if (!playlist) {
    return (
      <AuthGuard>
        <div className={`min-h-screen transition-colors duration-300 ${darkMode ? "dark bg-gray-900" : "bg-gradient-to-br from-orange-50 to-red-50"} flex items-center justify-center`}>
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Playlist not found</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">The playlist you're looking for doesn't exist.</p>
            <Link href="/playlists">
              <Button className="bg-orange-500 hover:bg-orange-600 text-white">Back to Playlists</Button>
            </Link>
          </div>
        </div>
      </AuthGuard>
    )
  }

  return (
    <AuthGuard>
      <div className={`min-h-screen transition-colors duration-300 ${darkMode ? "dark bg-gray-900" : "bg-gradient-to-br from-orange-50 to-red-50"}`}>
        <Navbar
          showNavbar={showNavbar}
          features={features}
          setActiveFeature={setActiveFeature}
          darkMode={darkMode}
          toggleDarkMode={toggleDarkMode}
        />
        
        {/* Header */}
        <div className="pt-16 md:pt-20">
          <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border-b border-orange-200/50 dark:border-gray-700/50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 md:py-6">

              {/* Main Header Content */}
              <div className="flex flex-col lg:flex-row gap-6">
                {/* Playlist Thumbnail */}
                <div className="flex-shrink-0">
                  <img
                    src={playlist.thumbnail || "/placeholder.svg"}
                    alt={playlist.title}
                    className="w-full sm:w-48 md:w-56 lg:w-64 h-32 md:h-36 lg:h-40 object-cover rounded-lg shadow-lg"
                  />
                </div>

                {/* Playlist Info and Actions */}
                <div className="flex-1 flex flex-col lg:flex-row lg:justify-between gap-6">
                  {/* Playlist Details */}
                  <div className="flex-1 space-y-4">
                    <div>
                      <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white mb-2">
                        {playlist.title}
                      </h1>
                      <p className="text-gray-600 dark:text-gray-400 text-sm md:text-base line-clamp-3 max-w-3xl">
                        {playlist.description}
                      </p>
                    </div>

                    {/* Stats Row */}
                    <div className="flex flex-wrap items-center gap-4 md:gap-6 text-sm text-gray-500 dark:text-gray-400">
                      <span className="flex items-center gap-1.5">
                        <Play className="h-4 w-4" />
                        {playlist.videos.length} videos
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Eye className="h-4 w-4" />
                        {playlist.stats.totalViews.toLocaleString()} views
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Clock className="h-4 w-4" />
                        {playlist.stats.totalDuration}
                      </span>
                      <span className="hidden md:block">
                        Updated {new Date(playlist.stats.lastModified).toLocaleDateString()}
                      </span>
                    </div>

                    {/* Creator Info */}
                    <div className="flex items-center gap-3">
                      <img
                        src={playlist.owner.avatar || "/placeholder.svg"}
                        alt={playlist.owner.name}
                        className="w-8 h-8 rounded-full"
                      />
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        Created by {playlist.owner.name}
                      </span>
                      {playlist.isCollaborative && (
                        <Badge className="bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 border-orange-200 dark:border-orange-800">
                          <Users className="h-3 w-3 mr-1" />
                          Collaborative
                        </Badge>
                      )}
                    </div>

                    {/* Tags */}
                    <div className="flex flex-wrap gap-2">
                      {playlist.tags.map((tag) => (
                        <Badge 
                          key={tag} 
                          variant="outline" 
                          className="text-xs border-orange-200 dark:border-gray-600 text-gray-600 dark:text-gray-400"
                        >
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex-shrink-0">
                    <div className="flex flex-col sm:flex-row lg:flex-col gap-2 lg:w-48">
                      <Button 
                        className="bg-orange-500 hover:bg-orange-600 text-white"
                        onClick={handlePlayAll}
                      >
                        <Play className="h-4 w-4 mr-2" />
                        Play All
                      </Button>
                      
                      <div className="grid grid-cols-2 gap-2">
                        <Button 
                          variant="outline"
                          onClick={handleSharePlaylist}
                          className="border-orange-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-orange-50 dark:hover:bg-gray-700"
                        >
                          <Share2 className="h-4 w-4 lg:mr-2" />
                          <span className="hidden lg:inline">Share</span>
                        </Button>
                        
                        <Button 
                          variant="outline"
                          onClick={handleExportPlaylist}
                          className="border-orange-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-orange-50 dark:hover:bg-gray-700"
                        >
                          <Download className="h-4 w-4 lg:mr-2" />
                          <span className="hidden lg:inline">Export</span>
                        </Button>
                        
                        {playlist?.userRole === "owner" && (
                          <>
                            <Link href={`/playlists/${resolvedParams.id}/edit`}>
                              <Button 
                                variant="outline" 
                                className="border-orange-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-orange-50 dark:hover:bg-gray-700 w-full"
                              >
                                <Edit className="h-4 w-4 lg:mr-2" />
                                <span className="hidden lg:inline">Edit</span>
                              </Button>
                            </Link>
                            
                            <Button 
                              variant="outline"
                              onClick={handleDeletePlaylist}
                              className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/30"
                            >
                              <Trash2 className="h-4 w-4 lg:mr-2" />
                              <span className="hidden lg:inline">Delete</span>
                            </Button>
                          </>
                        )}
                      </div>
                      
                      {/* Favorite button gets full width */}
                      <Button 
                        variant="outline"
                        onClick={toggleFavorite}
                        className={`w-full ${playlist?.isFavorite 
                          ? "bg-orange-50 dark:bg-orange-900/30 border-orange-200 dark:border-orange-800 text-orange-600 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-900/50" 
                          : "border-orange-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-orange-50 dark:hover:bg-gray-700"
                        }`}
                      >
                        <Heart className={`h-4 w-4 mr-2 ${playlist?.isFavorite ? 'fill-orange-500 text-orange-500' : ''}`} />
                        {playlist?.isFavorite ? 'Unfavorite' : 'Favorite'}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
          <Tabs defaultValue="videos" className="space-y-6">
            <TabsList className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border border-orange-200/50 dark:border-gray-700/50 grid grid-cols-2 sm:grid-cols-4 h-auto">
              <TabsTrigger 
                value="videos" 
                className="data-[state=active]:bg-orange-500 data-[state=active]:text-white text-xs sm:text-sm py-2 px-2 sm:px-3"
              >
                Videos ({playlist.videos.length})
              </TabsTrigger>
              <TabsTrigger 
                value="collaborators" 
                className="data-[state=active]:bg-orange-500 data-[state=active]:text-white text-xs sm:text-sm py-2 px-2 sm:px-3"
              >
                Collaborators ({playlist.collaborators.length})
              </TabsTrigger>
              <TabsTrigger 
                value="comments" 
                className="data-[state=active]:bg-orange-500 data-[state=active]:text-white text-xs sm:text-sm py-2 px-2 sm:px-3"
              >
                Comments ({playlist.comments.length})
              </TabsTrigger>
              <TabsTrigger 
                value="activity" 
                className="data-[state=active]:bg-orange-500 data-[state=active]:text-white text-xs sm:text-sm py-2 px-2 sm:px-3"
              >
                Activity
              </TabsTrigger>
            </TabsList>

            <TabsContent value="videos" className="space-y-6">
              {/* Video Controls */}
              <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border-orange-200/50 dark:border-gray-700/50">
                <CardContent className="p-3 sm:p-4">
                  <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-stretch sm:items-center justify-between">
                    <div className="flex-1 w-full sm:max-w-md">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                        <Input
                          placeholder="Search videos..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-10 bg-white/50 dark:bg-gray-700/50 border-orange-200 dark:border-gray-600 text-sm"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
                      <Select value={sortBy} onValueChange={setSortBy}>
                        <SelectTrigger className="flex-1 sm:w-40 bg-white/50 dark:bg-gray-700/50 border-orange-200 dark:border-gray-600 text-sm">
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

                      <div className="flex border border-orange-200 dark:border-gray-600 rounded-md flex-shrink-0">
                        <Button
                          variant={viewMode === "list" ? "default" : "ghost"}
                          size="sm"
                          onClick={() => setViewMode("list")}
                          className={`rounded-r-none px-2 sm:px-3 ${viewMode === "list" ? "bg-orange-500 hover:bg-orange-600 text-white" : ""}`}
                        >
                          <List className="h-4 w-4" />
                        </Button>
                        <Button
                          variant={viewMode === "grid" ? "default" : "ghost"}
                          size="sm"
                          onClick={() => setViewMode("grid")}
                          className={`rounded-l-none px-2 sm:px-3 ${viewMode === "grid" ? "bg-orange-500 hover:bg-orange-600 text-white" : ""}`}
                        >
                          <Grid3X3 className="h-4 w-4" />
                        </Button>
                      </div>

                      {(playlist?.userRole === "owner" || playlist?.userRole === "editor") && (
                        <Button
                          onClick={() => setShowAddVideo(true)}
                          className="bg-orange-500 hover:bg-orange-600 text-white flex-shrink-0"
                        >
                          <Plus className="h-4 w-4 sm:mr-2" />
                          <span className="hidden sm:inline">Add Video</span>
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
              
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
                      {viewMode === "list" ? (
                        <div className="space-y-2 sm:space-y-3">
                          {sortedVideos.map((video, index) => (
                            <SortableVideoItem key={video.id} video={video} index={index} />
                          ))}
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                          {sortedVideos.map((video, index) => (
                            <SortableVideoItem key={video.id} video={video} index={index} />
                          ))}
                        </div>
                      )}
                    </SortableContext>
                  </DndContext>
                </div>
              ) : (
                <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border-orange-200/50 dark:border-gray-700/50">
                  <CardContent className="p-8 text-center">
                    <div className="text-gray-500 dark:text-gray-400">
                      <Play className="h-12 w-12 mx-auto mb-4 text-orange-300" />
                      <h3 className="text-lg font-semibold mb-2">No videos in this playlist</h3>
                      <p className="text-sm mb-4">Start adding videos to see them here!</p>
                      {(playlist?.userRole === "owner" || playlist?.userRole === "editor") && (
                        <Button
                          onClick={() => setShowAddVideo(true)}
                          className="bg-orange-500 hover:bg-orange-600 text-white"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add First Video
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="collaborators" className="space-y-6">
              <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border-orange-200/50 dark:border-gray-700/50">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
                      <Users className="h-5 w-5 text-orange-500" />
                      Collaborators
                    </CardTitle>
                    {/* {(playlist?.userRole === "owner" || playlist?.userRole === "admin" || playlist?.userRole === "editor") && ( */}
                      <Button 
                        className="bg-orange-500 hover:bg-orange-600 text-white"
                        onClick={() => setShowAddCollaborator(true)}
                      >
                        <UserPlus className="h-4 w-4 mr-2" />
                        <span className="hidden sm:inline">Invite Collaborator</span>
                      </Button>
                    {/* )} */}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {playlist?.collaborators && playlist.collaborators.length > 0 ? (
                      playlist.collaborators.map((collaborator) => (
                        <div key={collaborator.id} className="flex items-center justify-between p-4 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                          <div className="flex items-center gap-3">
                            <div className="relative w-10 h-10">
                              <img
                                src={collaborator.avatar || "/placeholder.svg"}
                                alt={collaborator.name}
                                className="w-10 h-10 rounded-full object-cover"
                                loading="lazy"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement
                                  if (target.src !== "/placeholder.svg") {
                                    target.src = "/placeholder.svg"
                                  }
                                }}
                                onLoad={(e) => {
                                  const target = e.target as HTMLImageElement
                                  target.style.opacity = "1"
                                }}
                                style={{ opacity: "0.7", transition: "opacity 0.3s ease" }}
                              />
                            </div>
                            <div>
                              <p className="font-medium text-gray-900 dark:text-white">{collaborator.name}</p>
                              <p className="text-sm text-gray-500 dark:text-gray-400">
                                {collaborator.role} • Joined {new Date(collaborator.joinedAt).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={collaborator.role === "admin" ? "default" : "secondary"} className={
                              collaborator.role === "admin" ? "bg-orange-500 text-white" : ""
                            }>
                              {collaborator.role}
                            </Badge>
                            {/* Only show remove button if current user is owner/admin and this isn't the owner */}
                            {(playlist?.userRole === "owner" || playlist?.userRole === "admin") && 
                             collaborator.role !== "owner" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveCollaborator(collaborator.id)}
                                disabled={removingCollaborator === collaborator.id}
                                className="text-gray-500 hover:text-red-500"
                              >
                                {removingCollaborator === collaborator.id ? (
                                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-red-500" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                              </Button>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                        <Users className="h-12 w-12 mx-auto text-orange-300 mb-4 opacity-50" />
                        <h3 className="text-lg font-semibold mb-2 ">No collaborators yet</h3>
                        <p className="text-sm">Invite people to collaborate on this playlist!</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="comments" className="space-y-6">
              <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border-orange-200/50 dark:border-gray-700/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
                    <MessageSquare className="h-5 w-5 text-orange-500" />
                    Comments
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {/* Add Comment Form */}
                  <div className="mb-6">
                    <div className="flex gap-3">
                      <div className="relative w-8 h-8 flex-shrink-0">
                        <img
                          src={user?.avatar || "/placeholder.svg"}
                          alt="Your avatar"
                          className="w-8 h-8 rounded-full object-cover"
                          loading="lazy"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement
                            if (target.src !== "/placeholder.svg") {
                              target.src = "/placeholder.svg"
                            }
                          }}
                          onLoad={(e) => {
                            const target = e.target as HTMLImageElement
                            target.style.opacity = "1"
                          }}
                          style={{ opacity: "0.7", transition: "opacity 0.3s ease" }}
                        />
                      </div>
                      <div className="flex-1">
                        <Input
                          placeholder="Add a comment..."
                          value={commentText}
                          onChange={(e) => setCommentText(e.target.value)}
                          className="mb-3 bg-white/50 dark:bg-gray-700/50 border-orange-200 dark:border-gray-600"
                        />
                        {commentText.trim() && (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={handleAddComment}
                              disabled={addingComment}
                              className="bg-orange-500 hover:bg-orange-600 text-white"
                            >
                              {addingComment ? "Adding..." : "Comment"}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setCommentText("")}
                            >
                              Cancel
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Comments List */}
                  <div className="space-y-4">
                    {playlist?.comments && playlist.comments.length > 0 ? (
                      playlist.comments.map((comment) => (
                        <div key={comment.id} className="group flex gap-3 p-4 rounded-lg bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700/70 transition-colors">
                          <div className="relative w-8 h-8 flex-shrink-0">
                            <img
                              src={comment.user.avatar || "/placeholder.svg"}
                              alt={comment.user.name}
                              className="w-8 h-8 rounded-full object-cover"
                              loading="lazy"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement
                                if (target.src !== "/placeholder.svg") {
                                  target.src = "/placeholder.svg"
                                }
                              }}
                              onLoad={(e) => {
                                const target = e.target as HTMLImageElement
                                target.style.opacity = "1"
                              }}
                              style={{ opacity: "0.7", transition: "opacity 0.3s ease" }}
                            />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm text-gray-900 dark:text-white">{comment.user.name}</span>
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                  {new Date(comment.timestamp).toLocaleDateString()}
                                </span>
                              </div>
                              {/* Show delete button only if: 1) user owns the comment (by ID), OR 2) current user is the playlist owner */}
                              {(
                                // User owns this specific comment (compare by ID)
                                (user?.id === comment.user.id) ||
                                // OR current user is the playlist owner (can delete any comment)
                                (playlist?.userRole === "owner")
                              ) && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteComment(comment.id)}
                                  disabled={deletingComment === comment.id}
                                  className="text-gray-500 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  {deletingComment === comment.id ? (
                                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-red-500" />
                                  ) : (
                                    <Trash2 className="h-4 w-4" />
                                  )}
                                </Button>
                              )}
                            </div>
                            <p className="text-gray-700 dark:text-gray-300">{comment.content}</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                        <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <h3 className="text-lg font-semibold mb-2">No comments yet</h3>
                        <p className="text-sm">Be the first to comment on this playlist!</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="activity" className="space-y-6">
              <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border-orange-200/50 dark:border-gray-700/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
                    <Activity className="h-5 w-5 text-orange-500" />
                    Recent Activity
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {playlist?.activities && playlist.activities.length > 0 ? (
                      playlist.activities.map((activity) => (
                        <div key={activity.id} className="flex items-start gap-3 pb-4 border-b border-gray-100 dark:border-gray-700 last:border-0">
                          <div className="w-2 h-2 bg-orange-500 rounded-full mt-2 flex-shrink-0"></div>
                          <div>
                            <p className="text-sm text-gray-900 dark:text-white">
                              <span className="font-semibold">{activity.user}</span> {activity.action}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {new Date(activity.timestamp).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                        <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <h3 className="text-lg font-semibold mb-2">No recent activity</h3>
                        <p className="text-sm">Activity will appear here as changes are made to the playlist.</p>
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
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4 shadow-xl">
              <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Add Video to Playlist</h3>
              <div className="space-y-4">
                <div>
                  <div className="flex">
                    <LinkIcon className="w-4 h-4 text-orange-500 mr-2" />
                    <Label htmlFor="videoUrl" className="text-gray-700 dark:text-gray-300 pb-2">YouTube URL</Label>
                  </div>
                  
                  <Input
                    id="videoUrl"
                    value={newVideoUrl}
                    onChange={(e) => setNewVideoUrl(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=..."
                    className="mt-1 bg-white dark:bg-gray-700 border-orange-200 dark:border-gray-600"
                  />
                </div>
                <div className="flex gap-3">
                  <Button
                    onClick={handleAddVideo}
                    disabled={addingVideo}
                    className="bg-orange-500 hover:bg-orange-600 text-white flex-1"
                  >
                    {addingVideo ? "Adding..." : "Add Video"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowAddVideo(false)}
                    className="flex-1 border-orange-200 dark:border-gray-600"
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
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4 shadow-xl">
              <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Invite Collaborator</h3>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="collaboratorEmail" className="text-gray-700 dark:text-gray-300">Email Address</Label>
                  <Input
                    id="collaboratorEmail"
                    type="email"
                    value={collaboratorEmail}
                    onChange={(e) => setCollaboratorEmail(e.target.value)}
                    placeholder="user@example.com"
                    className="mt-1 bg-white dark:bg-gray-700 border-orange-200 dark:border-gray-600"
                  />
                </div>
                <div>
                  <Label htmlFor="collaboratorRole" className="text-gray-700 dark:text-gray-300">Permission Level</Label>
                  <Select value={collaboratorRole} onValueChange={setCollaboratorRole}>
                    <SelectTrigger className="mt-1 bg-white dark:bg-gray-700 border-orange-200 dark:border-gray-600">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="viewer">Viewer - Can view playlist</SelectItem>
                      {(playlist?.userRole === "admin" || playlist?.userRole === "owner") && (
                        <SelectItem value="editor">Editor - Can add/remove videos and invite viewers</SelectItem>
                      )}
                      {playlist?.userRole === "owner" && (
                        <SelectItem value="admin">Admin - Can manage collaborators (Editors & Viewers)</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-3">
                  <Button
                    onClick={handleAddCollaborator}
                    disabled={addingCollaborator || !collaboratorEmail.trim()}
                    className="bg-orange-500 hover:bg-orange-600 text-white flex-1"
                  >
                    {addingCollaborator ? "Sending..." : "Send Invite"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowAddCollaborator(false)}
                    className="flex-1 border-orange-200 dark:border-gray-600"
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
