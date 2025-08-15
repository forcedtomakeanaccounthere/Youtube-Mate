"use client"

import { useState, useEffect } from "react"
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

const features: Feature[] = featuresData

export default function HomePage() {
  const [activeFeature, setActiveFeature] = useState(features[0])
  const [showScrollTop, setShowScrollTop] = useState(false)
  const [showNavbar, setShowNavbar] = useState(false)
  const { darkMode, toggleDarkMode, mounted } = useDarkMode()

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