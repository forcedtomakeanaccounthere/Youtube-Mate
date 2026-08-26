"use client"

import type React from "react"
import { useState, useEffect, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Play, Mail, AlertCircle, CheckCircle, Loader2 } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { API_BASE } from "@/lib/api"


function VerificationRequiredPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isResending, setIsResending] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [userEmail, setUserEmail] = useState("")

  useEffect(() => {
    // Get email from URL params or localStorage
    const email = searchParams.get("email") ||
      (() => {
        try {
          const user = JSON.parse(localStorage.getItem("user") || "{}")
          return user.email || ""
        } catch {
          return ""
        }
      })()

    setUserEmail(email)

    // If no email found, redirect to login
    if (!email) {
      router.push("/login")
    }
  }, [searchParams, router])

  const resendVerificationEmail = async () => {
    if (!userEmail) {
      setError("Unable to resend verification email. Please try registering again.")
      return
    }

    setIsResending(true)
    setError("")
    setSuccess("")

    try {
      const response = await fetch(`${API_BASE}/auth/resend-verification`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: userEmail }),
      })

      const data = await response.json()

      if (response.ok) {
        setSuccess("Verification email sent! Please check your inbox.")
        toast({
          title: "Verification Email Sent! 📧",
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

  const handleLoginRedirect = () => {
    // Clear any stored user data since they're not verified
    localStorage.removeItem("user")
    localStorage.removeItem("token")
    router.push("/login")
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-red-50 to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-8">
      <div className="w-full max-w-lg relative z-10">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-6">
            <div className="p-3 bg-gradient-to-r from-orange-500 to-red-600 rounded-2xl shadow-lg">
              <Play className="w-8 h-8 text-white" />
            </div>
            <h1 className="ml-5 text-3xl font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent mb-2">
              Email Verification Required
            </h1>
          </div>
          <p className="text-gray-600 dark:text-gray-300">
            Please verify your email to activate your account
          </p>
        </div>

        {/* Error/Success Messages */}
        {error && (
          <Alert className="mb-6 border-red-200 bg-red-50/80 backdrop-blur-sm dark:bg-red-900/20">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-600 dark:text-red-400">{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="mb-6 border-green-200 bg-green-50/80 backdrop-blur-sm dark:bg-green-900/20">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-600 dark:text-green-400">{success}</AlertDescription>
          </Alert>
        )}

        {/* Verification Required Card */}
        <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl border-white/20 shadow-2xl">
          <CardContent className="p-6 pt-0">
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <Mail className="w-16 h-16 text-orange-500" />
              </div>

              <div className="space-y-4">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Check Your Email
                </h2>

                <div className="space-y-3">
                  <p className="text-gray-600 dark:text-gray-300">
                    We've sent a verification link to:
                  </p>
                  <p className="font-semibold text-orange-600 bg-orange-50 dark:bg-orange-900/20 p-3 rounded-lg">
                    {userEmail}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Click the "Verify Email" button in the email to activate your account.
                  </p>
                </div>

                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-4">
                  <div className="">
                    <div className="flex">
                      <AlertCircle className="w-5 h-5 text-amber-600 mr-2 mt-0.2" />
                      <p className="font-medium text-sm text-amber-800 dark:text-amber-200">Important :</p>
                    </div>

                    <div className="text-sm text-amber-800 dark:text-amber-200">
                      <p className="mt-3">You cannot log in or use your account until your email is verified. This helps keep your account secure.</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 pt-4">
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
                      <>
                        <Mail className="w-4 h-4 mr-2" />
                        Resend Verification Email
                      </>
                    )}
                  </Button>

                  <Button
                    onClick={handleLoginRedirect}
                    variant="outline"
                    className="w-full h-12"
                  >
                    Back to Login
                  </Button>
                </div>

                <div className="text-xs text-gray-500 dark:text-gray-400 pt-2">
                  <p>Didn't receive the email? Check your spam folder or try resending.</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Additional Help */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Need help? Contact our{" "}
            <a href="mailto:abhishekanandvii@gmail.com" className="text-orange-600 hover:text-orange-500">
              support team
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}

export default function VerificationRequiredPage() {
  return (
    <Suspense fallback={null}>
      <VerificationRequiredPageContent />
    </Suspense>
  )
}
