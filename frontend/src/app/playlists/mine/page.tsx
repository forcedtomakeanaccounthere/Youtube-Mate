"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function MinePage() {
  const router = useRouter()

  useEffect(() => {
    // Redirect to main playlists page with mine tab active
    router.replace("/playlists?tab=mine")
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <p className="text-gray-600 dark:text-gray-400">Redirecting to My Playlists...</p>
      </div>
    </div>
  )
}
