import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Play, Sun, Moon, ChevronDown, Link, LogOut, User, Menu, X, Scissors, MessageSquare, List, Download, Users, FileText, ArrowRight } from "lucide-react"
import { Feature } from "@/types/features"
import { toast } from "@/hooks/use-toast"
import { mestika } from "@/app/fonts"
import { API_BASE } from "@/lib/api"

interface NavbarProps {
  showNavbar: boolean
  features: Feature[]
  setActiveFeature: (feature: Feature) => void
  darkMode: boolean
  toggleDarkMode: (event?: React.MouseEvent<HTMLElement> | MouseEvent) => void
}

interface UserData {
  id: string
  email: string
  name: string
  avatar?: string
  authProvider: string
  plan: string
}


const featurePreviewImages: Record<string, string> = {
  'url-shortener': '/dropdown_ui/shortener.png',
  'transcript': '/dropdown_ui/transcript.png',
  'playlists': '/dropdown_ui/playlist.png',
  'downloader': '/dropdown_ui/downloads.png',
  'group-streaming': '/dropdown_ui/streaming.png',
  'summarizer': '/dropdown_ui/transcript1.png',
}

const featureSubtitles: Record<string, string> = {
  'url-shortener': 'Clean links & QR codes',
  'transcript': 'AI-powered video Q&A',
  'playlists': 'Collaborate with friends',
  'downloader': 'High-quality MP3 & MP4',
  'group-streaming': 'Live synced watch rooms',
  'summarizer': 'AI transcripts & summaries',
}

const getFeatureIcon = (iconName: string) => {
  switch (iconName) {
    case 'Scissors':
      return <Scissors className="w-4 h-4" />
    case 'MessageSquare':
      return <MessageSquare className="w-4 h-4" />
    case 'List':
      return <List className="w-4 h-4" />
    case 'Download':
      return <Download className="w-4 h-4" />
    case 'Users':
      return <Users className="w-4 h-4" />
    case 'FileText':
      return <FileText className="w-4 h-4" />
    default:
      return <Play className="w-4 h-4" />
  }
}

const getPreviewImage = (feature: Feature): string => {
  if (featurePreviewImages[feature.id]) {
    return featurePreviewImages[feature.id]
  }
  const titleLower = feature.title.toLowerCase()
  if (titleLower.includes('short')) return '/dropdown_ui/shortener.png'
  if (titleLower.includes('ask') || titleLower.includes('qa')) return '/dropdown_ui/transcript.png'
  if (titleLower.includes('playlist')) return '/dropdown_ui/playlist.png'
  if (titleLower.includes('download')) return '/dropdown_ui/downloads.png'
  if (titleLower.includes('stream')) return '/dropdown_ui/streaming.png'
  if (titleLower.includes('summar')) return '/dropdown_ui/transcript1.png'
  return '/dropdown_ui/shortener.png'
}

