"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Check, Star, Crown, Zap, Loader2 } from "lucide-react"
import Navbar from "@/components/landing/Navbar"
import featuresData from "@/data/features.json"
import { Feature } from "@/types/features"
import { useDarkMode } from "@/hooks/use-dark-mode"
import { createCheckoutSession, redirectToCheckout } from "@/lib/payment-service"
import { generateIdempotencyKey, createPaymentMetadata } from "@/lib/payment-utils"

const features: Feature[] = featuresData

interface PlanFeature {
    text: string
    included: boolean
}

interface Plan {
    id: string
    name: string
    price: string
    period: string
    description: string
    features: PlanFeature[]
    popular?: boolean
    icon: React.ReactNode
    badge?: string
}

const plans: Plan[] = [
    {
        id: "free",
        name: "Free",
        price: "₹0",
        period: "forever",
        description: "Perfect for getting started with YouTube Mate",
        icon: <Zap className="w-8 h-8" />,
        features: [
            { text: "5 AI summaries per day", included: true },
            { text: "10 URL shortener uses per day", included: true },
            { text: "Standard quality downloads (720p)", included: true },
            { text: "1 collaborator per playlist", included: true },
            { text: "3 private playlists", included: true },
            { text: "Basic playlist downloads", included: true },
            { text: "Custom domain for URLs", included: false },
            { text: "Priority support", included: false },
            { text: "Advanced analytics", included: false },
        ],
    },
    {
        id: "pro",
        name: "Pro",
        price: "₹799",
        period: "per month",
        description: "Ideal for content creators and professionals",
        icon: <Star className="w-8 h-8" />,
        popular: true,
        badge: "Most Popular",
        features: [
            { text: "100 AI summaries per day", included: true },
            { text: "Unlimited URL shortener", included: true },
            { text: "High quality downloads (1080p)", included: true },
            { text: "10 collaborators per playlist", included: true },
            { text: "50 private playlists", included: true },
            { text: "Bulk playlist downloads", included: true },
            { text: "Custom domain for URLs", included: true },
            { text: "Priority support", included: true },
            { text: "Advanced analytics", included: false },
        ],
    },
    {
        id: "exclusive",
        name: "Exclusive",
        price: "₹1,999",
        period: "per month",
        description: "Ultimate experience for power users and teams",
        icon: <Crown className="w-8 h-8" />,
        features: [
            { text: "Unlimited AI summaries", included: true },
            { text: "Unlimited URL shortener", included: true },
            { text: "4K quality downloads", included: true },
            { text: "Unlimited collaborators", included: true },
            { text: "Unlimited private playlists", included: true },
            { text: "Advanced playlist downloads", included: true },
            { text: "Custom domain + branding", included: true },
            { text: "24/7 priority support", included: true },
            { text: "Advanced analytics & insights", included: true },
        ],
    },
]

