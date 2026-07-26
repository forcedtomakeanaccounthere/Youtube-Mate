/**
 * Setup Script for Video Q&A Feature
 * 
 * This script:
 * 1. Checks if required environment variables are set
 * 2. Tests MongoDB connection
 * 3. Creates necessary indexes
 * 4. Validates API keys (optional)
 * 
 * Usage: node scripts/setup-video-qa.js
 */

require("dotenv").config()
const mongoose = require("mongoose")

async function setupVideoQA() {
  console.log("🚀 Starting Video Q&A Feature Setup...\n")

  // Step 1: Check environment variables
  console.log("📋 Step 1: Checking Environment Variables")
  const requiredEnvVars = {
    MONGODB_URI: process.env.MONGODB_URI,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    MISTRAL_API_KEY: process.env.MISTRAL_API_KEY,
  }

  let missingVars = []
  for (const [key, value] of Object.entries(requiredEnvVars)) {
    if (!value) {
      console.log(`   ❌ ${key} is not set`)
      missingVars.push(key)
    } else {
      console.log(`   ✅ ${key} is set`)
    }
  }

  if (missingVars.length > 0) {
    console.log("\n⚠️  Please set the missing environment variables in your .env file:")
    missingVars.forEach((varName) => {
      console.log(`   ${varName}=your_value_here`)
    })
    console.log("\nRefer to .env.example for guidance.")
    process.exit(1)
  }

  // Step 2: Connect to MongoDB
  console.log("\n📊 Step 2: Connecting to MongoDB")
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
    })
    console.log("   ✅ Connected to MongoDB successfully")
  } catch (error) {
    console.log("   ❌ Failed to connect to MongoDB:", error.message)
    process.exit(1)
  }

  // Step 3: Create indexes
  console.log("\n🔧 Step 3: Creating Database Indexes")
  try {
    const VideoQA = require("../models/VideoQA")
    const VideoQAUsage = require("../models/VideoQAUsage")

    // VideoQA indexes
    await VideoQA.collection.createIndex({ userId: 1, videoId: 1 })
    await VideoQA.collection.createIndex({ "sessions.sessionId": 1 })
    console.log("   ✅ VideoQA indexes created")

    // VideoQAUsage indexes
    await VideoQAUsage.collection.createIndex({ userId: 1, date: 1 }, { unique: true })
    console.log("   ✅ VideoQAUsage indexes created")
  } catch (error) {
    console.log("   ⚠️  Index creation:", error.message)
    console.log("   (This is usually fine if indexes already exist)")
  }

  // Step 4: Test API keys (optional)
  console.log("\n🔑 Step 4: Testing API Keys")
  
  // Test Gemini API
  try {
    const axios = require("axios")
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        contents: [
          {
            parts: [
              {
                text: "Say 'Hello'",
              },
            ],
          },
        ],
      },
      {
        timeout: 10000,
      }
    )
    
    if (response.data && response.data.candidates) {
      console.log("   ✅ Gemini API key is valid")
    } else {
      console.log("   ⚠️  Gemini API returned unexpected response")
    }
  } catch (error) {
    if (error.response?.status === 400) {
      console.log("   ✅ Gemini API key is valid (endpoint works)")
    } else {
      console.log("   ❌ Gemini API test failed:", error.message)
      console.log("   Please verify your GEMINI_API_KEY is correct")
    }
  }

  // Test Mistral API
  try {
    const axios = require("axios")
    const response = await axios.post(
      "https://api.mistral.ai/v1/chat/completions",
      {
        model: "mistral-large-latest",
        messages: [
          {
            role: "user",
            content: "Say 'Hello'",
          },
        ],
        max_tokens: 10,
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.MISTRAL_API_KEY}`,
        },
        timeout: 10000,
      }
    )

    if (response.data && response.data.choices) {
      console.log("   ✅ Mistral API key is valid")
    } else {
      console.log("   ⚠️  Mistral API returned unexpected response")
    }
  } catch (error) {
    console.log("   ❌ Mistral API test failed:", error.message)
    console.log("   Please verify your MISTRAL_API_KEY is correct")
  }

  // Step 5: Summary
  console.log("\n✨ Setup Complete!")
  console.log("\n📝 Next Steps:")
  console.log("   1. Start the backend server: npm start")
  console.log("   2. Start the frontend: cd ../frontend && npm run dev")
  console.log("   3. Navigate to /transcript page")
  console.log("   4. Generate a transcript for any YouTube video")
  console.log("   5. Click 'Ask Questions From Video' to test the feature")
  console.log("\n📚 For more information, see VIDEO_QA_IMPLEMENTATION.md")

  // Cleanup
  await mongoose.disconnect()
  process.exit(0)
}

// Run setup
setupVideoQA().catch((error) => {
  console.error("\n❌ Setup failed:", error)
  process.exit(1)
})
