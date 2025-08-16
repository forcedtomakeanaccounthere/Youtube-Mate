"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
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
} from "lucide-react"

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

export default function PlaylistsPage() {
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [filterType, setFilterType] = useState("all")
  const [sortBy, setSortBy] = useState("recent")
  const [loading, setLoading] = useState(true)
  const [pagination, setPagination] = useState({
    current: 1,
    total: 1,
    count: 0,
    limit: 12,
  })

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
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/playlists?${params}`,
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

  useEffect(() => {
    fetchPlaylists(1)
  }, [searchQuery, filterType, sortBy])

  const PlaylistCard = ({ playlist }: { playlist: Playlist }) => (
    <Card className="group hover:shadow-lg transition-all duration-200 border-gray-200 hover:border-red-200">
      <div className="relative">
        <img
          src={playlist.thumbnail || "/placeholder.svg?height=200&width=300"}
          alt={playlist.title}
          className="w-full h-48 object-cover rounded-t-lg"
        />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-200 rounded-t-lg flex items-center justify-center">
          <Button
            size="sm"
            className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-red-600 hover:bg-red-700"
          >
            <Play className="h-4 w-4 mr-2" />
            Play All
          </Button>
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
          {playlist.isCollaborative && (
            <Badge variant="secondary" className="bg-blue-100 text-blue-800">
              <Users className="h-3 w-3 mr-1" />
              Collaborative
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
            <span className="text-sm text-gray-600">{playlist.owner.name}</span>
          </div>
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <Calendar className="h-3 w-3" />
            {new Date(playlist.lastModified).toLocaleDateString()}
          </div>
        </div>

        <div className="flex flex-wrap gap-1 mt-3">
          {playlist.tags.map((tag) => (
            <Badge key={tag} variant="outline" className="text-xs">
              {tag}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  )

  const PlaylistListItem = ({ playlist }: { playlist: Playlist }) => (
    <Card className="hover:shadow-md transition-shadow duration-200">
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          <img
            src={playlist.thumbnail || "/placeholder.svg?height=64&width=96"}
            alt={playlist.title}
            className="w-24 h-16 object-cover rounded"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between mb-1">
              <h3 className="font-semibold text-lg truncate hover:text-red-600 transition-colors">
                <Link href={`/playlists/${playlist.id}`}>{playlist.title}</Link>
              </h3>
              <div className="flex gap-1 ml-2">
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
                    Collaborative
                  </Badge>
                )}
              </div>
            </div>
            <p className="text-gray-600 text-sm mb-2 line-clamp-1">{playlist.description}</p>
            <div className="flex items-center gap-4 text-sm text-gray-500">
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
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Share2 className="h-4 w-4 mr-2" />
              Share
            </Button>
            <Button variant="ghost" size="sm">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </div>
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
              <h1 className="text-3xl font-bold text-gray-900">Playlist Manager</h1>
              <p className="text-gray-600 mt-1">Create and manage your collaborative playlists</p>
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
        {/* Development Login Helper */}
        {/* Navigation Tabs */}
        <Tabs defaultValue="all" className="mb-8">
          <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:grid-cols-none lg:inline-flex">
            <TabsTrigger value="all">All Playlists</TabsTrigger>
            <TabsTrigger value="mine">
              <Link href="/playlists/mine" className="flex items-center">
                My Playlists
              </Link>
            </TabsTrigger>
            <TabsTrigger value="shared">
              <Link href="/playlists/shared" className="flex items-center">
                Shared Playlists
              </Link>
            </TabsTrigger>
            <TabsTrigger value="favorites">Favorites</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="space-y-6">
            {/* Search and Filters */}
            <div className="flex flex-col lg:flex-row gap-4 items-center justify-between bg-white p-4 rounded-lg border border-gray-200">
              <div className="flex-1 w-full lg:max-w-md">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Search playlists, descriptions, or tags..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 w-full lg:w-auto">
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="w-full lg:w-40">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Filter" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Playlists</SelectItem>
                    <SelectItem value="public">Public Only</SelectItem>
                    <SelectItem value="private">Private Only</SelectItem>
                    <SelectItem value="collaborative">Collaborative</SelectItem>
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

            {/* Results Summary */}
            <div className="flex items-center justify-between">
              <p className="text-gray-600">
                {loading ? "Loading..." : `${pagination.count} playlist${pagination.count !== 1 ? "s" : ""} found`}
              </p>
            </div>

            {/* Playlists Grid/List */}
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
            ) : playlists.length === 0 ? (
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
              <>
                <div
                  className={viewMode === "grid" ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" : "space-y-4"}
                >
                  {playlists.map((playlist) =>
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
                    >
                      Previous
                    </Button>
                    <span className="text-sm text-gray-600">
                      Page {pagination.current} of {pagination.total}
                    </span>
                    <Button
                      variant="outline"
                      onClick={() => fetchPlaylists(pagination.current + 1)}
                      disabled={pagination.current === pagination.total}
                    >
                      Next
                    </Button>
                  </div>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}