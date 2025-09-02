"use client"

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { CheckCircle, ArrowRight, Loader2 } from 'lucide-react'
import Navbar from '@/components/landing/Navbar'
import featuresData from '@/data/features.json'
import { Feature } from '@/types/features'
import { useDarkMode } from '@/hooks/use-dark-mode'

const features: Feature[] = featuresData

interface PaymentStatus {
  status: string
  customer_email: string
  metadata: {
    userId: string
    planId: string
    email: string
  }
  subscription_id: string
}

export default function SuccessPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const sessionId = searchParams.get('session_id')
  
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Navbar state
  const [activeFeature, setActiveFeature] = useState(features[0])
  const [showNavbar, setShowNavbar] = useState(true)
  const { darkMode, toggleDarkMode, mounted } = useDarkMode()

  useEffect(() => {
    if (sessionId) {
      verifyPayment()
    } else {
      setError('No session ID provided')
      setLoading(false)
    }
  }, [sessionId])

  const verifyPayment = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'}/stripe/verify-session/${sessionId}`)
      
      if (!response.ok) {
        throw new Error('Failed to verify payment')
      }
      
      const data = await response.json()
      setPaymentStatus(data)
    } catch (err) {
      setError('Failed to verify payment. Please contact support.')
    } finally {
      setLoading(false)
    }
  }

  const getPlanDisplayName = (planId: string) => {
    switch (planId) {
      case 'pro':
        return 'Pro Plan'
      case 'exclusive':
        return 'Exclusive Plan'
      default:
        return 'Plan'
    }
  }

  // Don't render anything that depends on darkMode until mounted
  if (!mounted) {
    return <div className="min-h-screen" />
  }

  return (
    <div className={`min-h-screen transition-colors duration-300 ${darkMode ? "dark bg-gradient-to-br from-gray-900 dark:to-gray-800" : "bg-gradient-to-br from-orange-50 to-red-50"}`}>
      <Navbar
        showNavbar={showNavbar}
        features={features}
        setActiveFeature={setActiveFeature}
        darkMode={darkMode}
        toggleDarkMode={toggleDarkMode}
      />
      
      <div className="container mx-auto px-4 pt-20 pb-20">
        <div className="max-w-2xl mx-auto text-center">
          {loading ? (
            <div className="flex flex-col items-center space-y-4">
              <Loader2 className="w-12 h-12 animate-spin text-orange-600" />
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Verifying your payment...
              </h1>
              <p className="text-gray-600 dark:text-gray-300">
                Please wait while we confirm your subscription.
              </p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center space-y-4">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                <span className="text-red-600 text-2xl">✕</span>
              </div>
              <h1 className="text-3xl font-bold text-red-600">Payment Error</h1>
              <p className="text-lg text-gray-600 dark:text-gray-300 mb-6">
                {error}
              </p>
              <Button
                onClick={() => router.push('/subscription')}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                Try Again
              </Button>
            </div>
          ) : paymentStatus?.status === 'paid' ? (
            <div className="flex flex-col items-center space-y-6">
              <CheckCircle className="w-20 h-20 text-green-500" />
              
              <div className="space-y-2">
                <h1 className="text-4xl font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">
                  Payment Successful!
                </h1>
                <p className="text-xl text-gray-600 dark:text-gray-300">
                  Welcome to {getPlanDisplayName(paymentStatus.metadata.planId)}
                </p>
              </div>

              <div
                className="w-full max-w-md p-6 rounded-2xl border"
                style={{
                  background: "linear-gradient(135deg, rgba(255,255,255,0.25) 0%, rgba(255,255,255,0.1) 100%)",
                  backdropFilter: "blur(20px)",
                  border: "1px solid rgba(255,255,255,0.2)",
                  boxShadow: "0 25px 50px rgba(251, 146, 60, 0.1)",
                }}
              >
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Subscription Details
                </h3>
                <div className="space-y-3 text-left">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-300">Plan:</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {getPlanDisplayName(paymentStatus.metadata.planId)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-300">Email:</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {paymentStatus.customer_email}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-300">Status:</span>
                    <span className="font-medium text-orange-600">
                      Active
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <p className="text-gray-600 dark:text-gray-300">
                  Your subscription is now active! You can start enjoying all the premium features.
                </p>
                
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Button
                    onClick={() => router.push('/')}
                    className="bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white"
                  >
                    Go to Homepage
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                  
                  <Button
                    variant="outline"
                    onClick={() => {
                      // Force a complete page refresh to get updated user data
                      window.location.href = '/subscription'
                    }}
                    className="border-orange-200 text-orange-700 hover:bg-orange-50 dark:border-orange-700 dark:text-orange-300 dark:hover:bg-orange-900"
                  >
                    View Subscription
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center space-y-4">
              <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center">
                <span className="text-yellow-600 text-2xl">⚠</span>
              </div>
              <h1 className="text-3xl font-bold text-yellow-600">Payment Pending</h1>
              <p className="text-lg text-gray-600 dark:text-gray-300 mb-6">
                Your payment is being processed. Please check back in a few minutes.
              </p>
              <Button
                onClick={() => window.location.reload()}
                className="bg-yellow-600 hover:bg-yellow-700 text-white"
              >
                Refresh Page
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
