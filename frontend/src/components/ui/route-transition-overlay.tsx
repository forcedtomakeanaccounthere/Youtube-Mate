"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import LoadingScreen from "./loading-screen"

const MIN_VISIBLE_MS = 350
const FADE_OUT_MS = 220
const INITIAL_HIDE_DELAY_MS = 300

export default function RouteTransitionOverlay() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [active, setActive] = useState(true)
  const [visible, setVisible] = useState(true)
  const startTimeRef = useRef<number>(Date.now())
  const hideTimeoutRef = useRef<number | null>(null)
  const fadeTimeoutRef = useRef<number | null>(null)
  const lastUrlRef = useRef<string>("")

  const clearTimers = useCallback(() => {
    if (hideTimeoutRef.current !== null) {
      window.clearTimeout(hideTimeoutRef.current)
      hideTimeoutRef.current = null
    }
    if (fadeTimeoutRef.current !== null) {
      window.clearTimeout(fadeTimeoutRef.current)
      fadeTimeoutRef.current = null
    }
  }, [])

  const scheduleHide = useCallback(() => {
    const elapsed = Date.now() - startTimeRef.current
    const remaining = Math.max(MIN_VISIBLE_MS - elapsed, 0)

    clearTimers()
    hideTimeoutRef.current = window.setTimeout(() => {
      setActive(false)
      fadeTimeoutRef.current = window.setTimeout(() => {
        setVisible(false)
      }, FADE_OUT_MS)
    }, remaining)
  }, [clearTimers])

  const show = useCallback(() => {
    clearTimers()
    startTimeRef.current = Date.now()
    setVisible(true)
    setActive(true)
  }, [clearTimers])

  useEffect(() => {
    document.documentElement.classList.add("app-loaded")
  }, [])

  useEffect(() => {
    const initialTimer = window.setTimeout(() => {
      scheduleHide()
    }, INITIAL_HIDE_DELAY_MS)

    return () => window.clearTimeout(initialTimer)
  }, [scheduleHide])

  useEffect(() => {
    const currentUrl = `${pathname}?${searchParams.toString()}`

    // Always hide when pathname/searchParams change (navigation completed)
    if (lastUrlRef.current !== currentUrl) {
      scheduleHide()
    }

    lastUrlRef.current = currentUrl
  }, [pathname, searchParams, scheduleHide])

  useEffect(() => {
    const safetyTimeoutRef = { current: null as number | null }

    const handleClick = (event: MouseEvent) => {
      if (event.defaultPrevented) {
        return
      }

      const target = event.target as HTMLElement | null
      const anchor = target?.closest("a")

      if (!anchor) {
        return
      }

      if (anchor.getAttribute("data-no-loading") === "true") {
        return
      }

      if (anchor.target && anchor.target !== "_self") {
        return
      }

      if (anchor.hasAttribute("download")) {
        return
      }

      const href = anchor.getAttribute("href")
      if (!href || href.startsWith("#")) {
        return
      }

      let nextUrl: URL
      try {
        nextUrl = new URL(href, window.location.href)
      } catch {
        return
      }

      if (nextUrl.origin !== window.location.origin) {
        return
      }

      const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`
      const targetUrl = `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`
      if (currentUrl === targetUrl) {
        return
      }

      // Clear any existing safety timeout
      if (safetyTimeoutRef.current !== null) {
        window.clearTimeout(safetyTimeoutRef.current)
      }

      show()
    }

    const handlePopState = () => {
      // Clear any existing safety timeout
      if (safetyTimeoutRef.current !== null) {
        window.clearTimeout(safetyTimeoutRef.current)
      }

      show()
      
      // Safety timeout: force hide after max time if navigation seems stuck
      safetyTimeoutRef.current = window.setTimeout(() => {
        scheduleHide()
      }, 1500) // 1.5 seconds max for back/forward navigation
    }

    document.addEventListener("click", handleClick, true)
    window.addEventListener("popstate", handlePopState)

    return () => {
      document.removeEventListener("click", handleClick, true)
      window.removeEventListener("popstate", handlePopState)
      
      // Clean up safety timeout on unmount
      if (safetyTimeoutRef.current !== null) {
        window.clearTimeout(safetyTimeoutRef.current)
      }
    }
  }, [show, scheduleHide])

  if (!visible) {
    return null
  }

  return (
    <LoadingScreen
      label="Loading"
      isActive={active}
      className={`route-overlay ${active ? "is-visible" : "is-hidden"}`}
    />
  )
}
