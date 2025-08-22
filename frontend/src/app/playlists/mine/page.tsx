"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
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
  Edit3,
  Trash2,
  Download,
  Copy,
} from "lucide-react"
import AuthGuard from "@/components/AuthGuard"

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

export default function MyPlaylistsPage() {
  const [playlists, setPlaylists] = useState<MyPlaylist[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [filterStatus, setFilterStatus] = useState("all")
  const [sortBy, setSortBy] = useState("recent")
  const [loading, setLoading] = useState(true)

  // Mock data - replace with API call
  const mockPlaylists: MyPlaylist[] = [
    {
      id: "1",
      title: "My Favorite Music Videos",
      description: "A collection of my all-time favorite music videos from various artists",
      thumbnail: "/5.png",
      videoCount: 24,
      isPublic: true,
      isCollaborative: false,
      collaborators: 0,
      views: 1245,
      createdAt: "2024-01-15",
      lastModified: "2024-01-20",
      tags: ["music", "favorites", "entertainment"],
      category: "music",
      status: "published",
    },
    {
      id: "2",
      title: "React.js Tutorial Series",
      description: "Complete tutorial series for learning React.js from basics to advanced concepts",
      thumbnail: "/6.png",
      videoCount: 35,
      isPublic: true,
      isCollaborative: true,
      collaborators: 3,
      views: 2856,
      createdAt: "2024-01-10",
      lastModified: "2024-01-25",
      tags: ["react", "javascript", "programming", "tutorial"],
      category: "education",
      status: "published",
    },
    {
      id: "3",
      title: "Cooking Experiments",
      description: "Trying out new recipes and cooking techniques",
      thumbnail: "/7.png",
      videoCount: 12,
      isPublic: false,
      isCollaborative: false,
      collaborators: 0,
      views: 0,
      createdAt: "2024-01-20",
      lastModified: "2024-01-22",
      tags: ["cooking", "recipes", "food"],
      category: "cooking",
      status: "private",
    },
    {
      id: "4",
      title: "Travel Vlogs Draft",
      description: "Collection of travel videos I'm planning to publish",
      thumbnail: "/8.png",
      videoCount: 8,
      isPublic: false,
      isCollaborative: false,
      collaborators: 0,
      views: 0,
      createdAt: "2024-01-25",
      lastModified: "2024-01-25",
      tags: ["travel", "vlog", "adventure"],
      category: "travel",
      status: "draft",
    },
  ]

  const deletePlaylist = async (playlistId: string) => {
    if (confirm("Are you sure you want to delete this playlist?")) {
      try {
        const token = localStorage.getItem("token")
        if (!token) return

        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/playlists/${playlistId}`,
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
        setPlaylists(prev => prev.filter(p => p.id !== playlistId))
      } catch (error) {
        console.error("Failed to delete playlist:", error)
        alert("Failed to delete playlist. Please try again.")
      }
    }
  }

  const duplicatePlaylist = async (playlistId: string) => {
    const original = playlists.find(p => p.id === playlistId)
    if (original) {
      try {
        const token = localStorage.getItem("token")
        if (!token) return

        const duplicateData = {
          name: `${original.title} (Copy)`,
          description: original.description,
          is_public: original.isPublic,
          is_collaborative: original.isCollaborative,
          category: original.category,
          tags: JSON.stringify(original.tags),
        }

        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/playlists`,
          {
            method: "POST",
            credentials: "include",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(duplicateData),
          }
        )

        if (!response.ok) {
          throw new Error("Failed to duplicate playlist")
        }

        const newPlaylist = await response.json()
        
        // Transform and add to local state
        const transformedPlaylist: MyPlaylist = {
          id: newPlaylist._id || newPlaylist.id,
          title: newPlaylist.name || newPlaylist.title,
          description: newPlaylist.description || "",
          thumbnail: newPlaylist.thumbnail || "/placeholder.svg",
          videoCount: 0,
          isPublic: newPlaylist.is_public ?? true,
          isCollaborative: newPlaylist.is_collaborative ?? false,
          collaborators: 0,
          views: 0,
          createdAt: newPlaylist.created_at || new Date().toISOString(),
          lastModified: newPlaylist.updated_at || new Date().toISOString(),
          tags: newPlaylist.tags || [],
          category: newPlaylist.category || "other",
          status: (newPlaylist.is_draft ? "draft" : (newPlaylist.is_public ? "published" : "private")) as "published" | "draft" | "private",
        }

        setPlaylists(prev => [transformedPlaylist, ...prev])
      } catch (error) {
        console.error("Failed to duplicate playlist:", error)
        alert("Failed to duplicate playlist. Please try again.")
      }
    }
  }

  // Fetch user's playlists from API
  const fetchMyPlaylists = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem("token")
      if (!token) {
        setLoading(false)
        return
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/playlists/mine`,
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

      setPlaylists(transformedPlaylists)
    } catch (error) {
      console.error("Failed to fetch playlists:", error)
      // Fallback to empty array on error
      setPlaylists([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMyPlaylists()
  }, [])

  // Filter and sort playlists
  const filteredPlaylists = playlists.filter((playlist) => {
    const matchesSearch = 
      playlist.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      playlist.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      playlist.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()))

    const matchesFilter = 
      filterStatus === "all" || 
      playlist.status === filterStatus

    return matchesSearch && matchesFilter
  })

  const sortedPlaylists = [...filteredPlaylists].sort((a, b) => {
    switch (sortBy) {
      case "recent":
        return new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime()
      case "oldest":
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      case "title":
        return a.title.localeCompare(b.title)
      case "videos":
        return b.videoCount - a.videoCount
      case "views":
        return b.views - a.views
      default:
        return 0
    }
  })

  const renderPlaylistCard = (playlist: MyPlaylist) => (
    <Card key={playlist.id} className="overflow-hidden hover:shadow-lg transition-shadow">
      <div className="relative">
        <img
          src={playlist.thumbnail}
          alt={playlist.title}
          className="w-full h-48 object-cover"
        />
        <div className="absolute top-2 right-2 flex gap-1">
          <Badge
            variant={playlist.status === "published" ? "default" : playlist.status === "draft" ? "secondary" : "outline"}
            className="text-xs"
          >
            {playlist.status}
          </Badge>
          {playlist.isPublic ? (
            <Badge className="bg-green-100 text-green-800 border-green-200">
              <Globe className="h-3 w-3 mr-1" />
              Public
            </Badge>
          ) : (
            <Badge className="bg-gray-100 text-gray-800 border-gray-200">
              <Lock className="h-3 w-3 mr-1" />
              Private
            </Badge>
          )}
          {playlist.isCollaborative && (
            <Badge className="bg-blue-100 text-blue-800 border-blue-200">
              <Users className="h-3 w-3 mr-1" />
              Collaborative
            </Badge>
          )}
        </div>
        <div className="absolute bottom-2 right-2">
          <Badge className="bg-black/70 text-white">
            {playlist.videoCount} videos
          </Badge>
        </div>
        <div className="absolute top-2 left-2">
          <div className="dropdown">
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 bg-black/50 hover:bg-black/70 text-white">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
      
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <Link href={`/playlists/${playlist.id}`}>
              <h3 className="font-semibold text-lg mb-2 hover:text-red-600 transition-colors">
                {playlist.title}
              </h3>
            </Link>
            <p className="text-gray-600 text-sm mb-3 line-clamp-2">
              {playlist.description}
            </p>
            
            <div className="flex flex-wrap gap-1 mb-3">
              {playlist.tags.slice(0, 3).map((tag) => (
                <Badge key={tag} variant="outline" className="text-xs">
                  {tag}
                </Badge>
              ))}
              {playlist.tags.length > 3 && (
                <Badge variant="outline" className="text-xs">
                  +{playlist.tags.length - 3}
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-4 text-sm text-gray-500">
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {new Date(playlist.lastModified).toLocaleDateString()}
              </div>
              {playlist.views > 0 && (
                <div className="flex items-center gap-1">
                  <Eye className="h-4 w-4" />
                  {playlist.views.toLocaleString()}
                </div>
              )}
              {playlist.isCollaborative && playlist.collaborators > 0 && (
                <div className="flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  {playlist.collaborators}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 mt-4">
              <Link href={`/playlists/${playlist.id}`}>
                <Button size="sm" className="bg-red-600 hover:bg-red-700">
                  <Play className="h-4 w-4 mr-1" />
                  View
                </Button>
              </Link>
              <Link href={`/playlists/${playlist.id}/edit`}>
                <Button variant="outline" size="sm">
                  <Edit3 className="h-4 w-4 mr-1" />
                  Edit
                </Button>
              </Link>
              <Button variant="outline" size="sm" onClick={() => duplicatePlaylist(playlist.id)}>
                <Copy className="h-4 w-4 mr-1" />
                Duplicate
              </Button>
              <Button variant="outline" size="sm">
                <Share2 className="h-4 w-4 mr-1" />
                Share
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => deletePlaylist(playlist.id)}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Delete
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )

  const renderPlaylistListItem = (playlist: MyPlaylist) => (
    <Card key={playlist.id} className="mb-4">
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          <img
            src={playlist.thumbnail}
            alt={playlist.title}
            className="w-24 h-16 object-cover rounded"
          />
          
          <div className="flex-1">
            <div className="flex items-start justify-between">
              <div>
                <Link href={`/playlists/${playlist.id}`}>
                  <h3 className="font-semibold text-lg hover:text-red-600 transition-colors">
                    {playlist.title}
                  </h3>
                </Link>
                <p className="text-gray-600 text-sm mb-2">{playlist.description}</p>
                
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <span>{playlist.videoCount} videos</span>
                  {playlist.views > 0 && <span>{playlist.views.toLocaleString()} views</span>}
                  <span>Modified {new Date(playlist.lastModified).toLocaleDateString()}</span>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <Badge
                  variant={playlist.status === "published" ? "default" : playlist.status === "draft" ? "secondary" : "outline"}
                >
                  {playlist.status}
                </Badge>
                {playlist.isPublic ? (
                  <Badge className="bg-green-100 text-green-800">
                    <Globe className="h-3 w-3 mr-1" />
                    Public
                  </Badge>
                ) : (
                  <Badge className="bg-gray-100 text-gray-800">
                    <Lock className="h-3 w-3 mr-1" />
                    Private
                  </Badge>
                )}
                {playlist.isCollaborative && (
                  <Badge className="bg-blue-100 text-blue-800">
                    <Users className="h-3 w-3 mr-1" />
                    Collaborative
                  </Badge>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-2 mt-3">
              <Link href={`/playlists/${playlist.id}`}>
                <Button size="sm" className="bg-red-600 hover:bg-red-700">
                  <Play className="h-4 w-4 mr-1" />
                  View
                </Button>
              </Link>
              <Link href={`/playlists/${playlist.id}/edit`}>
                <Button variant="outline" size="sm">
                  <Edit3 className="h-4 w-4 mr-1" />
                  Edit
                </Button>
              </Link>
              <Button variant="outline" size="sm" onClick={() => duplicatePlaylist(playlist.id)}>
                <Copy className="h-4 w-4 mr-1" />
                Duplicate
              </Button>
              <Button variant="outline" size="sm">
                <Share2 className="h-4 w-4 mr-1" />
                Share
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => deletePlaylist(playlist.id)}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Delete
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )

  return (
    <AuthGuard>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">My Playlists</h1>
                <p className="text-gray-600 mt-1">Manage your personal playlist collection</p>
              </div>
              <Link href="/playlists/create">
                <Button className="bg-red-600 hover:bg-red-700">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Playlist
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="p-3 rounded-full bg-blue-100 mr-4">
                    <List className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{playlists.length}</p>
                    <p className="text-gray-600">Total Playlists</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="p-3 rounded-full bg-green-100 mr-4">
                    <Play className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">
                      {playlists.reduce((sum, p) => sum + p.videoCount, 0)}
                    </p>
                    <p className="text-gray-600">Total Videos</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="p-3 rounded-full bg-purple-100 mr-4">
                    <Users className="h-6 w-6 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">
                      {playlists.filter(p => p.isCollaborative).length}
                    </p>
                    <p className="text-gray-600">Collaborative</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="p-3 rounded-full bg-orange-100 mr-4">
                    <Eye className="h-6 w-6 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">
                      {playlists.reduce((sum, p) => sum + p.views, 0).toLocaleString()}
                    </p>
                    <p className="text-gray-600">Total Views</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Controls */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search your playlists..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <div className="flex gap-2">
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[140px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="private">Private</SelectItem>
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recent">Most Recent</SelectItem>
                  <SelectItem value="oldest">Oldest First</SelectItem>
                  <SelectItem value="title">Title A-Z</SelectItem>
                  <SelectItem value="videos">Most Videos</SelectItem>
                  <SelectItem value="views">Most Views</SelectItem>
                </SelectContent>
              </Select>

              <div className="flex bg-gray-100 rounded-md p-1">
                <Button
                  variant={viewMode === "grid" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("grid")}
                  className="h-8"
                >
                  <Grid3X3 className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === "list" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("list")}
                  className="h-8"
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Content */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Card key={i} className="overflow-hidden">
                  <div className="w-full h-48 bg-gray-200 animate-pulse"></div>
                  <CardContent className="p-4">
                    <div className="space-y-3">
                      <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                      <div className="h-3 bg-gray-200 rounded animate-pulse w-3/4"></div>
                      <div className="h-3 bg-gray-200 rounded animate-pulse w-1/2"></div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : sortedPlaylists.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-400 mb-4">
                <List className="h-16 w-16 mx-auto" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {searchQuery || filterStatus !== "all" ? "No playlists found" : "No playlists yet"}
              </h3>
              <p className="text-gray-600 mb-6">
                {searchQuery || filterStatus !== "all"
                  ? "Try adjusting your search or filter criteria"
                  : "Create your first playlist to get started"}
              </p>
              {!searchQuery && filterStatus === "all" && (
                <Link href="/playlists/create">
                  <Button className="bg-red-600 hover:bg-red-700">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Your First Playlist
                  </Button>
                </Link>
              )}
            </div>
          ) : (
            <div className={viewMode === "grid" 
              ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" 
              : "space-y-4"
            }>
              {sortedPlaylists.map((playlist) => 
                viewMode === "grid" 
                  ? renderPlaylistCard(playlist)
                  : renderPlaylistListItem(playlist)
              )}
            </div>
          )}
        </div>
      </div>
    </AuthGuard>
  )
}
