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
  Filter,
  Users,
  Lock,
  Globe,
  Play,
  Calendar,
  Eye,
  Share2,
  Grid3X3,
  List,
  UserPlus,
} from "lucide-react"
import AuthGuard from "@/components/AuthGuard"

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

export default function SharedPlaylistsPage() {
  const [playlists, setPlaylists] = useState<SharedPlaylist[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [filterRole, setFilterRole] = useState("all")
  const [sortBy, setSortBy] = useState("recent")
  const [loading, setLoading] = useState(true)

  // Fetch shared playlists from API
  const fetchSharedPlaylists = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem("token")
      if (!token) {
        setLoading(false)
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
      setPlaylists(data.playlists || [])
    } catch (error) {
      console.error("Failed to fetch shared playlists:", error)
      // Fallback to empty array on error
      setPlaylists([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSharedPlaylists()
  }, [])

  // Filter and sort playlists
  const filteredPlaylists = playlists.filter((playlist) => {
    const matchesSearch = 
      playlist.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      playlist.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      playlist.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()))

    const matchesFilter = 
      filterRole === "all" || 
      playlist.role === filterRole

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

  const renderPlaylistCard = (playlist: SharedPlaylist) => (
    <Card key={playlist.id} className="overflow-hidden hover:shadow-lg transition-shadow">
      <div className="relative">
        <img
          src={playlist.thumbnail || "/placeholder.svg"}
          alt={playlist.title}
          className="w-full h-48 object-cover"
        />
        <div className="absolute top-2 right-2 flex gap-1">
          <Badge className={`text-xs ${
            playlist.role === "admin" ? "bg-red-100 text-red-800" :
            playlist.role === "editor" ? "bg-blue-100 text-blue-800" :
            "bg-gray-100 text-gray-800"
          }`}>
            {playlist.role}
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

            <div className="flex items-center gap-4 text-sm text-gray-500 mb-3">
              <div className="flex items-center gap-1">
                <img
                  src={playlist.owner.avatar || "/placeholder.svg"}
                  alt={playlist.owner.name}
                  className="w-4 h-4 rounded-full"
                />
                <span>by {playlist.owner.name}</span>
              </div>
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
            </div>

            <div className="flex items-center gap-2">
              <Link href={`/playlists/${playlist.id}`}>
                <Button size="sm" className="bg-red-600 hover:bg-red-700">
                  <Play className="h-4 w-4 mr-1" />
                  View
                </Button>
              </Link>
              <Button variant="outline" size="sm">
                <Share2 className="h-4 w-4 mr-1" />
                Share
              </Button>
              {playlist.role === "admin" && (
                <Button variant="outline" size="sm">
                  <UserPlus className="h-4 w-4 mr-1" />
                  Invite
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )

  const renderPlaylistListItem = (playlist: SharedPlaylist) => (
    <Card key={playlist.id} className="mb-4">
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          <img
            src={playlist.thumbnail || "/placeholder.svg"}
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
                  <span>by {playlist.owner.name}</span>
                  {playlist.views > 0 && <span>{playlist.views.toLocaleString()} views</span>}
                  <span>Modified {new Date(playlist.lastModified).toLocaleDateString()}</span>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <Badge className={`text-xs ${
                  playlist.role === "admin" ? "bg-red-100 text-red-800" :
                  playlist.role === "editor" ? "bg-blue-100 text-blue-800" :
                  "bg-gray-100 text-gray-800"
                }`}>
                  {playlist.role}
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
              <Button variant="outline" size="sm">
                <Share2 className="h-4 w-4 mr-1" />
                Share
              </Button>
              {playlist.role === "admin" && (
                <Button variant="outline" size="sm">
                  <UserPlus className="h-4 w-4 mr-1" />
                  Invite
                </Button>
              )}
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
                <h1 className="text-3xl font-bold text-gray-900">Shared Playlists</h1>
                <p className="text-gray-600 mt-1">Playlists shared with you by other users</p>
              </div>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search shared playlists..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <div className="flex gap-2">
              <Select value={filterRole} onValueChange={setFilterRole}>
                <SelectTrigger className="w-[140px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="editor">Editor</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
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
                <Users className="h-16 w-16 mx-auto" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {searchQuery || filterRole !== "all" ? "No playlists found" : "No shared playlists"}
              </h3>
              <p className="text-gray-600 mb-6">
                {searchQuery || filterRole !== "all"
                  ? "Try adjusting your search or filter criteria"
                  : "You haven't been invited to any collaborative playlists yet"}
              </p>
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