export default function SubscriptionPage() {
    const [selectedPlan, setSelectedPlan] = useState("pro")
    const [isAnimating, setIsAnimating] = useState(false)
    const [user, setUser] = useState<{ id: string; email: string; currentPlan?: string } | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [isProcessingPayment, setIsProcessingPayment] = useState(false)
    
    // Progressive loading states
    const [animationsEnabled, setAnimationsEnabled] = useState(false)
    const [cardsLoaded, setCardsLoaded] = useState(false)

    // Navbar state
    const [activeFeature, setActiveFeature] = useState(features[0])
    const [showNavbar, setShowNavbar] = useState(true)
    const { darkMode, toggleDarkMode, mounted } = useDarkMode()

    // Check user authentication and current subscription
    useEffect(() => {
        checkUserAuth()
    }, [])

    // Progressive loading for better performance
    useEffect(() => {
        // Load cards immediately (no delay for instant display)
        setCardsLoaded(true)

        // Enable animations after users have seen and interacted with static content
        const animationsTimer = setTimeout(() => {
            setAnimationsEnabled(true)
        }, 800) // Quick transition to animated view

        return () => {
            clearTimeout(animationsTimer)
        }
    }, [])

    // Show enhancement notification
    useEffect(() => {
        if (animationsEnabled && cardsLoaded) {
            // Optional: You could show a brief toast here
            console.log('Enhanced view activated with 3D animations and video backgrounds')
        }
    }, [animationsEnabled, cardsLoaded])

    const checkUserAuth = async () => {
        try {
            // Clear any cached data
            localStorage.removeItem('userCache')
            
            // Check if user is authenticated
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'}/auth/me`, {
                credentials: 'include',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'application/json'
                },
                cache: 'no-cache' // Ensure fresh data
            })
            
            if (response.ok) {
                const data = await response.json()
                if (data.success && data.user) {
                    const userData = {
                        id: data.user.id,
                        email: data.user.email,
                        currentPlan: data.user.currentPlan || data.user.plan || 'free'
                    }
                    setUser(userData)
                    console.log('User data refreshed:', userData) // Debug log
                } else {
                    setUser(null)
                }
            } else {
                setUser(null)
            }
        } catch (error) {
            console.error('Auth check failed:', error)
            setUser(null)
        } finally {
            setIsLoading(false)
        }
    }

    const handlePayment = async (planId: string) => {
        if (!user) {
            // Redirect to login page with return URL
            const returnUrl = encodeURIComponent('/subscription')
            window.location.href = `/login?redirect=${returnUrl}&message=Please login to purchase a subscription`
            return
        }

        if (planId === 'free') {
            alert('You are already on the free plan!')
            return
        }

        if (user.currentPlan === planId) {
            alert(`You are already subscribed to the ${planId} plan!`)
            return
        }

        setIsProcessingPayment(true)

        try {
            const idempotencyKey = generateIdempotencyKey(user.id, planId)
            
            const checkoutData = {
                planId,
                userId: user.id,
                email: user.email,
                idempotencyKey
            }

            console.log('🚀 Creating checkout session for:', checkoutData) // Debug log

            const session = await createCheckoutSession(checkoutData)
            console.log('✅ Checkout session created:', session.sessionId) // Debug log
            
            await redirectToCheckout(session.sessionId)
        } catch (error) {
            console.error('Payment failed:', error)
            alert('Payment failed. Please try again.')
        } finally {
            setIsProcessingPayment(false)
        }
    }

    // Don't render anything that depends on darkMode until mounted
    if (!mounted) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-orange-50 via-red-50 to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center">
                <div className="text-center space-y-4 animate-pulse">
                    <div className="w-16 h-16 mx-auto bg-gradient-to-r from-orange-400 to-red-500 rounded-full flex items-center justify-center">
                        <Crown className="w-8 h-8 text-white" />
                    </div>
                    <p className="text-gray-500 dark:text-gray-400">Loading plans...</p>
                </div>
            </div>
        )
    }

    const handlePlanSelect = (planId: string) => {
        if (planId === selectedPlan || (isAnimating && animationsEnabled)) return

        if (animationsEnabled) {
            setIsAnimating(true)
        }
        setSelectedPlan(planId)

        if (animationsEnabled) {
            setTimeout(() => {
                setIsAnimating(false)
            }, 800)
        }
    }

    const getCardStyle = (planId: string, index: number) => {
        if (!animationsEnabled) {
            // Simple layout without 3D transforms
            return {
                transform: "none",
                zIndex: planId === selectedPlan ? 20 : 10,
                filter: "none",
                opacity: 1,
            }
        }

        const selectedIndex = plans.findIndex((p) => p.id === selectedPlan)
        const currentIndex = plans.findIndex((p) => p.id === planId)

        // Calculate position relative to selected card
        let position = currentIndex - selectedIndex

        // Normalize position to -1, 0, 1 (left, center, right)
        if (position < -1) position += 3
        if (position > 1) position -= 3

        const isSelected = position === 0
        const isLeft = position === -1
        const isRight = position === 1

        if (isSelected) {
            return {
                transform: "translateX(0) translateZ(50px) scale(1.1) rotateY(0deg)",
                zIndex: 30,
                filter: "blur(0px)",
                opacity: 1,
            }
        } else if (isLeft) {
            return {
                transform: "translateX(-280px) translateZ(-50px) scale(0.85) rotateY(8deg)",
                zIndex: 10,
                filter: "blur(1px)",
                opacity: 0.8,
            }
        } else {
            return {
                transform: "translateX(280px) translateZ(-50px) scale(0.85) rotateY(-8deg)",
                zIndex: 10,
                filter: "blur(1px)",
                opacity: 0.8,
            }
        }
    }

    const getGlassStyle = (planId: string) => {
        // Skip heavy styling calculations when animations are disabled
        if (!animationsEnabled) {
            return {}
        }

        const isSelected = planId === selectedPlan

        if (isSelected) {
            return {
                // No glassmorphism for selected card with video
                background: "transparent",
                backdropFilter: "none",
                border: "none",
            }
        } else {
            return {
                background: "linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.05) 100%)",
                backdropFilter: "blur(15px)",
                border: "1px solid rgba(255,255,255,0.2)",
                boxShadow: "0 15px 35px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.2)",
            }
        }
    }

    return (
        <div className={`min-h-screen transition-all duration-500 ease-in-out animate-fadeIn ${darkMode ? "dark bg-gradient-to-br from-gray-900 dark:to-gray-800" : "bg-gradient-to-br from-orange-50 to-red-50"}`}>
            <style jsx>{`
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-fadeIn {
                    animation: fadeIn 0.4s ease-out forwards;
                }
            `}</style>
            <Navbar
                showNavbar={showNavbar}
                features={features}
                setActiveFeature={setActiveFeature}
                darkMode={darkMode}
                toggleDarkMode={toggleDarkMode}
            />
            {/* Header */}            
            <div className="container mx-auto px-4 pt-20 pb-6 text-center">
                {user?.currentPlan && (
                    <Badge className="mb-4 bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">
                        Current Plan: {user.currentPlan.charAt(0).toUpperCase() + user.currentPlan.slice(1)}
                    </Badge>
                )}
                <h1 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent mb-3">
                    Unlock Your Potential
                </h1>
                <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
                    Upgrade anytime as your needs grow.
                </p>
            </div>

            {/* Mobile Tabs - Visible only on mobile */}
            <div className="block md:hidden container mx-auto px-4 mb-8">
                <Tabs value={selectedPlan} onValueChange={setSelectedPlan} className="w-full">
                    <TabsList className="grid w-full grid-cols-3 bg-white/30 backdrop-blur-sm border border-white/20 mb-6">
                        <TabsTrigger 
                            value="free" 
                            className="data-[state=active]:bg-orange-500 data-[state=active]:text-white transition-all duration-300"
                        >
                            Free
                        </TabsTrigger>
                        <TabsTrigger 
                            value="pro" 
                            className="data-[state=active]:bg-orange-500 data-[state=active]:text-white transition-all duration-300"
                        >
                            Pro
                        </TabsTrigger>
                        <TabsTrigger 
                            value="exclusive" 
                            className="data-[state=active]:bg-orange-500 data-[state=active]:text-white transition-all duration-300"
                        >
                            Exclusive
                        </TabsTrigger>
                    </TabsList>

                    {plans.map((plan) => (
                        <TabsContent key={plan.id} value={plan.id} className="mt-0">
                            <div className="w-full max-w-sm mx-auto">
                                <div className="transform transition-all duration-500 ease-in-out">
                                    <MobilePlanCard 
                                        plan={plan} 
                                        isSelected={true} 
                                        onSelect={() => handlePayment(plan.id)}
                                        isCurrentPlan={user?.currentPlan === plan.id}
                                        isProcessing={isProcessingPayment}
                                    />
                                </div>
                            </div>
                        </TabsContent>
                    ))}
                </Tabs>
            </div>

            {/* Desktop Cards - Simple layout initially, 3D when animations enabled */}
            <div className="hidden md:block container mx-auto px-4 pb-20">
                {!cardsLoaded ? (
                    // Minimal loading state
                    <div className="flex items-center justify-center h-[650px]">
                        <div className="text-orange-500">Loading...</div>
                    </div>
                ) : !animationsEnabled ? (
                    <div>
                        {/* Helpful instruction text for static mode */}
                        <div className="text-center mb-8">
                            <p className="text-lg text-gray-600 dark:text-gray-300">
                                Click on any plan to select it
                            </p>
                        </div>
                        
                        {/* Fast static layout - all cards visible with proper backgrounds */}
                        <div className="flex items-stretch justify-center gap-6 h-[650px] max-w-6xl mx-auto">
                            {plans.map((plan) => (
                                <div
                                    key={plan.id}
                                    className={`flex-1 max-w-sm h-[520px] rounded-2xl cursor-pointer transition-all duration-300 ${
                                        plan.id === selectedPlan 
                                            ? 'ring-4 ring-orange-500 scale-105 shadow-2xl' 
                                            : 'hover:scale-105 shadow-lg hover:shadow-xl'
                                    }`}
                                    style={{
                                        background: plan.id === selectedPlan 
                                            ? "linear-gradient(135deg, #fb923c 0%, #f97316 25%, #ea580c 50%, #dc2626 75%, #b91c1c 100%)"
                                            : "linear-gradient(135deg, rgba(251, 146, 60, 0.7) 0%, rgba(249, 115, 22, 0.7) 25%, rgba(234, 88, 12, 0.7) 50%, rgba(220, 38, 38, 0.7) 75%, rgba(185, 28, 28, 0.7) 100%)",
                                        border: plan.id === selectedPlan 
                                            ? "2px solid rgba(249, 115, 22, 0.8)"
                                            : "1px solid rgba(255,255,255,0.3)",
                                        backdropFilter: "blur(10px)",
                                    }}
                                    onClick={() => handlePlanSelect(plan.id)}
                                >
                                    <SimplePlanCard 
                                        plan={plan} 
                                        isSelected={plan.id === selectedPlan}
                                        onSelect={() => handlePayment(plan.id)}
                                        isCurrentPlan={user?.currentPlan === plan.id}
                                        isProcessing={isProcessingPayment}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    // Full 3D animated layout - ONLY load when animations are ready
                    <div 
                        className="relative h-[650px] flex items-center justify-center transition-all duration-1000" 
                        style={{ perspective: "1200px" }}
                    >
                        {plans.map((plan, index) => {
                            const style = getCardStyle(plan.id, index)

                            return (
                                <div
                                    key={plan.id}
                                    className={`absolute transition-all duration-800 ease-in-out cursor-pointer ${isAnimating ? "pointer-events-none" : ""}`}
                                    style={{
                                        ...style,
                                        transformStyle: "preserve-3d",
                                    }}
                                    onClick={() => handlePlanSelect(plan.id)}
                                >
                                    {/* Only render heavy PlanCard when animations are enabled */}
                                    {animationsEnabled && (
                                        <PlanCard
                                            plan={plan}
                                            isSelected={plan.id === selectedPlan}
                                            onSelect={() => {
                                                handlePlanSelect(plan.id)
                                                if (plan.id !== selectedPlan) return
                                                handlePayment(plan.id)
                                            }}
                                            glassStyle={getGlassStyle(plan.id)}
                                            isCurrentPlan={user?.currentPlan === plan.id}
                                            isProcessing={isProcessingPayment}
                                            animationsEnabled={animationsEnabled}
                                        />
                                    )}
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* Selected Plan Details */}
            <div className="relative container mx-auto px-4 pb-20">
                <div className="mt-6 max-w-5xl mx-auto">
                    <div
                        className="rounded-3xl p-8 border"
                        style={{
                            background: "linear-gradient(135deg, rgba(255,255,255,0.25) 0%, rgba(255,255,255,0.1) 100%)",
                            backdropFilter: "blur(20px)",
                            border: "1px solid rgba(255,255,255,0.2)",
                            boxShadow: "0 25px 50px rgba(251, 146, 60, 0.1)",
                        }}
                    >
                        <h3 className="text-3xl font-bold text-center mb-8 text-gray-900 dark:text-white">
                            {plans.find((p) => p.id === selectedPlan)?.name} Plan Features
                        </h3>
                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {plans
                                .find((p) => p.id === selectedPlan)
                                ?.features.map((feature, index) => (
                                    <div key={index} className="flex items-center">
                                        <Check className={`w-6 h-6 mr-3 ${feature.included ? "text-green-500" : "text-gray-400"}`} />
                                        <span
                                            className={`text-lg ${feature.included ? "text-gray-900 dark:text-white" : "text-gray-500 line-through"}`}
                                        >
                                            {feature.text}
                                        </span>
                                    </div>
                                ))}
                        </div>
                    </div>
                </div>

                {/* FAQ Section */}
                <div className="mt-8 text-center">
                    <p className="text-xl text-gray-600 dark:text-gray-300 mb-3">
                        Need help choosing the right plan? We're here to help.
                    </p>
                    <Button
                        variant="outline"
                        size="lg"
                        className="bg-orange-400/20 backdrop-blur-sm border-white/30 hover:bg-orange-600/30"
                    >
                        Contact Support
                    </Button>
                </div>
            </div>
        </div>
    )
}

interface PlanCardProps {
    plan: Plan
    isSelected: boolean
    onSelect: () => void
    glassStyle?: React.CSSProperties
    isCurrentPlan?: boolean
    isProcessing?: boolean
    animationsEnabled?: boolean
}

function PlanCard({ plan, isSelected, onSelect, glassStyle, isCurrentPlan = false, isProcessing = false, animationsEnabled = false }: PlanCardProps) {
    return (
        <div
            className={`w-96 h-[544px] rounded-3xl overflow-hidden ${isSelected ? "shadow-2xl shadow-orange-500/30" : "shadow-xl"} transition-shadow duration-300 relative`}
        >
            {/* Background with metallic gradient */}
            <div className="absolute inset-0">
                <div
                    className="w-full h-full"
                    style={{
                        background: "linear-gradient(135deg, #fb923c 0%, #f97316 25%, #ea580c 50%, #dc2626 75%, #b91c1c 100%)",
                    }}
                />
                {/* Metallic overlay */}
                <div
                    className="absolute inset-0"
                    style={{
                        background:
                            "linear-gradient(135deg, rgba(255,255,255,0.3) 0%, transparent 30%, transparent 70%, rgba(255,255,255,0.1) 100%)",
                    }}
                />
                {/* Video background for selected card - only when animations enabled */}
                {isSelected && animationsEnabled && (
                    <>
                        <video
                            autoPlay
                            loop
                            muted
                            playsInline
                            preload="auto"
                            className="absolute top-0 left-0 w-full h-[550px] object-cover"
                        >
                            <source src="/vid2c.webm" type="video/webm" />
                            Your browser does not support the video tag.
                        </video>
                        {/* Gradient overlay from black to transparent */}
                        <div
                            className="absolute inset-0"
                            style={{
                                background: "linear-gradient(to bottom, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.7) 30%, rgba(0,0,0,0.3) 60%, transparent 100%)",
                            }}
                        />
                    </>
                )}
                {/* Animated background for selected card */}
                {isSelected && (
                    <div
                        className="absolute inset-0 animate-pulse"
                        style={{
                            background: "radial-gradient(circle at 50% 50%, rgba(255,255,255,0.1) 0%, transparent 70%)",
                        }}
                    />
                )}
            </div>

            {/* Glassmorphism Content */}
            <div
                className="relative h-full z-10"
                style={
                    isSelected ? 
                    {
                        // No glassmorphism for selected card with video
                        background: "transparent",
                        backdropFilter: "none",
                        border: "none",
                    } :
                    glassStyle || {
                        background: "linear-gradient(135deg, rgba(255,255,255,0.25) 0%, rgba(255,255,255,0.1) 100%)",
                        backdropFilter: "blur(20px)",
                        border: "2px solid rgba(255,255,255,0.3)",
                    }
                }
            >
                <div className="p-8 pt-4 h-full flex flex-col">
                    {/* Header */}
                    <div className="text-center mb-3">
                        {plan.badge && (
                            <Badge className="mb-3 bg-white/30 text-white border-white/50 backdrop-blur-sm">{plan.badge}</Badge>
                        )}
                        <div className="flex items-center justify-center mb-4 text-white">
                            {plan.icon}
                            <h3 className="text-3xl font-bold ml-3">{plan.name}</h3>
                        </div>
                        <div className="text-white mb-4">
                            <span className="text-5xl font-bold">{plan.price}</span>
                            <span className="text-lg opacity-80">/{plan.period}</span>
                        </div>
                        <p className="text-white/90 text-base leading-relaxed">{plan.description}</p>
                    </div>

                    {/* Features */}
                    <div className="flex-1 space-y-1 mb-2">
                        {plan.features.slice(0, 6).map((feature, index) => (
                            <div key={index} className="flex items-center text-sm">
                                <Check
                                    className={`w-4 h-4 mr-3 flex-shrink-0 ${feature.included ? "text-green-300" : "text-gray-400 opacity-50"
                                        }`}
                                />
                                <span className={`${feature.included ? "text-white" : "text-white/50 line-through"}`}>
                                    {feature.text}
                                </span>
                            </div>
                        ))}
                        {plan.features.length > 6 && (
                            <div className="text-white/70 text-xs font-medium mt-1">+{plan.features.length - 6} more features</div>
                        )}
                    </div>

                    {/* CTA Button */}
                    <Button
                        className={`w-full h-12 text-base font-semibold transition-all duration-300 ${
                            isCurrentPlan 
                                ? "bg-gray-500 text-white cursor-not-allowed opacity-70" 
                                : isSelected
                                    ? "bg-white text-orange-600 hover:bg-gray-100 shadow-lg"
                                    : "bg-white/30 text-white hover:bg-white/40 backdrop-blur-sm border border-white/50"
                        }`}
                        onClick={onSelect}
                        disabled={isCurrentPlan || isProcessing}
                    >
                        {isProcessing ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Processing...
                            </>
                        ) : isCurrentPlan ? (
                            "Current Plan"
                        ) : plan.id === "free" ? (
                            "Get Started Free"
                        ) : (
                            "Choose Plan"
                        )}
                    </Button>
                </div>
            </div>
        </div>
    )
}

interface MobilePlanCardProps {
    plan: Plan
    isSelected: boolean
    onSelect: () => void
    isCurrentPlan?: boolean
    isProcessing?: boolean
}

function MobilePlanCard({ plan, isSelected, onSelect, isCurrentPlan = false, isProcessing = false }: MobilePlanCardProps) {
    return (
        <div className="w-full max-w-sm mx-auto rounded-2xl overflow-hidden shadow-xl relative">
            {/* Main gradient background - always visible */}
            <div 
                className="absolute inset-0 rounded-2xl"
                style={{
                    background: "linear-gradient(135deg, #fb923c 0%, #f97316 25%, #ea580c 50%, #dc2626 75%, #b91c1c 100%)",
                }}
            />
            
            {/* Metallic shine overlay */}
            <div
                className="absolute inset-0 rounded-2xl"
                style={{
                    background: "linear-gradient(135deg, rgba(255,255,255,0.3) 0%, transparent 30%, transparent 70%, rgba(255,255,255,0.1) 100%)",
                }}
            />
            
            {/* Subtle dark overlay for text readability - very light */}
            <div
                className="absolute inset-0 rounded-2xl"
                style={{
                    background: "rgba(0, 0, 0, 0.2)",
                }}
            />
            
            {/* Content */}
            <div className="relative p-5 z-10">
                {/* Header */}
                <div className="text-center mb-4">
                    {plan.badge && (
                        <Badge className="mb-3 bg-white/30 text-white border-white/50 backdrop-blur-sm shadow-lg">{plan.badge}</Badge>
                    )}
                    <div className="flex items-center justify-center mb-3 text-white">
                        {plan.icon}
                        <h3 className="text-2xl font-bold ml-3 text-shadow-lg">{plan.name}</h3>
                    </div>
                    <div className="text-white mb-3">
                        <span className="text-3xl font-bold text-shadow-lg">{plan.price}</span>
                        <span className="text-sm opacity-95">/{plan.period}</span>
                    </div>
                    <p className="text-white text-sm leading-relaxed text-shadow">{plan.description}</p>
                </div>

                {/* Features */}
                <div className="space-y-2 mb-4">
                    {plan.features.map((feature, index) => (
                        <div key={index} className="flex items-start text-sm">
                            <Check
                                className={`w-4 h-4 mr-3 flex-shrink-0 mt-0.5 ${feature.included ? "text-green-300" : "text-gray-300"
                                    }`}
                            />
                            <span className={`${feature.included ? "text-white text-shadow" : "text-gray-200 line-through"}`}>
                                {feature.text}
                            </span>
                        </div>
                    ))}
                </div>

                {/* CTA Button */}
                <Button
                    className={`w-full h-12 text-base font-semibold shadow-lg transition-all duration-300 ${
                        isCurrentPlan 
                            ? "bg-gray-500 text-white cursor-not-allowed opacity-70" 
                            : "bg-white text-orange-600 hover:bg-gray-50"
                    }`}
                    onClick={onSelect}
                    disabled={isCurrentPlan || isProcessing}
                >
                    {isProcessing ? (
                        <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Processing...
                        </>
                    ) : isCurrentPlan ? (
                        "Current Plan"
                    ) : plan.id === "free" ? (
                        "Get Started Free"
                    ) : (
                        "Choose Plan"
                    )}
                </Button>
            </div>
        </div>
    )
}

// Simplified card component for fast initial loading
interface SimplePlanCardProps {
    plan: Plan
    isSelected: boolean
    onSelect: () => void
    isCurrentPlan?: boolean
    isProcessing?: boolean
}

function SimplePlanCard({ plan, isSelected, onSelect, isCurrentPlan = false, isProcessing = false }: SimplePlanCardProps) {
    return (
        <div className="p-6 h-full flex flex-col justify-between text-white">
            {/* Header */}
            <div className="text-center">
                {plan.badge && (
                    <div className="inline-block px-3 py-1 mb-4 text-xs font-semibold bg-white/20 rounded-full backdrop-blur-sm">
                        {plan.badge}
                    </div>
                )}
                <div className="mb-4 flex justify-center">{plan.icon}</div>
                <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                <div className="mb-2">
                    <span className="text-3xl font-bold">{plan.price}</span>
                    <span className="text-sm opacity-80">/{plan.period}</span>
                </div>
                <p className="text-sm opacity-90 mb-6 leading-relaxed">{plan.description}</p>
            </div>

            {/* Features - show all features in simplified format */}
            <div className="flex-1">
                <div className="space-y-3">
                    {plan.features.map((feature, index) => (
                        <div key={index} className="flex items-start text-sm">
                            <div className="w-5 h-5 mr-3 flex-shrink-0 mt-0.5">
                                {feature.included ? (
                                    <div className="w-3 h-3 bg-white rounded-full shadow-sm"></div>
                                ) : (
                                    <div className="w-3 h-3 bg-white/30 rounded-full"></div>
                                )}
                            </div>
                            <span className={`leading-relaxed ${feature.included ? "text-white" : "text-white/60 line-through"}`}>
                                {feature.text}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            {/* CTA Button */}
            <button
                className={`w-full mt-6 py-3 px-4 rounded-xl font-semibold transition-all duration-300 text-base ${
                    isCurrentPlan 
                        ? "bg-white/20 text-white cursor-not-allowed opacity-70" 
                        : "bg-white text-gray-900 hover:bg-gray-100 hover:shadow-lg transform hover:scale-105"
                }`}
                onClick={onSelect}
                disabled={isCurrentPlan || isProcessing}
            >
                {isProcessing ? (
                    <span className="flex items-center justify-center">
                        <div className="w-4 h-4 border-2 border-gray-900 border-t-transparent rounded-full animate-spin mr-2"></div>
                        Processing...
                    </span>
                ) : isCurrentPlan ? (
                    "Current Plan"
                ) : plan.id === "free" ? (
                    "Get Started Free"
                ) : (
                    "Choose Plan"
                )}
            </button>
        </div>
    )
}
