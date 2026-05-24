"use client"

import { useEffect, useRef, useState } from "react"
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

  const clearTimers = () => {
    if (hideTimeoutRef.current !== null) {
      window.clearTimeout(hideTimeoutRef.current)
      hideTimeoutRef.current = null
    }
    if (fadeTimeoutRef.current !== null) {
      window.clearTimeout(fadeTimeoutRef.current)
      fadeTimeoutRef.current = null
    }
  }

  const show = () => {
    clearTimers()
    startTimeRef.current = Date.now()
    setVisible(true)
    setActive(true)
  }

  const scheduleHide = () => {
    const elapsed = Date.now() - startTimeRef.current
    const remaining = Math.max(MIN_VISIBLE_MS - elapsed, 0)

    clearTimers()
    hideTimeoutRef.current = window.setTimeout(() => {
      setActive(false)
      fadeTimeoutRef.current = window.setTimeout(() => {
        setVisible(false)
      }, FADE_OUT_MS)
    }, remaining)
  }

  useEffect(() => {
    document.documentElement.classList.add("app-loaded")
  }, [])

  useEffect(() => {
    const initialTimer = window.setTimeout(() => {
      scheduleHide()
    }, INITIAL_HIDE_DELAY_MS)

    return () => window.clearTimeout(initialTimer)
  }, [])

  useEffect(() => {
    const currentUrl = `${pathname}?${searchParams.toString()}`

    if (lastUrlRef.current && lastUrlRef.current !== currentUrl) {
      scheduleHide()
    }

    lastUrlRef.current = currentUrl
  }, [pathname, searchParams])

  useEffect(() => {
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

      show()
    }

    const handlePopState = () => {
      show()
    }

    document.addEventListener("click", handleClick, true)
    window.addEventListener("popstate", handlePopState)

    return () => {
      document.removeEventListener("click", handleClick, true)
      window.removeEventListener("popstate", handlePopState)
    }
  }, [])

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
