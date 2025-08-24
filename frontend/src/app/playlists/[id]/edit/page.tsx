"use client"

import { useState, useEffect, use } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, Save, X } from "lucide-react"
import AuthGuard from "@/components/AuthGuard"
import Navbar from "@/components/landing/Navbar"
import { useDarkMode } from "@/hooks/use-dark-mode"
import featuresData from "@/data/features.json"
import { Feature } from "@/types/features"

interface PlaylistData {
  id: string
  title: string
  description: string
  thumbnail: string
  isPublic: boolean
  isCollaborative: boolean
  tags: string[]
  category: string
}

export default function EditPlaylistPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const router = useRouter()
  const { darkMode, toggleDarkMode } = useDarkMode()
  const [mounted, setMounted] = useState(false)
  const [playlist, setPlaylist] = useState<PlaylistData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    isPublic: false,
    isCollaborative: false,
    category: "",
    tags: [] as string[],
  })
  const [newTag, setNewTag] = useState("")

  // Features data for navbar
  const features: Feature[] = featuresData as Feature[]
  const [activeFeature, setActiveFeature] = useState<Feature | null>(null)
  const [showNavbar, setShowNavbar] = useState(true)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    const fetchPlaylist = async () => {
      setLoading(true)
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

        if (!response.ok) {
          throw new Error("Failed to fetch playlist")
        }

        const data = await response.json()
        setPlaylist(data)
        setFormData({
          title: data.title,
          description: data.description,
          isPublic: data.isPublic,
          isCollaborative: data.isCollaborative,
          category: data.category || "",
          tags: data.tags || [],
        })
      } catch (error) {
        console.error("Error fetching playlist:", error)
        alert("Failed to load playlist")
        router.push("/playlists")
      } finally {
        setLoading(false)
      }
    }

    fetchPlaylist()
  }, [resolvedParams.id, router])

  const handleSave = async () => {
    if (!formData.title.trim()) {
      alert("Please enter a playlist title")
      return
    }

    setSaving(true)
    try {
      const token = localStorage.getItem("token")
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/playlists/${resolvedParams.id}`,
        {
          method: "PUT",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            ...(token && { Authorization: `Bearer ${token}` }),
          },
          body: JSON.stringify({
            name: formData.title,
            description: formData.description,
            is_public: formData.isPublic,
            is_collaborative: formData.isCollaborative,
            category: formData.category,
            tags: formData.tags,
          }),
        }
      )

      if (response.ok) {
        router.push(`/playlists/${resolvedParams.id}`)
      } else {
        const error = await response.json()
        alert(error.error || "Failed to update playlist")
      }
    } catch (error) {
      console.error("Error updating playlist:", error)
      alert("Failed to update playlist")
    } finally {
      setSaving(false)
    }
  }

  const addTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, newTag.trim()]
      }))
      setNewTag("")
    }
  }

  const removeTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }))
  }

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
            <p className="text-gray-600 dark:text-gray-400 mb-4">The playlist you're trying to edit doesn't exist.</p>
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
          <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border-b border-orange-200 dark:border-gray-700/50">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 md:py-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <h1 className="text-xl md:text-2xl font-bold text-orange-500">Edit Playlist</h1>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
          <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border-orange-200/50 dark:border-gray-700/50 shadow-xl">
            <CardHeader className="border-b border-orange-200/30 dark:border-gray-700/30">
              <CardTitle className="text-gray-900 dark:text-white">Playlist Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 p-4 md:p-6">
              <div className="space-y-2">
                <Label htmlFor="title" className="text-gray-700 dark:text-gray-300">Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Enter playlist title"
                  className="bg-white dark:bg-gray-700 border-orange-200 dark:border-gray-600 text-gray-900 dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:border-orange-500 dark:focus:border-orange-400"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description" className="text-gray-700 dark:text-gray-300">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Enter playlist description"
                  rows={4}
                  className="bg-white dark:bg-gray-700 border-orange-200 dark:border-gray-600 text-gray-900 dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:border-orange-500 dark:focus:border-orange-400 resize-none"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="category" className="text-gray-700 dark:text-gray-300">Category</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}
                >
                  <SelectTrigger className="bg-white dark:bg-gray-700 border-orange-200 dark:border-gray-600 text-gray-900 dark:text-white">
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-gray-800 border-orange-200 dark:border-gray-600">
                    <SelectItem value="music" className="text-gray-900 dark:text-white hover:bg-orange-50 dark:hover:bg-gray-700">Music</SelectItem>
                    <SelectItem value="education" className="text-gray-900 dark:text-white hover:bg-orange-50 dark:hover:bg-gray-700">Education</SelectItem>
                    <SelectItem value="entertainment" className="text-gray-900 dark:text-white hover:bg-orange-50 dark:hover:bg-gray-700">Entertainment</SelectItem>
                    <SelectItem value="gaming" className="text-gray-900 dark:text-white hover:bg-orange-50 dark:hover:bg-gray-700">Gaming</SelectItem>
                    <SelectItem value="technology" className="text-gray-900 dark:text-white hover:bg-orange-50 dark:hover:bg-gray-700">Technology</SelectItem>
                    <SelectItem value="sports" className="text-gray-900 dark:text-white hover:bg-orange-50 dark:hover:bg-gray-700">Sports</SelectItem>
                    <SelectItem value="other" className="text-gray-900 dark:text-white hover:bg-orange-50 dark:hover:bg-gray-700">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-gray-700 dark:text-gray-300">Tags</Label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    placeholder="Add a tag"
                    className="flex-1 bg-white dark:bg-gray-700 border-orange-200 dark:border-gray-600 text-gray-900 dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:border-orange-500 dark:focus:border-orange-400"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        addTag()
                      }
                    }}
                  />
                  <Button
                    type="button"
                    onClick={addTag}
                    variant="outline"
                    className="border-orange-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-orange-50 dark:hover:bg-gray-700 whitespace-nowrap"
                  >
                    Add Tag
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {formData.tags.map((tag, index) => (
                    <div
                      key={index}
                      className="bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 text-sm px-3 py-1 rounded-full flex items-center gap-2 border border-orange-200 dark:border-orange-800"
                    >
                      {tag}
                      <button
                        onClick={() => removeTag(tag)}
                        className="text-orange-600 dark:text-orange-400 hover:text-orange-800 dark:hover:text-orange-200 transition-colors"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-4 border-t border-orange-200/30 dark:border-gray-700/30 pt-6">
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="isPublic"
                    checked={formData.isPublic}
                    onCheckedChange={(checked) => 
                      setFormData(prev => ({ ...prev, isPublic: checked as boolean }))
                    }
                    className="border-orange-300 dark:border-gray-600 data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500"
                  />
                  <Label htmlFor="isPublic" className="text-gray-700 dark:text-gray-300 cursor-pointer">Make this playlist public</Label>
                </div>

                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="isCollaborative"
                    checked={formData.isCollaborative}
                    onCheckedChange={(checked) => 
                      setFormData(prev => ({ ...prev, isCollaborative: checked as boolean }))
                    }
                    className="border-orange-300 dark:border-gray-600 data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500"
                  />
                  <Label htmlFor="isCollaborative" className="text-gray-700 dark:text-gray-300 cursor-pointer">Allow collaboration</Label>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t border-orange-200/30 dark:border-gray-700/30">
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-orange-500 hover:bg-orange-600 text-white border-none shadow-md hover:shadow-lg transition-all duration-200 flex-1 sm:flex-none"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? "Saving..." : "Save Changes"}
                </Button>
                <Link href={`/playlists/${resolvedParams.id}`} className="flex-1 sm:flex-none">
                  <Button 
                    variant="outline" 
                    className="w-full border-orange-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-orange-50 dark:hover:bg-gray-700"
                  >
                    Cancel
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AuthGuard>
  )
}
