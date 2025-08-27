const express = require("express")
const router = express.Router()
const passport = require("passport")
const jwt = require("jsonwebtoken")
const crypto = require("crypto")
const User = require("../models/User")
const { validateRegistration, validateLogin } = require("../middleware/validation")
const { rateLimiter } = require("../middleware/rateLimiter")
const { authenticateToken } = require("../middleware/auth")
const { uploadAvatar, cloudinary } = require("../config/cloudinary")
const { 
  sendVerificationEmail, 
  sendPasswordResetEmail, 
  sendWelcomeEmail 
} = require("../services/emailService")

// Helper function to generate JWT token
const generateToken = (user) => {
  return jwt.sign(
    { 
      id: user._id, 
      email: user.email,
      name: user.name,
      authProvider: user.authProvider 
    },
    process.env.JWT_SECRET || "your-secret-key",
    { expiresIn: "7d" }
  )
}

// Register with email/password
router.post("/register", rateLimiter, validateRegistration, async (req, res) => {
  try {
    const { email, password, name, phone } = req.body

    // Check if user already exists
    const existingUser = await User.findOne({ email })
    if (existingUser) {
      return res.status(400).json({ 
        error: "User already exists with this email" 
      })
    }

    // Generate email verification token
    const verificationToken = crypto.randomBytes(32).toString("hex")
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

    // Create new user (inactive until email verification)
    const user = new User({ 
      email, 
      password, 
      name,
      phone,
      authProvider: "local",
      isActive: false, // Account inactive until email verification
      emailVerificationToken: verificationToken,
      emailVerificationExpires: verificationExpires
    })
    await user.save()

    // Send verification email
    try {
      await sendVerificationEmail(email, name, verificationToken)
    } catch (emailError) {
      console.error("❌ Failed to send verification email:", emailError)
      // Don't fail registration if email fails, just log it
    }

    // DO NOT generate JWT token for unverified users
    // User must verify email before they can login

    res.status(201).json({
      success: true,
      message: "Registration successful! Please check your email to verify your account before logging in.",
      requiresVerification: true,
      email: user.email, // Only return email for verification purposes
      // No token or user data until verified
    })
  } catch (error) {
    console.error("Registration error:", error)
    res.status(500).json({
      error: "Registration failed",
      message: error.message,
    })
  }
})

// Login with email/password
router.post("/login", rateLimiter, validateLogin, async (req, res) => {
  try {
    const { email, password } = req.body

    // Find user (including inactive ones for better error messages)
    const user = await User.findOne({ email })
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" })
    }

    // Check if account is inactive due to unverified email
    if (!user.isActive && !user.isEmailVerified) {
      return res.status(403).json({ 
        error: "Please verify your email address before logging in.",
        code: "EMAIL_NOT_VERIFIED",
        canResendVerification: true
      })
    }

    // Check if account is inactive for other reasons
    if (!user.isActive) {
      return res.status(403).json({ 
        error: "Your account has been deactivated. Please contact support.",
        code: "ACCOUNT_DEACTIVATED"
      })
    }

    // Check if user registered with Google
    if (user.authProvider === "google") {
      return res.status(400).json({ 
        error: "This account is registered with Google. Please use Google Sign-In." 
      })
    }

    // Check password
    const isValidPassword = await user.comparePassword(password)
    if (!isValidPassword) {
      return res.status(401).json({ error: "Invalid credentials" })
    }

    // Update last login
    user.lastLogin = new Date()
    await user.save()

    // Generate JWT token
    const token = generateToken(user)

    res.json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        authProvider: user.authProvider,
        avatar: user.avatar,
        plan: user.plan
      }
    })
  } catch (error) {
    console.error("Login error:", error)
    res.status(500).json({
      error: "Login failed",
      message: error.message,
    })
  }
})

// Google OAuth routes
router.get("/google", 
  passport.authenticate("google", { 
    scope: ["profile", "email"],
    prompt: "select_account" 
  })
)

