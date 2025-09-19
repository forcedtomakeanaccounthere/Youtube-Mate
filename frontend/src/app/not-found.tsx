"use client"

import { useState } from "react"
import { Play, Home, ArrowLeft, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import Navbar from "@/components/landing/Navbar"
import { useDarkMode } from "@/hooks/use-dark-mode"
import featuresData from "@/data/features.json"
import type { Feature } from "@/types/features"

const features: Feature[] = featuresData

export default function NotFound() {
  // Navbar state
  const [activeFeature, setActiveFeature] = useState(features[0])
  const [showNavbar, setShowNavbar] = useState(true)
  const { darkMode, toggleDarkMode, mounted } = useDarkMode()

  // Don't render anything that depends on darkMode until mounted
  if (!mounted) {
    return <div className="min-h-screen" />
  }

  const handleGoHome = () => {
    window.location.href = "/"
  }

  const handleGoBack = () => {
    window.history.back()
  }

  return (
    <div className={`min-h-screen transition-colors duration-300 ${darkMode ? "dark bg-gradient-to-br from-gray-900 dark:to-gray-800" : "bg-gradient-to-br from-orange-50 to-red-50"}`}>
      <Navbar
        showNavbar={showNavbar}
        features={features}
        setActiveFeature={setActiveFeature}
        darkMode={darkMode}
        toggleDarkMode={toggleDarkMode}
      />
      
      <div className="pt-20 py-8 px-4 sm:px-6 lg:px-8 flex items-center justify-center min-h-screen">
        <div className="max-w-2xl mx-auto text-center">
          {/* Main 404 Card */}
          <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-orange-200/50 dark:border-gray-700/50 shadow-2xl">
            <CardContent className="p-3 md:p-5">
              {/* 404 Animation/Icon */}
              <div className="mb-8">
                <div className="relative">
                  <div className="text-8xl md:text-9xl font-bold text-orange-500/40 dark:text-orange-400/40 select-none">
                    404
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-20 h-20 md:w-24 md:h-24 bg-gradient-to-br from-orange-500 to-red-600 rounded-full flex items-center justify-center shadow-2xl ">
                      <Search className="w-10 h-10 md:w-12 md:h-12 text-white" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Error Message */}
              <div className="space-y-4 mb-8">
                <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white">
                  Page Not Found
                </h1>
                <p className="text-lg text-gray-600 dark:text-gray-300 max-w-md mx-auto leading-relaxed">
                  We're sorry, we seem to have lost this page, but we don't want to lose you.
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 max-w-[300px] mx-auto">
                  The page you're looking for might have been moved, deleted, or doesn't exist.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                <Button
                  onClick={handleGoHome}
                  className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white px-6 py-2 flex items-center space-x-2 min-w-[140px]"
                >
                  <Home className="w-4 h-4" />
                  <span>Go Home</span>
                </Button>
                
                <Button
                  onClick={handleGoBack}
                  variant="outline"
                  className="border-orange-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-orange-50 dark:hover:bg-gray-700 px-6 py-2 flex items-center space-x-2 min-w-[140px]"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Go Back</span>
                </Button>
              </div>

              {/* Additional Help */}
              <div className="mt-5 pt-6 border-t border-gray-200 dark:border-gray-700">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  Need help? Try one of these popular pages
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => window.location.href = "/download"}
                    className="text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20"
                  >
                    Download Videos
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => window.location.href = "/playlists"}
                    className="text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20"
                  >
                    Playlists
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => window.location.href = "/shorten"}
                    className="text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20"
                  >
                    URL Shortener
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => window.location.href = "/transcript"}
                    className="text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20"
                  >
                    Transcripts
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* YouTube Mate Logo Footer */}
          <div className="mt-8 flex items-center justify-center space-x-2 text-gray-500 dark:text-gray-400">
            <Play className="w-5 h-5 text-orange-500" />
            <span className="text-sm">YouTube Mate - Your Ultimate YouTube Companion</span>
          </div>
        </div>
      </div>
    </div>
  )
}