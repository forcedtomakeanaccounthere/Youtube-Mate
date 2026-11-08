import { useState, useEffect, useRef, useCallback } from 'react'
import { flushSync } from 'react-dom'

// Module-level guard to prevent concurrent transitions across multiple hooks or rapid clicks
let isGlobalTransitioning = false

export function useDarkMode() {
  const [darkMode, setDarkMode] = useState(false)
  const [mounted, setMounted] = useState(false)
  const isTransitioningRef = useRef(false)

  useEffect(() => {
    setMounted(true)
    // Sync React state with the class that was already applied by the inline script
    const isDark = document.documentElement.classList.contains('dark')
    setDarkMode(isDark)

    // Keep all useDarkMode hook instances across the app synchronized
    const handleThemeChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ darkMode: boolean }>
      if (customEvent.detail && typeof customEvent.detail.darkMode === 'boolean') {
        setDarkMode(customEvent.detail.darkMode)
      } else {
        setDarkMode(document.documentElement.classList.contains('dark'))
      }
    }

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'darkMode') {
        const isDark = e.newValue === 'true'
        setDarkMode(isDark)
        document.documentElement.classList.toggle('dark', isDark)
        document.documentElement.style.colorScheme = isDark ? 'dark' : 'light'
      }
    }

    window.addEventListener('theme-change', handleThemeChange)
    window.addEventListener('storage', handleStorageChange)

    return () => {
      window.removeEventListener('theme-change', handleThemeChange)
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [])

  const toggleDarkMode = useCallback(
    async (event?: React.MouseEvent<HTMLElement> | MouseEvent) => {
      if (!mounted) return

      // Guard: prevent glitching from rapid repeated clicks while an animation is currently running
      if (isTransitioningRef.current || isGlobalTransitioning) {
        return
      }

      const nextDarkMode = !document.documentElement.classList.contains('dark')

      const applyTheme = (next: boolean) => {
        setDarkMode(next)
        document.documentElement.classList.toggle('dark', next)
        document.documentElement.style.colorScheme = next ? 'dark' : 'light'
        try {
          localStorage.setItem('darkMode', next.toString())
        } catch {
          // Ignore localStorage errors (e.g. private mode restrictions)
        }
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('theme-change', { detail: { darkMode: next } })
          )
        }
      }

      // Check support for View Transitions and prefers-reduced-motion
      const hasViewTransition =
        typeof document !== 'undefined' &&
        'startViewTransition' in document &&
        typeof (document as any).startViewTransition === 'function'

      const prefersReducedMotion =
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches

      // Fallback: toggle theme instantly without animation
      if (!hasViewTransition || prefersReducedMotion) {
        applyTheme(nextDarkMode)
        return
      }

      // 1. Origin & Radius Calculation
      let x: number
      let y: number

      const target = (event?.currentTarget || event?.target) as HTMLElement | null
      const isKeyboardClick = event && event.clientX === 0 && event.clientY === 0

      if (
        event &&
        !isKeyboardClick &&
        typeof event.clientX === 'number' &&
        typeof event.clientY === 'number'
      ) {
        x = event.clientX
        y = event.clientY
      } else if (target && typeof target.getBoundingClientRect === 'function') {
        const rect = target.getBoundingClientRect()
        x = rect.left + rect.width / 2
        y = rect.top + rect.height / 2
      } else if (
        typeof document !== 'undefined' &&
        document.activeElement &&
        document.activeElement !== document.body
      ) {
        const rect = (document.activeElement as HTMLElement).getBoundingClientRect()
        if (rect.width > 0 || rect.height > 0) {
          x = rect.left + rect.width / 2
          y = rect.top + rect.height / 2
        } else {
          x = typeof window !== 'undefined' ? window.innerWidth - 40 : 40
          y = 40
        }
      } else {
        x = typeof window !== 'undefined' ? window.innerWidth - 40 : 40
        y = 40
      }

      // Fallback if coordinates are invalid or NaN
      if (isNaN(x) || isNaN(y)) {
        x = typeof window !== 'undefined' ? window.innerWidth - 40 : 40
        y = 40
      }

      // Calculate the maximum radius to ensure the circle covers the furthest corner of the viewport
      const endRadius = Math.hypot(
        Math.max(x, window.innerWidth - x),
        Math.max(y, window.innerHeight - y)
      )

      isTransitioningRef.current = true
      isGlobalTransitioning = true

      // Temporarily disable CSS transitions on the DOM so elements with background/color transitions
      // don't get captured mid-fade
      document.documentElement.classList.add('theme-transitioning')

      let transition: any
      try {
        transition = (document as any).startViewTransition(() => {
          flushSync(() => {
            applyTheme(nextDarkMode)
          })
        })

        // Wait for the pseudo-element tree to be ready
        await transition.ready

        // Animate circular clipPath on ::view-transition-new(root)
        const animation = document.documentElement.animate(
          {
            clipPath: [
              `circle(0px at ${x}px ${y}px)`,
              `circle(${endRadius}px at ${x}px ${y}px)`,
            ],
          },
          {
            duration: 700,
            easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
            pseudoElement: '::view-transition-new(root)',
          }
        )

        await animation.finished
      } catch (error) {
        console.warn('View transition animation error/abort:', error)
      } finally {
        if (transition && transition.finished) {
          try {
            await transition.finished
          } catch {
            // Ignore if transition was skipped or aborted
          }
        }
        document.documentElement.classList.remove('theme-transitioning')
        isTransitioningRef.current = false
        isGlobalTransitioning = false
      }
    },
    [mounted]
  )

  return {
    darkMode: mounted ? darkMode : false,
    toggleDarkMode,
    mounted,
  }
}
