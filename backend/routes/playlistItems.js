const express = require("express")
const router = express.Router()
const { authenticateToken } = require("../middleware/auth")
const { validatePlaylistItem } = require("../middleware/validation")
const Playlist = require("../models/PlaylistManager")
const PlaylistItem = require("../models/PlaylistItem")
const PlaylistCollaborator = require("../models/PlaylistCollaborator")
const { getYouTubeVideoInfo } = require("../utils/youtube")
const { logActivity, checkPlaylistPermission } = require("../utils/playlistUtils")

// Add video to playlist
router.post("/:playlistId/items", authenticateToken, validatePlaylistItem, async (req, res) => {
  try {
    const { playlistId } = req.params
    const { youtube_url, position } = req.body

    // Check playlist exists and user has permission
    const hasPermission = await checkPlaylistPermission(playlistId, req.user._id, "editor")
    if (!hasPermission) {
      return res.status(403).json({ error: "Access denied" })
    }

    // Get video info from YouTube
    let videoInfo
    try {
      videoInfo = await getYouTubeVideoInfo(youtube_url)
    } catch (error) {
      return res.status(400).json({ error: "Failed to fetch video information from YouTube" })
    }

    // Check if video already exists in playlist
    const existingItem = await PlaylistItem.findOne({
      playlist_id: playlistId,
      youtube_id: videoInfo.videoId,
    })

    if (existingItem) {
      return res.status(400).json({ error: "Video already exists in playlist" })
    }

    // Get next position if not provided
    let itemPosition = position
    if (!itemPosition) {
      const lastItem = await PlaylistItem.findOne({ playlist_id: playlistId }).sort({ position: -1 })
      itemPosition = lastItem ? lastItem.position + 1 : 0
    } else {
      // Shift existing items if position is specified
      await PlaylistItem.updateMany(
        { playlist_id: playlistId, position: { $gte: itemPosition } },
        { $inc: { position: 1 } },
      )
    }

    // Create playlist item
    const playlistItem = new PlaylistItem({
      playlist_id: playlistId,
      youtube_url,
      youtube_id: videoInfo.id || videoInfo.videoId,
      title: videoInfo.title,
      description: (videoInfo.description || "").substring(0, 2000), // Limit description length
      thumbnail_url: videoInfo.thumbnail || videoInfo.thumbnailUrl,
      duration: videoInfo.durationSeconds || 0,
      channel: {
        name: videoInfo.channel?.name || videoInfo.channel || "Unknown Channel",
        url: videoInfo.channel?.url || "",
        thumbnail: videoInfo.channel?.thumbnail || "",
      },
      added_by: req.user._id,
      position: itemPosition,
      metadata: {
        views: videoInfo.views || 0,
        likes: videoInfo.likes || 0,
        published_at: videoInfo.publishedAt || null,
        language: videoInfo.language || null,
      },
    })

    await playlistItem.save()

    // Update playlist stats
    await Playlist.findByIdAndUpdate(playlistId, {
      $inc: {
        "stats.video_count": 1,
        "stats.total_duration": videoInfo.durationSeconds || 0,
      },
      updated_at: new Date(),
    })

    // Log activity
    await logActivity(playlistId, req.user._id, "video_added", {
      video_title: videoInfo.title,
      video_id: videoInfo.videoId,
      position: itemPosition,
    })

    await playlistItem.populate("added_by", "name avatar")

    res.status(201).json({
      id: playlistItem._id,
      title: playlistItem.title,
      channel: playlistItem.channel.name,
      duration: formatDuration(playlistItem.duration),
      thumbnail: playlistItem.thumbnail_url,
      addedBy: playlistItem.added_by.name,
      addedAt: playlistItem.added_at,
      views: playlistItem.metadata.views,
      likes: playlistItem.metadata.likes,
      description: playlistItem.description,
      youtubeUrl: playlistItem.youtube_url,
      position: playlistItem.position,
    })
  } catch (error) {
    console.error("Error adding video to playlist:", error)
    res.status(500).json({ error: "Failed to add video to playlist" })
  }
})

