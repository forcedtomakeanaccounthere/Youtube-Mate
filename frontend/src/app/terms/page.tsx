"use client"

import { useState, useEffect } from "react"
import { FileText, AlertTriangle, CheckCircle, XCircle, Scale, Users, Shield } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import Navbar from "@/components/landing/Navbar"
import Footer from "@/components/landing/Footer"
import featuresData from "@/data/features.json"
import { Feature } from "@/types/features"
import { useDarkMode } from "@/hooks/use-dark-mode"

const features: Feature[] = featuresData

export default function TermsOfServicePage() {
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
              <Scale className="w-16 h-16 text-orange-500 mr-4" />
              <h1 className="text-5xl md:text-6xl font-bold bg-gradient-to-r from-orange-500 to-red-600 bg-clip-text text-transparent">
                Terms of Service
              </h1>
            </div>
            <p className="text-lg text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
              Please read these terms carefully before using YouTube Mate.
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">
              Last Updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>

          {/* Agreement to Terms */}
          <Card className="mb-8 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-orange-200/50 dark:border-gray-700/50">
            <CardContent className="p-8">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Agreement to Terms</h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
                By accessing or using YouTube Mate, you agree to be bound by these Terms of Service. 
                If you disagree with any part of these terms, you may not access the Service.
              </p>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                These Terms apply to all visitors, users, and others who access or use the Service.
              </p>
            </CardContent>
          </Card>

          {/* Use of Service */}
          <Card className="mb-8 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-orange-200/50 dark:border-gray-700/50">
            <CardContent className="p-8">
              <div className="flex items-center mb-4">
                <CheckCircle className="w-8 h-8 text-orange-500 mr-3" />
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Acceptable Use</h2>
              </div>
              
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                You agree to use YouTube Mate only for lawful purposes and in accordance with these Terms. You agree not to:
              </p>
              <ul className="space-y-3 text-gray-700 dark:text-gray-300">
                <li className="flex items-start">
                  <span className="text-orange-500 mr-2">•</span>
                  <span>Use the Service in any way that violates any applicable laws or regulations</span>
                </li>
                <li className="flex items-start">
                  <span className="text-orange-500 mr-2">•</span>
                  <span>Download, distribute, or share copyrighted content without proper authorization</span>
                </li>
                <li className="flex items-start">
                  <span className="text-orange-500 mr-2">•</span>
                  <span>Use the Service to transmit any harmful, threatening, or harassing content</span>
                </li>
                <li className="flex items-start">
                  <span className="text-orange-500 mr-2">•</span>
                  <span>Attempt to bypass any security measures or rate limiting</span>
                </li>
                <li className="flex items-start">
                  <span className="text-orange-500 mr-2">•</span>
                  <span>Use automated tools (bots, scripts) to access the Service without permission</span>
                </li>
                <li className="flex items-start">
                  <span className="text-orange-500 mr-2">•</span>
                  <span>Impersonate any person or entity or misrepresent your affiliation</span>
                </li>
                <li className="flex items-start">
                  <span className="text-orange-500 mr-2">•</span>
                  <span>Interfere with or disrupt the Service or servers connected to the Service</span>
                </li>
                <li className="flex items-start">
                  <span className="text-orange-500 mr-2">•</span>
                  <span>Collect or store personal data about other users without their consent</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          {/* User Accounts */}
          <Card className="mb-8 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-orange-200/50 dark:border-gray-700/50">
            <CardContent className="p-8">
              <div className="flex items-center mb-4">
                <Users className="w-8 h-8 text-orange-500 mr-3" />
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">User Accounts</h2>
              </div>
              
              <div className="space-y-4 text-gray-700 dark:text-gray-300">
                <p>
                  When you create an account with us, you must provide accurate, complete, and current information. Failure 
                  to do so constitutes a breach of these Terms, which may result in immediate termination of your account.
                </p>
                <p>
                  You are responsible for:
                </p>
                <ul className="space-y-2 ml-4">
                  <li className="flex items-start">
                    <span className="text-orange-500 mr-2">•</span>
                    <span>Safeguarding your password and any other credentials used to access your account</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-orange-500 mr-2">•</span>
                    <span>All activities that occur under your account</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-orange-500 mr-2">•</span>
                    <span>Notifying us immediately of any unauthorized use of your account</span>
                  </li>
                </ul>
                <p>
                  We reserve the right to refuse service, terminate accounts, or remove content at our sole discretion, 
                  especially if we believe there is a violation of these Terms.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Intellectual Property */}
          <Card className="mb-8 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-orange-200/50 dark:border-gray-700/50">
            <CardContent className="p-8">
              <div className="flex items-center mb-4">
                <Shield className="w-8 h-8 text-orange-500 mr-3" />
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Intellectual Property</h2>
              </div>
              
              <div className="space-y-4 text-gray-700 dark:text-gray-300">
                <p>
                  The Service and its original content, features, and functionality are owned by YouTube Mate and are 
                  protected by international copyright, trademark, patent, trade secret, and other intellectual property laws.
                </p>
                <p>
                  <strong>YouTube Content:</strong> All YouTube videos, thumbnails, titles, and other content accessed through 
                  our Service remain the property of their respective owners. YouTube Mate does not claim ownership of any 
                  YouTube content. Your use of YouTube content is subject to YouTube's Terms of Service.
                </p>
                <p>
                  <strong>User-Generated Content:</strong> When you create playlists, shortened URLs, or other content on our 
                  platform, you retain ownership of that content. However, you grant us a license to use, store, and display 
                  this content as necessary to provide the Service.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Copyright and DMCA */}
          <Card className="mb-8 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-orange-200/50 dark:border-gray-700/50">
            <CardContent className="p-8">
              <div className="flex items-center mb-4">
                <FileText className="w-8 h-8 text-orange-500 mr-3" />
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Copyright Policy</h2>
              </div>
              
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                We respect the intellectual property rights of others. It is our policy to respond to any claim that content 
                posted on the Service infringes copyright or other intellectual property rights.
              </p>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                <strong>Important Notice:</strong> YouTube Mate provides tools to interact with YouTube content. We do not 
                host video files ourselves. Video downloads are provided for personal, non-commercial use only, and users 
                are responsible for ensuring they have the right to download and use any content.
              </p>
              <p className="text-gray-700 dark:text-gray-300">
                If you believe that any content on our Service violates your copyright, please contact us with detailed 
                information about the alleged infringement.
              </p>
            </CardContent>
          </Card>

          {/* Prohibited Uses */}
          <Card className="mb-8 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-orange-200/50 dark:border-gray-700/50">
            <CardContent className="p-8">
              <div className="flex items-center mb-4">
                <XCircle className="w-8 h-8 text-orange-500 mr-3" />
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Prohibited Uses</h2>
              </div>
              
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                In addition to other terms as set forth in these Terms, you are prohibited from using the Service:
              </p>
              <ul className="space-y-3 text-gray-700 dark:text-gray-300">
                <li className="flex items-start">
                  <span className="text-red-500 mr-2">✕</span>
                  <span>To download copyrighted content for commercial purposes without authorization</span>
                </li>
                <li className="flex items-start">
                  <span className="text-red-500 mr-2">✕</span>
                  <span>To create spam or phishing campaigns using shortened URLs</span>
                </li>
                <li className="flex items-start">
                  <span className="text-red-500 mr-2">✕</span>
                  <span>To redistribute or resell access to the Service</span>
                </li>
                <li className="flex items-start">
                  <span className="text-red-500 mr-2">✕</span>
                  <span>To reverse engineer or attempt to extract source code from the Service</span>
                </li>
                <li className="flex items-start">
                  <span className="text-red-500 mr-2">✕</span>
                  <span>To remove or alter any copyright, trademark, or proprietary notices</span>
                </li>
                <li className="flex items-start">
                  <span className="text-red-500 mr-2">✕</span>
                  <span>To use the Service in a way that could damage, disable, or impair the Service</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          {/* Disclaimer */}
          <Card className="mb-8 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-orange-200/50 dark:border-gray-700/50">
            <CardContent className="p-8">
              <div className="flex items-center mb-4">
                <AlertTriangle className="w-8 h-8 text-orange-500 mr-3" />
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Disclaimer of Warranties</h2>
              </div>
              
              <div className="space-y-4 text-gray-700 dark:text-gray-300">
                <p>
                  THE SERVICE IS PROVIDED ON AN "AS IS" AND "AS AVAILABLE" BASIS. YOUTUBE MATE MAKES NO REPRESENTATIONS 
                  OR WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, AS TO THE OPERATION OF THE SERVICE OR THE INFORMATION, 
                  CONTENT, OR MATERIALS INCLUDED THEREIN.
                </p>
                <p>
                  We do not warrant that:
                </p>
                <ul className="space-y-2 ml-4">
                  <li className="flex items-start">
                    <span className="text-orange-500 mr-2">•</span>
                    <span>The Service will be uninterrupted, timely, secure, or error-free</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-orange-500 mr-2">•</span>
                    <span>The results obtained from using the Service will be accurate or reliable</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-orange-500 mr-2">•</span>
                    <span>Any errors in the Service will be corrected</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-orange-500 mr-2">•</span>
                    <span>The Service is free from viruses or other harmful components</span>
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Limitation of Liability */}
          <Card className="mb-8 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-orange-200/50 dark:border-gray-700/50">
            <CardContent className="p-8">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Limitation of Liability</h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                IN NO EVENT SHALL YOUTUBE MATE, ITS DIRECTORS, EMPLOYEES, PARTNERS, AGENTS, OR AFFILIATES BE LIABLE FOR 
                ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING WITHOUT LIMITATION, LOSS OF 
                PROFITS, DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES, RESULTING FROM YOUR ACCESS TO OR USE OF OR 
                INABILITY TO ACCESS OR USE THE SERVICE.
              </p>
            </CardContent>
          </Card>

          {/* Termination */}
          <Card className="mb-8 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-orange-200/50 dark:border-gray-700/50">
            <CardContent className="p-8">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Termination</h2>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                We may terminate or suspend your account and access to the Service immediately, without prior notice or 
                liability, for any reason, including if you breach these Terms.
              </p>
              <p className="text-gray-700 dark:text-gray-300">
                Upon termination, your right to use the Service will immediately cease. If you wish to terminate your account, 
                you may simply discontinue using the Service or contact us to request account deletion.
              </p>
            </CardContent>
          </Card>

          {/* Changes to Terms */}
          <Card className="mb-8 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-orange-200/50 dark:border-gray-700/50">
            <CardContent className="p-8">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Changes to Terms</h2>
              <p className="text-gray-700 dark:text-gray-300">
                We reserve the right to modify or replace these Terms at any time at our sole discretion. If a revision is 
                material, we will provide at least 30 days' notice prior to any new terms taking effect. What constitutes a 
                material change will be determined at our sole discretion. By continuing to access or use our Service after 
                those revisions become effective, you agree to be bound by the revised terms.
              </p>
            </CardContent>
          </Card>

          {/* Governing Law */}
          <Card className="mb-8 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-orange-200/50 dark:border-gray-700/50">
            <CardContent className="p-8">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Governing Law</h2>
              <p className="text-gray-700 dark:text-gray-300">
                These Terms shall be governed and construed in accordance with applicable laws, without regard to its conflict 
                of law provisions. Our failure to enforce any right or provision of these Terms will not be considered a waiver 
                of those rights.
              </p>
            </CardContent>
          </Card>

          {/* Contact Information */}
          <Card className="bg-gradient-to-r from-orange-500 to-red-600 text-white">
            <CardContent className="p-8">
              <h2 className="text-2xl font-bold mb-4">Contact Us</h2>
              <p className="mb-4">
                If you have any questions about these Terms of Service, please contact us:
              </p>
              <div className="space-y-2">
                <p><strong>Developer:</strong> Abhishek Anand</p>
                <p><strong>Linkedin:</strong> <a href="https://www.linkedin.com/in/abhishek-anand-iiits/" target="_blank" rel="noopener noreferrer" className="underline hover:text-orange-200">www.linkedin.com/in/abhishek-anand-iiits</a></p>
                <p><strong>Email:</strong> <a href="mailto:abhishekanandvii@gmail.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-orange-200">abhishekanandvii@gmail.com</a></p>
                <p><strong>GitHub:</strong> <a href="https://github.com/forcedtomakeanaccounthere" target="_blank" rel="noopener noreferrer" className="underline hover:text-orange-200">github.com/forcedtomakeanaccounthere</a></p>
                {/* <p><strong>Project:</strong> YouTube Mate</p> */}
              </div>
              <p className="mt-6 text-sm">
                By using YouTube Mate, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      <Footer />
    </div>
  )
}