router.get("/google/callback",
  passport.authenticate("google", { session: false }),
  async (req, res) => {
    try {
      // Generate JWT token for the authenticated user
      const token = generateToken(req.user)
      
      // Redirect to frontend with token
      res.redirect(`${process.env.FRONTEND_URL}/?token=${token}&success=true`)
    } catch (error) {
      console.error("Google callback error:", error)
      res.redirect(`${process.env.FRONTEND_URL}/login?error=authentication_failed`)
    }
  }
)

// Get current user
router.get("/me", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
    if (!user) {
      return res.status(404).json({ error: "User not found" })
    }

    res.json({
      success: true,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        authProvider: user.authProvider,
        avatar: user.avatar,
        plan: user.plan,
        currentPlan: user.plan, // Alias for frontend compatibility
        subscription: user.subscription,
        isEmailVerified: user.isEmailVerified
      }
    })
  } catch (error) {
    console.error("Get user error:", error)
    res.status(500).json({
      error: "Failed to get user",
      message: error.message,
    })
  }
})

// Logout (client-side handles token removal)
router.post("/logout", (req, res) => {
  res.json({
    success: true,
    message: "Logged out successfully"
  })
})

// Upload avatar
router.post("/upload-avatar", authenticateToken, uploadAvatar.single("avatar"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        error: "No file uploaded" 
      })
    }

    // Get the uploaded file URL from Cloudinary
    const avatarUrl = req.file.path

    // Delete old avatar from Cloudinary if it exists and is not from Google
    const user = await User.findById(req.user.id)
    if (user.avatar && user.avatar.includes("cloudinary.com")) {
      try {
        // Extract public_id from the Cloudinary URL
        const urlParts = user.avatar.split("/")
        const filename = urlParts[urlParts.length - 1]
        const publicId = filename.split(".")[0]
        await cloudinary.uploader.destroy(`youtube-mate/avatars/${publicId}`)
      } catch (deleteError) {
        // Continue anyway - old avatar cleanup is not critical
      }
    }

    // Update user's avatar in database
    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      { avatar: avatarUrl },
      { new: true }
    )

    res.json({
      success: true,
      message: "Avatar uploaded successfully",
      avatar: avatarUrl,
      user: {
        id: updatedUser._id,
        email: updatedUser.email,
        name: updatedUser.name,
        authProvider: updatedUser.authProvider,
        avatar: updatedUser.avatar,
        plan: updatedUser.plan
      }
    })
  } catch (error) {
    console.error("Avatar upload error:", error)
    res.status(500).json({
      error: "Failed to upload avatar",
      message: error.message,
    })
  }
})

// Email Verification Routes

// Verify email
router.post("/verify-email", async (req, res) => {
  try {
    const { token } = req.body

    if (!token) {
      return res.status(400).json({ error: "Verification token is required" })
    }

    // Find user with valid verification token
    const user = await User.findOne({
      emailVerificationToken: token,
      emailVerificationExpires: { $gt: Date.now() }
    })

    if (!user) {
      return res.status(400).json({ 
        error: "Invalid or expired verification token" 
      })
    }

    // Mark email as verified, activate account, and clear verification fields
    user.isEmailVerified = true
    user.isActive = true // Activate account upon email verification
    user.emailVerificationToken = null
    user.emailVerificationExpires = null
    await user.save()

    // Send welcome email
    try {
      await sendWelcomeEmail(user.email, user.name)
    } catch (emailError) {
      console.error("❌ Failed to send welcome email:", emailError)
    }

    res.json({
      success: true,
      message: "Email verified successfully!",
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        authProvider: user.authProvider,
        avatar: user.avatar,
        plan: user.plan,
        isEmailVerified: user.isEmailVerified
      }
    })
  } catch (error) {
    console.error("Email verification error:", error)
    res.status(500).json({
      error: "Email verification failed",
      message: error.message,
    })
  }
})