// Remove video from playlist
router.delete("/:playlistId/items/:itemId", authenticateToken, async (req, res) => {
  try {
    const { playlistId, itemId } = req.params

    // Check permissions
    const hasPermission = await checkPlaylistPermission(playlistId, req.user._id, "editor")
    if (!hasPermission) {
      return res.status(403).json({ error: "Access denied" })
    }

    const item = await PlaylistItem.findOne({
      _id: itemId,
      playlist_id: playlistId,
    })

    if (!item) {
      return res.status(404).json({ error: "Video not found in playlist" })
    }

    // Remove item
    await item.deleteOne()

    // Reorder remaining items
    await PlaylistItem.updateMany(
      { playlist_id: playlistId, position: { $gt: item.position } },
      { $inc: { position: -1 } },
    )

    // Update playlist stats
    await Playlist.findByIdAndUpdate(playlistId, {
      $inc: {
        "stats.video_count": -1,
        "stats.total_duration": -item.duration,
      },
      updated_at: new Date(),
    })

    // Log activity
    await logActivity(playlistId, req.user._id, "video_removed", {
      video_title: item.title,
      video_id: item.youtube_id,
      position: item.position,
    })

    res.json({ message: "Video removed from playlist" })
  } catch (error) {
    console.error("Error removing video from playlist:", error)
    res.status(500).json({ error: "Failed to remove video from playlist" })
  }
})

// Reorder playlist items
router.put("/:playlistId/items/reorder", authenticateToken, async (req, res) => {
  try {
    const { playlistId } = req.params
    const { items } = req.body // Array of { id, position }

    // Check permissions
    const hasPermission = await checkPlaylistPermission(playlistId, req.user._id, "editor")
    if (!hasPermission) {
      return res.status(403).json({ error: "Access denied" })
    }

    // Update positions
    const updatePromises = items.map((item) => PlaylistItem.findByIdAndUpdate(item.id, { position: item.position }))

    await Promise.all(updatePromises)

    // Update playlist modified time
    await Playlist.findByIdAndUpdate(playlistId, { updated_at: new Date() })

    // Log activity
    await logActivity(playlistId, req.user._id, "video_reordered", {
      items_count: items.length,
    })

    res.json({ message: "Playlist items reordered successfully" })
  } catch (error) {
    console.error("Error reordering playlist items:", error)
    res.status(500).json({ error: "Failed to reorder playlist items" })
  }
})

// Move a playlist item to a new position
router.put("/:playlistId/items/:itemId/move", authenticateToken, async (req, res) => {
  try {
    const { playlistId, itemId } = req.params
    const { new_position } = req.body

    if (new_position === undefined || new_position < 0) {
      return res.status(400).json({ error: "Invalid position" })
    }

    // Check permissions
    const hasPermission = await checkPlaylistPermission(playlistId, req.user._id, "editor")
    if (!hasPermission) {
      return res.status(403).json({ error: "Access denied" })
    }

    // Get the item
    const item = await PlaylistItem.findOne({
      _id: itemId,
      playlist_id: playlistId,
    })

    if (!item) {
      return res.status(404).json({ error: "Video not found in playlist" })
    }

    const old_position = item.position

    // If position is the same, do nothing
    if (old_position === new_position) {
      return res.json({ message: "Position unchanged" })
    }

    // Get total count to ensure new position is valid
    const count = await PlaylistItem.countDocuments({ playlist_id: playlistId })
    if (new_position >= count) {
      return res.status(400).json({ error: "Position out of range" })
    }

    // Update positions of other items
    if (new_position > old_position) {
      // Moving down - shift items between old and new position up
      await PlaylistItem.updateMany(
        { 
          playlist_id: playlistId, 
          position: { $gt: old_position, $lte: new_position } 
        },
        { $inc: { position: -1 } }
      )
    } else {
      // Moving up - shift items between new and old position down
      await PlaylistItem.updateMany(
        { 
          playlist_id: playlistId, 
          position: { $gte: new_position, $lt: old_position } 
        },
        { $inc: { position: 1 } }
      )
    }

    // Update the item's position
    item.position = new_position
    await item.save()

    // Update playlist modified time
    await Playlist.findByIdAndUpdate(playlistId, { updated_at: new Date() })

    // Log activity
    await logActivity(playlistId, req.user._id, "video_moved", {
      video_title: item.title,
      from_position: old_position,
      to_position: new_position
    })

    res.json({ 
      message: "Video moved successfully",
      item: {
        id: item._id,
        title: item.title,
        new_position: new_position
      }
    })
  } catch (error) {
    console.error("Error moving playlist item:", error)
    res.status(500).json({ error: "Failed to move video" })
  }
})

// Helper function to format duration
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

module.exports = router
