const express = require("express")
const router = express.Router()
const jwt = require("jsonwebtoken")
const User = require("../models/User")
const { validateRegistration, validateLogin } = require("../middleware/validation")
const { rateLimiter } = require("../middleware/rateLimiter")

// Register
router.post("/register", rateLimiter, validateRegistration, async (req, res) => {
  try {
    const { email, password, name } = req.body

    // Check if user already exists
    const existingUser = await User.findOne({ email })
    if (existingUser) {
      return res.status(400).json({ error: "User already exists with this email" })
    }

    // Create new user
    const user = new User({ email, password, name })
    await user.save()

    // Generate JWT token
    const token = jwt.sign({ id: user._id, email: user.email }, process.env.JWT_SECRET || "your-secret-key", {
      expiresIn: "7d",
    })

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      token,
      user: user.toJSON(),
    })
  } catch (error) {
    console.error("Registration error:", error)
    res.status(500).json({
      error: "Registration failed",
      message: error.message,
    })
  }
})

// Login
router.post("/login", rateLimiter, validateLogin, async (req, res) => {
  try {
    const { email, password } = req.body

    // Find user
    const user = await User.findOne({ email, isActive: true })
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" })
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
    const token = jwt.sign({ id: user._id, email: user.email }, process.env.JWT_SECRET || "your-secret-key", {
      expiresIn: "7d",
    })

    res.json({
      success: true,
      message: "Login successful",
      token,
      user: user.toJSON(),
    })
  } catch (error) {
    console.error("Login error:", error)
    res.status(500).json({
      error: "Login failed",
      message: error.message,
    })
  }
})

// Get current user
router.get("/me", require("../middleware/auth").authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
    if (!user) {
      return res.status(404).json({ error: "User not found" })
    }

    res.json({
      success: true,
      user: user.toJSON(),
    })
  } catch (error) {
    console.error("Get user error:", error)
    res.status(500).json({
      error: "Failed to get user",
      message: error.message,
    })
  }
})

module.exports = router