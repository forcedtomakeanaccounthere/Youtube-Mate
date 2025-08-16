"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { ChevronUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import Navbar from "../components/landing/Navbar"
import Hero from "../components/landing/Hero"
import Features from "../components/landing/Features"
import FAQ from "../components/landing/FAQ"
import CTA from "../components/landing/CTA"
import Footer from "../components/landing/Footer"
import featuresData from "@/data/features.json"
import { Feature } from "../types/features"
import { useDarkMode } from "@/hooks/use-dark-mode"
import { toast } from "@/hooks/use-toast"

const features: Feature[] = featuresData
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api"

export default function HomePage() {
  const searchParams = useSearchParams()
  const [activeFeature, setActiveFeature] = useState(features[0])
  const [showScrollTop, setShowScrollTop] = useState(false)
  const [showNavbar, setShowNavbar] = useState(false)
  const { darkMode, toggleDarkMode, mounted } = useDarkMode()

  // Handle OAuth success/error from URL params
  useEffect(() => {
    const token = searchParams.get("token")
    const success = searchParams.get("success")
    const error = searchParams.get("error")

    console.log("HomePage: Checking URL params")
    console.log("Token:", token)
    console.log("Success:", success)
    console.log("Error:", error)

    if (token && success) {
      console.log("HomePage: Processing OAuth success")
      localStorage.setItem("token", token)
      
      // Fetch user data with the token
      fetchUserData(token)
      
      // Clean up URL params
      window.history.replaceState({}, document.title, window.location.pathname)
    } else if (error) {
      console.error("HomePage: OAuth error:", error)
      toast({
        title: "Authentication Error",
        description: "Authentication failed. Please try again.",
        variant: "destructive"
      })
      
      // Clean up URL params
      window.history.replaceState({}, document.title, window.location.pathname)
    }
  }, [searchParams])

  // Fetch user data using token
  const fetchUserData = async (token: string) => {
    try {
      console.log("HomePage: Fetching user data with token...")
      const response = await fetch(`${API_BASE}/auth/me`, {
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      })

      const data = await response.json()
      console.log("HomePage: User data response:", data)

      if (response.ok && data.user) {
        localStorage.setItem("user", JSON.stringify(data.user))
        console.log("HomePage: User data stored successfully")
        console.log("HomePage: User avatar:", data.user.avatar)
        
        // Trigger auth state change event
        window.dispatchEvent(new Event("authStateChanged"))
        
        toast({
          title: "Login Successful!",
          description: `Welcome back, ${data.user.name}!`,
        })
      } else {
        console.error("HomePage: Failed to fetch user data:", data)
        localStorage.removeItem("token")
        toast({
          title: "Authentication Error",
          description: "Failed to complete authentication. Please try again.",
          variant: "destructive"
        })
      }
    } catch (error) {
      console.error("HomePage: Error fetching user data:", error)
      localStorage.removeItem("token")
      toast({
        title: "Authentication Error",
        description: "Failed to complete authentication. Please try again.",
        variant: "destructive"
      })
    }
  }

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY
      setShowScrollTop(scrollY > 300)
      setShowNavbar(scrollY > 100)
    }

    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  // Don't render anything that depends on darkMode until mounted
  if (!mounted) {
    return <div className="min-h-screen" /> // Minimal fallback
  }

  return (
    <div
      className={`min-h-screen transition-colors duration-300 ${darkMode ? "dark bg-gray-900" : "bg-gradient-to-br from-orange-50 to-red-50"}`}
    >
      <Navbar
        showNavbar={showNavbar}
        features={features}
        setActiveFeature={setActiveFeature}
        darkMode={darkMode}
        toggleDarkMode={toggleDarkMode}
      />
      <Hero />
      <Features features={features} activeFeature={activeFeature} setActiveFeature={setActiveFeature} />
      <FAQ />
      <CTA />
      <Footer />
      {showScrollTop && (
        <Button
          onClick={scrollToTop}
          size="icon"
          className="fixed bottom-6 right-6 z-50 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white shadow-lg"
        >
          <ChevronUp className="w-5 h-5" />
        </Button>
      )}
    </div>
  )
}