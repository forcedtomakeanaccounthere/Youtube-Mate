const express = require("express")
const router = express.Router()
const passport = require("passport")
const jwt = require("jsonwebtoken")
const User = require("../models/User")
const { validateRegistration, validateLogin } = require("../middleware/validation")
const { rateLimiter } = require("../middleware/rateLimiter")
const { authenticateToken } = require("../middleware/auth")
const { upload, cloudinary } = require("../config/cloudinary")

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

    // Create new user
    const user = new User({ 
      email, 
      password, 
      name,
      phone,
      authProvider: "local"
    })
    await user.save()

    // Generate JWT token
    const token = generateToken(user)

    res.status(201).json({
      success: true,
      message: "User registered successfully",
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

    // Find user
    const user = await User.findOne({ email, isActive: true })
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" })
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
    scope: ["profile", "email"] 
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
        plan: user.plan
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
router.post("/upload-avatar", authenticateToken, upload.single("avatar"), async (req, res) => {
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
        console.log("Failed to delete old avatar:", deleteError.message)
        // Continue anyway
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

module.exports = router