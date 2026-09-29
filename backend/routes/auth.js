const express = require("express")
const router = express.Router()
const frontendUrl = () => (process.env.FRONTEND_URL || "http://localhost:3000").replace(/\/+$/, "")
const passport = require("passport")
const { validateRegistration, validateLogin } = require("../middleware/validation")
const { rateLimiter } = require("../middleware/rateLimiter")
const { authenticateToken } = require("../middleware/auth")
const { uploadAvatar } = require("../config/cloudinary")
const { verifyRecaptcha } = require("../utils/recaptcha")
const authController = require("../controllers/authController")

/**
 * Auth Routes
 *
 * Business logic lives in:
 * - controllers/authController.js (HTTP handling, reCAPTCHA gating)
 * - services/authService.js (users, tokens, verification, password reset)
 *
 * The Google OAuth endpoints stay wired through Passport here because the
 * strategy handshake is routing-level middleware, not business logic.
 */

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
 *     description: Register a new user with email and password. Sends verification email.
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - name
 *               - recaptchaToken
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 minLength: 6
 *                 example: SecurePassword123
 *               name:
 *                 type: string
 *                 example: John Doe
 *               phone:
 *                 type: string
 *                 example: +1234567890
 *               recaptchaToken:
 *                 type: string
 *                 description: Google reCAPTCHA token
 *     responses:
 *       201:
 *         description: User registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Registration successful! Please check your email to verify your account.
 *                 requiresVerification:
 *                   type: boolean
 *                   example: true
 *                 email:
 *                   type: string
 *       400:
 *         description: Bad request - validation errors or user exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       429:
 *         description: Too many requests
 */
// Register with email/password
router.post("/register", rateLimiter, validateRegistration, authController.register.bind(authController))

// Login with email/password
router.post("/login", rateLimiter, validateLogin, authController.login.bind(authController))

// Google OAuth routes
router.get("/google", async (req, res, next) => {
  const { recaptchaToken } = req.query
  if (process.env.RECAPTCHA_SECRET_KEY) {
    const isHuman = await verifyRecaptcha(recaptchaToken, req.ip)
    if (!isHuman) {
      return res.redirect(`${frontendUrl()}/login?error=recaptcha_failed`)
    }
  }
  next()
}, passport.authenticate("google", {
  scope: ["profile", "email"],
  prompt: "select_account"
}))

router.get("/google/callback",
  passport.authenticate("google", { session: false }),
  authController.googleCallback.bind(authController)
)

// Get current user
router.get("/me", authenticateToken, authController.getCurrentUser.bind(authController))

// Logout (client-side handles token removal)
router.post("/logout", authController.logout.bind(authController))

// Upload avatar
router.post("/upload-avatar", authenticateToken, uploadAvatar.single("avatar"), authController.uploadAvatar.bind(authController))

// Email Verification Routes
// Verify email
router.post("/verify-email", authController.verifyEmail.bind(authController))

// Resend verification email
router.post("/resend-verification", rateLimiter, authController.resendVerification.bind(authController))

// Password Reset Routes
// Request password reset
router.post("/forgot-password", rateLimiter, authController.forgotPassword.bind(authController))

// Reset password
router.post("/reset-password", authController.resetPassword.bind(authController))

module.exports = router
