import { Suspense } from "react"
import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import RouteTransitionOverlay from "@/components/ui/route-transition-overlay"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "YouTube Mate - Your Ultimate YouTube Companion",
  description: "Shorten URLs, generate transcripts, download videos, and collaborate on playlists with YouTube Mate.",
  icons: {
    icon: '/8.webp',
    apple: '/8.webp',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Preload critical assets */}
        <link rel="preload" href="/7.webp" as="image" type="image/webp" />
        <link rel="preload" href="/1.webp" as="image" type="image/webp" />
        <link rel="preload" href="/2.webp" as="image" type="image/webp" />
        <link rel="preload" href="/login.webp" as="image" type="image/webp" />
        <link rel="prefetch" href="/vidc.webm" as="video" type="video/webm" />
        <link rel="prefetch" href="/vid2c.webm" as="video" type="video/webm" />
        <link rel="preload" href="/loading/icons8-video-100.png" as="image" />
        <link rel="preload" href="/loading/icons8-crowd-100.png" as="image" />
        <link rel="preload" href="/loading/icons8-document-100.png" as="image" />
        <link rel="preload" href="/loading/icons8-link-100%20(1).png" as="image" />
        <link rel="preload" href="/loading/icons8-music-folder-100.png" as="image" />
        <link rel="preload" href="/loading/icons8-play-100%20(1).png" as="image" />
        <link rel="preload" href="/loading/icons8-popcorn-100.png" as="image" />
        <link rel="preload" href="/loading/icons8-video-playlist-100.png" as="image" />
        <link rel="preload" href="/loading/icons8-web-chat-100.png" as="image" />
        <link rel="preload" href="/loading/icons8-website-100%20(1).png" as="image" />
        <link rel="preload" href="/loading/icons8-youtube-100%20(1).png" as="image" />
        {/* <link rel="preload" href="/loading/icons8-scissors-100.png" as="image" /> */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  const savedDarkMode = localStorage.getItem('darkMode');
                  if (savedDarkMode === 'true') {
                    document.documentElement.classList.add('dark');
                    document.documentElement.style.colorScheme = 'dark';
                  } else if (savedDarkMode === 'false') {
                    document.documentElement.classList.remove('dark');
                    document.documentElement.style.colorScheme = 'light';
                  } else {
                    // Default to light mode for first-time users (instead of system preference)
                    document.documentElement.classList.remove('dark');
                    document.documentElement.style.colorScheme = 'light';
                    // Save the default preference
                    localStorage.setItem('darkMode', 'false');
                  }
                } catch (e) {
                  // Fallback to light mode if localStorage is not available
                  document.documentElement.classList.remove('dark');
                  document.documentElement.style.colorScheme = 'light';
                }
              })();
            `,
          }}
        />
      </head>
      <body className={inter.className} suppressHydrationWarning>
        <div className="loading-overlay boot-overlay is-visible" role="status" aria-live="polite" aria-label="Loading">
          <div className="loading-shell">
            <div className="loading-icon-frame">
              <img
                src="/loading/icons8-video-100.png"
                alt=""
                aria-hidden="true"
                data-no-reveal="true"
                className="loading-icon"
                width={80}
                height={80}
              />
            </div>
            <div className="loading-dots" aria-hidden="true">
              <span className="loading-dot" style={{ animationDelay: "0s" }} />
              <span className="loading-dot" style={{ animationDelay: "0.15s" }} />
              <span className="loading-dot" style={{ animationDelay: "0.3s" }} />
            </div>
            <span className="sr-only">Loading</span>
          </div>
        </div>
        <Suspense fallback={null}>
          <RouteTransitionOverlay />
        </Suspense>
        {children}
      </body>
    </html>
  )
}
