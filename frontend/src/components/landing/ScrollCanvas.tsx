"use client"

import { useEffect, useRef, useState } from "react"
import { gsap } from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"

gsap.registerPlugin(ScrollTrigger)

const DESKTOP_FRAME_COUNT = 151
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
    
    const frameCount = isMobile.current ? MOBILE_FRAME_COUNT : DESKTOP_FRAME_COUNT
    const framePath = isMobile.current ? MOBILE_FRAME_PATH : DESKTOP_FRAME_PATH
    
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

    // Preload all images
    const loadImages = async () => {
      const imagePromises: Promise<boolean>[] = []
      let completedCount = 0
      const loadedImages: HTMLImageElement[] = []

      for (let i = 1; i <= frameCount; i++) {
        const img = new Image()
        const frameNumber = i.toString().padStart(3, "0")
        img.src = `${framePath}${frameNumber}.jpg`

        imagePromises.push(
          new Promise((resolve) => {
            img.onload = () => {
              loadedImages.push(img)
              completedCount++
              setLoadProgress(Math.round((completedCount / frameCount) * 100))
              resolve(true)
            }
            img.onerror = () => {
              completedCount++
              setLoadProgress(Math.round((completedCount / frameCount) * 100))
              resolve(false)
            }
          })
        )
      }

      await Promise.all(imagePromises)

      if (loadedImages.length === 0) {
        console.error("No scroll frames could be loaded")
        return
      }

      imagesRef.current = loadedImages
      setImagesLoaded(true)
      setCanvasSize()
      drawFrame(0)
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
    const scrollDistance = isMobile.current ? "+=200%" : "+=300%"

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

    // GSAP ScrollTrigger with direct frame mapping
    const trigger = ScrollTrigger.create({
      trigger: container,
      start: "top top",
      end: scrollDistance,
      scrub: 0.5,
      pin: true,
      onUpdate: (self) => {
        // Direct linear mapping: progress 0-1 maps to frames 0 to totalFrames-1
        const frameIndex = Math.min(
          Math.floor(self.progress * totalFrames),
          totalFrames - 1
        )
        
        if (frameIndex !== currentFrameRef.current) {
          currentFrameRef.current = frameIndex
          drawFrame(frameIndex)
        }
      },
    })

    return () => {
      trigger.kill()
    }
  }, [imagesLoaded])

  return (
    <section className="w-full">
      <div className="container mx-auto px-4 max-w-7xl">
        <div
          ref={containerRef}
          className="relative w-full h-screen overflow-hidden"
        >
          <canvas
            ref={canvasRef}
            className="w-full h-full pt-8"
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
