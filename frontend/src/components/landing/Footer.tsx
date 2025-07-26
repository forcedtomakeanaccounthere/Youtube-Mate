import { Play } from "lucide-react"

export default function Footer() {
  return (
    <footer className="bg-gray-900 dark:bg-gray-950 text-white py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="grid md:grid-cols-4 gap-8">
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Play className="w-8 h-8 text-orange-500" />
              <span className="text-xl font-bold">YouTube Mate</span>
            </div>
            <p className="text-gray-400">Your ultimate companion for YouTube content management and collaboration.</p>
          </div>
          <div>
            <h3 className="font-semibold mb-4 text-orange-500">Features</h3>
            <ul className="space-y-2 text-gray-400">
              <li>URL Shortener</li>
              <li>Transcript Generator</li>
              <li>Video Downloader</li>
              <li>Shared Playlists</li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold mb-4 text-orange-500">Support</h3>
            <ul className="space-y-2 text-gray-400">
              <li>Help Center</li>
              <li>Contact Us</li>
              <li>API Documentation</li>
              <li>Status Page</li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold mb-4 text-orange-500">Company</h3>
            <ul className="space-y-2 text-gray-400">
              <li>About Us</li>
              <li>Privacy Policy</li>
              <li>Terms of Service</li>
              <li>Blog</li>
            </ul>
          </div>
        </div>
        <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400">
          <p>© 2024 YouTube Mate. All rights reserved.</p>
          <p>Created by <a href="https://github.com/forcedtomakeanaccounthere/Youtube-Mate" target="_blank" >Abhishek Anand</a></p>
        </div>
      </div>
    </footer>
  )
}