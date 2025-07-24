import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Play, Sun, Moon, ChevronDown } from "lucide-react"
import { Feature } from "@/types/features"

interface NavbarProps {
  showNavbar: boolean
  features: Feature[]
  setActiveFeature: (feature: Feature) => void
  darkMode: boolean
  toggleDarkMode: () => void
}

export default function Navbar({ showNavbar, features, setActiveFeature, darkMode, toggleDarkMode }: NavbarProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        showNavbar
          ? "translate-y-0 backdrop-blur-md bg-white/80 dark:bg-gray-900/80 border-b border-orange-200/50 dark:border-gray-700/50"
          : "-translate-y-full"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16"
              onMouseLeave={() => setIsDropdownOpen(false)}>
          {/* Left: Logo and Name */}
          <div className="flex items-center space-x-2">
            <Play className="w-8 h-8 text-orange-500" />
            <span className="text-xl font-bold text-gray-900 dark:text-white">YouTube Mate</span>
          </div>

          {/* Right: Features Dropdown, Login, and Dark Mode Toggle */}
          <div className="flex items-center space-x-4">
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
                <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-orange-200/50 dark:border-gray-700/50 z-50">
                  {features.map((feature) => (
                    <button
                      key={feature.id}
                      onClick={() => {
                        setActiveFeature(feature)
                        setIsDropdownOpen(false)
                      }}
                      className="w-full text-left px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-orange-50 dark:hover:bg-gray-700 hover:text-orange-500 transition-colors duration-200"
                    >
                      {feature.title}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Login Button */}
            <Button
              variant="ghost"
              className="text-gray-700 dark:text-gray-300 hover:text-orange-500 transition-colors duration-200"
            >
              Login
            </Button>

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