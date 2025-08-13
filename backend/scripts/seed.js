const mongoose = require("mongoose")
const User = require("../models/User")
const ShortenedUrl = require("../models/ShortenedUrl")
const PlaylistManager = require("../models/PlaylistManager")
const PlaylistItem = require("../models/PlaylistItem")
const PlaylistCollaborator = require("../models/PlaylistCollaborator")
require("dotenv").config()

const seedData = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/youtube-mate")

    console.log("Connected to MongoDB")

    // Clear existing data
    await User.deleteMany({})
    await ShortenedUrl.deleteMany({})
    await PlaylistManager.deleteMany({})
    await PlaylistItem.deleteMany({})
    await PlaylistCollaborator.deleteMany({})

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

    // Create sample playlists
    const samplePlaylists = [
      {
        owner_id: testUser._id,
        name: "My Favorite Music Videos",
        description: "A collection of my all-time favorite music videos from various genres",
        is_public: true,
        is_collaborative: false,
        category: "music",
        tags: ["music", "favorites", "collection"],
        thumbnail_url: "https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg",
        stats: {
          total_views: 1250,
          total_duration: 1800,
          video_count: 5,
        },
      },
      {
        owner_id: testUser._id,
        name: "Programming Tutorials",
        description: "Essential programming tutorials for web development",
        is_public: true,
        is_collaborative: true,
        category: "education",
        tags: ["programming", "web-dev", "tutorials", "javascript"],
        thumbnail_url: "https://img.youtube.com/vi/jNQXAC9IVRw/maxresdefault.jpg",
        stats: {
          total_views: 890,
          total_duration: 7200,
          video_count: 12,
        },
      },
      {
        owner_id: testUser._id,
        name: "Private Collection",
        description: "My personal playlist of videos",
        is_public: false,
        is_collaborative: false,
        category: "other",
        tags: ["personal", "private"],
        thumbnail_url: null,
        stats: {
          total_views: 45,
          total_duration: 900,
          video_count: 3,
        },
      },
      {
        owner_id: testUser._id,
        name: "Team Project Resources",
        description: "Shared resources for our development team",
        is_public: false,
        is_collaborative: true,
        category: "technology",
        tags: ["team", "resources", "development"],
        thumbnail_url: "https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg",
        stats: {
          total_views: 320,
          total_duration: 3600,
          video_count: 8,
        },
      },
    ]

    const createdPlaylists = []
    for (const playlistData of samplePlaylists) {
      const playlist = new PlaylistManager(playlistData)
      await playlist.save()
      createdPlaylists.push(playlist)
    }

    console.log("Created sample playlists")

    // Create sample playlist items for the first playlist
    const samplePlaylistItems = [
      {
        playlist_id: createdPlaylists[0]._id,
        youtube_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        youtube_id: "dQw4w9WgXcQ",
        title: "Rick Astley - Never Gonna Give You Up (Official Video)",
        description: "The official video for Rick Astley's 'Never Gonna Give You Up'",
        duration: 213,
        thumbnail_url: "https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg",
        channel: {
          name: "Rick Astley",
          id: "UCuAXFkgsw1L7xaCfnd5JJOw",
          url: "https://www.youtube.com/channel/UCuAXFkgsw1L7xaCfnd5JJOw",
        },
        metadata: {
          views: 1400000000,
          likes: 15000000,
          upload_date: "2009-10-25",
        },
        added_by: testUser._id,
        position: 1,
      },
      {
        playlist_id: createdPlaylists[0]._id,
        youtube_url: "https://www.youtube.com/watch?v=jNQXAC9IVRw",
        youtube_id: "jNQXAC9IVRw",
        title: "Me at the zoo",
        description: "The first video uploaded to YouTube",
        duration: 19,
        thumbnail_url: "https://img.youtube.com/vi/jNQXAC9IVRw/maxresdefault.jpg",
        channel: {
          name: "jawed",
          id: "UC4QobU6STFB0P71PMvOGN5A",
          url: "https://www.youtube.com/channel/UC4QobU6STFB0P71PMvOGN5A",
        },
        metadata: {
          views: 300000000,
          likes: 8500000,
          upload_date: "2005-04-23",
        },
        added_by: testUser._id,
        position: 2,
      },
    ]

    for (const itemData of samplePlaylistItems) {
      const item = new PlaylistItem(itemData)
      await item.save()
    }

    console.log("Created sample playlist items")

    console.log("Seed data created successfully!")
    console.log("Test user credentials: test@example.com / password123")
    console.log("Created playlists:")
    createdPlaylists.forEach(p => console.log(`- ${p.name} (${p.is_public ? 'Public' : 'Private'}${p.is_collaborative ? ', Collaborative' : ''})`))

    process.exit(0)
  } catch (error) {
    console.error("Error seeding data:", error)
    process.exit(1)
  }
}

seedData()