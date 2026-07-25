"use client"

import { useState, useEffect } from "react"
import { Shield, Lock, Eye, Database, UserCheck, FileText, Bell, Trash2 } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import Navbar from "@/components/landing/Navbar"
import Footer from "@/components/landing/Footer"
import featuresData from "@/data/features.json"
import { Feature } from "@/types/features"
import { useDarkMode } from "@/hooks/use-dark-mode"

const features: Feature[] = featuresData

export default function PrivacyPolicyPage() {
  const [activeFeature, setActiveFeature] = useState<Feature | null>(null)
  const [showNavbar, setShowNavbar] = useState(true)
  const { darkMode, toggleDarkMode, mounted } = useDarkMode()

  useEffect(() => {
    if (features.length > 0) {
      setActiveFeature(features[0])
    }
  }, [])

  if (!mounted) {
    return <div className="min-h-screen" />
  }

  return (
    <div
      className={`min-h-screen transition-colors duration-300 ${darkMode ? "dark bg-gray-900" : "bg-gradient-to-br from-orange-50 to-red-50"}`}
    >
      {activeFeature && (
        <Navbar
          showNavbar={showNavbar}
          features={features}
          setActiveFeature={setActiveFeature}
          darkMode={darkMode}
          toggleDarkMode={toggleDarkMode}
        />
      )}
      
      <div className="pt-24 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          {/* Header Section */}
          <div className="text-center mb-16">
            <div className="flex items-center justify-center mb-6">
              <Shield className="w-16 h-16 text-orange-500 mr-4" />
              <h1 className="text-5xl md:text-6xl font-bold bg-gradient-to-r from-orange-500 to-red-600 bg-clip-text text-transparent">
                Privacy Policy
              </h1>
            </div>
            <p className="text-lg text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
              Your privacy matters to us. Learn how we collect, use, and protect your information.
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">
              Last Updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>

          {/* Introduction */}
          <Card className="mb-8 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-orange-200/50 dark:border-gray-700/50">
            <CardContent className="p-8">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Introduction</h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                YouTube Mate is committed to protecting your privacy. This Privacy Policy explains how 
                we collect, use, disclose, and safeguard your information when you use our service. Please read this privacy 
                policy carefully. If you do not agree with the terms of this privacy policy, please do not access the site.
              </p>
            </CardContent>
          </Card>

          {/* Information We Collect */}
          <Card className="mb-8 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-orange-200/50 dark:border-gray-700/50">
            <CardContent className="p-8">
              <div className="flex items-center mb-4">
                <Database className="w-8 h-8 text-orange-500 mr-3" />
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Information We Collect</h2>
              </div>
              
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">Personal Information</h3>
                  <p className="text-gray-700 dark:text-gray-300 mb-2">
                    When you register for an account, we may collect:
                  </p>
                  <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-300 ml-4">
                    <li>Name and email address</li>
                    <li>Username and password (encrypted)</li>
                    <li>Profile picture (if provided via OAuth)</li>
                    <li>Authentication tokens from third-party services (Google OAuth)</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">Usage Information</h3>
                  <p className="text-gray-700 dark:text-gray-300 mb-2">
                    We automatically collect certain information when you use our service:
                  </p>
                  <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-300 ml-4">
                    <li>YouTube URLs you shorten or process</li>
                    <li>Transcripts you generate</li>
                    <li>Videos you download (metadata only)</li>
                    <li>Playlists you create and collaborate on</li>
                    <li>Analytics data (if enabled) including click counts and access times</li>
                    <li>Device information and browser type</li>
                    <li>IP address and location data (general region only)</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">Cookies and Tracking</h3>
                  <p className="text-gray-700 dark:text-gray-300">
                    We use cookies and similar tracking technologies to track activity on our service and store certain 
                    information. You can instruct your browser to refuse all cookies or to indicate when a cookie is being sent.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* How We Use Your Information */}
          <Card className="mb-8 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-orange-200/50 dark:border-gray-700/50">
            <CardContent className="p-8">
              <div className="flex items-center mb-4">
                <Eye className="w-8 h-8 text-orange-500 mr-3" />
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">How We Use Your Information</h2>
              </div>
              
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                We use the information we collect in the following ways:
              </p>
              <ul className="space-y-3 text-gray-700 dark:text-gray-300">
                <li className="flex items-start">
                  <span className="text-orange-500 mr-2">•</span>
                  <span>To create and manage your account</span>
                </li>
                <li className="flex items-start">
                  <span className="text-orange-500 mr-2">•</span>
                  <span>To provide, operate, and maintain our services</span>
                </li>
                <li className="flex items-start">
                  <span className="text-orange-500 mr-2">•</span>
                  <span>To process your requests (URL shortening, transcript generation, downloads)</span>
                </li>
                <li className="flex items-start">
                  <span className="text-orange-500 mr-2">•</span>
                  <span>To enable collaboration features like shared playlists and watch parties</span>
                </li>
                <li className="flex items-start">
                  <span className="text-orange-500 mr-2">•</span>
                  <span>To provide analytics and insights when you enable this feature</span>
                </li>
                <li className="flex items-start">
                  <span className="text-orange-500 mr-2">•</span>
                  <span>To send you technical notices, updates, and support messages</span>
                </li>
                <li className="flex items-start">
                  <span className="text-orange-500 mr-2">•</span>
                  <span>To improve and optimize our service</span>
                </li>
                <li className="flex items-start">
                  <span className="text-orange-500 mr-2">•</span>
                  <span>To detect, prevent, and address technical issues or fraudulent activity</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          {/* Data Security */}
          <Card className="mb-8 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-orange-200/50 dark:border-gray-700/50">
            <CardContent className="p-8">
              <div className="flex items-center mb-4">
                <Lock className="w-8 h-8 text-orange-500 mr-3" />
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Data Security</h2>
              </div>
              
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                We implement appropriate technical and organizational security measures to protect your personal information:
              </p>
              <ul className="space-y-3 text-gray-700 dark:text-gray-300">
                <li className="flex items-start">
                  <span className="text-orange-500 mr-2">•</span>
                  <span>Passwords are encrypted using industry-standard hashing algorithms</span>
                </li>
                <li className="flex items-start">
                  <span className="text-orange-500 mr-2">•</span>
                  <span>Data transmission is secured using SSL/TLS encryption</span>
                </li>
                <li className="flex items-start">
                  <span className="text-orange-500 mr-2">•</span>
                  <span>Access to personal data is restricted to authorized personnel only</span>
                </li>
                <li className="flex items-start">
                  <span className="text-orange-500 mr-2">•</span>
                  <span>Regular security audits and updates</span>
                </li>
                <li className="flex items-start">
                  <span className="text-orange-500 mr-2">•</span>
                  <span>Secure cloud infrastructure with MongoDB Atlas and other trusted providers</span>
                </li>
              </ul>
              <p className="text-gray-700 dark:text-gray-300 mt-4 italic">
                However, no method of transmission over the Internet or electronic storage is 100% secure. While we strive to 
                use commercially acceptable means to protect your information, we cannot guarantee its absolute security.
              </p>
            </CardContent>
          </Card>

          {/* Third-Party Services */}
          <Card className="mb-8 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-orange-200/50 dark:border-gray-700/50">
            <CardContent className="p-8">
              <div className="flex items-center mb-4">
                <UserCheck className="w-8 h-8 text-orange-500 mr-3" />
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Third-Party Services</h2>
              </div>
              
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                Our service integrates with the following third-party services:
              </p>
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">YouTube API</h3>
                  <p className="text-gray-700 dark:text-gray-300">
                    We use YouTube's API to fetch video metadata, thumbnails, and other public information. Your use of 
                    YouTube content is subject to YouTube's Terms of Service.
                  </p>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Google OAuth</h3>
                  <p className="text-gray-700 dark:text-gray-300">
                    When you sign in with Google, we receive limited information (name, email, profile picture) as permitted 
                    by your Google account settings. We do not access your Google account without your explicit permission.
                  </p>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Cloudinary</h3>
                  <p className="text-gray-700 dark:text-gray-300">
                    We use Cloudinary for image hosting and QR code generation. Images are stored securely and are not 
                    shared with third parties.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Your Rights */}
          <Card className="mb-8 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-orange-200/50 dark:border-gray-700/50">
            <CardContent className="p-8">
              <div className="flex items-center mb-4">
                <FileText className="w-8 h-8 text-orange-500 mr-3" />
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Your Rights and Choices</h2>
              </div>
              
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                You have the following rights regarding your personal information:
              </p>
              <ul className="space-y-3 text-gray-700 dark:text-gray-300">
                <li className="flex items-start">
                  <span className="text-orange-500 mr-2">•</span>
                  <span><strong>Access:</strong> Request a copy of the personal information we hold about you</span>
                </li>
                <li className="flex items-start">
                  <span className="text-orange-500 mr-2">•</span>
                  <span><strong>Correction:</strong> Update or correct inaccurate personal information</span>
                </li>
                <li className="flex items-start">
                  <span className="text-orange-500 mr-2">•</span>
                  <span><strong>Deletion:</strong> Request deletion of your personal information (subject to legal obligations)</span>
                </li>
                <li className="flex items-start">
                  <span className="text-orange-500 mr-2">•</span>
                  <span><strong>Opt-out:</strong> Disable analytics for your shortened URLs</span>
                </li>
                <li className="flex items-start">
                  <span className="text-orange-500 mr-2">•</span>
                  <span><strong>Data Portability:</strong> Request your data in a portable format</span>
                </li>
              </ul>
              <p className="text-gray-700 dark:text-gray-300 mt-4">
                To exercise these rights, please contact us at the email address provided below.
              </p>
            </CardContent>
          </Card>

          {/* Data Retention */}
          <Card className="mb-8 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-orange-200/50 dark:border-gray-700/50">
            <CardContent className="p-8">
              <div className="flex items-center mb-4">
                <Trash2 className="w-8 h-8 text-orange-500 mr-3" />
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Data Retention</h2>
              </div>
              
              <p className="text-gray-700 dark:text-gray-300">
                We retain your personal information for as long as necessary to provide our services and comply with legal 
                obligations. When you delete your account, we will delete or anonymize your personal information within 30 days, 
                except where we are required to retain it for legal, regulatory, or security purposes. Shortened URLs and their 
                analytics may be retained for statistical purposes in an anonymized form.
              </p>
            </CardContent>
          </Card>

          {/* Children's Privacy */}
          {/* <Card className="mb-8 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-orange-200/50 dark:border-gray-700/50">
            <CardContent className="p-8">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Children's Privacy</h2>
              <p className="text-gray-700 dark:text-gray-300">
                Our service is not intended for children under the age of 13. We do not knowingly collect personal information 
                from children under 13. If you are a parent or guardian and believe your child has provided us with personal 
                information, please contact us, and we will delete such information from our systems.
              </p>
            </CardContent>
          </Card> */}

          {/* Changes to Privacy Policy */}
          <Card className="mb-8 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-orange-200/50 dark:border-gray-700/50">
            <CardContent className="p-8">
              <div className="flex items-center mb-4">
                <Bell className="w-8 h-8 text-orange-500 mr-3" />
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Changes to This Privacy Policy</h2>
              </div>
              
              <p className="text-gray-700 dark:text-gray-300">
                We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new 
                Privacy Policy on this page and updating the "Last Updated" date. You are advised to review this Privacy Policy 
                periodically for any changes. Changes to this Privacy Policy are effective when they are posted on this page.
              </p>
            </CardContent>
          </Card>

          {/* Contact Information */}
          <Card className="bg-gradient-to-r from-orange-500 to-red-600 text-white">
            <CardContent className="p-8">
              <h2 className="text-2xl font-bold mb-4">Contact Us</h2>
              <p className="mb-4">
                If you have any questions about this Privacy Policy or our data practices, please contact us:
              </p>
              <div className="space-y-2">
                <p><strong>Developer:</strong> Abhishek Anand</p>
                <p><strong>Linkedin:</strong> <a href="https://www.linkedin.com/in/abhishek-anand-iiits/" target="_blank" rel="noopener noreferrer" className="underline hover:text-orange-200">www.linkedin.com/in/abhishek-anand-iiits</a></p>
                <p><strong>Email:</strong> <a href="mailto:abhishekanandvii@gmail.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-orange-200">abhishekanandvii@gmail.com</a></p>
                <p><strong>GitHub:</strong> <a href="https://github.com/forcedtomakeanaccounthere" target="_blank" rel="noopener noreferrer" className="underline hover:text-orange-200">github.com/forcedtomakeanaccounthere</a></p>
                {/* <p><strong>Project:</strong> YouTube Mate</p> */}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Footer />
    </div>
  )
}
