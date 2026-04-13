"use client"

import { Suspense } from "react"
import { Loader2 } from "lucide-react"
import { usePathname } from "next/navigation"
import AuthGuard from "@/components/AuthGuard"
import { StreamPageContent } from "../../page"

export default function LiveStreamPage() {
  const pathname = usePathname()

  return (
    <AuthGuard
      redirectTo={`/login?redirect=${encodeURIComponent(pathname || "/stream")}`}
      title="Login Required"
      message="You need to be logged in to join this live stream."
    >
      <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-orange-500" /></div>}>
        <StreamPageContent />
      </Suspense>
    </AuthGuard>
  )
}
