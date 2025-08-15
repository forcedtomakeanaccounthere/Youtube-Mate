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
  Edit,
  Trash2,
  Share2,
  Settings,
} from "lucide-react"

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
  status: "active" | "draft" | "archived"
}

export default function MyPlaylistsPage() {
  const [playlists, setPlaylists] = useState<MyPlaylist[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [filterStatus, setFilterStatus] = useState("all")
  const [sortBy, setSortBy] = useState("recent")
  const [loading, setLoading] = useState(true)

  const handleDeletePlaylist = async (playlistId: string) => {
    if (!confirm("Are you sure you want to delete this playlist? This action cannot be undone.")) {
      return
    }

    try {
      const token = localStorage.getItem("token")
      if (!token) {
        alert("Authentication required")
        return
      }

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
      alert("Playlist deleted successfully")
    } catch (error) {
      console.error("Error deleting playlist:", error)
      alert("Failed to delete playlist. Please try again.")
    }
  }

  const handleEditPlaylist = (playlistId: string) => {
    // For now, just navigate to the playlist page where they can edit
    // In a full implementation, you might have a dedicated edit page
    window.location.href = `/playlists/${playlistId}?edit=true`
  }

  useEffect(() => {
    const fetchMyPlaylists = async () => {
      setLoading(true)
      try {
        const token = localStorage.getItem("token")
        if (!token) {
          console.warn("No authentication token found")
          setLoading(false)
          return
        }

        const params = new URLSearchParams({
          page: "1",
          limit: "20",
          search: searchQuery,
          status: filterStatus,
          sort: sortBy,
        })

        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/playlists/mine?${params}`,
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
        setPlaylists(data.playlists || [])
      } catch (error) {
        console.error("Error fetching my playlists:", error)
        setPlaylists([])
      } finally {
        setLoading(false)
      }
    }

    fetchMyPlaylists()
  }, [searchQuery, filterStatus, sortBy])

  const filteredPlaylists = playlists.filter((playlist) => {
    const matchesSearch =
      playlist.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      playlist.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      playlist.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()))

    const matchesFilter = filterStatus === "all" || playlist.status === filterStatus

    return matchesSearch && matchesFilter
  })

  const sortedPlaylists = [...filteredPlaylists].sort((a, b) => {
    switch (sortBy) {
      case "recent":
        return new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime()
      case "oldest":
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      case "name":
        return a.title.localeCompare(b.title)
      case "videos":
        return b.videoCount - a.videoCount
      case "views":
        return b.views - a.views
      default:
        return 0
    }
  })

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-100 text-green-800">Active</Badge>
      case "draft":
        return <Badge className="bg-yellow-100 text-yellow-800">Draft</Badge>
      case "archived":
        return <Badge className="bg-gray-100 text-gray-800">Archived</Badge>
      default:
        return null
    }
  }

  const PlaylistCard = ({ playlist }: { playlist: MyPlaylist }) => (
    <Card className="group hover:shadow-lg transition-all duration-200 border-gray-200 hover:border-red-200">
      <div className="relative">
        <img
          src={playlist.thumbnail || "/placeholder.svg"}
          alt={playlist.title}
          className="w-full h-48 object-cover rounded-t-lg"
        />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-200 rounded-t-lg flex items-center justify-center">
          <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <Button size="sm" className="bg-red-600 hover:bg-red-700">
              <Play className="h-4 w-4 mr-2" />
              Play
            </Button>
            <Button size="sm" variant="secondary">
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
          </div>
        </div>
        <div className="absolute top-2 left-2">{getStatusBadge(playlist.status)}</div>
        <div className="absolute top-2 right-2 flex gap-1">
          {playlist.isPublic ? (
            <Badge variant="secondary" className="bg-green-100 text-green-800">
              <Globe className="h-3 w-3 mr-1" />
              Public
            </Badge>
          ) : (
            <Badge variant="secondary" className="bg-gray-100 text-gray-800">
              <Lock className="h-3 w-3 mr-1" />
              Private
            </Badge>
          )}
          {playlist.isCollaborative && (
            <Badge variant="secondary" className="bg-blue-100 text-blue-800">
              <Users className="h-3 w-3 mr-1" />
              {playlist.collaborators}
            </Badge>
          )}
        </div>
      </div>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <h3 className="font-semibold text-lg line-clamp-2 group-hover:text-red-600 transition-colors">
            <Link href={`/playlists/${playlist.id}`}>{playlist.title}</Link>
          </h3>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button variant="ghost" size="sm">
              <Settings className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <p className="text-gray-600 text-sm mb-3 line-clamp-2">{playlist.description}</p>

        <div className="flex items-center gap-4 text-sm text-gray-500 mb-3">
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

        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <Calendar className="h-3 w-3" />
            Modified {new Date(playlist.lastModified).toLocaleDateString()}
          </div>
        </div>

        <div className="flex flex-wrap gap-1 mb-3">
          {playlist.tags.map((tag) => (
            <Badge key={tag} variant="outline" className="text-xs">
              {tag}
            </Badge>
          ))}
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1 bg-transparent">
            <Share2 className="h-4 w-4 mr-2" />
            Share
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className="flex-1 bg-transparent"
            onClick={() => handleEditPlaylist(playlist.id)}
          >
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className="text-red-600 hover:text-red-700 bg-transparent"
            onClick={() => handleDeletePlaylist(playlist.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <nav className="flex items-center space-x-2 text-sm text-gray-500 mb-2">
                <Link href="/playlists" className="hover:text-red-600">
                  Playlists
                </Link>
                <span>/</span>
                <span className="text-gray-900">My Playlists</span>
              </nav>
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

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search and Filters */}
        <div className="flex flex-col lg:flex-row gap-4 items-center justify-between bg-white p-4 rounded-lg border border-gray-200 mb-8">
          <div className="flex-1 w-full lg:max-w-md">
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

          <div className="flex items-center gap-3 w-full lg:w-auto">
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full lg:w-40">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-full lg:w-40">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Recently Modified</SelectItem>
                <SelectItem value="oldest">Oldest First</SelectItem>
                <SelectItem value="name">Name (A-Z)</SelectItem>
                <SelectItem value="videos">Most Videos</SelectItem>
                <SelectItem value="views">Most Views</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex border border-gray-200 rounded-md">
              <Button
                variant={viewMode === "grid" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("grid")}
                className="rounded-r-none"
              >
                <Grid3X3 className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "list" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("list")}
                className="rounded-l-none"
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Playlists</p>
                  <p className="text-2xl font-bold text-gray-900">{playlists.length}</p>
                </div>
                <div className="text-red-600">
                  <Grid3X3 className="h-8 w-8" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Videos</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {playlists.reduce((sum, p) => sum + p.videoCount, 0)}
                  </p>
                </div>
                <div className="text-blue-600">
                  <Play className="h-8 w-8" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Views</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {playlists.reduce((sum, p) => sum + p.views, 0).toLocaleString()}
                  </p>
                </div>
                <div className="text-green-600">
                  <Eye className="h-8 w-8" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Collaborators</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {playlists.reduce((sum, p) => sum + p.collaborators, 0)}
                  </p>
                </div>
                <div className="text-purple-600">
                  <Users className="h-8 w-8" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Results Summary */}
        <div className="flex items-center justify-between mb-6">
          <p className="text-gray-600">
            {loading
              ? "Loading..."
              : `${sortedPlaylists.length} playlist${sortedPlaylists.length !== 1 ? "s" : ""} found`}
          </p>
        </div>

        {/* Playlists Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <div className="h-48 bg-gray-200 rounded-t-lg"></div>
                <CardContent className="p-4">
                  <div className="h-4 bg-gray-200 rounded mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded mb-3"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : sortedPlaylists.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 mb-4">
              <Grid3X3 className="h-16 w-16 mx-auto" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No playlists found</h3>
            <p className="text-gray-600 mb-4">
              {searchQuery
                ? "Try adjusting your search terms or filters."
                : "Get started by creating your first playlist."}
            </p>
            <Link href="/playlists/create">
              <Button className="bg-red-600 hover:bg-red-700">
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Playlist
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sortedPlaylists.map((playlist) => (
              <PlaylistCard key={playlist.id} playlist={playlist} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
