"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import Navbar from "@/components/landing/Navbar"
import featuresData from "@/data/features.json"
import { Feature } from "@/types/features"
import { useDarkMode } from "@/hooks/use-dark-mode"
import {
  Search,
  Users,
  Lock,
  Globe,
  Play,
  MoreVertical,
  Eye,
  UserCheck,
  UserX,
  Settings,
  MessageSquare,
  Activity,
} from "lucide-react"

const features: Feature[] = featuresData

interface SharedPlaylist {
  id: string
  title: string
  description: string
  thumbnail: string
  videoCount: number
  isPublic: boolean
  owner: {
    name: string
    avatar: string
  }
  collaborators: number
  views: number
  createdAt: string
  lastModified: string
  tags: string[]
  myRole: "editor" | "viewer" | "admin"
  lastActivity: string
  unreadComments: number
}

export default function SharedPlaylistsPage() {
  const [playlists, setPlaylists] = useState<SharedPlaylist[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [filterRole, setFilterRole] = useState("all")
  const [sortBy, setSortBy] = useState("recent")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchSharedPlaylists = async () => {
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
          role: filterRole,
          sort: sortBy,
        })

        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/playlists/shared?${params}`,
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
        console.error("Error fetching shared playlists:", error)
        setPlaylists([])
      } finally {
        setLoading(false)
      }
    }

    fetchSharedPlaylists()
  }, [searchQuery, filterRole, sortBy])
          views: 2100,
          createdAt: "2024-01-05",
          lastModified: "2024-01-20",
          tags: ["design", "inspiration", "tutorial"],
          myRole: "admin",
          lastActivity: "2024-01-20T09:15:00Z",
          unreadComments: 7,
        },
      ]

      setTimeout(() => {
        setPlaylists(mockPlaylists)
        setLoading(false)
      }, 1000)
    }

    fetchSharedPlaylists()
  }, [])

  const filteredPlaylists = playlists.filter((playlist) => {
    const matchesSearch =
      playlist.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      playlist.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      playlist.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()))

    const matchesFilter = filterRole === "all" || playlist.myRole === filterRole

    return matchesSearch && matchesFilter
  })

  const sortedPlaylists = [...filteredPlaylists].sort((a, b) => {
    switch (sortBy) {
      case "recent":
        return new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime()
      case "oldest":
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      case "name":
        return a.title.localeCompare(b.title)
      case "videos":
        return b.videoCount - a.videoCount
      case "activity":
        return new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime()
      default:
        return 0
    }
  })

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "admin":
        return <Badge className="bg-purple-100 text-purple-800">Admin</Badge>
      case "editor":
        return <Badge className="bg-blue-100 text-blue-800">Editor</Badge>
      case "viewer":
        return <Badge className="bg-gray-100 text-gray-800">Viewer</Badge>
      default:
        return null
    }
  }

  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60))

    if (diffInHours < 1) return "Just now"
    if (diffInHours < 24) return `${diffInHours}h ago`
    const diffInDays = Math.floor(diffInHours / 24)
    if (diffInDays < 7) return `${diffInDays}d ago`
    return date.toLocaleDateString()
  }

  const PlaylistCard = ({ playlist }: { playlist: SharedPlaylist }) => (
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
            {playlist.myRole !== "viewer" && (
              <Button size="sm" variant="secondary">
                <Settings className="h-4 w-4 mr-2" />
                Manage
              </Button>
            )}
          </div>
        </div>
        <div className="absolute top-2 left-2 flex gap-1">
          {getRoleBadge(playlist.myRole)}
          {playlist.unreadComments > 0 && (
            <Badge className="bg-red-100 text-red-800">
              <MessageSquare className="h-3 w-3 mr-1" />
              {playlist.unreadComments}
            </Badge>
          )}
        </div>
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
        </div>
      </div>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <h3 className="font-semibold text-lg line-clamp-2 group-hover:text-red-600 transition-colors">
            <Link href={`/playlists/${playlist.id}`}>{playlist.title}</Link>
          </h3>
          <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-gray-600 text-sm mb-3 line-clamp-2">{playlist.description}</p>

        <div className="flex items-center gap-4 text-sm text-gray-500 mb-3">
          <span>{playlist.videoCount} videos</span>
          <span className="flex items-center gap-1">
            <Eye className="h-3 w-3" />
            {playlist.views.toLocaleString()} views
          </span>
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            {playlist.collaborators} collaborators
          </span>
        </div>

        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <img
              src={playlist.owner.avatar || "/placeholder.svg"}
              alt={playlist.owner.name}
              className="w-6 h-6 rounded-full"
            />
            <span className="text-sm text-gray-600">{playlist.owner.name}</span>
          </div>
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <Activity className="h-3 w-3" />
            {getTimeAgo(playlist.lastActivity)}
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
            <MessageSquare className="h-4 w-4 mr-2" />
            Comments
            {playlist.unreadComments > 0 && (
              <Badge className="ml-2 bg-red-100 text-red-800 text-xs">{playlist.unreadComments}</Badge>
            )}
          </Button>
          {playlist.myRole === "viewer" ? (
            <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700 bg-transparent">
              <UserX className="h-4 w-4" />
            </Button>
          ) : (
            <Button variant="outline" size="sm" className="text-green-600 hover:text-green-700 bg-transparent">
              <UserCheck className="h-4 w-4" />
            </Button>
          )}
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
                <span className="text-gray-900">Shared Playlists</span>
              </nav>
              <h1 className="text-3xl font-bold text-gray-900">Shared Playlists</h1>
              <p className="text-gray-600 mt-1">Playlists shared with you by other users</p>
            </div>
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
                placeholder="Search shared playlists..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 w-full lg:w-auto">
            <Select value={filterRole} onValueChange={setFilterRole}>
              <SelectTrigger className="w-full lg:w-40">
                <Users className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="editor">Editor</SelectItem>
                <SelectItem value="viewer">Viewer</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-full lg:w-40">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Recent Activity</SelectItem>
                <SelectItem value="oldest">Oldest First</SelectItem>
                <SelectItem value="name">Name (A-Z)</SelectItem>
                <SelectItem value="videos">Most Videos</SelectItem>
                <SelectItem value="activity">Last Activity</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Role Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Shared</p>
                  <p className="text-2xl font-bold text-gray-900">{playlists.length}</p>
                </div>
                <div className="text-blue-600">
                  <Users className="h-8 w-8" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">As Admin</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {playlists.filter((p) => p.myRole === "admin").length}
                  </p>
                </div>
                <div className="text-purple-600">
                  <Settings className="h-8 w-8" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">As Editor</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {playlists.filter((p) => p.myRole === "editor").length}
                  </p>
                </div>
                <div className="text-blue-600">
                  <UserCheck className="h-8 w-8" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Unread Comments</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {playlists.reduce((sum, p) => sum + p.unreadComments, 0)}
                  </p>
                </div>
                <div className="text-red-600">
                  <MessageSquare className="h-8 w-8" />
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
              : `${sortedPlaylists.length} shared playlist${sortedPlaylists.length !== 1 ? "s" : ""} found`}
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
              <Users className="h-16 w-16 mx-auto" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No shared playlists found</h3>
            <p className="text-gray-600 mb-4">
              {searchQuery
                ? "Try adjusting your search terms or filters."
                : "No one has shared playlists with you yet."}
            </p>
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