export default function Navbar({ showNavbar, features, setActiveFeature, darkMode, toggleDarkMode }: NavbarProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [hoveredFeature, setHoveredFeature] = useState<Feature | null>(null)

  // Filter out "timestamp-share" from the dropdown while preserving features.json
  const dropdownFeatures = features.filter(
    (feature) =>
      feature.id !== 'timestamp-share' &&
      feature.title?.toLowerCase() !== 'timestamp share'
  )
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [userData, setUserData] = useState<UserData | null>(null)
  const [authCheckCount, setAuthCheckCount] = useState(0) // Force re-renders
  const [avatarError, setAvatarError] = useState(false) // Track avatar loading errors
  const [isUploading, setIsUploading] = useState(false) // Track upload state

  // Check authentication status
  const checkAuthStatus = () => {
    const token = localStorage.getItem("token")
    const user = localStorage.getItem("user")
    
    console.log("Navbar: Checking auth state")
    console.log("Token exists:", !!token)
    console.log("User data exists:", !!user)
    console.log("User data content:", user)
    
    setAuthCheckCount(prev => prev + 1) // Force re-render
    
    if (token && user) {
      try {
        const parsedUser = JSON.parse(user)
        console.log("Parsed user data:", parsedUser)
        console.log("Avatar URL:", parsedUser.avatar)
        console.log("Avatar exists:", !!parsedUser.avatar)
        setUserData(parsedUser)
        setIsAuthenticated(true)
        setAvatarError(false) // Reset avatar error when new user data is set
      } catch (error) {
        console.error("Error parsing user data:", error)
        // Clear invalid data
        localStorage.removeItem("token")
        localStorage.removeItem("user")
        setIsAuthenticated(false)
        setUserData(null)
      }
    } else if (token && !user) {
      // Token exists but no user data, fetch it
      console.log("Token exists but no user data, fetching...")
      fetchUserData(token)
    } else {
      // No token or user data
      setIsAuthenticated(false)
      setUserData(null)
    }
  }

  // Check authentication status on component mount and listen for storage changes
  useEffect(() => {
    // Initial check
    checkAuthStatus()

    // Listen for storage changes (when login happens in another tab or component)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "token" || e.key === "user") {
        console.log("Storage changed, rechecking auth status")
        setTimeout(() => checkAuthStatus(), 100) // Small delay to ensure data is set
      }
    }

    // Listen for custom auth events
    const handleAuthChange = () => {
      console.log("Auth change event received, rechecking auth status")
      setTimeout(() => checkAuthStatus(), 100) // Small delay to ensure data is set
    }

    // Listen for page focus to recheck auth state
    const handleFocus = () => {
      console.log("Page focused, rechecking auth status")
      checkAuthStatus()
    }

    // Listen for page visibility change
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log("Page visible, rechecking auth status")
        checkAuthStatus()
      }
    }

    window.addEventListener("storage", handleStorageChange)
    window.addEventListener("authStateChanged", handleAuthChange)
    window.addEventListener("focus", handleFocus)
    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      window.removeEventListener("storage", handleStorageChange)
      window.removeEventListener("authStateChanged", handleAuthChange)
      window.removeEventListener("focus", handleFocus)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [])

  // Fetch user data using token
  const fetchUserData = async (token: string) => {
    try {
      console.log("Fetching user data with token...")
      const response = await fetch(`${API_BASE}/auth/me`, {
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      })

      const data = await response.json()
      console.log("User data response:", data)

      if (response.ok && data.user) {
        localStorage.setItem("user", JSON.stringify(data.user))
        setUserData(data.user)
        setIsAuthenticated(true)
        console.log("User data stored successfully")
        
        // Trigger auth state change event
        window.dispatchEvent(new Event("authStateChanged"))
      } else {
        console.error("Failed to fetch user data:", data)
        localStorage.removeItem("token")
        localStorage.removeItem("user")
        setIsAuthenticated(false)
        setUserData(null)
      }
    } catch (error) {
      console.error("Error fetching user data:", error)
      localStorage.removeItem("token")
      localStorage.removeItem("user")
      setIsAuthenticated(false)
      setUserData(null)
    }
  }

  // Handle avatar upload
  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file type and size
    if (!file.type.startsWith('image/')) {
      toast({ title: "Invalid file", description: "Please select an image file.", variant: "destructive" })
      return
    }

    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      toast({ title: "File too large", description: "File size must be less than 5MB.", variant: "destructive" })
      return
    }

    setIsUploading(true)

    try {
      const formData = new FormData()
      formData.append('avatar', file)

      const token = localStorage.getItem('token')
      const response = await fetch(`${API_BASE}/auth/upload-avatar`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      })

      const data = await response.json()

      if (response.ok) {
        // Update local user data
        localStorage.setItem('user', JSON.stringify(data.user))
        setUserData(data.user)
        setAvatarError(false)
        
        // Trigger auth state change event
        window.dispatchEvent(new Event("authStateChanged"))
        
        console.log('Avatar uploaded successfully:', data.avatar)
      } else {
        console.error('Avatar upload failed:', data.error)
        toast({ title: "Upload failed", description: data.error || "Failed to upload avatar.", variant: "destructive" })
      }
    } catch (error) {
      console.error('Avatar upload error:', error)
      toast({ title: "Upload error", description: "Failed to upload avatar. Please try again.", variant: "destructive" })
    } finally {
      setIsUploading(false)
      // Reset the input
      event.target.value = ''
    }
  }

  // Handle avatar click (only for non-Google users or users without avatar)
  const handleAvatarClick = () => {
    if (userData?.authProvider === 'google' && userData?.avatar) {
      // Google users with avatar can't change it, do nothing
      return
    }
    
    // Trigger file input for local users or users without avatar
    const fileInput = document.createElement('input')
    fileInput.type = 'file'
    fileInput.accept = 'image/*'
    fileInput.onchange = (e) => handleAvatarUpload(e as any)
    fileInput.click()
  }

  // Handle logout
  const handleLogout = () => {
    localStorage.removeItem("token")
    localStorage.removeItem("user")
    setIsAuthenticated(false)
    setUserData(null)
    setMobileMenuOpen(false)
    
    // Trigger auth state change event
    window.dispatchEvent(new Event("authStateChanged"))
    
    window.location.href = "/"
  }

  // Mobile menu state
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const sidebarRef = useRef<HTMLDivElement>(null)

  // Close sidebar on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (mobileMenuOpen && sidebarRef.current && !sidebarRef.current.contains(e.target as Node)) {
        setMobileMenuOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [mobileMenuOpen])

  // Lock body scroll when sidebar is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => { document.body.style.overflow = "" }
  }, [mobileMenuOpen])

  return (
    <>
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 backdrop-blur-md bg-white/80 dark:bg-gray-900/80 border-b border-orange-200/50 dark:border-gray-700/50`}
      >
        <div className="max-w-7xl mx-auto px-2 sm:px-4 md:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 md:h-16">
            {/* Left: Logo and Name */}
            <div className="flex items-center space-x-1 md:space-x-2 cursor-pointer" onClick={() => window.location.href = "/"}>
              <Play className="w-6 h-6 md:w-8 md:h-8 text-orange-500" />
              <span className="text-lg md:text-xl font-bold text-gray-900 dark:text-white" style={{ fontFamily: mestika.style.fontFamily }}>YouTube Mate</span>
            </div>

            {/* Desktop Right section */}
            <div className="hidden md:flex items-center space-x-7 lg:space-x-8 mr-12 md:mr-24 lg:mr-36 xl:mr-48">
              {/* Features Dropdown */}
              <div
                className="relative"
                onMouseEnter={() => setIsDropdownOpen(true)}
                onMouseLeave={() => {
                  setIsDropdownOpen(false)
                  setHoveredFeature(null)
                }}
              >
                <Button
                  variant="ghost"
                  onClick={() => setIsDropdownOpen((prev) => !prev)}
                  className="text-gray-700 dark:text-gray-300 hover:text-orange-500 transition-colors duration-200 flex items-center space-x-1"
                >
                  <span>Features</span>
                  <ChevronDown
                    className={`w-4 h-4 transition-transform duration-200 ${
                      isDropdownOpen ? "rotate-180 text-orange-500" : ""
                    }`}
                  />
                </Button>

                {isDropdownOpen && (
                  <div
                    className="absolute top-full pt-2 z-50 animate-in fade-in-0 duration-200"
                    style={{
                      left: 'calc(50% - 152px)',
                    }}
                  >
                    {/* Glass parent div: invisible before hover, becomes glass around dropdown + preview on hover */}
                    <div
                      className={`rounded-2xl p-2 flex flex-row items-stretch transition-all duration-200 ${
                        hoveredFeature
                          ? 'gap-2.5 sm:gap-3 backdrop-blur-2xl shadow-2xl'
                          : 'gap-0 shadow-xl'
                      }`}
                      style={{
                        background: hoveredFeature
                          ? (darkMode
                              ? 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.03) 100%)'
                              : 'linear-gradient(135deg, rgba(255,255,255,0.72) 0%, rgba(255,255,255,0.38) 100%)')
                          : 'transparent',
                        border: hoveredFeature
                          ? (darkMode
                              ? '1px solid rgba(255,255,255,0.12)'
                              : '1px solid rgba(255,255,255,0.85)')
                          : '1px solid transparent',
                        boxShadow: hoveredFeature
                          ? (darkMode
                              ? '0 20px 50px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.12)'
                              : '0 20px 50px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.95)')
                          : 'none',
                        backdropFilter: hoveredFeature ? 'blur(24px)' : 'none',
                        WebkitBackdropFilter: hoveredFeature ? 'blur(24px)' : 'none',
                      }}
                    >
                      {/* Left: Dropdown Options List — stays at exact same spot whether preview is open or closed */}
                      <div
                        className="w-64 sm:w-72 rounded-xl overflow-hidden relative transition-all duration-200 shrink-0"
                        style={{
                          background: hoveredFeature
                            ? (darkMode ? '#121218' : '#ffffff')
                            : (darkMode ? '#161622' : '#ffffff'),
                          border: hoveredFeature
                            ? (darkMode ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.06)')
                            : (darkMode ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.08)'),
                          boxShadow: hoveredFeature
                            ? (darkMode ? '0 10px 30px rgba(0,0,0,0.5)' : '0 10px 30px rgba(0,0,0,0.07)')
                            : (darkMode ? '0 16px 40px rgba(0,0,0,0.6), 0 2px 10px rgba(0,0,0,0.3)' : '0 16px 40px rgba(0,0,0,0.12), 0 2px 10px rgba(0,0,0,0.06)'),
                        }}
                      >
                        <div className="p-1.5 space-y-1">
                          {dropdownFeatures.map((feature) => {
                            const isHovered = hoveredFeature?.id === feature.id
                            return (
                              <button
                                key={feature.id}
                                onClick={() => {
                                  window.location.href = feature.route
                                }}
                                onMouseEnter={() => setHoveredFeature(feature)}
                                className={`w-full text-left px-3 py-2 rounded-xl transition-all duration-150 flex items-center space-x-3 group/item ${
                                  isHovered
                                    ? 'bg-orange-500/10 dark:bg-white/[0.09] text-orange-600 dark:text-orange-400'
                                    : 'text-gray-800 dark:text-gray-100 hover:bg-black/[0.04] dark:hover:bg-white/[0.05]'
                                }`}
                              >
                                <div
                                  className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors shrink-0 ${
                                    isHovered
                                      ? 'bg-orange-500 text-white shadow-sm'
                                      : 'bg-orange-500/10 text-orange-500 dark:bg-white/10 dark:text-orange-400'
                                  }`}
                                >
                                  {getFeatureIcon(feature.icon)}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-semibold truncate leading-tight">
                                    {feature.title}
                                  </div>
                                  <div className="text-[11px] text-gray-500 dark:text-gray-400 truncate mt-0.5">
                                    {featureSubtitles[feature.id] || feature.description}
                                  </div>
                                </div>
                                <ChevronDown
                                  className={`w-3.5 h-3.5 -rotate-90 transition-all ${
                                    isHovered
                                      ? 'opacity-100 text-orange-500 translate-x-0.5'
                                      : 'opacity-0'
                                  }`}
                                />
                              </button>
                            )
                          })}
                        </div>
                      </div>

                      {/* Right: Preview (only appears when an option is hovered) */}
                      {hoveredFeature && (
                        <div
                          onClick={() => {
                            window.location.href = hoveredFeature.route
                          }}
                          className="group/preview cursor-pointer w-[420px] sm:w-[460px] lg:w-[490px] xl:w-[520px] rounded-xl overflow-hidden p-3 flex flex-col justify-between transition-all duration-200 animate-in fade-in-0 zoom-in-95 shrink-0"
                          style={{
                            background: darkMode
                              ? 'linear-gradient(180deg, rgba(22,22,30,0.98) 0%, rgba(16,16,22,0.98) 100%)'
                              : 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(250,250,252,0.98) 100%)',
                            border: darkMode
                              ? '1px solid rgba(255,255,255,0.08)'
                              : '1px solid rgba(0,0,0,0.06)',
                            boxShadow: darkMode
                              ? '0 10px 30px rgba(0,0,0,0.5)'
                              : '0 10px 30px rgba(0,0,0,0.07)',
                          }}
                        >
                          {/* Preview Top Header */}
                          <div className="flex items-center justify-between pb-2 px-1 border-b border-gray-200/50 dark:border-white/10 mb-2 shrink-0">
                            <div className="flex items-center space-x-2">
                              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20">
                                Preview
                              </span>
                              <span className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate max-w-[260px]">
                                {hoveredFeature.title}
                              </span>
                            </div>
                            <div className="flex items-center text-xs text-orange-500 group-hover/preview:text-orange-600 dark:group-hover/preview:text-orange-400 font-medium">
                              <span>Open Page</span>
                              <ArrowRight className="w-3.5 h-3.5 ml-1 group-hover/preview:translate-x-0.5 transition-transform" />
                            </div>
                          </div>

                          {/* Image container matching dropdown height */}
                          <div className="relative flex-1 w-full rounded-lg overflow-hidden border border-gray-200/70 dark:border-white/10 bg-gray-100 dark:bg-gray-800/80 shadow-inner min-h-[250px]">
                            <img
                              src={getPreviewImage(hoveredFeature)}
                              alt={hoveredFeature.title}
                              className="w-full h-full object-cover object-top transition-transform duration-300 group-hover/preview:scale-[1.02]"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />
                            <div className="absolute bottom-2 left-2 right-2 px-2.5 py-1.5 rounded-md bg-black/60 backdrop-blur-md text-white text-[11px] flex items-center justify-between pointer-events-none">
                              <span className="truncate pr-2">{hoveredFeature.description}</span>
                              <span className="text-orange-400 font-semibold text-[10px] shrink-0">Click to visit &rarr;</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* User Avatar (if authenticated) */}
              {isAuthenticated && userData && (
                <div className="flex items-center">
                  <div
                    className={`relative ${
                      userData.authProvider !== 'google' || !userData.avatar
                        ? 'cursor-pointer hover:opacity-80 transition-opacity'
                        : ''
                    }`}
                    onClick={handleAvatarClick}
                    title={
                      userData.authProvider !== 'google' || !userData.avatar
                        ? 'Click to upload avatar'
                        : ''
                    }
                  >
                    {userData.avatar && !avatarError ? (
                      <img
                        src={userData.avatar}
                        alt={userData.name || "User Avatar"}
                        className="w-11 h-11 rounded-full border-2 border-orange-200 dark:border-gray-600 hover:border-orange-400 dark:hover:border-gray-400 transition-colors duration-200 object-cover"
                        onLoad={() => {
                          setAvatarError(false)
                        }}
                        onError={() => {
                          setAvatarError(true)
                        }}
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-11 h-11 rounded-full bg-orange-100 dark:bg-gray-700 border-2 border-orange-200 dark:border-gray-600 flex items-center justify-center">
                        <User className="w-6 h-6 text-orange-500 dark:text-gray-400" />
                      </div>
                    )}
                    {isUploading && (
                      <div className="absolute inset-0 bg-black bg-opacity-50 rounded-full flex items-center justify-center">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      </div>
                    )}
                    {(userData.authProvider !== 'google' || !userData.avatar) && !isUploading && (
                      <div className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-30 rounded-full flex items-center justify-center opacity-0 hover:opacity-100 transition-all duration-200">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Login/Logout Button */}
              {isAuthenticated ? (
                <Button
                  variant="ghost"
                  className="text-gray-700 dark:text-gray-300 hover:text-orange-500 transition-colors duration-200 flex items-center space-x-1"
                  onClick={handleLogout}
                >
                  <LogOut className="w-4 h-4" />
                  <span>Logout</span>
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  className="text-gray-700 dark:text-gray-300 hover:text-orange-500 transition-colors duration-200"
                  onClick={() => window.location.href = "/login"}
                >
                  Login
                </Button>
              )}

              {/* Dark Mode Toggle */}
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleDarkMode}
                className="text-gray-700 dark:text-gray-300 hover:text-orange-500"
              >
                {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </Button>
            </div>

            {/* Mobile Right section */}
            <div className="flex md:hidden items-center space-x-2">
              {/* Avatar or Login */}
              {isAuthenticated && userData ? (
                <div
                  className={`relative ${
                    userData.authProvider !== 'google' || !userData.avatar
                      ? 'cursor-pointer hover:opacity-80 transition-opacity'
                      : ''
                  }`}
                  onClick={handleAvatarClick}
                >
                  {userData.avatar && !avatarError ? (
                    <img
                      src={userData.avatar}
                      alt={userData.name || "User Avatar"}
                      className="w-8 h-8 rounded-full border-2 border-orange-200 dark:border-gray-600 object-cover"
                      onLoad={() => setAvatarError(false)}
                      onError={() => setAvatarError(true)}
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-orange-100 dark:bg-gray-700 border-2 border-orange-200 dark:border-gray-600 flex items-center justify-center">
                      <User className="w-4 h-4 text-orange-500 dark:text-gray-400" />
                    </div>
                  )}
                  {isUploading && (
                    <div className="absolute inset-0 bg-black bg-opacity-50 rounded-full flex items-center justify-center">
                      <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  )}
                </div>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-gray-700 dark:text-gray-300 hover:text-orange-500 transition-colors duration-200 text-sm px-2"
                  onClick={() => window.location.href = "/login"}
                >
                  Login
                </Button>
              )}

              {/* Dark Mode Toggle */}
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleDarkMode}
                className="text-gray-700 dark:text-gray-300 hover:text-orange-500 h-8 w-8"
              >
                {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </Button>

              {/* Hamburger */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileMenuOpen(true)}
                className="text-gray-700 dark:text-gray-300 hover:text-orange-500 h-8 w-8"
                aria-label="Open menu"
              >
                <Menu className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Side Panel Overlay + Drawer */}
      <div
        className={`fixed inset-0 z-[100] transition-opacity duration-300 md:hidden ${
          mobileMenuOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      >
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />

        {/* Side Panel */}
        <div
          ref={sidebarRef}
          className={`absolute top-0 right-0 h-full w-[60%] max-w-[280px] bg-white dark:bg-gray-900 shadow-2xl transform transition-transform duration-300 ease-[cubic-bezier(0.25,0.46,0.45,0.94)] ${
            mobileMenuOpen ? "translate-x-0" : "translate-x-full"
          }`}
        >
          {/* Panel Header */}
          <div className="flex items-center justify-between p-4 border-b border-orange-200/50 dark:border-gray-700/50">
            <div className="flex items-center space-x-2">
              <Play className="w-5 h-5 text-orange-500" />
              <span className="font-semibold text-gray-900 dark:text-white">Menu</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileMenuOpen(false)}
              className="text-gray-700 dark:text-gray-300 hover:text-orange-500 h-8 w-8"
              aria-label="Close menu"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* User info (if logged in) */}
          {isAuthenticated && userData && (
            <div className="p-4 border-b border-orange-200/30 dark:border-gray-700/30">
              <div className="flex items-center space-x-3">
                {userData.avatar && !avatarError ? (
                  <img
                    src={userData.avatar}
                    alt={userData.name || "User"}
                    className="w-10 h-10 rounded-full border-2 border-orange-200 dark:border-gray-600 object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-gray-700 border-2 border-orange-200 dark:border-gray-600 flex items-center justify-center">
                    <User className="w-5 h-5 text-orange-500 dark:text-gray-400" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{userData.name || "User"}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{userData.email}</p>
                </div>
              </div>
            </div>
          )}

          {/* Features list */}
          <div className="flex-1 overflow-y-auto py-2">
            <p className="px-4 py-2 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Features</p>
            {dropdownFeatures.map((feature) => (
              <button
                key={feature.id}
                onClick={() => {
                  setMobileMenuOpen(false)
                  window.location.href = feature.route
                }}
                className="w-full text-left px-4 py-3 text-gray-700 dark:text-gray-300 hover:bg-orange-50 dark:hover:bg-gray-800 hover:text-orange-500 transition-colors duration-200 flex items-center space-x-3"
              >
                <span className="text-sm font-medium">{feature.title}</span>
              </button>
            ))}
          </div>

          {/* Bottom section: Dark mode toggle + Logout */}
          <div className="absolute bottom-0 left-0 right-0 border-t border-orange-200/50 dark:border-gray-700/50 bg-white dark:bg-gray-900 p-4 space-y-2">
            {/* Dark mode row */}
            <button
              onClick={toggleDarkMode}
              className="w-full flex items-center justify-between px-2 py-2 text-gray-700 dark:text-gray-300 hover:bg-orange-50 dark:hover:bg-gray-800 rounded-lg transition-colors duration-200"
            >
              <span className="text-sm font-medium">Dark Mode</span>
              <div className={`w-10 h-5 rounded-full relative transition-colors duration-300 ${darkMode ? 'bg-orange-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transform transition-transform duration-300 ${darkMode ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </div>
            </button>

            {/* Logout */}
            {isAuthenticated && (
              <button
                onClick={handleLogout}
                className="w-full flex items-center space-x-3 px-2 py-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors duration-200"
              >
                <LogOut className="w-4 h-4" />
                <span className="text-sm font-medium">Logout</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
