const session = require("express-session")
const MongoStore = require("connect-mongo")

/**
 * Session Configuration
 * Configures Express session with MongoDB store
 */

/**
 * Create session middleware with MongoDB store
 */
const createSessionMiddleware = () => {
  // Validate session secret
  if (!process.env.SESSION_SECRET && process.env.NODE_ENV === "production") {
    console.warn("⚠️  SESSION_SECRET not set in production! This is a security risk.")
  }

  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI required for session store")
  }

  const sessionConfig = {
    secret: process.env.SESSION_SECRET || "your-session-secret",
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGODB_URI,
      touchAfter: 24 * 3600, // lazy session update - only touch session once in 24 hours
      ttl: 14 * 24 * 60 * 60, // session TTL of 14 days
      autoRemove: "native", // automatically remove expired sessions
      collectionName: "sessions",
      stringify: false,
    }),
    cookie: {
      secure: process.env.NODE_ENV === "production", // Set to true in production with HTTPS
      maxAge: 14 * 24 * 60 * 60 * 1000, // 14 days in milliseconds
      httpOnly: true,
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    },
  }

  console.log("✅ Session store configured with MongoDB")
  console.log(`   Cookie secure: ${sessionConfig.cookie.secure}`)
  console.log(`   Cookie sameSite: ${sessionConfig.cookie.sameSite}`)

  return session(sessionConfig)
}

module.exports = {
  createSessionMiddleware,
}
