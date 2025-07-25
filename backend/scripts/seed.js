const mongoose = require("mongoose")
const User = require("../models/User")
const ShortenedUrl = require("../models/ShortenedUrl")
require("dotenv").config()

const seedData = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/youtube-mate")

    console.log("Connected to MongoDB")

    // Clear existing data
    await User.deleteMany({})
    await ShortenedUrl.deleteMany({})

    console.log("Cleared existing data")

    // Create test user
    const testUser = new User({
      email: "test@example.com",
      password: "password123",
      name: "Test User",
      plan: "premium",
    })

    await testUser.save()
    console.log("Created test user")

    // Create sample URLs
    const sampleUrls = [
      {
        userId: testUser._id,
        originalUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        shortCode: "rickroll",
        customAlias: "rickroll",
        domain: "ytmate.co",
        videoData: {
          videoId: "dQw4w9WgXcQ",
          title: "Rick Astley - Never Gonna Give You Up (Official Video)",
          thumbnailUrl: "https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg",
          duration: "3:33",
          durationSeconds: 213,
          channel: "Rick Astley",
          views: "1.4B views",
        },
        clicks: 1337,
        analyticsEnabled: true,
        tags: ["music", "classic", "meme"],
      },
      {
        userId: testUser._id,
        originalUrl: "https://www.youtube.com/watch?v=jNQXAC9IVRw",
        shortCode: "me-at-zoo",
        domain: "ytmate.co",
        videoData: {
          videoId: "jNQXAC9IVRw",
          title: "Me at the zoo",
          thumbnailUrl: "https://img.youtube.com/vi/jNQXAC9IVRw/maxresdefault.jpg",
          duration: "0:19",
          durationSeconds: 19,
          channel: "jawed",
          views: "300M views",
        },
        clicks: 42,
        analyticsEnabled: true,
        tags: ["history", "first-video"],
      },
    ]

    for (const urlData of sampleUrls) {
      const url = new ShortenedUrl(urlData)
      await url.save()
    }

    console.log("Created sample URLs")
    console.log("Seed data created successfully!")
    console.log("Test user credentials: test@example.com / password123")

    process.exit(0)
  } catch (error) {
    console.error("Error seeding data:", error)
    process.exit(1)
  }
}

seedData()