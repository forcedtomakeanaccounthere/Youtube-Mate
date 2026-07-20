"use client"

import { useEffect, useState } from "react"

const ICON_PATHS = [
  "/loading/icons8-crowd-100.png",
  "/loading/icons8-document-100.png",
  "/loading/icons8-link-100 (1).png",
  "/loading/icons8-music-folder-100.png",
  "/loading/icons8-play-100 (1).png",
  "/loading/icons8-popcorn-100.png",
//   "/loading/icons8-scissors-100.png",
  "/loading/icons8-video-100.png",
  "/loading/icons8-video-playlist-100.png",
  "/loading/icons8-web-chat-100.png",
  "/loading/icons8-website-100 (1).png",
  "/loading/icons8-youtube-100 (1).png",
]

type LoadingScreenProps = {
  label?: string
  className?: string
  isActive?: boolean
}

export default function LoadingScreen({
  label = "Loading",
  className,
  isActive = true,
}: LoadingScreenProps) {
  // Start with a deterministic index to avoid SSR/client hydration mismatches.
  const [iconIndex, setIconIndex] = useState<number>(0)
  const [imagesReady, setImagesReady] = useState<boolean>(false)

  useEffect(() => {
    // Prefetch icons on mount (client-side) and pick a random starting icon once a few have loaded.
    let mounted = true
    if (typeof window !== "undefined") {
      let loaded = 0
      const minToStart = Math.min(3, ICON_PATHS.length)
      const imgs: HTMLImageElement[] = []

      ICON_PATHS.forEach((path) => {
        const image = new Image()
        image.src = path
        image.onload = () => {
          loaded += 1
          if (mounted && !imagesReady && loaded >= minToStart) {
            setImagesReady(true)
            setIconIndex(Math.floor(Math.random() * ICON_PATHS.length))
          }
        }
        imgs.push(image)
      })

      return () => {
        mounted = false
        imgs.forEach((img) => {
          img.onload = null
        })
      }
    }
  }, [])

  useEffect(() => {
    if (typeof window === "undefined" || !isActive || !imagesReady) {
      return
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return
    }

    const interval = 360 // ms - a bit slower for visibility
    const intervalId = window.setInterval(() => {
      setIconIndex((prev) => {
        if (ICON_PATHS.length < 2) return prev

        let next = Math.floor(Math.random() * ICON_PATHS.length)
        if (next === prev) next = (prev + 1) % ICON_PATHS.length
        return next
      })
    }, interval)

    return () => window.clearInterval(intervalId)
  }, [isActive, imagesReady])

  const iconSrc = ICON_PATHS[iconIndex] ?? ICON_PATHS[0]

  return (
    <div
      className={`loading-overlay${className ? ` ${className}` : ""}`}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <div className="loading-shell">
        <div className="loading-icon-frame">
          <img
            key={iconSrc}
            src={iconSrc}
            alt=""
            aria-hidden="true"
            data-no-reveal="true"
            className="loading-icon"
            width={180}
            height={180}
          />
        </div>
        <div className="loading-dots" aria-hidden="true">
          <span className="loading-dot" style={{ animationDelay: "0s" }} />
          <span className="loading-dot" style={{ animationDelay: "0.15s" }} />
          <span className="loading-dot" style={{ animationDelay: "0.3s" }} />
        </div>
        <span className="sr-only">{label}</span>
      </div>
    </div>
  )
}
