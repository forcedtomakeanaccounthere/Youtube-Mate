"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { LogIn, Lock } from "lucide-react"

interface AuthGuardProps {
  children: React.ReactNode
  redirectTo?: string
  message?: string
  title?: string
}

export default function AuthGuard({ 
  children, 
  redirectTo = "/login", 
  message = "You need to be logged in to access this feature. Please log in to continue.",
  title = "Authentication Required"
}: AuthGuardProps) {
  const router = useRouter()
  const [token, setToken] = useState<string | null>(null)
  const [isChecking, setIsChecking] = useState(true)
  const [showModal, setShowModal] = useState(false)

  useEffect(() => {
    // Only access localStorage on the client side
    if (typeof window !== 'undefined') {
      const storedToken = localStorage.getItem("token")
      setToken(storedToken)
      
      if (!storedToken) {
        setShowModal(true)
      }
    }
    setIsChecking(false)
  }, [])

  const handleLogin = () => {
    setShowModal(false)
    router.push(redirectTo)
  }

  if (isChecking) {
    // Show loading state while checking authentication
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-orange-500"></div>
      </div>
    )
  }

  if (!token) {
    return (
      <div className="min-h-screen relative">
        {/* Blurred background login page */}
        <div className="absolute inset-0 bg-gradient-to-br from-orange-50 to-red-50 dark:from-gray-900 dark:to-gray-800 blur-sm" />
        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
          <div className="text-center text-white space-y-4 blur-sm">
            <Lock className="w-24 h-24 mx-auto opacity-50" />
            <h1 className="text-4xl font-bold">Protected Content</h1>
            <p className="text-xl">Please log in to access this page</p>
          </div>
        </div>

        {/* Modal */}
        <Dialog open={showModal} onOpenChange={setShowModal}>
          <DialogContent className="max-w-[525px] max-h-[600px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 pb-3">
                <Lock className="w-5 h-5 text-orange-500" />
                {title}
              </DialogTitle>
              <DialogDescription className="text-left mt-4">
                {message}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button 
                onClick={handleLogin}
                className="w-full bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white"
              >
                <LogIn className="w-4 h-4 mr-2" />
                Go to Login
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  return <>{children}</>
}
