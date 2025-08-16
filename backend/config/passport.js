const passport = require("passport")
const GoogleStrategy = require("passport-google-oauth20").Strategy
const JwtStrategy = require("passport-jwt").Strategy
const ExtractJwt = require("passport-jwt").ExtractJwt
const User = require("../models/User")

// Make sure environment variables are loaded
require("dotenv").config()

// Debug environment variables
console.log("Google Client ID:", process.env.GOOGLE_CLIENT_ID ? "✓ Loaded" : "✗ Missing")
console.log("Google Client Secret:", process.env.GOOGLE_CLIENT_SECRET ? "✓ Loaded" : "✗ Missing")

// Google OAuth Strategy
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: "http://localhost:5000/api/auth/google/callback"
}, async (accessToken, refreshToken, profile, done) => {
  try {
    // Check if user already exists with this Google ID
    let user = await User.findOne({ googleId: profile.id })
    
    if (user) {
      // Update last login
      user.lastLogin = new Date()
      await user.save()
      return done(null, user)
    }

    // Check if user exists with the same email
    user = await User.findOne({ email: profile.emails[0].value })
    
    if (user) {
      // Link Google account to existing user
      user.googleId = profile.id
      user.authProvider = "google"
      user.avatar = profile.photos[0]?.value || user.avatar
      user.lastLogin = new Date()
      await user.save()
      return done(null, user)
    }

    // Create new user
    user = new User({
      googleId: profile.id,
      name: profile.displayName,
      email: profile.emails[0].value,
      avatar: profile.photos[0]?.value,
      authProvider: "google",
      lastLogin: new Date()
    })

    await user.save()
    done(null, user)
  } catch (error) {
    console.error("Google OAuth error:", error)
    done(error, null)
  }
}))

// JWT Strategy for API authentication
passport.use(new JwtStrategy({
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: process.env.JWT_SECRET || "your-secret-key"
}, async (payload, done) => {
  try {
    const user = await User.findById(payload.id)
    if (user && user.isActive) {
      return done(null, user)
    }
    return done(null, false)
  } catch (error) {
    return done(error, false)
  }
}))

// Serialize/deserialize user for session
passport.serializeUser((user, done) => {
  done(null, user.id)
})

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id)
    done(null, user)
  } catch (error) {
    done(error, null)
  }
})

module.exports = passport
