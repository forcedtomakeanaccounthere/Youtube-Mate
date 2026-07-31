import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Play, Sun, Moon, ChevronDown, Link, LogOut, User, Menu, X } from "lucide-react"
import { Feature } from "@/types/features"
import { toast } from "@/hooks/use-toast"
import { mestika } from "@/app/fonts"

interface NavbarProps {
  showNavbar: boolean
  features: Feature[]
  setActiveFeature: (feature: Feature) => void
  darkMode: boolean
  toggleDarkMode: () => void
}

interface UserData {
  id: string
  email: string
  name: string
  avatar?: string
  authProvider: string
  plan: string
}

export default function Navbar({ showNavbar, features, setActiveFeature, darkMode, toggleDarkMode }: NavbarProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
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

    // More aggressive periodic check for the first 30 seconds
    let checkCount = 0
    const intervalId = setInterval(() => {
      if (checkCount < 30) {
        console.log("Periodic auth check", checkCount + 1)
        checkAuthStatus()
        checkCount++
      } else {
        clearInterval(intervalId)
      }
    }, 1000)

    return () => {
      window.removeEventListener("storage", handleStorageChange)
      window.removeEventListener("authStateChanged", handleAuthChange)
      window.removeEventListener("focus", handleFocus)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      clearInterval(intervalId)
    }
  }, [])

  // Fetch user data using token
  const fetchUserData = async (token: string) => {
    try {
      console.log("Fetching user data with token...")
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api"}/auth/me`, {
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
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api"}/auth/upload-avatar`, {
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
          <div className="flex items-center justify-between h-14 md:h-16"
                onMouseLeave={() => setIsDropdownOpen(false)}>
            {/* Left: Logo and Name */}
            <div className="flex items-center space-x-1 md:space-x-2 cursor-pointer" onClick={() => window.location.href = "/"}>
              <Play className="w-6 h-6 md:w-8 md:h-8 text-orange-500" />
              <span className="text-lg md:text-xl font-bold text-gray-900 dark:text-white" style={{ fontFamily: mestika.style.fontFamily }}>YouTube Mate</span>
            </div>

            {/* Desktop Right section */}
            <div className="hidden md:flex items-center space-x-4">
              {/* Features Dropdown */}
              <div
                className="relative"
                onMouseEnter={() => setIsDropdownOpen(true)}
              >
                <Button
                  variant="ghost"
                  className="text-gray-700 dark:text-gray-300 hover:text-orange-500 transition-colors duration-200 flex items-center space-x-1"
                >
                  <span>Features</span>
                  <ChevronDown className="w-4 h-4" />
                </Button>
                {isDropdownOpen && (
                  <div
                    className="absolute right-0 mt-2 w-56 z-50 rounded-2xl overflow-hidden backdrop-blur-xl"
                    style={{
                      background: darkMode
                        ? 'linear-gradient(90deg, rgba(30,30,40,0.97) 0%, rgba(30,30,40,0.85) 55%, rgba(30,30,40,0.70) 100%)'
                        : 'linear-gradient(90deg, rgba(255,255,255,0.97) 0%, rgba(250,250,255,0.90) 55%, rgba(245,245,252,0.72) 100%)',
                      border: darkMode
                        ? '1px solid rgba(255,255,255,0.08)'
                        : '1px solid rgba(255,255,255,0.7)',
                      boxShadow: darkMode
                        ? '0 12px 40px rgba(0,0,0,0.5), 0 2px 10px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.06)'
                        : '0 12px 40px rgba(0,0,0,0.13), 0 2px 10px rgba(0,0,0,0.07), inset 0 1px 0 rgba(255,255,255,0.9)',
                    }}
                  >
                    {/* Fluted glass top sheen */}
                    <div
                      className="absolute top-0 left-0 right-0 h-[45%] rounded-t-2xl pointer-events-none"
                      style={{
                        background: darkMode
                          ? 'linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0) 100%)'
                          : 'linear-gradient(180deg, rgba(255,255,255,0.60) 0%, rgba(255,255,255,0) 100%)',
                      }}
                    />
                    {/* Left-to-right gloss — opaque on text side, fades right */}
                    <div
                      className="absolute top-0 left-0 bottom-0 w-[50%] pointer-events-none"
                      style={{
                        background: darkMode
                          ? 'linear-gradient(90deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0) 100%)'
                          : 'linear-gradient(90deg, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0) 100%)',
                      }}
                    />
                    <div className="relative py-1.5">
                      {features.map((feature, index) => (
                        <button
                          key={feature.id}
                          onClick={() => {
                            window.location.href = feature.route
                          }}
                          className={`w-full text-left px-4 py-2.5
                            text-gray-800 dark:text-gray-100
                            hover:text-orange-500 dark:hover:text-orange-400
                            transition-all duration-150 text-sm font-medium
                            ${index !== 0 ? 'border-t border-gray-200/50 dark:border-white/[0.06]' : ''}`}
                          style={{
                            background: 'transparent',
                          }}
                          onMouseEnter={e => {
                            (e.currentTarget as HTMLButtonElement).style.background = darkMode
                              ? 'rgba(255,255,255,0.07)'
                              : 'rgba(255,255,255,0.65)'
                          }}
                          onMouseLeave={e => {
                            (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
                          }}
                        >
                          {feature.title}
                        </button>
                      ))}
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
            {features.map((feature) => (
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
