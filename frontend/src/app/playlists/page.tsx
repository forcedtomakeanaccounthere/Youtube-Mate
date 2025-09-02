"use client"

import { useState, useEffect, useMemo, Suspense } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Search,
  Plus,
  Grid3X3,
  List,
  Filter,
  Users,
  Lock,
  Globe,
  Play,
  MoreVertical,
  Calendar,
  Eye,
  Share2,
  Heart,
  Upload,
  X,
  Youtube,
  Import,
  AlertCircle,
  Edit,
  Trash2,
  ExternalLink,
  Clock,
  Loader2,
} from "lucide-react"
import AuthGuard from "@/components/AuthGuard"
import Navbar from "@/components/landing/Navbar"
import { useDarkMode } from "@/hooks/use-dark-mode"
import { useToast } from "@/hooks/use-toast"
import featuresData from "@/data/features.json"
import { Feature } from "@/types/features"

interface Playlist {
  id: string
  title: string
  description: string
  thumbnail: string
  videoCount: number
  isPublic: boolean
  isCollaborative: boolean
  owner: {
    name: string
    avatar: string
  }
  collaborators: number
  views: number
  createdAt: string
  lastModified: string
  tags: string[]
  category: string
  status: string
  isFavorite?: boolean
}

interface PlaylistsResponse {
  playlists: Playlist[]
  pagination: {
    current: number
    total: number
    count: number
    limit: number
  }
}

interface MyPlaylist {
  id: string
  title: string
  description: string
  thumbnail: string
  videoCount: number
  isPublic: boolean
  isCollaborative: boolean
  collaborators: number
  views: number
  createdAt: string
  lastModified: string
  tags: string[]
  category: string
  status: "published" | "draft" | "private"
}

interface SharedPlaylist {
  id: string
  title: string
  description: string
  thumbnail: string
  videoCount: number
  isPublic: boolean
  isCollaborative: boolean
  owner: {
    name: string
    avatar: string
  }
  role: "admin" | "editor" | "viewer"
  views: number
  createdAt: string
  lastModified: string
  tags: string[]
  category: string
}

