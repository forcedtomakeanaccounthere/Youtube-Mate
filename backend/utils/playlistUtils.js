const Playlist = require("../models/PlaylistManager")
const PlaylistCollaborator = require("../models/PlaylistCollaborator")
const PlaylistActivity = require("../models/PlaylistActivity")

// Log playlist activity
async function logActivity(playlistId, userId, action, details = {}, metadata = {}) {
  try {
    const activity = new PlaylistActivity({
      playlist_id: playlistId,
      user_id: userId,
      action,
      details,
      metadata,
    })
    await activity.save()
  } catch (error) {
    console.error("Error logging activity:", error)
  }
}

// Check if user has permission to perform action on playlist
async function checkPlaylistPermission(playlistId, userId, requiredLevel = "viewer") {
  try {
    console.log(`🔍 Permission Check Debug:`)
    console.log(`  - Playlist ID: ${playlistId}`)
    console.log(`  - User ID: ${userId}`)
    console.log(`  - Required Level: ${requiredLevel}`)
    
    const playlist = await Playlist.findById(playlistId)
    if (!playlist) {
      console.log(`  ❌ Playlist not found`)
      return false
    }

    // Owner has all permissions
    if (playlist.owner_id.toString() === userId.toString()) {
      console.log(`  ✅ User is owner - permission granted`)
      return true
    }

    // Check collaborator permissions
    const collaboration = await PlaylistCollaborator.findOne({
      playlist_id: playlistId,
      user_id: userId,
      status: "accepted",
    })

    console.log(`  - Collaboration found:`, collaboration ? {
      id: collaboration._id,
      permission_level: collaboration.permission_level,
      status: collaboration.status,
      user_id: collaboration.user_id
    } : null)

    if (!collaboration) {
      // Check if playlist is public and only viewer access is required
      const publicAccess = playlist.is_public && requiredLevel === "viewer"
      console.log(`  - No collaboration found. Public access for viewer: ${publicAccess}`)
      return publicAccess
    }

    // Ensure collaboration status is accepted
    if (collaboration.status !== "accepted") {
      console.log(`  ❌ Collaboration status is '${collaboration.status}', not 'accepted'`)
      return false
    }

    // Permission hierarchy: admin > editor > viewer
    const permissionLevels = {
      viewer: 1,
      editor: 2,
      admin: 3,
    }

    const userLevel = permissionLevels[collaboration.permission_level] || 0
    const requiredLevelNum = permissionLevels[requiredLevel] || 0

    console.log(`  - User Level: ${collaboration.permission_level} (${userLevel})`)
    console.log(`  - Required Level: ${requiredLevel} (${requiredLevelNum})`)
    console.log(`  - User Level >= Required Level: ${userLevel >= requiredLevelNum}`)
    console.log(`  - Permission Result: ${userLevel >= requiredLevelNum}`)

    return userLevel >= requiredLevelNum
  } catch (error) {
    console.error("Error checking playlist permission:", error)
    return false
  }
}

// Get user's role in playlist
async function getUserPlaylistRole(playlistId, userId) {
  try {
    const playlist = await Playlist.findById(playlistId)
    if (!playlist) return null

    // Check if owner
    if (playlist.owner_id.toString() === userId.toString()) {
      return "owner"
    }

    // Check collaborator role
    const collaboration = await PlaylistCollaborator.findOne({
      playlist_id: playlistId,
      user_id: userId,
      status: "accepted",
    })

    return collaboration ? collaboration.permission_level : null
  } catch (error) {
    console.error("Error getting user playlist role:", error)
    return null
  }
}

// Update playlist statistics
async function updatePlaylistStats(playlistId) {
  try {
    const PlaylistItem = require("../models/PlaylistItem")

    const stats = await PlaylistItem.aggregate([
      { $match: { playlist_id: playlistId } },
      {
        $group: {
          _id: null,
          video_count: { $sum: 1 },
          total_duration: { $sum: "$duration" },
          total_views: { $sum: "$metadata.views" },
        },
      },
    ])

    const playlistStats = stats[0] || {
      video_count: 0,
      total_duration: 0,
      total_views: 0,
    }

    await Playlist.findByIdAndUpdate(playlistId, {
      stats: playlistStats,
      updated_at: new Date(),
    })

    return playlistStats
  } catch (error) {
    console.error("Error updating playlist stats:", error)
    return null
  }
}

// Generate playlist export data
async function generatePlaylistExport(playlistId, format = "json") {
  try {
    const PlaylistItem = require("../models/PlaylistItem")

    const playlist = await Playlist.findById(playlistId).populate("owner_id", "name email").lean()

    if (!playlist) {
      throw new Error("Playlist not found")
    }

    const items = await PlaylistItem.find({ playlist_id: playlistId })
      .populate("added_by", "name")
      .sort({ position: 1 })
      .lean()

    const exportData = {
      playlist: {
        id: playlist._id,
        name: playlist.name,
        description: playlist.description,
        owner: playlist.owner_id.name,
        created_at: playlist.created_at,
        updated_at: playlist.updated_at,
        stats: playlist.stats,
      },
      videos: items.map((item) => ({
        title: item.title,
        youtube_url: item.youtube_url,
        youtube_id: item.youtube_id,
        channel: item.channel.name,
        duration: item.duration,
        added_by: item.added_by.name,
        added_at: item.added_at,
        position: item.position,
      })),
    }

    switch (format.toLowerCase()) {
      case "json":
        return JSON.stringify(exportData, null, 2)
      case "csv":
        return generateCSVExport(exportData)
      case "txt":
        return generateTextExport(exportData)
      default:
        return JSON.stringify(exportData, null, 2)
    }
  } catch (error) {
    console.error("Error generating playlist export:", error)
    throw error
  }
}

function generateCSVExport(data) {
  const headers = ["Position", "Title", "Channel", "Duration", "YouTube URL", "Added By", "Added At"]
  const rows = data.videos.map((video) => [
    video.position + 1,
    `"${video.title.replace(/"/g, '""')}"`,
    `"${video.channel.replace(/"/g, '""')}"`,
    formatDuration(video.duration),
    video.youtube_url,
    video.added_by,
    new Date(video.added_at).toLocaleDateString(),
  ])

  return [headers.join(","), ...rows.map((row) => row.join(","))].join("\n")
}

function generateTextExport(data) {
  let text = `Playlist: ${data.playlist.name}\n`
  text += `Description: ${data.playlist.description}\n`
  text += `Owner: ${data.playlist.owner}\n`
  text += `Created: ${new Date(data.playlist.created_at).toLocaleDateString()}\n`
  text += `Videos: ${data.playlist.stats.video_count}\n\n`

  data.videos.forEach((video, index) => {
    text += `${index + 1}. ${video.title}\n`
    text += `   Channel: ${video.channel}\n`
    text += `   Duration: ${formatDuration(video.duration)}\n`
    text += `   URL: ${video.youtube_url}\n`
    text += `   Added by: ${video.added_by} on ${new Date(video.added_at).toLocaleDateString()}\n\n`
  })

  return text
}

function formatDuration(seconds) {
  if (!seconds) return "0:00"
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }
  return `${minutes}:${secs.toString().padStart(2, "0")}`
}

module.exports = {
  logActivity,
  checkPlaylistPermission,
  getUserPlaylistRole,
  updatePlaylistStats,
  generatePlaylistExport,
}