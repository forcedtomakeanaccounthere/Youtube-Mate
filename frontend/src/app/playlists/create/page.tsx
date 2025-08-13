"use client"

import type React from "react"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, Upload, Users, Globe, Lock, Plus, X, Youtube, Import } from "lucide-react"

interface PlaylistFormData {
  title: string
  description: string
  isPublic: boolean
  isCollaborative: boolean
  tags: string[]
  category: string
  thumbnail: string | null
  importUrl: string
}

export default function CreatePlaylistPage() {
  const router = useRouter()
  const [formData, setFormData] = useState<PlaylistFormData>({
    title: "",
    description: "",
    isPublic: true,
    isCollaborative: false,
    tags: [],
    category: "",
    thumbnail: null,
    importUrl: "",
  })
  const [newTag, setNewTag] = useState("")
  const [isImporting, setIsImporting] = useState(false)
  const [importedPlaylist, setImportedPlaylist] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const handleInputChange = (field: keyof PlaylistFormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const addTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      handleInputChange("tags", [...formData.tags, newTag.trim()])
      setNewTag("")
    }
  }

  const removeTag = (tagToRemove: string) => {
    handleInputChange(
      "tags",
      formData.tags.filter((tag) => tag !== tagToRemove),
    )
  }

  const handleImportPlaylist = async () => {
    if (!formData.importUrl) return

    setIsImporting(true)
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/downloads/playlist/info?url=${encodeURIComponent(formData.importUrl)}`,
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
      setFormData((prev) => ({
        ...prev,
        title: importedPlaylist.title,
        description: importedPlaylist.description,
        thumbnail: importedPlaylist.thumbnail,
      }))
    } catch (error) {
      console.error("Import failed:", error)
      alert("Failed to import playlist. Please check the URL and try again.")
    } finally {
      setIsImporting(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const token = localStorage.getItem("token")
      if (!token) {
        // For now, create a test token or redirect to login
        console.warn("No authentication token found")
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/playlists`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        credentials: "include",
        body: JSON.stringify({
          name: formData.title,
          description: formData.description,
          is_public: formData.isPublic,
          is_collaborative: formData.isCollaborative,
          category: formData.category || "other",
          tags: formData.tags,
          thumbnail_url: formData.thumbnail,
          import_url: formData.importUrl || null,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to create playlist")
      }

      const newPlaylist = await response.json()
      console.log("Playlist created:", newPlaylist)

      // Redirect to the new playlist
      router.push(`/playlists/${newPlaylist.id}`)
    } catch (error) {
      console.error("Failed to create playlist:", error)
      alert("Failed to create playlist. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-4">
            <Link href="/playlists">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Playlists
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Create New Playlist</h1>
              <p className="text-gray-600 mt-1">Set up your new collaborative playlist</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Import Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Import className="h-5 w-5 text-red-600" />
                Import from YouTube (Optional)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-1">
                  <Label htmlFor="importUrl">YouTube Playlist URL</Label>
                  <Input
                    id="importUrl"
                    placeholder="https://www.youtube.com/playlist?list=..."
                    value={formData.importUrl}
                    onChange={(e) => handleInputChange("importUrl", e.target.value)}
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    type="button"
                    onClick={handleImportPlaylist}
                    disabled={!formData.importUrl || isImporting}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    {isImporting ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Importing...
                      </>
                    ) : (
                      <>
                        <Youtube className="h-4 w-4 mr-2" />
                        Import
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {importedPlaylist && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-start gap-4">
                    <img
                      src={importedPlaylist.thumbnail || "/placeholder.svg"}
                      alt="Imported playlist"
                      className="w-20 h-14 object-cover rounded"
                    />
                    <div className="flex-1">
                      <h4 className="font-semibold text-green-800">{importedPlaylist.title}</h4>
                      <p className="text-sm text-green-600 mb-2">{importedPlaylist.description}</p>
                      <Badge className="bg-green-100 text-green-800">
                        {importedPlaylist.videoCount} videos imported
                      </Badge>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="title">Playlist Title *</Label>
                <Input
                  id="title"
                  placeholder="Enter playlist title"
                  value={formData.title}
                  onChange={(e) => handleInputChange("title", e.target.value)}
                  required
                />
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Describe your playlist..."
                  value={formData.description}
                  onChange={(e) => handleInputChange("description", e.target.value)}
                  rows={4}
                />
              </div>

              <div>
                <Label htmlFor="category">Category</Label>
                <Select value={formData.category} onValueChange={(value) => handleInputChange("category", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
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
                <Label>Tags</Label>
                <div className="flex gap-2 mb-2">
                  <Input
                    placeholder="Add a tag"
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
                  />
                  <Button type="button" onClick={addTag} variant="outline">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {formData.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="flex items-center gap-1">
                      {tag}
                      <button type="button" onClick={() => removeTag(tag)} className="ml-1 hover:text-red-600">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Privacy & Collaboration Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Privacy & Collaboration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    {formData.isPublic ? (
                      <Globe className="h-4 w-4 text-green-600" />
                    ) : (
                      <Lock className="h-4 w-4 text-gray-600" />
                    )}
                    <Label htmlFor="isPublic">Public Playlist</Label>
                  </div>
                  <p className="text-sm text-gray-600">
                    {formData.isPublic
                      ? "Anyone can view and search for this playlist"
                      : "Only you and invited collaborators can access this playlist"}
                  </p>
                </div>
                <Switch
                  id="isPublic"
                  checked={formData.isPublic}
                  onCheckedChange={(checked) => handleInputChange("isPublic", checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-blue-600" />
                    <Label htmlFor="isCollaborative">Enable Collaboration</Label>
                  </div>
                  <p className="text-sm text-gray-600">
                    Allow others to add, remove, and reorder videos in this playlist
                  </p>
                </div>
                <Switch
                  id="isCollaborative"
                  checked={formData.isCollaborative}
                  onCheckedChange={(checked) => handleInputChange("isCollaborative", checked)}
                />
              </div>

              {formData.isCollaborative && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-semibold text-blue-800 mb-2">Collaboration Features</h4>
                  <ul className="text-sm text-blue-700 space-y-1">
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
          <Card>
            <CardHeader>
              <CardTitle>Playlist Thumbnail</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-red-400 transition-colors">
                <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 mb-2">Upload a custom thumbnail</p>
                <p className="text-sm text-gray-500 mb-4">Recommended: 1280x720px, JPG or PNG</p>
                <Button type="button" variant="outline">
                  <Upload className="h-4 w-4 mr-2" />
                  Choose File
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-6 border-t border-gray-200">
            <Link href="/playlists">
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </Link>
            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  // Save as draft logic
                  console.log("Saving as draft...")
                }}
              >
                Save as Draft
              </Button>
              <Button type="submit" className="bg-red-600 hover:bg-red-700" disabled={!formData.title || loading}>
                {loading ? (
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
      </div>
    </div>
  )
}