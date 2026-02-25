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
import { Crown, Star } from "lucide-react"

interface PremiumGuardProps {
  isOpen: boolean
  onClose: () => void
  feature?: string
  title?: string
  message?: string
}

export default function PremiumGuard({ 
  isOpen,
  onClose,
  feature = "this feature",
  title = "Premium Feature",
  message = "This is a premium feature. Subscribe to access unlimited downloads and advanced features."
}: PremiumGuardProps) {
  const router = useRouter()

  // Only show in production mode
  const isProduction = process.env.NODE_ENV === 'production'

  const handleSubscribe = () => {
    onClose()
    router.push("/subscription")
  }

  const handleClose = () => {
    onClose()
  }

  // Don't show anything in development mode
  if (!isProduction) {
    return null
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-[525px] max-h-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 pb-3">
            <Crown className="w-5 h-5 text-orange-500" />
            {title}
          </DialogTitle>
          <DialogDescription className="text-left mt-4">
            <div className="space-y-4">
              <p>{message}</p>
              
              <div className="bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 p-4 rounded-lg border border-orange-200 dark:border-orange-800">
                <h4 className="font-semibold text-orange-800 dark:text-orange-200 mb-2 flex items-center gap-2">
                  <Star className="w-4 h-4" />
                  Premium Benefits
                </h4>
                <ul className="text-sm text-orange-700 dark:text-orange-300 space-y-1">
                  <li>• Unlimited downloads</li>
                  <li>• High quality formats (up to 4K)</li>
                  <li>• Bulk playlist downloads</li>
                  <li>• Advanced audio extraction</li>
                  <li>• Priority support</li>
                </ul>
              </div>
            </div>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex flex-col sm:flex-row gap-2">
          <Button 
            variant="outline"
            onClick={handleClose}
            className="order-2 sm:order-1"
          >
            Maybe Later
          </Button>
          <Button 
            onClick={handleSubscribe}
            className="order-1 sm:order-2 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white"
          >
            <Crown className="w-4 h-4 mr-2" />
            View Subscription Plans
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Hook for premium feature checking
export function usePremiumGuard() {
  const [showPremiumModal, setShowPremiumModal] = useState(false)

  const checkPremiumFeature = (callback?: () => void) => {
    // Only check in production mode
    if (process.env.NODE_ENV === 'production') {
      setShowPremiumModal(true)
      return false // Block the action
    } else {
      // In development, allow the action
      if (callback) callback()
      return true // Allow the action
    }
  }

  const closePremiumModal = () => {
    setShowPremiumModal(false)
  }

  return {
    showPremiumModal,
    checkPremiumFeature,
    closePremiumModal
  }
}