// Resend verification email
router.post("/resend-verification", rateLimiter, async (req, res) => {
  try {
    const { email } = req.body

    if (!email) {
      return res.status(400).json({ error: "Email is required" })
    }

    const user = await User.findOne({ email })
    if (!user) {
      return res.status(404).json({ error: "User not found" })
    }

    if (user.isEmailVerified) {
      return res.status(400).json({ error: "Email is already verified" })
    }

    // Generate new verification token
    const verificationToken = crypto.randomBytes(32).toString("hex")
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

    user.emailVerificationToken = verificationToken
    user.emailVerificationExpires = verificationExpires
    await user.save()

    // Send verification email
    await sendVerificationEmail(user.email, user.name, verificationToken)

    res.json({
      success: true,
      message: "Verification email sent successfully"
    })
  } catch (error) {
    console.error("Resend verification error:", error)
    res.status(500).json({
      error: "Failed to resend verification email",
      message: error.message,
    })
  }
})

// Password Reset Routes

// Request password reset
router.post("/forgot-password", rateLimiter, async (req, res) => {
  try {
    const { email } = req.body

    if (!email) {
      return res.status(400).json({ error: "Email is required" })
    }

    const user = await User.findOne({ email })
    if (!user) {
      // Don't reveal if user exists or not for security
      return res.json({
        success: true,
        message: "If an account with that email exists, we've sent password reset instructions"
      })
    }

    // Don't allow password reset for Google OAuth users
    if (user.authProvider === "google") {
      return res.status(400).json({ 
        error: "Google OAuth users cannot reset password. Please use Google sign-in." 
      })
    }

    // Generate password reset token
    const resetToken = crypto.randomBytes(32).toString("hex")
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

    user.passwordResetToken = resetToken
    user.passwordResetExpires = resetExpires
    await user.save()

    // Send password reset email
    await sendPasswordResetEmail(user.email, user.name, resetToken)

    res.json({
      success: true,
      message: "Password reset instructions sent to your email"
    })
  } catch (error) {
    console.error("Forgot password error:", error)
    res.status(500).json({
      error: "Failed to process password reset request",
      message: error.message,
    })
  }
})

// Reset password
router.post("/reset-password", async (req, res) => {
  try {
    const { token, password } = req.body

    if (!token || !password) {
      return res.status(400).json({ error: "Token and new password are required" })
    }

    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters long" })
    }

    // Find user with valid reset token
    const user = await User.findOne({
      passwordResetToken: token,
      passwordResetExpires: { $gt: Date.now() }
    })

    if (!user) {
      return res.status(400).json({ 
        error: "Invalid or expired reset token" 
      })
    }

    // Update password and clear reset fields
    user.password = password // Will be hashed by pre-save middleware
    user.passwordResetToken = null
    user.passwordResetExpires = null
    await user.save()

    res.json({
      success: true,
      message: "Password reset successfully!"
    })
  } catch (error) {
    console.error("Reset password error:", error)
    res.status(500).json({
      error: "Failed to reset password",
      message: error.message,
    })
  }
})

// Resend verification email
router.post('/resend-verification', async (req, res) => {
  try {
    const { email } = req.body
    
    if (!email) {
      return res.status(400).json({ error: "Email is required" })
    }
    
    const user = await User.findOne({ email })
    if (!user) {
      return res.status(404).json({ error: "User not found" })
    }
    
    if (user.isEmailVerified) {
      return res.status(400).json({ error: "Email is already verified" })
    }
    
    // Generate new verification token
    const verificationToken = crypto.randomBytes(32).toString('hex')
    user.emailVerificationToken = verificationToken
    await user.save()
    
    // Send verification email
    await sendVerificationEmail(user.email, verificationToken)
    
    res.json({ 
      message: "Verification email sent successfully",
      email: user.email
    })
    
  } catch (error) {
    console.error('Error resending verification email:', error)
    res.status(500).json({ error: "Internal server error" })
  }
})

module.exports = router