"use client"

import { useEffect, useRef, useState } from "react"
import { gsap } from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"

gsap.registerPlugin(ScrollTrigger)

const DESKTOP_TOTAL_FRAMES = 240
const MOBILE_FRAME_COUNT = 91
const DESKTOP_FRAME_PATH = "/hero_frames/ezgif-frame-"
const MOBILE_FRAME_PATH = "/hero_frames_mobile/ezgif-frame-"

export default function ScrollCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [imagesLoaded, setImagesLoaded] = useState(false)
  const [loadProgress, setLoadProgress] = useState(0)
  const imagesRef = useRef<HTMLImageElement[]>([])
  const currentFrameRef = useRef(0)
  const isMobile = useRef(false)

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    // Detect mobile
    isMobile.current = window.innerWidth < 768
    
    // Desktop: Load every other frame (120 frames from 240 total)
    // Mobile: Load all 91 webp frames
    const frameStep = isMobile.current ? 1 : 2
    const totalFramesToLoad = isMobile.current ? MOBILE_FRAME_COUNT : Math.ceil(DESKTOP_TOTAL_FRAMES / 2)
    const framePath = isMobile.current ? MOBILE_FRAME_PATH : DESKTOP_FRAME_PATH
    const fileExtension = isMobile.current ? "webp" : "jpg"
    const fallbackFrame = isMobile.current ? "091" : "240"
    
    const ctx = canvas.getContext("2d", { alpha: false })
    if (!ctx) return

    // Set canvas size for retina displays
    const setCanvasSize = () => {
      const rect = container.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      
      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr
      canvas.style.width = `${rect.width}px`
      canvas.style.height = `${rect.height}px`
      
      ctx.scale(dpr, dpr)
      
      // Redraw current frame after resize
      if (imagesLoaded && imagesRef.current[currentFrameRef.current]) {
        drawFrame(currentFrameRef.current)
      }
    }

    // Draw a specific frame - COVER to fill entire canvas
    const drawFrame = (index: number) => {
      const img = imagesRef.current[index]
      if (!img || !img.complete) return

      const rect = container.getBoundingClientRect()
      ctx.clearRect(0, 0, rect.width, rect.height)

      // Calculate dimensions to COVER canvas (fill entire area, crop if needed)
      const canvasAspect = rect.width / rect.height
      const imgAspect = img.width / img.height

      let drawWidth, drawHeight, offsetX, offsetY

      if (canvasAspect > imgAspect) {
        // Canvas is wider - fit to width, crop height
        drawWidth = rect.width
        drawHeight = rect.width / imgAspect
        offsetX = 0
        offsetY = (rect.height - drawHeight) / 2
      } else {
        // Canvas is taller - fit to height, crop width
        drawHeight = rect.height
        drawWidth = rect.height * imgAspect
        offsetX = (rect.width - drawWidth) / 2
        offsetY = 0
      }

      ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight)
    }

    // Preload images
    const loadImages = async () => {
      const imagePromises: Promise<void>[] = []
      const loadedImages: HTMLImageElement[] = []
      let loadedCount = 0

      // Desktop: Load every other frame (1, 3, 5, ... 239)
      // Mobile: Load all frames (1-91)
      const maxFrame = isMobile.current ? MOBILE_FRAME_COUNT : DESKTOP_TOTAL_FRAMES
      
      for (let i = 1; i <= maxFrame; i += frameStep) {
        const img = new Image()
        const frameNumber = i.toString().padStart(3, "0")
        img.src = `${framePath}${frameNumber}.${fileExtension}`

        imagePromises.push(
          new Promise((resolve, reject) => {
            img.onload = () => {
              loadedCount++
              loadedImages.push(img)
              setLoadProgress(Math.round((loadedCount / totalFramesToLoad) * 100))
              resolve()
            }
            img.onerror = (e) => {
              console.warn(`Failed to load frame ${frameNumber}:`, e)
              resolve() // Don't reject, just skip this frame
            }
          })
        )
      }

      await Promise.all(imagePromises)

      if (loadedImages.length === 0) {
        console.error("No scroll frames could be loaded")
        // Load fallback image (last frame)
        const fallbackImg = new Image()
        fallbackImg.src = `${framePath}${fallbackFrame}.${fileExtension}`
        fallbackImg.onload = () => {
          imagesRef.current = [fallbackImg]
          setImagesLoaded(true)
          setCanvasSize()
          drawFrame(0)
        }
        return
      }

      imagesRef.current = loadedImages
      setImagesLoaded(true)
      setCanvasSize()
      drawFrame(0) // Draw first frame
    }

    loadImages()

    // Handle window resize
    const handleResize = () => {
      setCanvasSize()
    }
    window.addEventListener("resize", handleResize)

    return () => {
      window.removeEventListener("resize", handleResize)
    }
  }, [])

  useEffect(() => {
    if (!imagesLoaded || !containerRef.current || !canvasRef.current) return

    const container = containerRef.current
    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d", { alpha: false })
    if (!ctx) return

    const totalFrames = imagesRef.current.length
    const scrollDistance = isMobile.current ? "+=200%" : "+=250%"

    // Draw a specific frame
    const drawFrame = (index: number) => {
      const img = imagesRef.current[index]
      if (!img || !img.complete) return

      const rect = container.getBoundingClientRect()
      ctx.clearRect(0, 0, rect.width, rect.height)

      // COVER - fill entire canvas
      const canvasAspect = rect.width / rect.height
      const imgAspect = img.width / img.height

      let drawWidth, drawHeight, offsetX, offsetY

      if (canvasAspect > imgAspect) {
        drawWidth = rect.width
        drawHeight = rect.width / imgAspect
        offsetX = 0
        offsetY = (rect.height - drawHeight) / 2
      } else {
        drawHeight = rect.height
        drawWidth = rect.height * imgAspect
        offsetX = (rect.width - drawWidth) / 2
        offsetY = 0
      }

      ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight)
    }

    // GSAP ScrollTrigger with smooth pin/unpin transitions
    const trigger = ScrollTrigger.create({
      trigger: container,
      start: "top top",
      end: scrollDistance,
      scrub: 1, // Slight delay (1 second) makes pin transitions smoother
      pin: true,
      pinSpacing: true, // Ensures smooth spacing transitions
      anticipatePin: 1,
      invalidateOnRefresh: true,
      onUpdate: (self) => {
        // Direct linear mapping with proper clamping
        const rawIndex = self.progress * (totalFrames - 1)
        const frameIndex = Math.round(rawIndex) // Round to nearest frame
        const clampedIndex = Math.max(0, Math.min(frameIndex, totalFrames - 1))
        
        if (clampedIndex !== currentFrameRef.current) {
          currentFrameRef.current = clampedIndex
          drawFrame(clampedIndex)
        }
      },
    })

    return () => {
      trigger.kill()
    }
  }, [imagesLoaded])

  return (
    <section className="w-full relative">
      <div className="container mx-auto px-4 max-w-7xl">
        <div
          ref={containerRef}
          className="relative w-full h-screen overflow-hidden will-change-transform"
        >
          <canvas
            ref={canvasRef}
            className="w-full h-full"
          />
          
          {/* Loading indicator */}
          {!imagesLoaded && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-orange-50 to-red-50 dark:bg-gray-900">
              <div className="w-64 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mb-4">
                <div
                  className="h-full bg-gradient-to-r from-orange-500 to-red-600 transition-all duration-300"
                  style={{ width: `${loadProgress}%` }}
                />
              </div>
              <p className="text-gray-800 dark:text-white text-lg font-medium">
                Loading Experience... {loadProgress}%
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
