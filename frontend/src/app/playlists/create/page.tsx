"use client"

import type React from "react"
import { useState, useEffect } from "react"
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
import { ArrowLeft, Upload, Users, Globe, Lock, Plus, X, Youtube, Import, AlertCircle } from "lucide-react"
import Navbar from "@/components/landing/Navbar"
import AuthGuard from "@/components/AuthGuard"
import { Feature } from "@/types/features"
import { useDarkMode } from "@/hooks/use-dark-mode"

interface PlaylistFormData {
  title: string
  description: string
  isPublic: boolean
  isCollaborative: boolean
  tags: string[]
  category: string
  thumbnail: File | null
  importUrl: string
}

export default function CreatePlaylistPage() {
  const router = useRouter()
  const { darkMode, toggleDarkMode } = useDarkMode()
  const [features, setFeatures] = useState<Feature[]>([])
  
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
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null)
  const [error, setError] = useState<string>("")

  // Load features data
  useEffect(() => {
    const loadFeatures = async () => {
      try {
        const response = await fetch('/src/data/features.json')
        if (!response.ok) {
          // Fallback to mock features
          const mockFeatures: Feature[] = [
            { 
              id: "1", 
              title: "Download Videos", 
              route: "/download",
              image: "/1.png",
              icon: "Download",
              description: "Download YouTube videos",
              content: { title: "Download Videos", description: "Download videos from YouTube", features: [] }
            },
            { 
              id: "2", 
              title: "Playlist Manager", 
              route: "/playlists",
              image: "/2.png",
              icon: "List",
              description: "Manage your playlists",
              content: { title: "Playlist Manager", description: "Create and manage playlists", features: [] }
            },
            { 
              id: "3", 
              title: "URL Shortener", 
              route: "/shorten",
              image: "/3.png",
              icon: "Link",
              description: "Shorten URLs",
              content: { title: "URL Shortener", description: "Create short URLs", features: [] }
            },
            { 
              id: "4", 
              title: "Transcript Generator", 
              route: "/transcript",
              image: "/4.png",
              icon: "FileText",
              description: "Generate transcripts",
              content: { title: "Transcript Generator", description: "Generate video transcripts", features: [] }
            },
          ]
          setFeatures(mockFeatures)
          return
        }
        const data = await response.json()
        setFeatures(data.features || [])
      } catch (error) {
        console.error('Failed to load features:', error)
        // Fallback to mock features
        const mockFeatures: Feature[] = [
          { 
            id: "1", 
            title: "Download Videos", 
            route: "/download",
            image: "/1.png",
            icon: "Download",
            description: "Download YouTube videos",
            content: { title: "Download Videos", description: "Download videos from YouTube", features: [] }
          },
          { 
            id: "2", 
            title: "Playlist Manager", 
            route: "/playlists",
            image: "/2.png",
            icon: "List",
            description: "Manage your playlists",
            content: { title: "Playlist Manager", description: "Create and manage playlists", features: [] }
          },
          { 
            id: "3", 
            title: "URL Shortener", 
            route: "/shorten",
            image: "/3.png",
            icon: "Link",
            description: "Shorten URLs",
            content: { title: "URL Shortener", description: "Create short URLs", features: [] }
          },
          { 
            id: "4", 
            title: "Transcript Generator", 
            route: "/transcript",
            image: "/4.png",
            icon: "FileText",
            description: "Generate transcripts",
            content: { title: "Transcript Generator", description: "Generate video transcripts", features: [] }
          },
        ]
        setFeatures(mockFeatures)
      }
    }
    loadFeatures()
  }, [])

  const handleInputChange = (field: keyof PlaylistFormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleThumbnailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // Validate file type and size
      if (!file.type.startsWith('image/')) {
        setError('Please select an image file')
        return
      }
      
      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        setError('File size must be less than 10MB')
        return
      }

      setFormData((prev) => ({ ...prev, thumbnail: file }))
      
      // Create preview
      const reader = new FileReader()
      reader.onload = (e) => {
        setThumbnailPreview(e.target?.result as string)
      }
      reader.readAsDataURL(file)
      setError("")
    }
  }

  const removeThumbnail = () => {
    setFormData((prev) => ({ ...prev, thumbnail: null }))
    setThumbnailPreview(null)
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
    setError("")
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api"}/downloads/playlist/info?url=${encodeURIComponent(formData.importUrl)}`,
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
      }))
      
      // Set thumbnail preview if available
      if (importedPlaylist.thumbnail) {
        setThumbnailPreview(importedPlaylist.thumbnail)
      }
    } catch (error) {
      console.error("Import failed:", error)
      setError("Failed to import playlist. Please check the URL and try again.")
    } finally {
      setIsImporting(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent, saveAsDraft = false) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      const token = localStorage.getItem("token")
      if (!token) {
        setError("Please log in to create a playlist")
        router.push("/login")
        return
      }

      // Create FormData for file upload
      const formDataToSend = new FormData()
      formDataToSend.append("name", formData.title)
      formDataToSend.append("description", formData.description)
      formDataToSend.append("is_public", formData.isPublic.toString())
      formDataToSend.append("is_collaborative", formData.isCollaborative.toString())
      formDataToSend.append("category", formData.category || "other")
      formDataToSend.append("tags", JSON.stringify(formData.tags))
      formDataToSend.append("save_as_draft", saveAsDraft.toString())
      
      if (formData.importUrl) {
        formDataToSend.append("import_url", formData.importUrl)
      }
      
      if (formData.thumbnail) {
        formDataToSend.append("thumbnail", formData.thumbnail)
      }

      console.log("Submitting form data:", {
        name: formData.title,
        description: formData.description,
        is_public: formData.isPublic,
        is_collaborative: formData.isCollaborative,
        category: formData.category,
        tags: formData.tags,
        save_as_draft: saveAsDraft,
        import_url: formData.importUrl,
        has_thumbnail: !!formData.thumbnail
      })

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api"}/playlists`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
        body: formDataToSend,
      })

      console.log("Response status:", response.status)
      console.log("Response headers:", response.headers)

      if (!response.ok) {
        const errorText = await response.text()
        console.error("Error response:", errorText)
        
        try {
          const errorData = JSON.parse(errorText)
          throw new Error(errorData.error || errorData.details?.[0] || "Failed to create playlist")
        } catch (parseError) {
          throw new Error(`Server error: ${response.status} - ${errorText}`)
        }
      }

      const newPlaylist = await response.json()
      console.log("Playlist created:", newPlaylist)

      // Redirect to the new playlist
      router.push(`/playlists/${newPlaylist.id}`)
    } catch (error: any) {
      console.error("Failed to create playlist:", error)
      setError(error.message || "Failed to create playlist. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthGuard>
      <div className={`min-h-screen transition-colors duration-300 ${darkMode ? 'dark bg-gray-900' : 'bg-orange-50'}`}>
        {/* Navbar */}
        <Navbar
          showNavbar={true}
          features={features}
          setActiveFeature={() => {}}
          darkMode={darkMode}
          toggleDarkMode={toggleDarkMode}
        />

        {/* Main Content */}
        <div className="pt-20">
          {/* Header */}
          <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
              <div className="flex items-center gap-6">
                <div className="pl-9 ml-9">
                  <h1 className="text-3xl font-bold text-orange-500">Create New Playlist</h1>
                  <p className="text-gray-600 dark:text-gray-300 mt-2">Set up your new collaborative playlist</p>
                </div>
              </div>
            </div>
          </div>

          {/* Form Container */}
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Error Display */}
            {error && (
              <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                <p className="text-red-700 dark:text-red-300">{error}</p>
              </div>
            )}

            <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-8">
              {/* Import Section */}
              <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
                    <Import className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                    Import from YouTube (Optional)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <Label htmlFor="importUrl" className="text-gray-700 dark:text-gray-300 mb-3">YouTube Playlist URL</Label>
                      <Input
                        id="importUrl"
                        placeholder="https://www.youtube.com/playlist?list=..."
                        value={formData.importUrl}
                        onChange={(e) => handleInputChange("importUrl", e.target.value)}
                        className="mt-1 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                      />
                    </div>
                    <div className="flex items-end">
                      <Button
                        type="button"
                        onClick={handleImportPlaylist}
                        disabled={!formData.importUrl || isImporting}
                        className="bg-orange-600 hover:bg-orange-700 dark:bg-orange-600 dark:hover:bg-orange-700 text-white"
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
              <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-orange-600">Basic Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="title" className="text-gray-700 dark:text-gray-300 mb-3">Playlist Title </Label>
                    <Input
                      id="title"
                      placeholder="Enter playlist title"
                      value={formData.title}
                      onChange={(e) => handleInputChange("title", e.target.value)}
                      required
                      className="mt-1 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                    />
                  </div>

                  <div>
                    <Label htmlFor="description" className="text-gray-700 dark:text-gray-300 mb-3">Description</Label>
                    <Textarea
                      id="description"
                      placeholder="Describe your playlist..."
                      value={formData.description}
                      onChange={(e) => handleInputChange("description", e.target.value)}
                      rows={4}
                      className="mt-1 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                    />
                  </div>

                  <div>
                    <Label htmlFor="category" className="text-gray-700 dark:text-gray-300 mb-3">Category</Label>
                    <Select value={formData.category} onValueChange={(value) => handleInputChange("category", value)}>
                      <SelectTrigger className="mt-1 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white">
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                      <SelectContent className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600">
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
                    <Label className="text-gray-700 dark:text-gray-300 mb-3">Tags</Label>
                    <div className="flex gap-2 mb-2 mt-1">
                      <Input
                        placeholder="Add a tag"
                        value={newTag}
                        onChange={(e) => setNewTag(e.target.value)}
                        onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
                        className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                      />
                      <Button type="button" onClick={addTag} variant="outline" className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300">
                        <Plus className="h-4 w-4 text-orange-500" />
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {formData.tags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200">
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
              <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-gray-900 dark:text-white">Privacy & Collaboration</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        {formData.isPublic ? (
                          <Globe className="h-4 w-4 text-green-600 dark:text-green-400" />
                        ) : (
                          <Lock className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                        )}
                        <Label htmlFor="isPublic" className="text-gray-900 dark:text-white">Public Playlist</Label>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
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
                        <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        <Label htmlFor="isCollaborative" className="text-gray-900 dark:text-white">Enable Collaboration</Label>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
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
              <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-sm">
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
                    <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center hover:border-orange-400 dark:hover:border-orange-500 transition-colors">
                      <Upload className="h-12 w-12 text-orange-300 mx-auto mb-4" />
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
                        className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300"
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        Choose File
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-6 border-t border-gray-200 dark:border-gray-700">
                <Link href="/playlists">
                  <Button type="button" variant="outline" className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300">
                    Cancel
                  </Button>
                </Link>
                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={(e) => handleSubmit(e, true)}
                    disabled={!formData.title || loading}
                    className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300"
                  >
                    {loading ? (
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
                    className="bg-gradient-to-r from-red-600 to-orange-600 dark:from-red-500 dark:to-orange-500 text-white" 
                    disabled={!formData.title || loading}
                  >
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
      </div>
    </AuthGuard>
  )
}
