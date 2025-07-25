const jwt = require("jsonwebtoken")
const User = require("../models/User")

const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers["authorization"]
    const token = authHeader && authHeader.split(" ")[1] // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ error: "Access token required" })
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || "your-secret-key")
    const user = await User.findById(decoded.id)

    if (!user || !user.isActive) {
      return res.status(401).json({ error: "Invalid or expired token" })
    }

    req.user = user
    next()
  } catch (error) {
    console.error("Auth error:", error)
    return res.status(403).json({ error: "Invalid or expired token" })
  }
}

const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers["authorization"]
    const token = authHeader && authHeader.split(" ")[1]

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || "your-secret-key")
      const user = await User.findById(decoded.id)

      if (user && user.isActive) {
        req.user = user
      }
    }

    next()
  } catch (error) {
    // Continue without authentication
    next()
  }
}

module.exports = { authenticateToken, optionalAuth }