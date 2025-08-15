import { useState, useEffect } from 'react'

export function useDarkMode() {
  const [darkMode, setDarkMode] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    // Sync React state with the class that was already applied by the script
    const isDark = document.documentElement.classList.contains('dark')
    setDarkMode(isDark)
  }, [])

  const toggleDarkMode = () => {
    if (!mounted) return

    const newDarkMode = !darkMode
    setDarkMode(newDarkMode)
    
    if (newDarkMode) {
      document.documentElement.classList.add('dark')
      document.documentElement.style.colorScheme = 'dark'
    } else {
      document.documentElement.classList.remove('dark')
      document.documentElement.style.colorScheme = 'light'
    }
    
    // Save preference to localStorage
    localStorage.setItem('darkMode', newDarkMode.toString())
  }

  // Return the current dark mode state, but only after mounting
  // This prevents hydration mismatches
  return {
    darkMode: mounted ? darkMode : false,
    toggleDarkMode,
    mounted
  }
}
