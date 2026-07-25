"use client"

import { useState, useEffect } from "react"
import { Play, Users, Target, Heart, Award, Zap, Globe, Shield } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import Navbar from "@/components/landing/Navbar"
import Footer from "@/components/landing/Footer"
import featuresData from "@/data/features.json"
import { Feature } from "@/types/features"
import { useDarkMode } from "@/hooks/use-dark-mode"

const features: Feature[] = featuresData

export default function AboutPage() {
  const [activeFeature, setActiveFeature] = useState<Feature | null>(null)
  const [showNavbar, setShowNavbar] = useState(true)
  const [isHeartAnimating, setIsHeartAnimating] = useState(false)
  const [particles, setParticles] = useState<{ id: number; angle: number }[]>([])
  const { darkMode, toggleDarkMode, mounted } = useDarkMode()

  useEffect(() => {
    if (features.length > 0) {
      setActiveFeature(features[0])
    }
  }, [])

  const handleHeartClick = () => {
    // Trigger the main heart animation
    setIsHeartAnimating(true)
    
    // Generate particles
    const newParticles = Array.from({ length: 12 }, (_, i) => ({
      id: Date.now() + i,
      angle: (i * 30) // Distribute particles in a circle
    }))
    
    setParticles(newParticles)
    
    // Reset animations
    setTimeout(() => {
      setIsHeartAnimating(false)
      setParticles([])
    }, 1000)
  }

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
              <Play className="w-16 h-16 text-orange-500 mr-4" />
              <h1 className="text-5xl md:text-6xl font-bold bg-gradient-to-r from-orange-500 to-red-600 bg-clip-text text-transparent">
                About YouTube Mate
              </h1>
            </div>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
              Your ultimate companion for managing, sharing, and enhancing your YouTube experience.
            </p>
          </div>

          {/* Mission Section */}
          <Card className="mb-12 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-orange-200/50 dark:border-gray-700/50">
            <CardContent className="p-8">
              <div className="flex items-start space-x-4">
                <Target className="w-12 h-12 text-orange-500 flex-shrink-0" />
                <div>
                  <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">Our Mission</h2>
                  <p className="text-lg text-gray-700 dark:text-gray-300 leading-relaxed">
                    YouTube Mate was created to solve the everyday challenges content creators, educators, and YouTube enthusiasts face. 
                    We believe that powerful tools should be accessible to everyone, which is why we've built a comprehensive platform 
                    that combines URL shortening, transcript generation, video downloading, and collaborative playlist management—all in one place.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Story Section */}
          <div className="mb-12">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-6 text-center">Our Story</h2>
            <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-orange-200/50 dark:border-gray-700/50">
              <CardContent className="p-8">
                <p className="text-lg text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
                  YouTube Mate started as a simple idea: what if managing YouTube content could be easier, more collaborative, 
                  and more powerful? As content creators and educators ourselves, we experienced firsthand the frustrations of 
                  switching between multiple tools to accomplish simple tasks.
                </p>
                <p className="text-lg text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
                  In 2024, we set out to create a unified solution that would streamline the YouTube content workflow. From 
                  shortening URLs with custom timestamps to generating accurate transcripts, downloading videos for offline use, 
                  and building collaborative playlists—we wanted it all in one seamless experience.
                </p>
                <p className="text-lg text-gray-700 dark:text-gray-300 leading-relaxed">
                  Today, YouTube Mate serves thousands of users worldwide, helping them work smarter with YouTube content. 
                  We're constantly evolving based on user feedback and remain committed to providing the best tools for the 
                  YouTube community.
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Core Values */}
          <div className="mb-12">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-8 text-center">Our Core Values</h2>
            <div className="grid md:grid-cols-2 gap-6">
              <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-orange-200/50 dark:border-gray-700/50">
                <CardContent className="p-6">
                  <div className="flex items-start space-x-4">
                    <Users className="w-10 h-10 text-orange-500 flex-shrink-0" />
                    <div>
                      <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">User-Centric</h3>
                      <p className="text-gray-700 dark:text-gray-300">
                        Every feature we build starts with understanding our users' needs. Your feedback drives our roadmap.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-orange-200/50 dark:border-gray-700/50">
                <CardContent className="p-6">
                  <div className="flex items-start space-x-4">
                    <Zap className="w-10 h-10 text-orange-500 flex-shrink-0" />
                    <div>
                      <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Innovation</h3>
                      <p className="text-gray-700 dark:text-gray-300">
                        We constantly explore new technologies and approaches to make YouTube content management more efficient.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-orange-200/50 dark:border-gray-700/50">
                <CardContent className="p-6">
                  <div className="flex items-start space-x-4">
                    <Shield className="w-10 h-10 text-orange-500 flex-shrink-0" />
                    <div>
                      <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Privacy & Security</h3>
                      <p className="text-gray-700 dark:text-gray-300">
                        Your data security is paramount. We implement industry-standard practices to protect your information.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-orange-200/50 dark:border-gray-700/50">
                <CardContent className="p-6">
                  <div className="flex items-start space-x-4">
                    <Globe className="w-10 h-10 text-orange-500 flex-shrink-0" />
                    <div>
                      <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Accessibility</h3>
                      <p className="text-gray-700 dark:text-gray-300">
                        Powerful tools should be available to everyone. We're committed to keeping our core features free.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* What We Offer */}
          <div className="mb-12">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-8 text-center">What We Offer</h2>
            <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-orange-200/50 dark:border-gray-700/50">
              <CardContent className="p-8">
                <div className="space-y-6">
                  <div className="flex items-start space-x-4">
                    <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center text-white font-bold flex-shrink-0">
                      1
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">URL Shortener with Timestamps</h3>
                      <p className="text-gray-700 dark:text-gray-300">
                        Create custom short links to YouTube videos with precise timestamps. Perfect for sharing specific moments 
                        with your audience or students.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-4">
                    <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center text-white font-bold flex-shrink-0">
                      2
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Transcript Generator</h3>
                      <p className="text-gray-700 dark:text-gray-300">
                        Extract accurate transcripts from any YouTube video. Export in multiple formats for accessibility, 
                        content creation, or study materials.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-4">
                    <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center text-white font-bold flex-shrink-0">
                      3
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Video & Audio Downloader</h3>
                      <p className="text-gray-700 dark:text-gray-300">
                        Download videos and audio in various quality options for offline viewing or content preservation.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-4">
                    <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center text-white font-bold flex-shrink-0">
                      4
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Collaborative Playlists</h3>
                      <p className="text-gray-700 dark:text-gray-300">
                        Create and manage playlists with friends, colleagues, or students. Real-time collaboration makes 
                        content curation effortless.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-4">
                    <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center text-white font-bold flex-shrink-0">
                      5
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Watch Parties & Stream Rooms</h3>
                      <p className="text-gray-700 dark:text-gray-300">
                        Host synchronized watch parties with real-time chat. Perfect for remote teams, study groups, or 
                        virtual events.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Team Section */}
          <Card className="bg-gradient-to-r from-orange-500 to-red-600 text-white relative overflow-visible">
            <CardContent className="p-8 text-center">
              <div 
                className="relative inline-block cursor-pointer select-none"
                onClick={handleHeartClick}
              >
                {/* Main Heart */}
                <div className="relative">
                  <Heart 
                    className={`w-16 h-16 mx-auto mb-4 transition-all duration-300 ${
                      isHeartAnimating 
                        ? 'fill-red-500 text-red-500 scale-125 animate-heart-pop' 
                        : 'fill-white text-white hover:scale-110'
                    }`}
                    strokeWidth={2}
                  />
                  
                  {/* Particles */}
                  {particles.map((particle) => (
                    <div
                      key={particle.id}
                      className="absolute top-1/2 left-1/2 pointer-events-none"
                      style={{
                        transform: `translate(-50%, -50%) rotate(${particle.angle}deg) translateY(-40px)`,
                        animation: 'particle-burst 0.8s ease-out forwards'
                      }}
                    >
                      <Heart className="w-3 h-3 fill-red-400 text-red-400" />
                    </div>
                  ))}
                  
                  {/* Ripple effect */}
                  {isHeartAnimating && (
                    <>
                      <div className="absolute inset-0 rounded-full animate-ripple bg-red-400/30" />
                      <div className="absolute inset-0 rounded-full animate-ripple-delay bg-red-300/20" />
                    </>
                  )}
                </div>
              </div>
              
              <h2 className="text-3xl font-bold mb-4">Built with Passion</h2>
              <p className="text-lg mb-6 max-w-2xl mx-auto">
                YouTube Mate is developed and maintained by <strong>Abhishek Anand</strong>, a passionate developer 
                dedicated to creating tools that make a difference in how people interact with YouTube content.
              </p>
              <div className="flex justify-center space-x-4">
                <Award className="w-8 h-8" />
                <Users className="w-8 h-8" />
                <Globe className="w-8 h-8" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <style jsx>{`
        @keyframes heart-pop {
          0% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.3);
          }
          100% {
            transform: scale(1.25);
          }
        }

        @keyframes particle-burst {
          0% {
            opacity: 1;
            transform: translate(-50%, -50%) rotate(var(--angle)) translateY(0) scale(1);
          }
          100% {
            opacity: 0;
            transform: translate(-50%, -50%) rotate(var(--angle)) translateY(-80px) scale(0.3);
          }
        }

        @keyframes ripple {
          0% {
            transform: scale(1);
            opacity: 0.6;
          }
          100% {
            transform: scale(2.5);
            opacity: 0;
          }
        }

        @keyframes ripple-delay {
          0% {
            transform: scale(1);
            opacity: 0.4;
          }
          100% {
            transform: scale(3);
            opacity: 0;
          }
        }

        .animate-heart-pop {
          animation: heart-pop 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .animate-ripple {
          animation: ripple 0.6s ease-out;
        }

        .animate-ripple-delay {
          animation: ripple-delay 0.8s ease-out;
        }
      `}</style>

      <Footer />
    </div>
  )
}
