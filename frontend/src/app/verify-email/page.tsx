"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Play, AlertCircle, CheckCircle, Loader2, Mail } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { API_BASE } from "@/lib/api"


function VerifyEmailPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [isResending, setIsResending] = useState(false)

  useEffect(() => {
    const token = searchParams.get("token")
    if (!token) {
      setError("Invalid verification link. Please check your email for the correct link.")
      setIsLoading(false)
      return
    }

    verifyEmail(token)
  }, [searchParams])

  const verifyEmail = async (token: string) => {
    console.log("Starting email verification with token:", token)
    
    try {
      console.log("Making API call to:", `/auth/verify-email`)
      
      const response = await fetch(`/auth/verify-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token }),
      })

      console.log("API Response status:", response.status)
      
      const data = await response.json()
      console.log("API Response data:", data)

      if (response.ok) {
        setSuccess("Email verified successfully! You can now access all features.")
        toast({
          title: "Email Verified!",
          description: "Your email has been successfully verified.",
        })

        // Redirect to login after 3 seconds
        setTimeout(() => {
          router.push("/login")
        }, 3000)
      } else {
        console.error("Verification failed:", data)
        setError(data.error || "Failed to verify email")
      }
    } catch (error) {
      console.error("Network error during verification:", error)
      setError("Network error. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const resendVerificationEmail = async () => {
    setIsResending(true)
    setError("")

    try {
      // Get user email from localStorage or prompt user
      const user = JSON.parse(localStorage.getItem("user") || "{}")
      if (!user.email) {
        setError("Unable to resend verification email. Please log in again.")
        setIsResending(false)
        return
      }

      const response = await fetch(`/auth/resend-verification`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: user.email }),
      })

      const data = await response.json()

      if (response.ok) {
        toast({
          title: "Verification Email Sent!",
          description: "Please check your email for the new verification link.",
        })
      } else {
        setError(data.error || "Failed to resend verification email")
      }
    } catch (error) {
      setError("Network error. Please try again.")
    } finally {
      setIsResending(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-red-50 to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-8">
      {/* Decorative background elements
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-orange-400/50 to-red-500/50 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-tr from-red-400/50 to-orange-500/50 rounded-full blur-3xl"></div>
      </div> */}

      <div className="w-full max-w-md relative z-10">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-6">
            <div className="p-3 bg-gradient-to-r from-orange-500 to-red-600 rounded-2xl shadow-lg">
              <Play className="w-8 h-8 text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent mb-2">
            Email Verification
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            {isLoading ? "Verifying your email address..." : "Email verification status"}
          </p>
        </div>

        {/* Verification Card */}
        <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl border-white/20 shadow-2xl">
          <CardContent className="p-8 text-center">
            {isLoading ? (
              <div className="space-y-4">
                <div className="flex justify-center">
                  <Loader2 className="w-12 h-12 text-orange-500 animate-spin" />
                </div>
                <p className="text-gray-600 dark:text-gray-300">Verifying your email address...</p>
              </div>
            ) : error ? (
              <div className="space-y-6">
                <Alert className="border-red-200 bg-red-50/80 backdrop-blur-sm dark:bg-red-900/20">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-red-600 dark:text-red-400">{error}</AlertDescription>
                </Alert>

                <div className="flex justify-center">
                  <Mail className="w-16 h-16 text-orange-500" />
                </div>

                <div className="space-y-4">
                  <p className="text-gray-600 dark:text-gray-300">
                    Having trouble with email verification? We can send you a new verification link.
                  </p>

                  <Button
                    onClick={resendVerificationEmail}
                    disabled={isResending}
                    className="w-full h-12 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-medium shadow-lg"
                  >
                    {isResending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      "Resend Verification Email"
                    )}
                  </Button>

                  <Link href="/login">
                    <Button
                      variant="ghost"
                      className="w-full h-12 text-gray-600 hover:text-gray-800 dark:text-gray-300 dark:hover:text-gray-100"
                    >
                      Back to Login
                    </Button>
                  </Link>
                </div>
              </div>
            ) : success ? (
              <div className="space-y-6">
                <Alert className="border-green-200 bg-green-50/80 backdrop-blur-sm dark:bg-green-900/20">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-600 dark:text-green-400">{success}</AlertDescription>
                </Alert>

                <div className="flex justify-center">
                  <CheckCircle className="w-16 h-16 text-green-500" />
                </div>

                <div className="space-y-4">
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Email Verified!</h2>
                  <p className="text-gray-600 dark:text-gray-300">
                    Your email has been successfully verified. You will be redirected to the login page shortly.
                  </p>

                  <Link href="/login">
                    <Button className="w-full h-12 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-medium shadow-lg">
                      Continue to Login
                    </Button>
                  </Link>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailPageContent />
    </Suspense>
  )
}
