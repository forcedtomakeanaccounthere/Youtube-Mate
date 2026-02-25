"use client"

import { Scissors, Share2, FileText, Download, List } from "lucide-react"
import { Button } from "@/components/ui/button"
import Image from "next/image"
import { Feature } from "@/types/features"
import { useRef, useEffect, useCallback } from "react"

const iconMap = {
  Scissors: Scissors,
  Share2: Share2,
  FileText: FileText,
  Download: Download,
  List: List,
}

interface FeaturesProps {
  features: Feature[]
  activeFeature: Feature
  setActiveFeature: (feature: Feature) => void
}

export default function Features({ features, activeFeature, setActiveFeature }: FeaturesProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const autoScrollRef = useRef<NodeJS.Timeout | null>(null)
  const userInteractedRef = useRef(false)

  const activeIndex = features.findIndex(f => f.id === activeFeature.id)

  const goToNext = useCallback(() => {
    const nextIndex = (activeIndex + 1) % features.length
    setActiveFeature(features[nextIndex])
  }, [activeIndex, features, setActiveFeature])

  // Auto-scroll every 2 seconds on mobile
  useEffect(() => {
    const isMobile = window.matchMedia("(max-width: 767px)").matches
    if (!isMobile) return

    // Reset user interaction flag after 5 seconds of inactivity
    const resetTimer = () => {
      userInteractedRef.current = true
      if (autoScrollRef.current) clearInterval(autoScrollRef.current)
      const resumeTimer = setTimeout(() => {
        userInteractedRef.current = false
        startAutoScroll()
      }, 5000)
      return () => clearTimeout(resumeTimer)
    }

    const startAutoScroll = () => {
      if (autoScrollRef.current) clearInterval(autoScrollRef.current)
      autoScrollRef.current = setInterval(() => {
        if (!userInteractedRef.current) {
          goToNext()
        }
      }, 2000)
    }

    startAutoScroll()

    return () => {
      if (autoScrollRef.current) clearInterval(autoScrollRef.current)
    }
  }, [goToNext])

  // Scroll active tab into view on mobile
  useEffect(() => {
    if (scrollContainerRef.current) {
      const activeBtn = scrollContainerRef.current.querySelector('[data-active="true"]') as HTMLElement
      if (activeBtn) {
        activeBtn.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" })
      }
    }
  }, [activeFeature])

  const handleTabClick = (feature: Feature) => {
    userInteractedRef.current = true
    setActiveFeature(feature)
    // Resume auto-scroll after 5 seconds
    setTimeout(() => { userInteractedRef.current = false }, 5000)
  }

  return (
    <section className="mt-8 py-16 px-4 sm:px-6 lg:px-8 relative">
      <div className="absolute inset-0 ">
        <img src="/2.webp" alt="stripes" className="absolute stripes" />
      </div>
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">Powerful Features</h2>
          <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Discover all the tools you need to enhance your YouTube experience
          </p>
        </div>

        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl border border-orange-200/50 dark:border-gray-700/50 overflow-hidden">
          {/* Desktop Tab Navigation */}
          <div className="hidden md:flex flex-wrap justify-center p-6 bg-gradient-to-r from-orange-100/50 to-red-100/50 dark:from-gray-700/50 dark:to-gray-600/50">
            <div className="flex flex-wrap gap-2 bg-white/60 dark:bg-gray-800/60 rounded-full p-2 backdrop-blur-sm">
              {features.map((feature) => {
                const IconComponent = iconMap[feature.icon as keyof typeof iconMap]
                return (
                  <button
                    key={feature.id}
                    onClick={() => setActiveFeature(feature)}
                    className={`px-6 py-3 rounded-full transition-all duration-300 flex items-center space-x-2 ${
                      activeFeature.id === feature.id
                        ? "bg-gradient-to-r from-orange-500 to-red-600 text-white shadow-lg transform scale-105"
                        : "text-gray-700 dark:text-gray-300 hover:bg-orange-100 dark:hover:bg-gray-700"
                    }`}
                  >
                    {IconComponent && <IconComponent className="w-6 h-6" />}
                    <span className="font-medium">{feature.title}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Mobile Tab Navigation - Horizontal scroll */}
          <div className="md:hidden p-3 bg-gradient-to-r from-orange-100/50 to-red-100/50 dark:from-gray-700/50 dark:to-gray-600/50">
            <div 
              ref={scrollContainerRef}
              className="flex gap-2 overflow-x-auto scrollbar-hide snap-x snap-mandatory pb-1"
              style={{ scrollbarWidth: "none", msOverflowStyle: "none", WebkitOverflowScrolling: "touch" }}
            >
              {features.map((feature) => {
                const IconComponent = iconMap[feature.icon as keyof typeof iconMap]
                return (
                  <button
                    key={feature.id}
                    data-active={activeFeature.id === feature.id}
                    onClick={() => handleTabClick(feature)}
                    className={`flex-shrink-0 snap-center px-4 py-2 rounded-full transition-all duration-300 flex items-center space-x-1.5 text-sm ${
                      activeFeature.id === feature.id
                        ? "bg-gradient-to-r from-orange-500 to-red-600 text-white shadow-lg"
                        : "bg-white/60 dark:bg-gray-800/60 text-gray-700 dark:text-gray-300"
                    }`}
                  >
                    {IconComponent && <IconComponent className="w-4 h-4" />}
                    <span className="font-medium whitespace-nowrap">{feature.title}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Content Area */}
          <div className="grid md:grid-cols-2 gap-8 p-6 md:p-8">
            <div className="space-y-4 md:space-y-6">
              <h3 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
                {activeFeature.content.title}
              </h3>
              <p className="text-base md:text-lg text-gray-600 dark:text-gray-300 leading-relaxed">
                {activeFeature.content.description}
              </p>
              <div className="space-y-3">
                {activeFeature.content.features.map((feature, index) => (
                  <div key={index} className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-gradient-to-r from-orange-500 to-red-600 rounded-full"></div>
                    <span className="text-gray-700 dark:text-gray-300">{feature}</span>
                  </div>
                ))}
              </div>
              <Button className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white"
                onClick={() => window.location.href = activeFeature.route}
              >
                Try {activeFeature.title}
              </Button>
            </div>
            <div className="relative hover:scale-110 transition-transform duration-300 cursor-pointer"
              onClick={() => window.location.href = activeFeature.route}
            >
              <Image
                src={`${activeFeature.image}?height=400&width=600`}
                alt={`${activeFeature.title} feature showcase`}
                width={600}
                height={400}
                className="rounded-lg shadow-lg object-cover w-full h-full"
                loading="lazy"
                placeholder="blur"
                blurDataURL="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAwIiBoZWlnaHQ9IjQwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjk3MzE2IiBvcGFjaXR5PSIwLjEiLz48L3N2Zz4="
              />
              <div className="absolute inset-0 bg-gradient-to-t from-orange-500/20 to-transparent rounded-lg"></div>
            </div>
          </div>
        </div>
      </div>
      <style jsx>{`
        .stripes {
          position: absolute;
          top: 670px;
          right: 0px;
          width: 590px;
          height: 590px;
        }
        @media (max-width: 1290px) {
          .stripes {
            top: 640px;
            right: 0px;
            width: 490px;
            height: 490px;
          }
        }
        @media (max-width: 1120px) {
          .stripes {
            top: 610px;
            right: 0px;
            width: 390px;
            height: 390px;
          }
        }
        @media (max-width: 740px) {
          .stripes {
            visibility: hidden;
          }
        }
      `}</style>
    </section>
  )
}
