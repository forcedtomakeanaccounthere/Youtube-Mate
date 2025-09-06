import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "YouTube Mate - Your Ultimate YouTube Companion",
  description: "Shorten URLs, generate transcripts, download videos, and collaborate on playlists with YouTube Mate.",
  icons: {
    icon: '/8.png',
    apple: '/8.png',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
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
        {children}
      </body>
    </html>
  )
}
