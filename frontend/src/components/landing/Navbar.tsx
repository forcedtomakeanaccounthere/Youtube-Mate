import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Play, Sun, Moon, ChevronDown, Link, LogOut, User } from "lucide-react"
import { Feature } from "@/types/features"

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
      alert('Please select an image file')
      return
    }

    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      alert('File size must be less than 5MB')
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
        alert(data.error || 'Failed to upload avatar')
      }
    } catch (error) {
      console.error('Avatar upload error:', error)
      alert('Failed to upload avatar. Please try again.')
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
    
    // Trigger auth state change event
    window.dispatchEvent(new Event("authStateChanged"))
    
    window.location.href = "/"
  }

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300  backdrop-blur-md bg-white/80 dark:bg-gray-900/80 border-b border-orange-200/50 dark:border-gray-700/50"`}
    >
      <div className="max-w-7xl mx-auto px-2 sm:px-4 md:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 md:h-16"
              onMouseLeave={() => setIsDropdownOpen(false)}>
          {/* Left: Logo and Name */}
          <div className="flex items-center space-x-1 md:space-x-2" onClick={() => window.location.href = "/"}>
            <Play className="w-6 h-6 md:w-8 md:h-8 text-orange-500" />
            <span className="text-lg md:text-xl font-bold text-gray-900 dark:text-white">YouTube Mate</span>
          </div>

          {/* Right: Features Dropdown, Login, and Dark Mode Toggle */}
          <div className="flex items-center space-x-2 md:space-x-4">
            {/* Features Dropdown - Hidden on mobile */}
            <div
              className="relative hidden md:block"
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
                <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-orange-200/50 dark:border-gray-700/50 z-50">
                  {features.map((feature) => (
                    <button
                      key={feature.id}
                      onClick={() => {
                        // setActiveFeature(feature)
                        // setIsDropdownOpen(false)
                        window.location.href = feature.route
                      }}
                      className="w-full text-left px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-orange-50 dark:hover:bg-gray-700 hover:text-orange-500 transition-colors duration-200"
                    >
                      {feature.title}
                    </button>
                  ))}
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
                      className="w-8 h-8 md:w-11 md:h-11 rounded-full border-2 border-orange-200 dark:border-gray-600 hover:border-orange-400 dark:hover:border-gray-400 transition-colors duration-200 object-cover"
                      onLoad={() => {
                        console.log("✅ Avatar image loaded successfully:", userData.avatar)
                        setAvatarError(false)
                      }}
                      onError={(e) => {
                        console.error("❌ Avatar image failed to load:", userData.avatar)
                        console.error("Error details:", e)
                        setAvatarError(true)
                      }}
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-8 h-8 md:w-11 md:h-11 rounded-full bg-orange-100 dark:bg-gray-700 border-2 border-orange-200 dark:border-gray-600 flex items-center justify-center">
                      <User className="w-4 h-4 md:w-6 md:h-6 text-orange-500 dark:text-gray-400" />
                    </div>
                  )}
                  
                  {/* Upload loading indicator */}
                  {isUploading && (
                    <div className="absolute inset-0 bg-black bg-opacity-50 rounded-full flex items-center justify-center">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  )}
                  
                  {/* Upload overlay for clickable avatars */}
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
                <LogOut className="w-4 h-4 hidden md:block" />
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
              { darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" /> }
            </Button>
          </div>
        </div>
      </div>
    </nav>
  )
}