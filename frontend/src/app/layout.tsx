import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import DevAuthHelper from "@/components/DevAuthHelper"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "YouTube Mate - Your Ultimate YouTube Companion",
  description: "Shorten URLs, generate transcripts, download videos, and collaborate on playlists with YouTube Mate.",
  icons: {
    icon: '/5.png',
    apple: '/5.png',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className} suppressHydrationWarning>
        <DevAuthHelper />
        {children}
      </body>
    </html>
  )
}