function PlaylistsPageContent() {
  const { darkMode, toggleDarkMode } = useDarkMode()
  const [mounted, setMounted] = useState(false)
  const { toast } = useToast()
  const router = useRouter()
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [myPlaylists, setMyPlaylists] = useState<MyPlaylist[]>([])
  const [favoritePlaylists, setFavoritePlaylists] = useState<Playlist[]>([])
  const [sharedPlaylists, setSharedPlaylists] = useState<SharedPlaylist[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [searchInput, setSearchInput] = useState("") // Separate input state for debouncing
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [filterType, setFilterType] = useState("all")
  const [sortBy, setSortBy] = useState("recent")
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("all")
  const [pagination, setPagination] = useState({
    current: 1,
    total: 1,
    count: 0,
    limit: 12,
  })

  // Features data for navbar
  const features: Feature[] = featuresData as Feature[]
  const [activeFeature, setActiveFeature] = useState<Feature | null>(null)
  const [showNavbar, setShowNavbar] = useState(true)

  // Create form state
  const [createFormData, setCreateFormData] = useState({
    title: "",
    description: "",
    isPublic: true,
    isCollaborative: false,
    tags: [] as string[],
    category: "",
    thumbnail: null as File | null,
    importUrl: "",
  })
  const [newTag, setNewTag] = useState("")
  const [isImporting, setIsImporting] = useState(false)
  const [importedPlaylist, setImportedPlaylist] = useState<any>(null)
  const [createLoading, setCreateLoading] = useState(false)
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null)
  const [createError, setCreateError] = useState<string>("")

  // My Playlists state
  const [myPlaylistsSearchQuery, setMyPlaylistsSearchQuery] = useState("")
  const [myPlaylistsFilterStatus, setMyPlaylistsFilterStatus] = useState("all")
  const [myPlaylistsFilterBy, setMyPlaylistsFilterBy] = useState("all")
  const [myPlaylistsStatusBy, setMyPlaylistsStatusBy] = useState("all")
  const [myPlaylistsCollaborativeBy, setMyPlaylistsCollaborativeBy] = useState("all")
  const [myPlaylistsSortBy, setMyPlaylistsSortBy] = useState("recent")
  const [myPlaylistsViewMode, setMyPlaylistsViewMode] = useState<"grid" | "list">("grid")
  const [myPlaylistsLoading, setMyPlaylistsLoading] = useState(false)

  // Shared Playlists state
  const [sharedPlaylistsLoading, setSharedPlaylistsLoading] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Handle tab query parameter
  const searchParams = useSearchParams()
  useEffect(() => {
    const tabParam = searchParams.get('tab')
    if (tabParam && ['all', 'shared', 'favorites', 'mine', 'create'].includes(tabParam)) {
      setActiveTab(tabParam)
    }
  }, [searchParams])

  // Custom tab change handler to update URL
  const handleTabChange = (newTab: string) => {
    setActiveTab(newTab)
    // Update URL with tab parameter
    const newUrl = new URL(window.location.href)
    if (newTab === "all") {
      newUrl.searchParams.delete('tab')
    } else {
      newUrl.searchParams.set('tab', newTab)
    }
    router.push(newUrl.pathname + newUrl.search, { scroll: false })
  }

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(searchInput)
    }, 500)

    return () => clearTimeout(timer)
  }, [searchInput])

  const fetchPlaylists = async (page = 1) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pagination.limit.toString(),
        search: searchQuery,
        filter: filterType,
        sort: sortBy,
      })

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api"}/playlists?${params}`,
        {
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            ...(typeof window !== "undefined" &&
              localStorage.getItem("token") && {
                Authorization: `Bearer ${localStorage.getItem("token")}`,
              }),
          },
        },
      )

      if (!response.ok) {
        throw new Error("Failed to fetch playlists")
      }

      const data: PlaylistsResponse = await response.json()
      setPlaylists(data.playlists)
      setPagination(data.pagination)
    } catch (error) {
      console.error("Error fetching playlists:", error)
      setPlaylists([])
    } finally {
      setLoading(false)
    }
  }

  const fetchFavorites = async (page = 1) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pagination.limit.toString(),
      })

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api"}/playlists/favorites?${params}`,
        {
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            ...(typeof window !== "undefined" &&
              localStorage.getItem("token") && {
                Authorization: `Bearer ${localStorage.getItem("token")}`,
              }),
          },
        },
      )

      if (!response.ok) {
        throw new Error("Failed to fetch favorites")
      }

      const data: PlaylistsResponse = await response.json()
      setFavoritePlaylists(data.playlists)
      setPagination(data.pagination)
    } catch (error) {
      console.error("Error fetching favorites:", error)
      setFavoritePlaylists([])
    } finally {
      setLoading(false)
    }
  }

  const toggleFavorite = async (playlistId: string) => {
    try {
      const playlist = playlists.find(p => p.id === playlistId) || favoritePlaylists.find(p => p.id === playlistId)
      if (!playlist) return

      const method = playlist.isFavorite ? "DELETE" : "POST"
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api"}/playlists/${playlistId}/favorite`,
        {
          method,
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            ...(typeof window !== "undefined" &&
              localStorage.getItem("token") && {
                Authorization: `Bearer ${localStorage.getItem("token")}`,
              }),
          },
        },
      )

      if (!response.ok) {
        throw new Error("Failed to toggle favorite")
      }

      const data = await response.json()
      
      // Update playlists state
      setPlaylists(prev => prev.map(p => 
        p.id === playlistId ? { ...p, isFavorite: data.isFavorite } : p
      ))

      // Update favorites list as well
      setFavoritePlaylists(prev => prev.map(p => 
        p.id === playlistId ? { ...p, isFavorite: data.isFavorite } : p
      ))

      // If we're on the favorites tab and removing a favorite, remove it from the list
      if (activeTab === "favorites" && !data.isFavorite) {
        setFavoritePlaylists(prev => prev.filter(p => p.id !== playlistId))
      }

      // If we're adding a favorite while on favorites tab, refresh the favorites
      if (activeTab === "favorites" && data.isFavorite) {
        fetchFavorites(pagination.current)
      }

      toast({
        title: data.isFavorite ? "Added to Favorites" : "Removed from Favorites",
        description: data.isFavorite 
          ? "Playlist has been added to your favorites" 
          : "Playlist has been removed from your favorites",
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

  useEffect(() => {
    if (activeTab === "favorites") {
      fetchFavorites(1)
    } else if (activeTab === "mine") {
      fetchMyPlaylists()
    } else if (activeTab === "shared") {
      fetchSharedPlaylists()
    } else {
      fetchPlaylists(1)
    }
  }, [searchQuery, filterType, sortBy, activeTab])

  // Create form functions
  const handleCreateInputChange = (field: keyof typeof createFormData, value: any) => {
    setCreateFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleThumbnailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // Validate file type and size
      if (!file.type.startsWith('image/')) {
        setCreateError('Please select an image file')
        return
      }
      
      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        setCreateError('File size must be less than 10MB')
        return
      }

      setCreateFormData((prev) => ({ ...prev, thumbnail: file }))
      
      // Create preview
      const reader = new FileReader()
      reader.onload = (e) => {
        setThumbnailPreview(e.target?.result as string)
      }
      reader.readAsDataURL(file)
      setCreateError("")
    }
  }

  const removeThumbnail = () => {
    setCreateFormData((prev) => ({ ...prev, thumbnail: null }))
    setThumbnailPreview(null)
  }

  const addTag = () => {
    if (newTag.trim() && !createFormData.tags.includes(newTag.trim())) {
      handleCreateInputChange("tags", [...createFormData.tags, newTag.trim()])
      setNewTag("")
    }
  }

  const removeTag = (tagToRemove: string) => {
    handleCreateInputChange(
      "tags",
      createFormData.tags.filter((tag) => tag !== tagToRemove),
    )
  }

  const handleImportPlaylist = async () => {
    if (!createFormData.importUrl) return

    setIsImporting(true)
    setCreateError("")
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api"}/downloads/playlist/info?url=${encodeURIComponent(createFormData.importUrl)}`,
        {
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
        }
      )

      if (!response.ok) {
        throw new Error("Failed to import playlist")
      }

      const importedData = await response.json()
      
      const importedPlaylist = {
        title: importedData.title || `Imported Playlist`,
        description: importedData.description || "Imported from YouTube",
        videoCount: importedData.videos?.length || 0,
        thumbnail: importedData.thumbnail,
        videos: importedData.videos?.slice(0, 5) || [], // Show first 5 videos as preview
      }

      setImportedPlaylist(importedPlaylist)
      setCreateFormData((prev) => ({
        ...prev,
        title: importedPlaylist.title,
        description: importedPlaylist.description,
      }))
      
      // Set thumbnail preview if available
      if (importedPlaylist.thumbnail) {
        setThumbnailPreview(importedPlaylist.thumbnail)
      }
    } catch (error) {
      console.error("Import failed:", error)
      setCreateError("Failed to import playlist. Please check the URL and try again.")
    } finally {
      setIsImporting(false)
    }
  }

  const handleCreateSubmit = async (e: React.FormEvent, saveAsDraft = false) => {
    e.preventDefault()
    setCreateLoading(true)
    setCreateError("")

    try {
      const token = localStorage.getItem("token")
      if (!token) {
        setCreateError("Please log in to create a playlist")
        return
      }

      // Create FormData for file upload
      const formDataToSend = new FormData()
      formDataToSend.append("name", createFormData.title)
      formDataToSend.append("description", createFormData.description)
      formDataToSend.append("is_public", createFormData.isPublic.toString())
      formDataToSend.append("is_collaborative", createFormData.isCollaborative.toString())
      formDataToSend.append("category", createFormData.category || "other")
      formDataToSend.append("tags", JSON.stringify(createFormData.tags))
      formDataToSend.append("save_as_draft", saveAsDraft.toString())
      
      if (createFormData.importUrl) {
        formDataToSend.append("import_url", createFormData.importUrl)
      }
      
      if (createFormData.thumbnail) {
        formDataToSend.append("thumbnail", createFormData.thumbnail)
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api"}/playlists`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
        body: formDataToSend,
      })

      if (!response.ok) {
        const errorText = await response.text()
        try {
          const errorData = JSON.parse(errorText)
          throw new Error(errorData.error || errorData.details?.[0] || "Failed to create playlist")
        } catch (parseError) {
          throw new Error(`Server error: ${response.status} - ${errorText}`)
        }
      }

      const newPlaylist = await response.json()
      
      // Reset form
      setCreateFormData({
        title: "",
        description: "",
        isPublic: true,
        isCollaborative: false,
        tags: [],
        category: "",
        thumbnail: null,
        importUrl: "",
      })
      setThumbnailPreview(null)
      setImportedPlaylist(null)
      setNewTag("")
      
      // Switch to "All Playlists" tab and refresh
      handleTabChange("all")
      fetchPlaylists(1)
      
      toast({
        title: "Success",
        description: "Playlist created successfully!",
      })

    } catch (error: any) {
      console.error("Failed to create playlist:", error)
      setCreateError(error.message || "Failed to create playlist. Please try again.")
    } finally {
      setCreateLoading(false)
    }
  }

  // My Playlists functions
  const fetchMyPlaylists = async () => {
    setMyPlaylistsLoading(true)
    try {
      const token = localStorage.getItem("token")
      if (!token) {
        setMyPlaylistsLoading(false)
        return
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api"}/playlists/mine`,
        {
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      )

      if (!response.ok) {
        throw new Error("Failed to fetch playlists")
      }

      const data = await response.json()
      
      // Transform backend data to match frontend interface
      const transformedPlaylists: MyPlaylist[] = data.playlists?.map((playlist: any) => ({
        id: playlist._id || playlist.id,
        title: playlist.name || playlist.title,
        description: playlist.description || "",
        thumbnail: playlist.thumbnail || "/placeholder.svg",
        videoCount: playlist.videos?.length || 0,
        isPublic: playlist.is_public ?? true,
        isCollaborative: playlist.is_collaborative ?? false,
        collaborators: playlist.collaborators?.length || 0,
        views: playlist.views || 0,
        createdAt: playlist.created_at || playlist.createdAt || new Date().toISOString(),
        lastModified: playlist.updated_at || playlist.lastModified || new Date().toISOString(),
        tags: playlist.tags || [],
        category: playlist.category || "other",
        status: (playlist.is_draft ? "draft" : (playlist.is_public ? "published" : "private")) as "published" | "draft" | "private",
      })) || []

      setMyPlaylists(transformedPlaylists)
    } catch (error) {
      console.error("Failed to fetch my playlists:", error)
      setMyPlaylists([])
    } finally {
      setMyPlaylistsLoading(false)
    }
  }

  // Shared Playlists functions
  const fetchSharedPlaylists = async () => {
    setSharedPlaylistsLoading(true)
    try {
      const token = localStorage.getItem("token")
      if (!token) {
        setSharedPlaylistsLoading(false)
        return
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api"}/playlists/shared`,
        {
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      )

      if (!response.ok) {
        throw new Error("Failed to fetch shared playlists")
      }

      const data = await response.json()
      setSharedPlaylists(data.playlists || [])
    } catch (error) {
      console.error("Failed to fetch shared playlists:", error)
      setSharedPlaylists([])
    } finally {
      setSharedPlaylistsLoading(false)
    }
  }

  const deleteMyPlaylist = async (playlistId: string) => {
    if (confirm("Are you sure you want to delete this playlist?")) {
      try {
        const token = localStorage.getItem("token")
        if (!token) return

        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api"}/playlists/${playlistId}`,
          {
            method: "DELETE",
            credentials: "include",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
          }
        )

        if (!response.ok) {
          throw new Error("Failed to delete playlist")
        }

        // Remove from local state
        setMyPlaylists(prev => prev.filter(p => p.id !== playlistId))
        
        toast({
          title: "Success",
          description: "Playlist deleted successfully",
        })
      } catch (error) {
        console.error("Failed to delete playlist:", error)
        toast({
          title: "Error",
          description: "Failed to delete playlist. Please try again.",
          variant: "destructive",
        })
      }
    }
  }

  // Filter playlists based on search query (client-side filtering as backup)
  const filteredPlaylists = playlists.filter(playlist => {
    if (!searchQuery) return true
    
    const searchLower = searchQuery.toLowerCase()
    return (
      playlist.title.toLowerCase().includes(searchLower) ||
      playlist.description.toLowerCase().includes(searchLower) ||
      playlist.tags.some(tag => tag.toLowerCase().includes(searchLower)) ||
      playlist.owner.name.toLowerCase().includes(searchLower)
    )
  })

  const filteredFavoritePlaylists = favoritePlaylists.filter(playlist => {
    if (!searchQuery) return true
    
    const searchLower = searchQuery.toLowerCase()
    return (
      playlist.title.toLowerCase().includes(searchLower) ||
      playlist.description.toLowerCase().includes(searchLower) ||
      playlist.tags.some(tag => tag.toLowerCase().includes(searchLower)) ||
      playlist.owner.name.toLowerCase().includes(searchLower)
    )
  })

  const filteredMyPlaylists = useMemo(() => {
    let filtered = myPlaylists.filter((playlist) => {
      const matchesSearch =
        myPlaylistsSearchQuery === "" ||
        playlist.title.toLowerCase().includes(myPlaylistsSearchQuery.toLowerCase()) ||
        playlist.description.toLowerCase().includes(myPlaylistsSearchQuery.toLowerCase()) ||
        playlist.tags.some(tag => tag.toLowerCase().includes(myPlaylistsSearchQuery.toLowerCase()))

      const matchesCategory =
        myPlaylistsFilterBy === "all" || playlist.category === myPlaylistsFilterBy

      const matchesStatus =
        myPlaylistsStatusBy === "all" || playlist.status === myPlaylistsStatusBy

      const matchesCollaborative =
        myPlaylistsCollaborativeBy === "all" ||
        (myPlaylistsCollaborativeBy === "collaborative" && playlist.isCollaborative) ||
        (myPlaylistsCollaborativeBy === "solo" && !playlist.isCollaborative)

      return matchesSearch && matchesCategory && matchesStatus && matchesCollaborative
    })

    // Sort playlists
    if (myPlaylistsSortBy === "name") {
      filtered.sort((a, b) => a.title.localeCompare(b.title))
    } else if (myPlaylistsSortBy === "created") {
      filtered.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
    } else if (myPlaylistsSortBy === "videos") {
      filtered.sort((a, b) => b.videoCount - a.videoCount)
    } else if (myPlaylistsSortBy === "views") {
      filtered.sort((a, b) => b.views - a.views)
    } else if (myPlaylistsSortBy === "recent") {
      filtered.sort(
        (a, b) =>
          new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime()
      )
    }

    return filtered
  }, [myPlaylists, myPlaylistsSearchQuery, myPlaylistsFilterBy, myPlaylistsStatusBy, myPlaylistsCollaborativeBy, myPlaylistsSortBy])

  const PlaylistCard = ({ playlist }: { playlist: Playlist }) => (
    <Card className="group hover:shadow-xl transition-all duration-300 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border-orange-200/50 dark:border-gray-700/50 hover:border-orange-300 dark:hover:border-orange-600">
      <div className="relative">
        <img
          src={playlist.thumbnail || "/placeholder.svg?height=200&width=300"}
          alt={playlist.title}
          className="w-full h-48 object-cover rounded-t-lg"
        />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-200 rounded-t-lg flex items-center justify-center">
          <Button
            size="sm"
            className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-orange-500 hover:bg-orange-600 text-white shadow-lg"
          >
            <Play className="h-4 w-4 mr-2" />
            Play All
          </Button>
        </div>
      </div>
      <CardContent className="p-4">
        {/* Status Badges - moved here to avoid overlapping image */}
        <div className="flex flex-wrap gap-1 mb-3">
          {playlist.isPublic ? (
            <Badge variant="secondary" className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border border-green-200 dark:border-green-800">
              <Globe className="h-3 w-3 mr-1" />
              Public
            </Badge>
          ) : (
            <Badge variant="secondary" className="bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300 border border-gray-200 dark:border-gray-600">
              <Lock className="h-3 w-3 mr-1" />
              Private
            </Badge>
          )}
          {playlist.isCollaborative && (
            <Badge variant="secondary" className="bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
              <Users className="h-3 w-3 mr-1" />
              Collaborative
            </Badge>
          )}
        </div>
        
        <div className="flex items-start justify-between mb-2">
          <h3 className="font-semibold text-lg line-clamp-2 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors text-gray-900 dark:text-white">
            <Link href={`/playlists/${playlist.id}`}>{playlist.title}</Link>
          </h3>
          <div className="flex gap-1">
            <Button 
              variant="ghost" 
              size="sm" 
              className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-600 dark:text-gray-400 hover:text-orange-600 dark:hover:text-orange-400"
              onClick={(e) => {
                e.preventDefault()
                toggleFavorite(playlist.id)
              }}
            >
              <Heart 
                className={`h-4 w-4 ${playlist.isFavorite ? 'fill-orange-500 text-orange-500' : ''}`} 
              />
            </Button>
            <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-600 dark:text-gray-400 hover:text-orange-600 dark:hover:text-orange-400">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <p className="text-gray-600 dark:text-gray-400 text-sm mb-3 line-clamp-2">{playlist.description}</p>

        <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mb-3">
          <span>{playlist.videoCount} videos</span>
          <span className="flex items-center gap-1">
            <Eye className="h-3 w-3" />
            {playlist.views.toLocaleString()} views
          </span>
          {playlist.collaborators > 0 && (
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {playlist.collaborators} collaborators
            </span>
          )}
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img
              src={playlist.owner.avatar || "/placeholder.svg?height=24&width=24"}
              alt={playlist.owner.name}
              className="w-6 h-6 rounded-full"
            />
            <span className="text-sm text-gray-600 dark:text-gray-400">{playlist.owner.name}</span>
          </div>
          <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
            <Calendar className="h-3 w-3" />
            {new Date(playlist.lastModified).toLocaleDateString()}
          </div>
        </div>

        <div className="flex flex-wrap gap-1 mt-3">
          {playlist.tags.map((tag) => (
            <Badge key={tag} variant="outline" className="text-xs border-orange-200 dark:border-gray-600 text-gray-700 dark:text-gray-300">
              {tag}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  )

  const MyPlaylistCard = ({ playlist }: { playlist: MyPlaylist }) => (
    <Card className="group hover:shadow-xl transition-all duration-300 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border-orange-200/50 dark:border-gray-700/50 hover:border-orange-300 dark:hover:border-orange-600">
      <div className="relative">
        <img
          src={playlist.thumbnail || "/placeholder.svg?height=200&width=300"}
          alt={playlist.title}
          className="w-full h-48 object-cover rounded-t-lg"
        />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-200 rounded-t-lg flex items-center justify-center">
          <Button
            size="sm"
            className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-orange-500 hover:bg-orange-600 text-white shadow-lg"
          >
            <Play className="h-4 w-4 mr-2" />
            Play All
          </Button>
        </div>
      </div>
      <CardContent className="p-4">
        {/* Status Badges */}
        <div className="flex flex-wrap gap-1 mb-3">
          {playlist.status === "published" ? (
            <Badge variant="secondary" className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border border-green-200 dark:border-green-800">
              <Globe className="h-3 w-3 mr-1" />
              Published
            </Badge>
          ) : playlist.status === "draft" ? (
            <Badge variant="secondary" className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-800">
              <Edit className="h-3 w-3 mr-1" />
              Draft
            </Badge>
          ) : (
            <Badge variant="secondary" className="bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300 border border-gray-200 dark:border-gray-600">
              <Lock className="h-3 w-3 mr-1" />
              Private
            </Badge>
          )}
          {playlist.isCollaborative && (
            <Badge variant="secondary" className="bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
              <Users className="h-3 w-3 mr-1" />
              Collaborative
            </Badge>
          )}
        </div>
        
        <div className="flex items-start justify-between mb-2">
          <h3 className="font-semibold text-lg line-clamp-2 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors text-gray-900 dark:text-white">
            <Link href={`/playlists/${playlist.id}`}>{playlist.title}</Link>
          </h3>
          <div className="flex gap-1">
            <Button
              variant="ghost" 
              size="sm" 
              className="opacity-0 group-hover:opacity-100 transition-opacity text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
              onClick={(e) => {
                e.preventDefault()
                deleteMyPlaylist(playlist.id)
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <p className="text-gray-600 dark:text-gray-400 text-sm mb-3 line-clamp-2">{playlist.description}</p>

        <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mb-3">
          <span>{playlist.videoCount} videos</span>
          <span className="flex items-center gap-1">
            <Eye className="h-3 w-3" />
            {playlist.views.toLocaleString()} views
          </span>
          {playlist.collaborators > 0 && (
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {playlist.collaborators} collaborators
            </span>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
            <Calendar className="h-3 w-3" />
            Created {new Date(playlist.createdAt).toLocaleDateString()}
          </div>
          <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
            <Clock className="h-3 w-3" />
            Modified {new Date(playlist.lastModified).toLocaleDateString()}
          </div>
        </div>

        <div className="flex flex-wrap gap-1 mt-3">
          {playlist.tags.map((tag) => (
            <Badge key={tag} variant="outline" className="text-xs border-orange-200 dark:border-gray-600 text-gray-700 dark:text-gray-300">
              {tag}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  )

  const SharedPlaylistCard = ({ playlist }: { playlist: SharedPlaylist }) => (
    <Card className="group hover:shadow-xl transition-all duration-300 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border-orange-200/50 dark:border-gray-700/50 hover:border-orange-300 dark:hover:border-orange-600">
      <div className="relative">
        <img
          src={playlist.thumbnail || "/placeholder.svg?height=200&width=300"}
          alt={playlist.title}
          className="w-full h-48 object-cover rounded-t-lg"
        />
        <div className="absolute top-2 right-2 flex gap-1">
          <Badge className={`text-xs ${
            playlist.role === "admin" ? "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border-red-200 dark:border-red-800" :
            playlist.role === "editor" ? "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800" :
            "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-600"
          }`}>
            {playlist.role}
          </Badge>
        </div>
        <div className="absolute bottom-2 right-2">
          <Badge className="bg-black/70 text-white">
            {playlist.videoCount} videos
          </Badge>
        </div>
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-200 rounded-t-lg flex items-center justify-center">
          <Button
            size="sm"
            className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-orange-500 hover:bg-orange-600 text-white shadow-lg"
          >
            <Play className="h-4 w-4 mr-2" />
            Play All
          </Button>
        </div>
      </div>
      <CardContent className="p-4">
        <div className="flex flex-wrap gap-1 mb-3">
          {playlist.isPublic ? (
            <Badge variant="secondary" className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border border-green-200 dark:border-green-800">
              <Globe className="h-3 w-3 mr-1" />
              Public
            </Badge>
          ) : (
            <Badge variant="secondary" className="bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300 border border-gray-200 dark:border-gray-600">
              <Lock className="h-3 w-3 mr-1" />
              Private
            </Badge>
          )}
          {playlist.isCollaborative && (
            <Badge variant="secondary" className="bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
              <Users className="h-3 w-3 mr-1" />
              Collaborative
            </Badge>
          )}
        </div>
        
        <div className="flex items-start justify-between mb-2">
          <h3 className="font-semibold text-lg line-clamp-2 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors text-gray-900 dark:text-white">
            <Link href={`/playlists/${playlist.id}`}>{playlist.title}</Link>
          </h3>
        </div>
        <p className="text-gray-600 dark:text-gray-400 text-sm mb-3 line-clamp-2">{playlist.description}</p>

        <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mb-3">
          <div className="flex items-center gap-1">
            <img
              src={playlist.owner.avatar || "/placeholder.svg"}
              alt={playlist.owner.name}
              className="w-4 h-4 rounded-full"
            />
            <span>by {playlist.owner.name}</span>
          </div>
          <span className="flex items-center gap-1">
            <Eye className="h-3 w-3" />
            {playlist.views.toLocaleString()} views
          </span>
        </div>

        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
            <Calendar className="h-3 w-3" />
            Created {new Date(playlist.createdAt).toLocaleDateString()}
          </div>
          <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
            <Clock className="h-3 w-3" />
            Modified {new Date(playlist.lastModified).toLocaleDateString()}
          </div>
        </div>

        <div className="flex flex-wrap gap-1 mt-3">
          {playlist.tags.slice(0, 3).map((tag) => (
            <Badge key={tag} variant="outline" className="text-xs border-orange-200 dark:border-gray-600 text-gray-700 dark:text-gray-300">
              {tag}
            </Badge>
          ))}
          {playlist.tags.length > 3 && (
            <Badge variant="outline" className="text-xs border-orange-200 dark:border-gray-600 text-gray-700 dark:text-gray-300">
              +{playlist.tags.length - 3}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  )

  const PlaylistListItem = ({ playlist }: { playlist: Playlist }) => (
    <Card className="hover:shadow-lg transition-all duration-300 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border-orange-200/50 dark:border-gray-700/50 hover:border-orange-300 dark:hover:border-orange-600">
      <CardContent className="p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <img
            src={playlist.thumbnail || "/placeholder.svg?height=64&width=96"}
            alt={playlist.title}
            className="w-full sm:w-24 h-32 sm:h-16 object-cover rounded"
          />
          <div className="flex-1 min-w-0 w-full">
            <div className="flex flex-col sm:flex-row items-start justify-between mb-1">
              <h3 className="font-semibold text-lg truncate hover:text-orange-600 dark:hover:text-orange-400 transition-colors text-gray-900 dark:text-white mb-2 sm:mb-0">
                <Link href={`/playlists/${playlist.id}`}>{playlist.title}</Link>
              </h3>
              <div className="flex gap-1 flex-wrap sm:ml-2">
                {playlist.isPublic ? (
                  <Badge variant="secondary" className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border border-green-200 dark:border-green-800">
                    <Globe className="h-3 w-3 mr-1" />
                    Public
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300 border border-gray-200 dark:border-gray-600">
                    <Lock className="h-3 w-3 mr-1" />
                    Private
                  </Badge>
                )}
                {playlist.isCollaborative && (
                  <Badge variant="secondary" className="bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                    <Users className="h-3 w-3 mr-1" />
                    Collaborative
                  </Badge>
                )}
              </div>
            </div>
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-2 line-clamp-1">{playlist.description}</p>
            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
              <span>{playlist.videoCount} videos</span>
              <span className="flex items-center gap-1">
                <Eye className="h-3 w-3" />
                {playlist.views.toLocaleString()} views
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {new Date(playlist.lastModified).toLocaleDateString()}
              </span>
              <div className="flex items-center gap-2">
                <img
                  src={playlist.owner.avatar || "/placeholder.svg?height=16&width=16"}
                  alt={playlist.owner.name}
                  className="w-4 h-4 rounded-full"
                />
                <span>{playlist.owner.name}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button 
              variant="ghost" 
              size="sm"
              className="text-gray-600 dark:text-gray-400 hover:text-orange-600 dark:hover:text-orange-400 flex-1 sm:flex-none"
              onClick={(e) => {
                e.preventDefault()
                toggleFavorite(playlist.id)
              }}
            >
              <Heart 
                className={`h-4 w-4 ${playlist.isFavorite ? 'fill-orange-500 text-orange-500' : ''}`} 
              />
            </Button>
            <Button variant="outline" size="sm" className="border-orange-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-orange-50 dark:hover:bg-gray-700 flex-1 sm:flex-none">
              <Share2 className="h-4 w-4 mr-2" />
              Share
            </Button>
            <Button variant="ghost" size="sm" className="text-gray-600 dark:text-gray-400 hover:text-orange-600 dark:hover:text-orange-400 flex-1 sm:flex-none">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )

  // Don't render anything that depends on darkMode until mounted
  if (!mounted) {
    return <div className="min-h-screen" />
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
              <div className="text-center">
                <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">Playlist Manager</h1>
                <p className="text-gray-600 dark:text-gray-400 mt-1">Create and manage your collaborative playlists</p>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
          {/* Navigation Tabs */}
          <Tabs value={activeTab} onValueChange={handleTabChange} className="mb-6 md:mb-8">
            <TabsList className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border border-orange-200/50 dark:border-gray-700/50 grid w-full grid-cols-3 sm:grid-cols-5 lg:w-auto lg:grid-cols-none lg:inline-flex h-auto">
              <TabsTrigger 
                value="all"
                className="data-[state=active]:bg-orange-500 data-[state=active]:text-white text-gray-700 dark:text-gray-300 py-2 px-3 text-sm"
              >
                All Playlists
              </TabsTrigger>
              <TabsTrigger 
                value="mine"
                className="data-[state=active]:bg-orange-500 data-[state=active]:text-white text-gray-700 dark:text-gray-300 py-2 px-3 text-sm"
              >
                My Playlists
              </TabsTrigger>
              <TabsTrigger 
                value="shared"
                className="data-[state=active]:bg-orange-500 data-[state=active]:text-white text-gray-700 dark:text-gray-300 py-2 px-3 text-sm"
              >
                Shared Playlists
              </TabsTrigger>
              <TabsTrigger 
                value="favorites"
                className="data-[state=active]:bg-orange-500 data-[state=active]:text-white text-gray-700 dark:text-gray-300 py-2 px-3 text-sm"
              >
                Favorites
              </TabsTrigger>
              <TabsTrigger 
                value="create"
                className="data-[state=active]:bg-orange-500 data-[state=active]:text-white text-gray-700 dark:text-gray-300 py-2 px-3 text-sm"
              >
                <Plus className="h-4 w-4 mr-1" />
                Create
              </TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="space-y-6">
              {/* Search and Filters */}
              <div className="flex flex-col lg:flex-row gap-4 items-center justify-between bg-white/80 dark:bg-gray-800/80 backdrop-blur-md p-4 rounded-lg border border-orange-200/50 dark:border-gray-700/50 shadow-lg">
                <div className="flex-1 w-full lg:max-w-md">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 h-4 w-4" />
                    <Input
                      placeholder="Search playlists, descriptions, or tags..."
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                      className="pl-10 bg-white dark:bg-gray-700 border-orange-200 dark:border-gray-600 text-gray-900 dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:border-orange-500 dark:focus:border-orange-400"
                    />
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
                  <Select value={filterType} onValueChange={setFilterType}>
                    <SelectTrigger className="w-full sm:w-40 bg-white dark:bg-gray-700 border-orange-200 dark:border-gray-600 text-gray-900 dark:text-white">
                      <Filter className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="Filter" />
                    </SelectTrigger>
                    <SelectContent className="bg-white dark:bg-gray-800 border-orange-200 dark:border-gray-600">
                      <SelectItem value="all" className="text-gray-900 dark:text-white hover:bg-orange-50 dark:hover:bg-gray-700">All Playlists</SelectItem>
                      <SelectItem value="public" className="text-gray-900 dark:text-white hover:bg-orange-50 dark:hover:bg-gray-700">Public Only</SelectItem>
                      <SelectItem value="private" className="text-gray-900 dark:text-white hover:bg-orange-50 dark:hover:bg-gray-700">Private Only</SelectItem>
                      <SelectItem value="collaborative" className="text-gray-900 dark:text-white hover:bg-orange-50 dark:hover:bg-gray-700">Collaborative</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="w-full sm:w-40 bg-white dark:bg-gray-700 border-orange-200 dark:border-gray-600 text-gray-900 dark:text-white">
                      <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent className="bg-white dark:bg-gray-800 border-orange-200 dark:border-gray-600">
                      <SelectItem value="recent" className="text-gray-900 dark:text-white hover:bg-orange-50 dark:hover:bg-gray-700">Recently Modified</SelectItem>
                      <SelectItem value="oldest" className="text-gray-900 dark:text-white hover:bg-orange-50 dark:hover:bg-gray-700">Oldest First</SelectItem>
                      <SelectItem value="name" className="text-gray-900 dark:text-white hover:bg-orange-50 dark:hover:bg-gray-700">Name (A-Z)</SelectItem>
                      <SelectItem value="videos" className="text-gray-900 dark:text-white hover:bg-orange-50 dark:hover:bg-gray-700">Most Videos</SelectItem>
                      <SelectItem value="views" className="text-gray-900 dark:text-white hover:bg-orange-50 dark:hover:bg-gray-700">Most Views</SelectItem>
                    </SelectContent>
                  </Select>

                  <div className="flex border border-orange-200 dark:border-gray-600 rounded-md">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setViewMode("grid")}
                      className={`rounded-r-none transition-colors ${
                        viewMode === "grid" 
                          ? "bg-orange-500 text-white hover:bg-orange-600" 
                          : "text-gray-700 dark:text-gray-300 hover:bg-orange-50 dark:hover:bg-gray-700"
                      }`}
                    >
                      <Grid3X3 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setViewMode("list")}
                      className={`rounded-l-none transition-colors ${
                        viewMode === "list" 
                          ? "bg-orange-500 text-white hover:bg-orange-600" 
                          : "text-gray-700 dark:text-gray-300 hover:bg-orange-50 dark:hover:bg-gray-700"
                      }`}
                    >
                      <List className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Results Summary */}
              <div className="flex items-center justify-between">
                <p className="text-gray-600 dark:text-gray-400">
                  {loading ? "Loading..." : `${filteredPlaylists.length} playlist${filteredPlaylists.length !== 1 ? "s" : ""} found`}
                  {searchQuery && (
                    <span className="ml-2 text-orange-600 dark:text-orange-400">
                      for "{searchQuery}"
                    </span>
                  )}
                </p>
              </div>

              {/* Playlists Grid/List */}
              {loading ? (
                <div className={viewMode === "grid" ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" : "space-y-4"}>
                  {[...Array(6)].map((_, i) => (
                    <Card key={i} className="animate-pulse bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border-orange-200/50 dark:border-gray-700/50">
                      <div className="h-48 bg-gray-200 dark:bg-gray-700 rounded-t-lg"></div>
                      <CardContent className="p-4">
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
                        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded mb-3"></div>
                        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : filteredPlaylists.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-gray-400 dark:text-gray-500 mb-4">
                    <Grid3X3 className="h-16 w-16 mx-auto" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No playlists found</h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    {searchQuery
                      ? "Try adjusting your search terms or filters."
                      : "Get started by creating your first playlist."}
                  </p>
                  <Link href="/playlists/create">
                    <Button className="bg-orange-500 hover:bg-orange-600 text-white shadow-lg hover:shadow-xl transition-all duration-200">
                      <Plus className="h-4 w-4 mr-2" />
                      Create Your First Playlist
                    </Button>
                  </Link>
                </div>
              ) : (
                <>
                  <div
                    className={viewMode === "grid" ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" : "space-y-4"}
                  >
                    {filteredPlaylists.map((playlist) =>
                      viewMode === "grid" ? (
                        <PlaylistCard key={playlist.id} playlist={playlist} />
                      ) : (
                        <PlaylistListItem key={playlist.id} playlist={playlist} />
                      ),
                    )}
                  </div>

                  {/* Pagination */}
                  {pagination.total > 1 && (
                    <div className="flex items-center justify-center gap-2 mt-8">
                      <Button
                        variant="outline"
                        onClick={() => fetchPlaylists(pagination.current - 1)}
                        disabled={pagination.current === 1}
                        className="border-orange-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-orange-50 dark:hover:bg-gray-700"
                      >
                        Previous
                      </Button>
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        Page {pagination.current} of {pagination.total}
                      </span>
                      <Button
                        variant="outline"
                        onClick={() => fetchPlaylists(pagination.current + 1)}
                        disabled={pagination.current === pagination.total}
                        className="border-orange-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-orange-50 dark:hover:bg-gray-700"
                      >
                        Next
                      </Button>
                    </div>
                  )}
                </>
              )}
            </TabsContent>

            <TabsContent value="mine" className="space-y-6">
              {/* My Playlists Search and Filters */}
              <div className="flex flex-col lg:flex-row gap-4 items-center justify-between bg-white/80 dark:bg-gray-800/80 backdrop-blur-md p-4 rounded-lg border border-orange-200/50 dark:border-gray-700/50 shadow-lg">
                <div className="flex-1 w-full lg:max-w-md">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      type="text"
                      placeholder="Search my playlists..."
                      value={myPlaylistsSearchQuery}
                      onChange={(e) => setMyPlaylistsSearchQuery(e.target.value)}
                      className="pl-10 bg-white/50 dark:bg-gray-700/50 border-orange-200/50 dark:border-gray-600/50 focus:border-orange-400 dark:focus:border-orange-500"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 lg:gap-4 w-full lg:w-auto">
                  {/* Category Filter */}
                  <Select value={myPlaylistsFilterBy} onValueChange={setMyPlaylistsFilterBy}>
                    <SelectTrigger className="w-full sm:w-[140px] bg-white/50 dark:bg-gray-700/50 border-orange-200/50 dark:border-gray-600/50">
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      <SelectItem value="music">Music</SelectItem>
                      <SelectItem value="education">Education</SelectItem>
                      <SelectItem value="entertainment">Entertainment</SelectItem>
                      <SelectItem value="gaming">Gaming</SelectItem>
                      <SelectItem value="sports">Sports</SelectItem>
                      <SelectItem value="technology">Technology</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>

                  {/* Status Filter */}
                  <Select value={myPlaylistsStatusBy} onValueChange={setMyPlaylistsStatusBy}>
                    <SelectTrigger className="w-full sm:w-[120px] bg-white/50 dark:bg-gray-700/50 border-orange-200/50 dark:border-gray-600/50">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="published">Published</SelectItem>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="private">Private</SelectItem>
                    </SelectContent>
                  </Select>

                  {/* Collaborative Filter */}
                  <Select value={myPlaylistsCollaborativeBy} onValueChange={setMyPlaylistsCollaborativeBy}>
                    <SelectTrigger className="w-full sm:w-[140px] bg-white/50 dark:bg-gray-700/50 border-orange-200/50 dark:border-gray-600/50">
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="solo">Solo</SelectItem>
                      <SelectItem value="collaborative">Collaborative</SelectItem>
                    </SelectContent>
                  </Select>

                  {/* Sort Order */}
                  <Select value={myPlaylistsSortBy} onValueChange={setMyPlaylistsSortBy}>
                    <SelectTrigger className="w-full sm:w-[140px] bg-white/50 dark:bg-gray-700/50 border-orange-200/50 dark:border-gray-600/50">
                      <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="recent">Last Modified</SelectItem>
                      <SelectItem value="created">Created Date</SelectItem>
                      <SelectItem value="name">Name</SelectItem>
                      <SelectItem value="videos">Video Count</SelectItem>
                      <SelectItem value="views">Views</SelectItem>
                    </SelectContent>
                  </Select>

                  {/* View Toggle */}
                  <div className="flex bg-white/50 dark:bg-gray-700/50 rounded-md border border-orange-200/50 dark:border-gray-600/50">
                    <Button
                      variant={myPlaylistsViewMode === "grid" ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setMyPlaylistsViewMode("grid")}
                      className={myPlaylistsViewMode === "grid" ? "bg-orange-500 hover:bg-orange-600 text-white" : ""}
                    >
                      <Grid3X3 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant={myPlaylistsViewMode === "list" ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setMyPlaylistsViewMode("list")}
                      className={myPlaylistsViewMode === "list" ? "bg-orange-500 hover:bg-orange-600 text-white" : ""}
                    >
                      <List className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* My Playlists Stats */}
              <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md p-4 rounded-lg border border-orange-200/50 dark:border-gray-700/50 shadow-lg">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <h3 className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                      {myPlaylistsLoading ? "..." : filteredMyPlaylists.length}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Total Playlists</p>
                  </div>
                  <div className="text-center">
                    <h3 className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                      {myPlaylistsLoading ? "..." : filteredMyPlaylists.reduce((sum: number, p: MyPlaylist) => sum + p.videoCount, 0)}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Total Videos</p>
                  </div>
                  <div className="text-center">
                    <h3 className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                      {myPlaylistsLoading ? "..." : filteredMyPlaylists.filter((p: MyPlaylist) => p.status === "published").length}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Published</p>
                  </div>
                  <div className="text-center">
                    <h3 className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                      {myPlaylistsLoading ? "..." : filteredMyPlaylists.filter((p: MyPlaylist) => p.isCollaborative).length}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Collaborative</p>
                  </div>
                </div>
              </div>

              {/* My Playlists Content */}
              {myPlaylistsLoading ? (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {[...Array(8)].map((_, i) => (
                    <Card key={i} className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border-orange-200/50 dark:border-gray-700/50">
                      <div className="animate-pulse">
                        <div className="w-full h-48 bg-gray-300 dark:bg-gray-600 rounded-t-lg"></div>
                        <CardContent className="p-4">
                          <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded mb-2"></div>
                          <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded mb-3 w-3/4"></div>
                          <div className="flex gap-2 mb-3">
                            <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-16"></div>
                            <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-20"></div>
                          </div>
                        </CardContent>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : filteredMyPlaylists.length === 0 ? (
                <div className="text-center py-12">
                  <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md p-8 rounded-lg border border-orange-200/50 dark:border-gray-700/50 shadow-lg max-w-md mx-auto">
                    <Play className="h-16 w-16 text-orange-300 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                      No playlists found
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-4">
                      Create your first playlist to get started
                    </p>
                    <Button 
                      onClick={() => handleTabChange("create")}
                      className="bg-orange-500 hover:bg-orange-600 text-white"
                    >
                      Create Playlist
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  {myPlaylistsViewMode === "grid" ? (
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      {filteredMyPlaylists.map((playlist: MyPlaylist) => (
                        <MyPlaylistCard key={playlist.id} playlist={playlist} />
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {filteredMyPlaylists.map((playlist: MyPlaylist) => (
                        <MyPlaylistCard key={playlist.id} playlist={playlist} />
                      ))}
                    </div>
                  )}
                </>
              )}
            </TabsContent>

            <TabsContent value="shared" className="space-y-6">
              {/* Search and Filters for Shared Playlists */}
              <div className="flex flex-col lg:flex-row gap-4 items-center justify-between bg-white/80 dark:bg-gray-800/80 backdrop-blur-md p-4 rounded-lg border border-orange-200/50 dark:border-gray-700/50 shadow-lg">
                <div className="flex-1 w-full lg:max-w-md">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Shared Playlists</h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Playlists shared with you by other users</p>
                </div>

                <div className="flex items-center gap-3 w-full lg:w-auto">
                  <div className="flex border border-orange-200 dark:border-gray-600 rounded-md">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setViewMode("grid")}
                      className={`px-3 py-1 rounded-l-md ${
                        viewMode === "grid"
                          ? "bg-orange-500 text-white"
                          : "text-gray-600 dark:text-gray-400 hover:bg-orange-50 dark:hover:bg-gray-700"
                      }`}
                    >
                      <Grid3X3 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setViewMode("list")}
                      className={`px-3 py-1 rounded-r-md ${
                        viewMode === "list"
                          ? "bg-orange-500 text-white"
                          : "text-gray-600 dark:text-gray-400 hover:bg-orange-50 dark:hover:bg-gray-700"
                      }`}
                    >
                      <List className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Results count */}
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {sharedPlaylistsLoading ? "Loading..." : `${sharedPlaylists.length} shared playlist${sharedPlaylists.length !== 1 ? 's' : ''} found`}
              </div>

              {/* Shared Playlists Grid/List */}
              {sharedPlaylistsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
                </div>
              ) : (
                <>
                  {sharedPlaylists.length === 0 ? (
                    <div className="text-center py-12 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md rounded-lg border border-orange-200/50 dark:border-gray-700/50">
                      <Users className="mx-auto h-12 w-12 text-orange-400 mb-4" />
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                        No shared playlists yet
                      </h3>
                      <p className="text-gray-600 dark:text-gray-400 mb-4">
                        No playlists have been shared with you yet. Ask others to share their playlists with you!
                      </p>
                    </div>
                  ) : (
                    <div className={
                      viewMode === "grid"
                        ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
                        : "space-y-4"
                    }>
                      {sharedPlaylists.map((playlist) => (
                        <SharedPlaylistCard key={playlist.id} playlist={playlist} />
                      ))}
                    </div>
                  )}
                </>
              )}
            </TabsContent>

            <TabsContent value="favorites" className="space-y-6">
              {/* Search and Filters for Favorites - simplified */}
              <div className="flex flex-col lg:flex-row gap-4 items-center justify-between bg-white/80 dark:bg-gray-800/80 backdrop-blur-md p-4 rounded-lg border border-orange-200/50 dark:border-gray-700/50 shadow-lg">
                <div className="flex-1 w-full lg:max-w-md">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Your Favorite Playlists</h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Playlists you've added to your favorites</p>
                </div>

                <div className="flex items-center gap-3 w-full lg:w-auto">
                  <div className="flex border border-orange-200 dark:border-gray-600 rounded-md">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setViewMode("grid")}
                      className={`rounded-r-none transition-colors ${
                        viewMode === "grid" 
                          ? "bg-orange-500 text-white hover:bg-orange-600" 
                          : "text-gray-700 dark:text-gray-300 hover:bg-orange-50 dark:hover:bg-gray-700"
                      }`}
                    >
                      <Grid3X3 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setViewMode("list")}
                      className={`rounded-l-none transition-colors ${
                        viewMode === "list" 
                          ? "bg-orange-500 text-white hover:bg-orange-600" 
                          : "text-gray-700 dark:text-gray-300 hover:bg-orange-50 dark:hover:bg-gray-700"
                      }`}
                    >
                      <List className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Results Summary */}
              <div className="flex items-center justify-between">
                <p className="text-gray-600 dark:text-gray-400">
                  {loading ? "Loading..." : `${filteredFavoritePlaylists.length} favorite playlist${filteredFavoritePlaylists.length !== 1 ? "s" : ""}`}
                </p>
              </div>

              {/* Favorites Grid/List */}
              {loading ? (
                <div className={viewMode === "grid" ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" : "space-y-4"}>
                  {[...Array(3)].map((_, i) => (
                    <Card key={i} className="animate-pulse bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border-orange-200/50 dark:border-gray-700/50">
                      <div className="h-48 bg-gray-200 dark:bg-gray-700 rounded-t-lg"></div>
                      <CardContent className="p-4">
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
                        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded mb-3"></div>
                        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : filteredFavoritePlaylists.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-gray-400 dark:text-gray-500 mb-4">
                    <Heart className="h-16 w-16 mx-auto text-orange-300" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    {searchQuery.trim() ? "No matching favorite playlists" : "No favorite playlists yet"}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    {searchQuery.trim() 
                      ? "Try adjusting your search terms to find your favorite playlists."
                      : "Start adding playlists to your favorites by clicking the heart icon on any playlist."
                    }
                  </p>
                  <Button 
                    variant="outline"
                    onClick={() => handleTabChange("all")}
                    className="border-orange-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-orange-50 dark:hover:bg-gray-700"
                  >
                    Browse Playlists
                  </Button>
                </div>
              ) : (
                <>
                  <div
                    className={viewMode === "grid" ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" : "space-y-4"}
                  >
                    {filteredFavoritePlaylists.map((playlist) =>
                      viewMode === "grid" ? (
                        <PlaylistCard key={playlist.id} playlist={playlist} />
                      ) : (
                        <PlaylistListItem key={playlist.id} playlist={playlist} />
                      ),
                    )}
                  </div>

                  {/* Pagination for Favorites */}
                  {pagination.total > 1 && (
                    <div className="flex items-center justify-center gap-2 mt-8">
                      <Button
                        variant="outline"
                        onClick={() => fetchFavorites(pagination.current - 1)}
                        disabled={pagination.current === 1}
                        className="border-orange-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-orange-50 dark:hover:bg-gray-700"
                      >
                        Previous
                      </Button>
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        Page {pagination.current} of {pagination.total}
                      </span>
                      <Button
                        variant="outline"
                        onClick={() => fetchFavorites(pagination.current + 1)}
                        disabled={pagination.current === pagination.total}
                        className="border-orange-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-orange-50 dark:hover:bg-gray-700"
                      >
                        Next
                      </Button>
                    </div>
                  )}
                </>
              )}
            </TabsContent>

            <TabsContent value="create" className="space-y-6">
              {/* Error Display */}
              {createError && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                  <p className="text-red-700 dark:text-red-300">{createError}</p>
                </div>
              )}

              <form onSubmit={(e) => handleCreateSubmit(e, false)} className="space-y-6">
                {/* Import Section */}
                <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border-orange-200/50 dark:border-gray-700/50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-orange-600 dark:text-orange-400">
                      <Import className="h-5 w-5" />
                      Import from YouTube (Optional)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex gap-4">
                      <div className="flex-1">
                        <Label htmlFor="importUrl" className="text-gray-700 dark:text-gray-300">YouTube Playlist URL</Label>
                        <Input
                          id="importUrl"
                          placeholder="https://www.youtube.com/playlist?list=..."
                          value={createFormData.importUrl}
                          onChange={(e) => handleCreateInputChange("importUrl", e.target.value)}
                          className="mt-1 bg-white dark:bg-gray-700 border-orange-200 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                        />
                      </div>
                      <div className="flex items-end">
                        <Button
                          type="button"
                          onClick={handleImportPlaylist}
                          disabled={!createFormData.importUrl || isImporting}
                          className="bg-orange-500 hover:bg-orange-600 text-white"
                        >
                          {isImporting ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                              Importing...
                            </>
                          ) : (
                            <>
                              <Youtube className="h-4 w-4 mr-1" />
                              Import
                            </>
                          )}
                        </Button>
                      </div>
                    </div>

                    {importedPlaylist && (
                      <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                        <div className="flex items-start gap-4">
                          <img
                            src={importedPlaylist.thumbnail || "/placeholder.svg"}
                            alt="Imported playlist"
                            className="w-20 h-14 object-cover rounded"
                          />
                          <div className="flex-1">
                            <h4 className="font-semibold text-green-800 dark:text-green-300">{importedPlaylist.title}</h4>
                            <p className="text-sm text-green-600 dark:text-green-400 mb-2">{importedPlaylist.description}</p>
                            <Badge className="bg-green-100 dark:bg-green-800 text-green-800 dark:text-green-200">
                              {importedPlaylist.videoCount} videos imported
                            </Badge>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Basic Information */}
                <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border-orange-200/50 dark:border-gray-700/50">
                  <CardHeader>
                    <CardTitle className="text-orange-600 dark:text-orange-400">Basic Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="title" className="text-gray-700 dark:text-gray-300">Playlist Title *</Label>
                      <Input
                        id="title"
                        placeholder="Enter playlist title"
                        value={createFormData.title}
                        onChange={(e) => handleCreateInputChange("title", e.target.value)}
                        required
                        className="mt-1 bg-white dark:bg-gray-700 border-orange-200 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                      />
                    </div>

                    <div>
                      <Label htmlFor="description" className="text-gray-700 dark:text-gray-300">Description</Label>
                      <Textarea
                        id="description"
                        placeholder="Describe your playlist..."
                        value={createFormData.description}
                        onChange={(e) => handleCreateInputChange("description", e.target.value)}
                        rows={4}
                        className="mt-1 bg-white dark:bg-gray-700 border-orange-200 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                      />
                    </div>

                    <div>
                      <Label htmlFor="category" className="text-gray-700 dark:text-gray-300">Category</Label>
                      <Select value={createFormData.category} onValueChange={(value) => handleCreateInputChange("category", value)}>
                        <SelectTrigger className="mt-1 bg-white dark:bg-gray-700 border-orange-200 dark:border-gray-600 text-gray-900 dark:text-white">
                          <SelectValue placeholder="Select a category" />
                        </SelectTrigger>
                        <SelectContent className="bg-white dark:bg-gray-800 border-orange-200 dark:border-gray-600">
                          <SelectItem value="music">Music</SelectItem>
                          <SelectItem value="education">Education</SelectItem>
                          <SelectItem value="entertainment">Entertainment</SelectItem>
                          <SelectItem value="gaming">Gaming</SelectItem>
                          <SelectItem value="technology">Technology</SelectItem>
                          <SelectItem value="sports">Sports</SelectItem>
                          <SelectItem value="cooking">Cooking</SelectItem>
                          <SelectItem value="travel">Travel</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="text-gray-700 dark:text-gray-300">Tags</Label>
                      <div className="flex gap-2 mb-2 mt-1">
                        <Input
                          placeholder="Add a tag"
                          value={newTag}
                          onChange={(e) => setNewTag(e.target.value)}
                          onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
                          className="bg-white dark:bg-gray-700 border-orange-200 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                        />
                        <Button type="button" onClick={addTag} variant="outline" className="border-orange-200 dark:border-gray-600 text-orange-600 dark:text-orange-400">
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {createFormData.tags.map((tag) => (
                          <Badge key={tag} variant="secondary" className="flex items-center gap-1 bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300">
                            {tag}
                            <button type="button" onClick={() => removeTag(tag)} className="ml-1 hover:text-red-600 dark:hover:text-red-400">
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Privacy & Collaboration Settings */}
                <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border-orange-200/50 dark:border-gray-700/50">
                  <CardHeader>
                    <CardTitle className="text-gray-900 dark:text-white">Privacy & Collaboration</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          {createFormData.isPublic ? (
                            <Globe className="h-4 w-4 text-green-600 dark:text-green-400" />
                          ) : (
                            <Lock className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                          )}
                          <Label htmlFor="isPublic" className="text-gray-900 dark:text-white">Public Playlist</Label>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {createFormData.isPublic
                            ? "Anyone can view and search for this playlist"
                            : "Only you and invited collaborators can access this playlist"}
                        </p>
                      </div>
                      <Switch
                        id="isPublic"
                        checked={createFormData.isPublic}
                        onCheckedChange={(checked) => handleCreateInputChange("isPublic", checked)}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                          <Label htmlFor="isCollaborative" className="text-gray-900 dark:text-white">Enable Collaboration</Label>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Allow others to add, remove, and reorder videos in this playlist
                        </p>
                      </div>
                      <Switch
                        id="isCollaborative"
                        checked={createFormData.isCollaborative}
                        onCheckedChange={(checked) => handleCreateInputChange("isCollaborative", checked)}
                      />
                    </div>

                    {createFormData.isCollaborative && (
                      <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
                        <h4 className="font-semibold text-orange-800 dark:text-orange-300 mb-2">Collaboration Features</h4>
                        <ul className="text-sm text-orange-700 dark:text-orange-400 space-y-1">
                          <li>• Invite users by email or username</li>
                          <li>• Set different permission levels (Admin, Editor, Viewer)</li>
                          <li>• Real-time collaboration with activity logs</li>
                          <li>• Comment and discussion system</li>
                        </ul>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Thumbnail Upload */}
                <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border-orange-200/50 dark:border-gray-700/50">
                  <CardHeader>
                    <CardTitle className="text-gray-900 dark:text-white">Playlist Thumbnail</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {thumbnailPreview ? (
                      <div className="relative">
                        <img
                          src={thumbnailPreview}
                          alt="Thumbnail preview"
                          className="w-full max-w-md h-48 object-cover rounded-lg border"
                        />
                        <Button
                          type="button"
                          onClick={removeThumbnail}
                          variant="destructive"
                          size="sm"
                          className="absolute top-2 right-2"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="border-2 border-dashed border-orange-300 dark:border-gray-600 rounded-lg p-8 text-center hover:border-orange-400 dark:hover:border-orange-500 transition-colors">
                        <Upload className="h-12 w-12 text-orange-400 mx-auto mb-4" />
                        <p className="text-gray-600 dark:text-gray-400 mb-2">Upload a custom thumbnail</p>
                        <p className="text-sm text-gray-500 dark:text-gray-500 mb-4">Recommended: 1280x720px, JPG or PNG</p>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleThumbnailChange}
                          className="hidden"
                          id="thumbnail-upload"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => document.getElementById('thumbnail-upload')?.click()}
                          className="border-orange-200 dark:border-gray-600 text-orange-600 dark:text-orange-400"
                        >
                          <Upload className="h-4 w-4 mr-2" />
                          Choose File
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Action Buttons */}
                <div className="flex items-center justify-between pt-6 border-t border-orange-200 dark:border-gray-700">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleTabChange("all")}
                    className="border-orange-200 dark:border-gray-600 text-gray-700 dark:text-gray-300"
                  >
                    Cancel
                  </Button>
                  <div className="flex gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={(e) => handleCreateSubmit(e, true)}
                      disabled={!createFormData.title || createLoading}
                      className="border-orange-200 dark:border-gray-600 text-gray-700 dark:text-gray-300"
                    >
                      {createLoading ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400 mr-2"></div>
                          Saving...
                        </>
                      ) : (
                        "Save as Draft"
                      )}
                    </Button>
                    <Button 
                      type="submit" 
                      className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white"
                      disabled={!createFormData.title || createLoading}
                    >
                      {createLoading ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Creating...
                        </>
                      ) : (
                        "Create Playlist"
                      )}
                    </Button>
                  </div>
                </div>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </AuthGuard>
  )
}

export default function PlaylistsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center"><div className="text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" /><p>Loading playlists...</p></div></div>}>
      <PlaylistsPageContent />
    </Suspense>
  )
}
