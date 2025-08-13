const jwt = require("jsonwebtoken")
require("dotenv").config()

// Create a test token for our seeded user
const testUserId = "688b74624a5b1b58b0bc757d" // This matches the user ID from the seeded data
const testEmail = "test@example.com"

const token = jwt.sign(
  { id: testUserId, email: testEmail },
  process.env.JWT_SECRET || "your-secret-key",
  { expiresIn: "7d" }
)

console.log("Test token for frontend:")
console.log(token)
console.log("\nTo use this token:")
console.log("1. Open browser developer tools")
console.log("2. Go to Application/Storage > Local Storage > http://localhost:3000")
console.log("3. Add key: 'token' with value:", token)
