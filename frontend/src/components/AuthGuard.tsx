"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

interface AuthGuardProps {
  children: React.ReactNode
  redirectTo?: string
  message?: string
}

export default function AuthGuard({ 
  children, 
  redirectTo = "/login", 
  message = "Login to access the playlist manager page" 
}: AuthGuardProps) {
  const router = useRouter()

  useEffect(() => {
    const token = localStorage.getItem("token")
    if (!token) {
      alert(message)
      router.push(redirectTo)
    }
  }, [router, redirectTo, message])

  // Check if user is authenticated
  const [token, setToken] = useState<string | null>(null)
  const [isChecking, setIsChecking] = useState(true)
  
  useEffect(() => {
    // Only access localStorage on the client side
    if (typeof window !== 'undefined') {
      const storedToken = localStorage.getItem("token")
      setToken(storedToken)
    }
    setIsChecking(false)
  }, [])

  if (isChecking) {
    // Show loading state while checking authentication
    return null
  }

  if (!token) {
    return null // Don't render anything while redirecting
  }

  return <>{children}</>
}
