"use client"

import type React from "react"
import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Eye, EyeOff, Mail, Lock, User, Play, AlertCircle, CheckCircle, Phone, Loader2 } from "lucide-react"
import { toast } from "@/hooks/use-toast"

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api"

function LoginPageContent() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const [isLoading, setIsLoading] = useState(false)
    const [showPassword, setShowPassword] = useState(false)
    const [showConfirmPassword, setShowConfirmPassword] = useState(false)
    const [error, setError] = useState("")
    const [success, setSuccess] = useState("")
    const [activeTab, setActiveTab] = useState("login")

    // Login form state
    const [loginData, setLoginData] = useState({
        email: "",
        password: "",
    })

    // Register form state
    const [registerData, setRegisterData] = useState({
        name: "",
        email: "",
        password: "",
        confirmPassword: "",
    })

    // Handle OAuth success/error from URL params
    useEffect(() => {
        const token = searchParams.get("token")
        const success = searchParams.get("success")
        const error = searchParams.get("error")

        if (token && success) {
            localStorage.setItem("token", token)
            
            // Fetch user data with the token
            fetchUserData(token)
        } else if (error) {
            setError("Authentication failed. Please try again.")
        }
    }, [searchParams, router])

    // Fetch user data using token
    const fetchUserData = async (token: string) => {
        try {
            console.log("Login: Fetching user data with token...")
            const response = await fetch(`${API_BASE}/auth/me`, {
                headers: {
                    "Authorization": `Bearer ${token}`,
                },
            })

            const data = await response.json()
            console.log("Login: User data response:", data)

            if (response.ok && data.user) {
                localStorage.setItem("user", JSON.stringify(data.user))
                console.log("Login: User data stored successfully")
                
                // Trigger auth state change event
                window.dispatchEvent(new Event("authStateChanged"))
                
                toast({
                    title: "Login Successful!",
                    description: "Welcome back to YouTube Mate!",
                })
                router.push("/")
            } else {
                console.error("Login: Failed to fetch user data:", data)
                throw new Error("Failed to fetch user data")
            }
        } catch (error) {
            console.error("Login: Error fetching user data:", error)
            setError("Failed to complete authentication. Please try again.")
            localStorage.removeItem("token")
        }
    }

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)
        setError("")

        try {
            const response = await fetch(`${API_BASE}/auth/login`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(loginData),
            })

            const data = await response.json()

            if (response.ok) {
                localStorage.setItem("token", data.token)
                localStorage.setItem("user", JSON.stringify(data.user))

                // Trigger auth state change event
                window.dispatchEvent(new Event("authStateChanged"))

                toast({
                    title: "Login Successful!",
                    description: "Welcome back to YouTube Mate!",
                })

                router.push("/")
            } else {
                // Check if the error is due to email not verified
                if (data.error === "EMAIL_NOT_VERIFIED") {
                    // Store the user's email for the verification-required page
                    localStorage.setItem("pendingVerificationEmail", loginData.email)
                    router.push("/verification-required")
                    return
                }
                setError(data.error || "Login failed")
            }
        } catch (error) {
            setError("Network error. Please try again.")
        } finally {
            setIsLoading(false)
        }
    }

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)
        setError("")

        if (registerData.password !== registerData.confirmPassword) {
            setError("Passwords do not match")
            setIsLoading(false)
            return
        }

        if (registerData.password.length < 6) {
            setError("Password must be at least 6 characters long")
            setIsLoading(false)
            return
        }

        try {
            const response = await fetch(`${API_BASE}/auth/register`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    name: registerData.name,
                    email: registerData.email,
                    password: registerData.password,
                }),
            })

            const data = await response.json()

            if (response.ok) {
                // For normal registration, users need to verify their email first
                // Store the user's email for the verification-required page
                localStorage.setItem("pendingVerificationEmail", registerData.email)

                setSuccess("Account created successfully! Please check your email to verify your account.")

                toast({
                    title: "Registration Successful!",
                    description: "Please check your email to verify your account before logging in.",
                })

                setTimeout(() => {
                    router.push("/verification-required")
                }, 2000)
            } else {
                setError(data.error || "Registration failed")
            }
        } catch (error) {
            setError("Network error. Please try again.")
        } finally {
            setIsLoading(false)
        }
    }

    const handleGoogleLogin = () => {
        window.location.href = `${API_BASE}/auth/google`
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-orange-50 via-red-50 to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex">
            {/* Left Side - Form */}
            <div className="flex-1 flex items-center justify-center p-2 lg:p-6">
                <div className="w-full max-w-md space-y-8">
                    {/* Header */}
                    <div className="text-center">
                        <div className="flex items-center justify-center" onClick={() => (window.location.href = "/")}>
                            <div className="p-3 rounded-full bg-gradient-to-r from-orange-500 to-red-600 shadow-lg">
                                <Play className="w-4 h-4 text-white" />
                            </div>
                            <h1 className="ml-2 text-3xl font-bold bg-gradient-to-r from-orange-500 to-red-600 bg-clip-text text-transparent mb-2">
                                YouTube Mate
                            </h1>
                        </div>
                        <p className="text-gray-600 dark:text-gray-300 text-sm mt-5">
                            {activeTab === "login" ? "Welcome back! Sign in to your account" : "Create your account to get started"}
                        </p>
                    </div>

                    {/* Error/Success Messages */}
                    {error && (
                        <Alert className="border-red-200 bg-red-50/80 dark:bg-red-900/20 backdrop-blur-sm">
                            <AlertCircle className="h-4 w-4 text-red-600" />
                            <AlertDescription className="text-red-600 dark:text-red-400">{error}</AlertDescription>
                        </Alert>
                    )}

                    {success && (
                        <Alert className="border-green-200 bg-green-50/80 dark:bg-green-900/20 backdrop-blur-sm">
                            <CheckCircle className="h-4 w-4 text-green-600" />
                            <AlertDescription className="text-green-600 dark:text-green-400">{success}</AlertDescription>
                        </Alert>
                    )}

                    {/* Glassmorphism Card */}
                    <Card className="bg-white/20 dark:bg-gray-800/20 backdrop-blur-xl border border-white/30 dark:border-gray-700/30 shadow-2xl">
                        <CardContent className="p-6">
                            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                                <TabsList className="grid w-full grid-cols-2 bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm border border-white/20">
                                    <TabsTrigger
                                        value="login"
                                        className="data-[state=active]:bg-white/80 data-[state=active]:text-gray-900 data-[state=active]:shadow-sm"
                                    >
                                        Sign In
                                    </TabsTrigger>
                                    <TabsTrigger
                                        value="register"
                                        className="data-[state=active]:bg-white/80 data-[state=active]:text-gray-900 data-[state=active]:shadow-sm"
                                    >
                                        Sign Up
                                    </TabsTrigger>
                                </TabsList>

                                {/* Login Tab */}
                                <TabsContent value="login" className="space-y-6">
                                    <form onSubmit={handleLogin} className="space-y-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="login-email" className="text-gray-700 dark:text-gray-200 font-medium">
                                                Email Address
                                            </Label>
                                            <div className="relative">
                                                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                                                <Input
                                                    id="login-email"
                                                    type="email"
                                                    placeholder="Enter your email"
                                                    value={loginData.email}
                                                    onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                                                    className="pl-10 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm border-white/30 dark:border-gray-600/30 focus:border-orange-500 focus:ring-orange-500/20"
                                                    required
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="login-password" className="text-gray-700 dark:text-gray-200 font-medium">
                                                Password
                                            </Label>
                                            <div className="relative">
                                                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                                                <Input
                                                    id="login-password"
                                                    type={showPassword ? "text" : "password"}
                                                    placeholder="Enter your password"
                                                    value={loginData.password}
                                                    onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                                                    className="pl-10 pr-10 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm border-white/30 dark:border-gray-600/30 focus:border-orange-500 focus:ring-orange-500/20"
                                                    required
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowPassword(!showPassword)}
                                                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                                >
                                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                                </button>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-end">
                                            <Link
                                                href="/forgot-password"
                                                className="text-sm text-orange-600 hover:text-orange-500 font-medium"
                                            >
                                                Forgot password?
                                            </Link>
                                        </div>

                                        <Button
                                            type="submit"
                                            disabled={isLoading}
                                            className="w-full bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-medium py-3 shadow-lg hover:shadow-xl transition-all duration-200"
                                        >
                                            {isLoading ? "Signing in..." : "Sign In"}
                                        </Button>
                                    </form>

                                    <div className="relative">
                                        <div className="absolute inset-0 flex items-center">
                                            <span className="w-full border-t border-gray-300/50 dark:border-gray-600/50" />
                                        </div>
                                        <div className="relative flex justify-center text-xs uppercase">
                                            <span className="bg-white/80 dark:bg-gray-800/80 px-3 text-gray-500 font-medium backdrop-blur-sm">
                                                Or continue with
                                            </span>
                                        </div>
                                    </div>

                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={handleGoogleLogin}
                                        className="w-full bg-white hover:bg-gray-50 text-gray-700 border-gray-300 font-medium py-3 shadow-md hover:shadow-lg transition-all duration-200"
                                    >
                                        <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                                            <path
                                                fill="#4285F4"
                                                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                            />
                                            <path
                                                fill="#34A853"
                                                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                            />
                                            <path
                                                fill="#FBBC05"
                                                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                            />
                                            <path
                                                fill="#EA4335"
                                                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                            />
                                        </svg>
                                        Continue with Google
                                    </Button>

                                    <div className="text-center">
                                        <p className="text-sm text-gray-600 dark:text-gray-400">
                                            Don't have an account?{" "}
                                            <button
                                                type="button"
                                                onClick={() => setActiveTab("register")}
                                                className="text-orange-600 hover:text-orange-500 font-medium"
                                            >
                                                Register
                                            </button>
                                        </p>
                                    </div>
                                </TabsContent>

                                {/* Register Tab */}
                                <TabsContent value="register" className="space-y-6">
                                    <form onSubmit={handleRegister} className="space-y-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="register-name" className="text-gray-700 dark:text-gray-200 font-medium">
                                                Full Name
                                            </Label>
                                            <div className="relative">
                                                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                                                <Input
                                                    id="register-name"
                                                    type="text"
                                                    placeholder="Enter your full name"
                                                    value={registerData.name}
                                                    onChange={(e) => setRegisterData({ ...registerData, name: e.target.value })}
                                                    className="pl-10 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm border-white/30 dark:border-gray-600/30 focus:border-orange-500 focus:ring-orange-500/20"
                                                    required
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="register-email" className="text-gray-700 dark:text-gray-200 font-medium">
                                                Email Address
                                            </Label>
                                            <div className="relative">
                                                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                                                <Input
                                                    id="register-email"
                                                    type="email"
                                                    placeholder="Enter your email"
                                                    value={registerData.email}
                                                    onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })}
                                                    className="pl-10 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm border-white/30 dark:border-gray-600/30 focus:border-orange-500 focus:ring-orange-500/20"
                                                    required
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="register-password" className="text-gray-700 dark:text-gray-200 font-medium">
                                                Password
                                            </Label>
                                            <div className="relative">
                                                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                                                <Input
                                                    id="register-password"
                                                    type={showPassword ? "text" : "password"}
                                                    placeholder="Create a password"
                                                    value={registerData.password}
                                                    onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })}
                                                    className="pl-10 pr-10 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm border-white/30 dark:border-gray-600/30 focus:border-orange-500 focus:ring-orange-500/20"
                                                    required
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowPassword(!showPassword)}
                                                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                                >
                                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                                </button>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <Label
                                                htmlFor="register-confirm-password"
                                                className="text-gray-700 dark:text-gray-200 font-medium"
                                            >
                                                Confirm Password
                                            </Label>
                                            <div className="relative">
                                                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                                                <Input
                                                    id="register-confirm-password"
                                                    type={showConfirmPassword ? "text" : "password"}
                                                    placeholder="Confirm your password"
                                                    value={registerData.confirmPassword}
                                                    onChange={(e) => setRegisterData({ ...registerData, confirmPassword: e.target.value })}
                                                    className="pl-10 pr-10 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm border-white/30 dark:border-gray-600/30 focus:border-orange-500 focus:ring-orange-500/20"
                                                    required
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                                >
                                                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                                </button>
                                            </div>
                                        </div>

                                        <Button
                                            type="submit"
                                            disabled={isLoading}
                                            className="w-full bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-medium py-3 shadow-lg hover:shadow-xl transition-all duration-200"
                                        >
                                            {isLoading ? "Creating account..." : "Create Account"}
                                        </Button>
                                    </form>

                                    <div className="relative">
                                        <div className="absolute inset-0 flex items-center">
                                            <span className="w-full border-t border-gray-300/50 dark:border-gray-600/50" />
                                        </div>
                                        <div className="relative flex justify-center text-xs uppercase">
                                            <span className="bg-white/80 dark:bg-gray-800/80 px-3 text-gray-500 font-medium backdrop-blur-sm">
                                                Or continue with
                                            </span>
                                        </div>
                                    </div>

                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={handleGoogleLogin}
                                        className="w-full bg-white hover:bg-gray-50 text-gray-700 border-gray-300 font-medium py-3 shadow-md hover:shadow-lg transition-all duration-200"
                                    >
                                        <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                                            <path
                                                fill="#4285F4"
                                                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                            />
                                            <path
                                                fill="#34A853"
                                                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                            />
                                            <path
                                                fill="#FBBC05"
                                                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                            />
                                            <path
                                                fill="#EA4335"
                                                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                            />
                                        </svg>
                                        Continue with Google
                                    </Button>

                                    <div className="text-center">
                                        <p className="text-sm text-gray-600 dark:text-gray-400">
                                            Already have an account?{" "}
                                            <button
                                                type="button"
                                                onClick={() => setActiveTab("login")}
                                                className="text-orange-600 hover:text-orange-500 font-medium"
                                            >
                                                Sign In
                                            </button>
                                        </p>
                                    </div>
                                </TabsContent>
                            </Tabs>

                            {/* Terms and Services */}
                            <div className="text-center mt-4">
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                    By creating an account you agree to our{" "}
                                    <span className="text-orange-600 hover:text-orange-500 underline">
                                        Terms of Service
                                    </span>{" "}
                                    {/* <Link href="/terms" className="text-orange-600 hover:text-orange-500 underline">
                                        Terms of Service
                                    </Link>{" "} */}
                                    and{" "}
                                    <span className="text-orange-600 hover:text-orange-500 underline">
                                        Privacy Policy
                                    </span>
                                    {/* <Link href="/privacy" className="text-orange-600 hover:text-orange-500 underline">
                                        Privacy Policy
                                    </Link> */}
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Right Side - Image */}
            <div className="hidden lg:flex flex-1 items-center justify-center p-8 relative overflow-hidden">
                {/* Background Video */}
                <div className="absolute inset-0 z-0">
                    <video 
                        autoPlay 
                        loop 
                        muted 
                        className="w-full h-full object-cover"
                    >
                        <source src="/vid.mp4" type="video/mp4" />
                        Your browser does not support the video tag.
                    </video>
                </div>
                <div className="relative z-10 text-center space-y-6 max-w-lg">
                    {/* Glassmorphism Card for Content */}
                    <div className="bg-white/10 dark:bg-gray-800/10 backdrop-blur-xl border border-white/20 dark:border-gray-700/20 rounded-3xl p-4 shadow-2xl">
                        <div className="w-32 h-32 mx-auto bg-gradient-to-br from-orange-400 to-red-600 rounded-full flex items-center justify-center shadow-2xl mb-6">
                            <Play className="w-16 h-16 text-white" onClick={() => (window.location.href = "/")}/>
                        </div>
                        <h2 className="text-4xl font-bold text-white drop-shadow-lg mb-4">Welcome to YouTube Mate</h2>
                        <p className="text-lg text-white/90 leading-relaxed drop-shadow-md mb-8">
                            Your ultimate companion for YouTube content management. Download videos, create playlists, generate
                            transcripts, and collaborate with others seamlessly.
                        </p>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-white/20 dark:bg-gray-800/20 backdrop-blur-sm rounded-lg p-4 border border-white/30">
                                <h3 className="font-semibold text-white mb-2 drop-shadow-md">Video/Audio Downloads</h3>
                                <p className="text-sm text-white/80 drop-shadow-sm">Download youtube videos in multiple formats</p>
                            </div>
                            <div className="bg-white/20 dark:bg-gray-800/20 backdrop-blur-sm rounded-lg p-4 border border-white/30">
                                <h3 className="font-semibold text-white mb-2 drop-shadow-md">Smart Playlists</h3>
                                <p className="text-sm text-white/80 drop-shadow-sm">Organize and share your collections</p>
                            </div>
                            <div className="bg-white/20 dark:bg-gray-800/20 backdrop-blur-sm rounded-lg p-4 border border-white/30">
                                <h3 className="font-semibold text-white mb-2 drop-shadow-md">AI Transcripts</h3>
                                <p className="text-sm text-white/80 drop-shadow-sm">Generate accurate transcriptions & summaries</p>
                            </div>
                            <div className="bg-white/20 dark:bg-gray-800/20 backdrop-blur-sm rounded-lg p-4 border border-white/30">
                                <h3 className="font-semibold text-white mb-2 drop-shadow-md">URL Shortener</h3>
                                <p className="text-sm text-white/80 drop-shadow-sm">Create short, trackable links. Share links with timestamps</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center"><div className="text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" /><p>Loading...</p></div></div>}>
      <LoginPageContent />
    </Suspense>
  )
}
