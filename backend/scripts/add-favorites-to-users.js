const mongoose = require("mongoose")
require("dotenv").config()

// Import the User model
const User = require("../models/User")

async function addFavoritesToUsers() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI)
    console.log("Connected to MongoDB")

    // Update all users to have the favorites field if they don't already have it
    const result = await User.updateMany(
      { "favorites.playlists": { $exists: false } },
      { 
        $set: { 
          "favorites.playlists": [] 
        } 
      }
    )

    console.log(`Updated ${result.modifiedCount} users with favorites field`)
    
    // Verify the update
    const usersWithFavorites = await User.countDocuments({ "favorites.playlists": { $exists: true } })
    console.log(`Total users with favorites field: ${usersWithFavorites}`)

  } catch (error) {
    console.error("Error updating users:", error)
  } finally {
    // Close the connection
    await mongoose.connection.close()
    console.log("Connection closed")
  }
}

// Run the migration
addFavoritesToUsers()
