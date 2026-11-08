const authService = require("../services/authService")
const { verifyRecaptcha } = require("../utils/recaptcha")

/**
 * Auth Controller
 * Handles HTTP requests/responses for authentication endpoints.
 * Business logic lives in services/authService.js.
 */
class AuthController {
  /**
   * Helper: verify reCAPTCHA when configured.
   * @returns {Boolean} true when verification passed
   */
  async _verifyRecaptcha(recaptchaToken, ip) {
    if (!process.env.RECAPTCHA_SECRET_KEY) return true
    return verifyRecaptcha(recaptchaToken, ip)
  }

  /**
   * Helper: shared user payload shape
   */
  _userPayload(user) {
    return {
      id: user._id,
      email: user.email,
      name: user.name,
      authProvider: user.authProvider,
      avatar: user.avatar,
      plan: user.plan,
    }
  }

  /**
   * Helper: set the httpOnly auth cookie (browsers should use this instead
   * of persisting the JWT in localStorage — immune to XSS token theft).
   */
  _setAuthCookie(res, token) {
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // matches the JWT's 7d expiry
      path: "/",
    })
  }

  /**
   * Register a new user with email/password
   * POST /api/auth/register
   */
  async register(req, res) {
    try {
      const { email, password, name, phone, recaptchaToken } = req.body

      // Verify Google reCAPTCHA if configured
      const isHuman = await this._verifyRecaptcha(recaptchaToken, req.ip)
      if (!isHuman) {
        return res.status(400).json({ error: "reCAPTCHA verification failed. Please try again." })
      }

      const { user } = await authService.registerUser({ email, password, name, phone })

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

      if (error.message === "User already exists with this email") {
        return res.status(400).json({
          error: "User already exists with this email",
        })
      }

      res.status(500).json({
        error: "Registration failed",
        message: error.message,
      })
    }
  }

  /**
   * Login with email/password
   * POST /api/auth/login
   */
  async login(req, res) {
    try {
      const { email, password, recaptchaToken } = req.body

      // Verify Google reCAPTCHA if configured
      const isHuman = await this._verifyRecaptcha(recaptchaToken, req.ip)
      if (!isHuman) {
        return res.status(400).json({ error: "reCAPTCHA verification failed. Please try again." })
      }

      const { user, token } = await authService.loginUser({ email, password })

      this._setAuthCookie(res, token)

      res.json({
        success: true,
        message: "Login successful",
        token,
        user: this._userPayload(user),
      })
    } catch (error) {
      console.error("Login error:", error)

      if (error.code === "EMAIL_NOT_VERIFIED") {
        return res.status(403).json({
          error: error.message,
          code: error.code,
          canResendVerification: true,
        })
      }
      if (error.code === "ACCOUNT_DEACTIVATED") {
        return res.status(403).json({
          error: error.message,
          code: error.code,
        })
      }
      if (error.message === "Invalid credentials") {
        return res.status(401).json({ error: error.message })
      }
      if (error.message === "This account is registered with Google. Please use Google Sign-In.") {
        return res.status(400).json({ error: error.message })
      }

      res.status(500).json({
        error: "Login failed",
        message: error.message,
      })
    }
  }

  /**
   * Google OAuth callback — issue JWT and redirect to the frontend
   * GET /api/auth/google/callback
   */
  async googleCallback(req, res) {
    const frontendUrl = (process.env.FRONTEND_URL || "http://localhost:3000").replace(/\/+$/, "")

    try {
      // Generate JWT token for the authenticated user
      const token = authService.generateToken(req.user)

      // Store in an httpOnly cookie so the browser never keeps the JWT in JS
      this._setAuthCookie(res, token)

      // Redirect to frontend with token (kept for backward compatibility with
      // existing clients that read it from the URL; the cookie works on its own)
      res.redirect(`${frontendUrl}/?token=${token}&success=true`)
    } catch (error) {
      console.error("Google callback error:", error)
      res.redirect(`${frontendUrl}/login?error=authentication_failed`)
    }
  }

  /**
   * Get the authenticated user's profile
   * GET /api/auth/me
   */
  async getCurrentUser(req, res) {
    try {
      const user = await authService.getCurrentUser(req.user.id)

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
          isEmailVerified: user.isEmailVerified,
        },
      })
    } catch (error) {
      console.error("Get user error:", error)

      if (error.message === "User not found") {
        return res.status(404).json({ error: error.message })
      }

      res.status(500).json({
        error: "Failed to get user",
        message: error.message,
      })
    }
  }

  /**
   * Logout (client-side handles token removal)
   * POST /api/auth/logout
   */
  async logout(req, res) {
    res.clearCookie("token", { path: "/" })
    res.json({
      success: true,
      message: "Logged out successfully",
    })
  }

  /**
   * Upload a new avatar via Cloudinary
   * POST /api/auth/upload-avatar
   */
  async uploadAvatar(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({
          error: "No file uploaded",
        })
      }

      // Get the uploaded file URL from Cloudinary
      const avatarUrl = req.file.path

      const updatedUser = await authService.updateAvatar(req.user.id, avatarUrl)

      res.json({
        success: true,
        message: "Avatar uploaded successfully",
        avatar: avatarUrl,
        user: this._userPayload(updatedUser),
      })
    } catch (error) {
      console.error("Avatar upload error:", error)
      res.status(500).json({
        error: "Failed to upload avatar",
        message: error.message,
      })
    }
  }

  /**
   * Verify an email address
   * POST /api/auth/verify-email
   */
  async verifyEmail(req, res) {
    try {
      const { token } = req.body

      if (!token) {
        return res.status(400).json({ error: "Verification token is required" })
      }

      const user = await authService.verifyEmail(token)

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
          isEmailVerified: user.isEmailVerified,
        },
      })
    } catch (error) {
      console.error("Email verification error:", error)

      if (error.message === "Invalid or expired verification token") {
        return res.status(400).json({ error: error.message })
      }

      res.status(500).json({
        error: "Email verification failed",
        message: error.message,
      })
    }
  }

  /**
   * Resend the verification email
   * POST /api/auth/resend-verification
   */
  async resendVerification(req, res) {
    try {
      const { email } = req.body

      if (!email) {
        return res.status(400).json({ error: "Email is required" })
      }

      await authService.resendVerification(email)

      res.json({
        success: true,
        message: "Verification email sent successfully",
      })
    } catch (error) {
      console.error("Resend verification error:", error)

      if (error.message === "User not found") {
        return res.status(404).json({ error: error.message })
      }
      if (error.message === "Email is already verified") {
        return res.status(400).json({ error: error.message })
      }

      res.status(500).json({
        error: "Failed to resend verification email",
        message: error.message,
      })
    }
  }

  /**
   * Request a password reset email
   * POST /api/auth/forgot-password
   */
  async forgotPassword(req, res) {
    try {
      const { email } = req.body

      if (!email) {
        return res.status(400).json({ error: "Email is required" })
      }

      const { handled } = await authService.requestPasswordReset(email)

      if (!handled) {
        // Don't reveal if user exists or not for security
        return res.json({
          success: true,
          message: "If an account with that email exists, we've sent password reset instructions",
        })
      }

      res.json({
        success: true,
        message: "Password reset instructions sent to your email",
      })
    } catch (error) {
      console.error("Forgot password error:", error)

      if (error.message === "Google OAuth users cannot reset password. Please use Google sign-in.") {
        return res.status(400).json({ error: error.message })
      }

      res.status(500).json({
        error: "Failed to process password reset request",
        message: error.message,
      })
    }
  }

  /**
   * Reset password with a reset token
   * POST /api/auth/reset-password
   */
  async resetPassword(req, res) {
    try {
      const { token, password } = req.body

      if (!token || !password) {
        return res.status(400).json({ error: "Token and new password are required" })
      }

      if (password.length < 6) {
        return res.status(400).json({ error: "Password must be at least 6 characters long" })
      }

      await authService.resetPassword(token, password)

      res.json({
        success: true,
        message: "Password reset successfully!",
      })
    } catch (error) {
      console.error("Reset password error:", error)

      if (error.message === "Invalid or expired reset token") {
        return res.status(400).json({ error: error.message })
      }

      res.status(500).json({
        error: "Failed to reset password",
        message: error.message,
      })
    }
  }
}

module.exports = new AuthController()
