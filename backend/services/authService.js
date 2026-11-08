const User = require("../models/User")
const jwt = require("jsonwebtoken")
const crypto = require("crypto")
const { cloudinary } = require("../config/cloudinary")
const {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
} = require("./emailService")

/**
 * Authentication Service
 * Business logic for registration, login, email verification, password
 * reset, and avatars — matching the User schema (authProvider, isActive,
 * isEmailVerified, emailVerification*, passwordReset* fields).
 *
 * JWT payload contract: { id, email, name, authProvider } — middleware/auth.js
 * resolves users via decoded.id, so this shape MUST NOT change.
 */
class AuthService {
  /**
   * Generate a JWT for a user
   */
  generateToken(user) {
    return jwt.sign(
      {
        id: user._id,
        email: user.email,
        name: user.name,
        authProvider: user.authProvider,
      },
      require("../config/env").getJwtSecret(),
      { expiresIn: "7d" }
    )
  }

  /**
   * Register a new user (inactive until email verification).
   * Sends the verification email; email failures are logged, not fatal.
   * @returns {Promise<{user: Object}>}
   */
  async registerUser({ email, password, name, phone }) {
    // Check if user already exists
    const existingUser = await User.findOne({ email })
    if (existingUser) {
      throw new Error("User already exists with this email")
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
      emailVerificationExpires: verificationExpires,
    })
    await user.save()

    // Send verification email
    try {
      await sendVerificationEmail(email, name, verificationToken)
    } catch (emailError) {
      console.error("❌ Failed to send verification email:", emailError)
      // Don't fail registration if email fails, just log it
    }

    return { user }
  }

  /**
   * Login with email/password. Order of checks produces distinct,
   * frontend-consumed error codes — preserve it.
   * @returns {Promise<{user: Object, token: String}>}
   */
  async loginUser({ email, password }) {
    // Find user (including inactive ones for better error messages)
    const user = await User.findOne({ email })
    if (!user) {
      throw new Error("Invalid credentials")
    }

    // Check if account is inactive due to unverified email
    if (!user.isActive && !user.isEmailVerified) {
      const error = new Error("Please verify your email address before logging in.")
      error.code = "EMAIL_NOT_VERIFIED"
      error.canResendVerification = true
      throw error
    }

    // Check if account is inactive for other reasons
    if (!user.isActive) {
      const error = new Error("Your account has been deactivated. Please contact support.")
      error.code = "ACCOUNT_DEACTIVATED"
      throw error
    }

    // Check if user registered with Google
    if (user.authProvider === "google") {
      throw new Error("This account is registered with Google. Please use Google Sign-In.")
    }

    // Check password
    const isValidPassword = await user.comparePassword(password)
    if (!isValidPassword) {
      throw new Error("Invalid credentials")
    }

    // Update last login
    user.lastLogin = new Date()
    await user.save()

    return { user, token: this.generateToken(user) }
  }

  /**
   * Get a user by ID (for GET /me)
   */
  async getCurrentUser(userId) {
    const user = await User.findById(userId)
    if (!user) {
      throw new Error("User not found")
    }
    return user
  }

  /**
   * Update the user's avatar, cleaning up the previous Cloudinary avatar.
   * @returns {Promise<Object>} updated user document
   */
  async updateAvatar(userId, avatarUrl) {
    // Delete old avatar from Cloudinary if it exists and is not from Google
    const user = await User.findById(userId)
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
    return User.findByIdAndUpdate(userId, { avatar: avatarUrl }, { new: true })
  }

  /**
   * Verify an email address with a verification token and activate the
   * account. Sends the welcome email; email failures are logged, not fatal.
   * @returns {Promise<Object>} the verified user
   */
  async verifyEmail(token) {
    // Find user with valid verification token
    const user = await User.findOne({
      emailVerificationToken: token,
      emailVerificationExpires: { $gt: Date.now() },
    })

    if (!user) {
      throw new Error("Invalid or expired verification token")
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

    return user
  }

  /**
   * Generate and send a fresh verification email.
   * Email failures propagate (the request fails) — as before.
   */
  async resendVerification(email) {
    const user = await User.findOne({ email })
    if (!user) {
      throw new Error("User not found")
    }

    if (user.isEmailVerified) {
      throw new Error("Email is already verified")
    }

    // Generate new verification token
    const verificationToken = crypto.randomBytes(32).toString("hex")
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

    user.emailVerificationToken = verificationToken
    user.emailVerificationExpires = verificationExpires
    await user.save()

    // Send verification email
    await sendVerificationEmail(user.email, user.name, verificationToken)

    return user
  }

  /**
   * Generate and email a password reset token.
   * @returns {Promise<{handled: Boolean}>} handled=false when the email is
   *   unknown (the caller responds with the generic non-revealing message)
   */
  async requestPasswordReset(email) {
    const user = await User.findOne({ email })
    if (!user) {
      // Don't reveal if user exists or not for security
      return { handled: false }
    }

    // Don't allow password reset for Google OAuth users
    if (user.authProvider === "google") {
      throw new Error("Google OAuth users cannot reset password. Please use Google sign-in.")
    }

    // Generate password reset token
    const resetToken = crypto.randomBytes(32).toString("hex")
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

    user.passwordResetToken = resetToken
    user.passwordResetExpires = resetExpires
    await user.save()

    // Send password reset email
    await sendPasswordResetEmail(user.email, user.name, resetToken)

    return { handled: true }
  }

  /**
   * Reset a password with a reset token. The pre-save middleware hashes it.
   */
  async resetPassword(token, password) {
    // Find user with valid reset token
    const user = await User.findOne({
      passwordResetToken: token,
      passwordResetExpires: { $gt: Date.now() },
    })

    if (!user) {
      throw new Error("Invalid or expired reset token")
    }

    // Update password and clear reset fields
    user.password = password // Will be hashed by pre-save middleware
    user.passwordResetToken = null
    user.passwordResetExpires = null
    await user.save()

    return user
  }
}

module.exports = new AuthService()
