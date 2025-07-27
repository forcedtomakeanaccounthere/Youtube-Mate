"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
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
  DotIcon as DragHandleDots2Icon,
  UserPlus,
  ExternalLink,
} from "lucide-react"

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
  stats: {
    totalViews: number
    totalDuration: string
    createdAt: string
    lastModified: string
  }
  tags: string[]
}

export default function PlaylistViewPage({ params }: { params: { id: string } }) {
  const [playlist, setPlaylist] = useState<PlaylistData | null>(null)
  const [currentVideo, setCurrentVideo] = useState<Video | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [viewMode, setViewMode] = useState<"grid" | "list">("list")
  const [sortBy, setSortBy] = useState("order")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchPlaylist = async () => {
      setLoading(true)
      // Mock data - replace with actual API call
      const mockPlaylist: PlaylistData = {
        id: params.id,
        title: "My Favorite Music Videos",
        description:
          "A collection of my all-time favorite music videos from various genres. This playlist features the best tracks from different eras and styles.",
        thumbnail: "/placeholder.svg?height=300&width=400",
        isPublic: true,
        isCollaborative: true,
        owner: {
          name: "John Doe",
          avatar: "/placeholder.svg?height=40&width=40",
        },
        videos: [
          {
            id: "1",
            title: "Amazing Song Title - Official Music Video",
            channel: "Artist Channel",
            duration: "3:45",
            thumbnail: "/placeholder.svg?height=180&width=320",
            addedBy: "John Doe",
            addedAt: "2024-01-20",
            views: 1250000,
            likes: 45000,
            description: "Official music video for Amazing Song Title",
          },
          {
            id: "2",
            title: "Another Great Track - Live Performance",
            channel: "Music Channel",
            duration: "4:12",
            thumbnail: "/placeholder.svg?height=180&width=320",
            addedBy: "Sarah Wilson",
            addedAt: "2024-01-19",
            views: 890000,
            likes: 32000,
            description: "Live performance from the concert tour",
          },
        ],
        collaborators: [
          {
            id: "1",
            name: "Sarah Wilson",
            avatar: "/placeholder.svg?height=40&width=40",
            role: "editor",
            joinedAt: "2024-01-15",
            lastActive: "2024-01-22",
          },
          {
            id: "2",
            name: "Mike Chen",
            avatar: "/placeholder.svg?height=40&width=40",
            role: "viewer",
            joinedAt: "2024-01-18",
            lastActive: "2024-01-21",
          },
        ],
        comments: [
          {
            id: "1",
            user: {
              name: "Sarah Wilson",
              avatar: "/placeholder.svg?height=32&width=32",
            },
            content: "Great playlist! Love the variety of music genres.",
            timestamp: "2024-01-22T10:30:00Z",
            replies: [],
          },
        ],
        stats: {
          totalViews: 2140000,
          totalDuration: "2:15:30",
          createdAt: "2024-01-15",
          lastModified: "2024-01-22",
        },
        tags: ["music", "favorites", "mixed-genre"],
      }

      setTimeout(() => {
        setPlaylist(mockPlaylist)
        setCurrentVideo(mockPlaylist.videos[0])
        setLoading(false)
      }, 1000)
    }

    fetchPlaylist()
  }, [params.id])

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
        return b.views - a.views
      case "recent":
        return new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime()
      default:
        return 0
    }
  })

  const VideoCard = ({ video, index }: { video: Video; index: number }) => (
    <Card
      className={`group hover:shadow-md transition-all duration-200 ${currentVideo?.id === video.id ? "ring-2 ring-red-500" : ""}`}
    >
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-gray-500 w-8">
            <DragHandleDots2Icon className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab" />
            <span className="text-sm font-medium">{index + 1}</span>
          </div>

          <div className="relative">
            <img
              src={video.thumbnail || "/placeholder.svg"}
              alt={video.title}
              className="w-32 h-20 object-cover rounded cursor-pointer"
              onClick={() => setCurrentVideo(video)}
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-200 rounded flex items-center justify-center">
              <Button
                size="sm"
                className="opacity-0 group-hover:opacity-100 transition-opacity bg-red-600 hover:bg-red-700"
                onClick={() => {
                  setCurrentVideo(video)
                  setIsPlaying(!isPlaying)
                }}
              >
                {isPlaying && currentVideo?.id === video.id ? (
                  <Pause className="h-4 w-4" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
              </Button>
            </div>
            <div className="absolute bottom-1 right-1 bg-black/80 text-white text-xs px-1 rounded">
              {video.duration}
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="font-semibold line-clamp-2 hover:text-red-600 transition-colors cursor-pointer">
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
            <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
              <ExternalLink className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
      </div>
    )
  }

  if (!playlist) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Playlist not found</h2>
          <p className="text-gray-600 mb-4">The playlist you're looking for doesn't exist.</p>
          <Link href="/playlists">
            <Button className="bg-red-600 hover:bg-red-700">Back to Playlists</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
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
                  <Button className="bg-red-600 hover:bg-red-700">
                    <Play className="h-4 w-4 mr-2" />
                    Play All
                  </Button>
                  <Button variant="outline">
                    <Share2 className="h-4 w-4 mr-2" />
                    Share
                  </Button>
                  <Button variant="outline">
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
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
                  <Button variant="outline">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Video
                  </Button>
                )}
              </div>
            </div>

            {/* Videos List */}
            <div className="space-y-2">
              {sortedVideos.map((video, index) => (
                <VideoCard key={video.id} video={video} index={index} />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="collaborators" className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Collaborators</h3>
              {playlist.isCollaborative && (
                <Button className="bg-red-600 hover:bg-red-700">
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
                        <Button variant="ghost" size="sm">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="comments" className="space-y-6">
            <div className="space-y-4">
              {playlist.comments.map((comment) => (
                <Card key={comment.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <img
                        src={comment.user.avatar || "/placeholder.svg"}
                        alt={comment.user.name}
                        className="w-8 h-8 rounded-full"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-sm">{comment.user.name}</span>
                          <span className="text-xs text-gray-500">
                            {new Date(comment.timestamp).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-gray-700">{comment.content}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
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
                  <div className="flex items-start gap-3 pb-4 border-b border-gray-100">
                    <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                    <div>
                      <p className="text-sm">
                        <span className="font-semibold">Sarah Wilson</span> added 2 videos to the playlist
                      </p>
                      <p className="text-xs text-gray-500">2 hours ago</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 pb-4 border-b border-gray-100">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                    <div>
                      <p className="text-sm">
                        <span className="font-semibold">Mike Chen</span> left a comment
                      </p>
                      <p className="text-xs text-gray-500">1 day ago</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}