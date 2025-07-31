const express = require("express")
const router = express.Router()
const { authenticateToken, optionalAuth } = require("../middleware/auth")
const { validatePlaylistCreate, validatePlaylistUpdate } = require("../middleware/validation")
const Playlist = require("../models/PlaylistManager")
const PlaylistItem = require("../models/PlaylistItem")
const PlaylistCollaborator = require("../models/PlaylistCollaborator")
const PlaylistComment = require("../models/PlaylistComment")
const PlaylistActivity = require("../models/PlaylistActivity")
const { getYouTubeVideoInfo, getYouTubePlaylistInfo } = require("../utils/youtube")
const { logActivity } = require("../utils/playlistUtils")

// Get all playlists (public + user's own + shared)
router.get("/", optionalAuth, async (req, res) => {
  try {
    const { page = 1, limit = 12, search = "", filter = "all", sort = "recent", category = "", tags = "" } = req.query

    const pageNum = Number.parseInt(page)
    const limitNum = Number.parseInt(limit)
    const skip = (pageNum - 1) * limitNum

    // Build query
    const query = {}

    // Search functionality
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { tags: { $in: [new RegExp(search, "i")] } },
      ]
    }

    // Filter by type
    if (filter === "public") {
      query.is_public = true
      query.status = "active"
    } else if (filter === "private") {
      if (!req.user) {
        return res.status(401).json({ error: "Authentication required for private playlists" })
      }
      query.owner_id = req.user._id
      query.is_public = false
    } else if (filter === "collaborative") {
      query.is_collaborative = true
      query.status = "active"
    } else {
      // All playlists - public ones + user's own if authenticated
      if (req.user) {
        query.$or = [
          { is_public: true, status: "active" },
          { owner_id: req.user._id },
          // Add shared playlists
          {
            _id: {
              $in: await PlaylistCollaborator.find({
                user_id: req.user._id,
                status: "accepted",
              }).distinct("playlist_id"),
            },
          },
        ]
      } else {
        query.is_public = true
        query.status = "active"
      }
    }

    // Filter by category
    if (category) {
      query.category = category
    }

    // Filter by tags
    if (tags) {
      const tagArray = tags.split(",").map((tag) => tag.trim())
      query.tags = { $in: tagArray }
    }

    // Build sort
    let sortQuery = {}
    switch (sort) {
      case "recent":
        sortQuery = { updated_at: -1 }
        break
      case "oldest":
        sortQuery = { created_at: 1 }
        break
      case "name":
        sortQuery = { name: 1 }
        break
      case "videos":
        sortQuery = { "stats.video_count": -1 }
        break
      case "views":
        sortQuery = { "stats.total_views": -1 }
        break
      default:
        sortQuery = { updated_at: -1 }
    }

    // Execute query
    const playlists = await Playlist.find(query)
      .populate("owner_id", "name email avatar")
      .sort(sortQuery)
      .skip(skip)
      .limit(limitNum)
      .lean()

    // Get total count for pagination
    const total = await Playlist.countDocuments(query)

    // Get collaborator counts for each playlist
    const playlistIds = playlists.map((p) => p._id)
    const collaboratorCounts = await PlaylistCollaborator.aggregate([
      { $match: { playlist_id: { $in: playlistIds }, status: "accepted" } },
      { $group: { _id: "$playlist_id", count: { $sum: 1 } } },
    ])

    const collaboratorMap = {}
    collaboratorCounts.forEach((item) => {
      collaboratorMap[item._id.toString()] = item.count
    })

    // Format response
    const formattedPlaylists = playlists.map((playlist) => ({
      id: playlist._id,
      title: playlist.name,
      description: playlist.description,
      thumbnail: playlist.thumbnail_url,
      videoCount: playlist.stats.video_count,
      isPublic: playlist.is_public,
      isCollaborative: playlist.is_collaborative,
      owner: {
        name: playlist.owner_id.name,
        avatar: playlist.owner_id.avatar,
      },
      collaborators: collaboratorMap[playlist._id.toString()] || 0,
      views: playlist.stats.total_views,
      createdAt: playlist.created_at,
      lastModified: playlist.updated_at,
      tags: playlist.tags,
      category: playlist.category,
      status: playlist.status,
    }))

    res.json({
      playlists: formattedPlaylists,
      pagination: {
        current: pageNum,
        total: Math.ceil(total / limitNum),
        count: total,
        limit: limitNum,
      },
    })
  } catch (error) {
    console.error("Error fetching playlists:", error)
    res.status(500).json({ error: "Failed to fetch playlists" })
  }
})

// Get user's own playlists
router.get("/mine", authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 12, search = "", status = "all", sort = "recent" } = req.query

    const pageNum = Number.parseInt(page)
    const limitNum = Number.parseInt(limit)
    const skip = (pageNum - 1) * limitNum

    // Build query
    const query = { owner_id: req.user._id }

    // Search functionality
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { tags: { $in: [new RegExp(search, "i")] } },
      ]
    }

    // Filter by status
    if (status !== "all") {
      query.status = status
    }

    // Build sort
    let sortQuery = {}
    switch (sort) {
      case "recent":
        sortQuery = { updated_at: -1 }
        break
      case "oldest":
        sortQuery = { created_at: 1 }
        break
      case "name":
        sortQuery = { name: 1 }
        break
      case "videos":
        sortQuery = { "stats.video_count": -1 }
        break
      case "views":
        sortQuery = { "stats.total_views": -1 }
        break
      default:
        sortQuery = { updated_at: -1 }
    }

    // Execute query
    const playlists = await Playlist.find(query)
      .populate("owner_id", "name email avatar")
      .sort(sortQuery)
      .skip(skip)
      .limit(limitNum)
      .lean()

    const total = await Playlist.countDocuments(query)

    // Get collaborator counts
    const playlistIds = playlists.map((p) => p._id)
    const collaboratorCounts = await PlaylistCollaborator.aggregate([
      { $match: { playlist_id: { $in: playlistIds }, status: "accepted" } },
      { $group: { _id: "$playlist_id", count: { $sum: 1 } } },
    ])

    const collaboratorMap = {}
    collaboratorCounts.forEach((item) => {
      collaboratorMap[item._id.toString()] = item.count
    })

    // Format response
    const formattedPlaylists = playlists.map((playlist) => ({
      id: playlist._id,
      title: playlist.name,
      description: playlist.description,
      thumbnail: playlist.thumbnail_url,
      videoCount: playlist.stats.video_count,
      isPublic: playlist.is_public,
      isCollaborative: playlist.is_collaborative,
      collaborators: collaboratorMap[playlist._id.toString()] || 0,
      views: playlist.stats.total_views,
      createdAt: playlist.created_at,
      lastModified: playlist.updated_at,
      tags: playlist.tags,
      category: playlist.category,
      status: playlist.status,
    }))

    // Get summary stats
    const stats = await Playlist.aggregate([
      { $match: { owner_id: req.user._id } },
      {
        $group: {
          _id: null,
          totalPlaylists: { $sum: 1 },
          totalVideos: { $sum: "$stats.video_count" },
          totalViews: { $sum: "$stats.total_views" },
        },
      },
    ])

    const totalCollaborators = await PlaylistCollaborator.countDocuments({
      playlist_id: { $in: playlistIds },
      status: "accepted",
    })

    res.json({
      playlists: formattedPlaylists,
      stats: {
        totalPlaylists: stats[0]?.totalPlaylists || 0,
        totalVideos: stats[0]?.totalVideos || 0,
        totalViews: stats[0]?.totalViews || 0,
        totalCollaborators,
      },
      pagination: {
        current: pageNum,
        total: Math.ceil(total / limitNum),
        count: total,
        limit: limitNum,
      },
    })
  } catch (error) {
    console.error("Error fetching user playlists:", error)
    res.status(500).json({ error: "Failed to fetch user playlists" })
  }
})

// Get shared playlists
router.get("/shared", authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 12, search = "", role = "all", sort = "recent" } = req.query

    const pageNum = Number.parseInt(page)
    const limitNum = Number.parseInt(limit)
    const skip = (pageNum - 1) * limitNum

    // Build collaborator query
    const collaboratorQuery = {
      user_id: req.user._id,
      status: "accepted",
    }

    if (role !== "all") {
      collaboratorQuery.permission_level = role
    }

    // Get collaborations
    const collaborations = await PlaylistCollaborator.find(collaboratorQuery)
      .populate({
        path: "playlist_id",
        populate: {
          path: "owner_id",
          select: "name email avatar",
        },
      })
      .sort({ last_active: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean()

    // Filter by search if provided
    let filteredCollaborations = collaborations
    if (search) {
      filteredCollaborations = collaborations.filter(
        (collab) =>
          collab.playlist_id.name.toLowerCase().includes(search.toLowerCase()) ||
          collab.playlist_id.description.toLowerCase().includes(search.toLowerCase()) ||
          collab.playlist_id.tags.some((tag) => tag.toLowerCase().includes(search.toLowerCase())),
      )
    }

    // Get total count
    const total = await PlaylistCollaborator.countDocuments(collaboratorQuery)

    // Get unread comments count for each playlist
    const playlistIds = filteredCollaborations.map((c) => c.playlist_id._id)
    const unreadComments = await PlaylistComment.aggregate([
      {
        $match: {
          playlist_id: { $in: playlistIds },
          user_id: { $ne: req.user._id },
          created_at: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }, // Last 7 days
        },
      },
      { $group: { _id: "$playlist_id", count: { $sum: 1 } } },
    ])

    const unreadMap = {}
    unreadComments.forEach((item) => {
      unreadMap[item._id.toString()] = item.count
    })

    // Format response
    const formattedPlaylists = filteredCollaborations.map((collab) => ({
      id: collab.playlist_id._id,
      title: collab.playlist_id.name,
      description: collab.playlist_id.description,
      thumbnail: collab.playlist_id.thumbnail_url,
      videoCount: collab.playlist_id.stats.video_count,
      isPublic: collab.playlist_id.is_public,
      isCollaborative: collab.playlist_id.is_collaborative,
      owner: {
        name: collab.playlist_id.owner_id.name,
        avatar: collab.playlist_id.owner_id.avatar,
      },
      collaborators: 0, // Will be populated separately if needed
      views: collab.playlist_id.stats.total_views,
      createdAt: collab.playlist_id.created_at,
      lastModified: collab.playlist_id.updated_at,
      tags: collab.playlist_id.tags,
      myRole: collab.permission_level,
      lastActivity: collab.last_active,
      unreadComments: unreadMap[collab.playlist_id._id.toString()] || 0,
    }))

    // Get summary stats by role
    const roleStats = await PlaylistCollaborator.aggregate([
      { $match: { user_id: req.user._id, status: "accepted" } },
      { $group: { _id: "$permission_level", count: { $sum: 1 } } },
    ])

    const stats = {
      total: total,
      admin: roleStats.find((r) => r._id === "admin")?.count || 0,
      editor: roleStats.find((r) => r._id === "editor")?.count || 0,
      viewer: roleStats.find((r) => r._id === "viewer")?.count || 0,
      unreadComments: Object.values(unreadMap).reduce((sum, count) => sum + count, 0),
    }

    res.json({
      playlists: formattedPlaylists,
      stats,
      pagination: {
        current: pageNum,
        total: Math.ceil(total / limitNum),
        count: total,
        limit: limitNum,
      },
    })
  } catch (error) {
    console.error("Error fetching shared playlists:", error)
    res.status(500).json({ error: "Failed to fetch shared playlists" })
  }
})

// Create new playlist
router.post("/", authenticateToken, validatePlaylistCreate, async (req, res) => {
  try {
    const {
      name,
      description = "",
      is_public = false,
      is_collaborative = false,
      category = "other",
      tags = [],
      thumbnail_url = null,
      import_url = null,
      status = "active",
    } = req.body

    let playlistData = {
      owner_id: req.user._id,
      name,
      description,
      is_public,
      is_collaborative,
      category,
      tags,
      thumbnail_url,
      status,
    }

    // Handle YouTube playlist import
    if (import_url) {
      try {
        const importedData = await getYouTubePlaylistInfo(import_url)
        playlistData = {
          ...playlistData,
          name: importedData.title || name,
          description: importedData.description || description,
          thumbnail_url: importedData.thumbnail || thumbnail_url,
          import_data: {
            source: "youtube",
            original_url: import_url,
            imported_at: new Date(),
          },
        }
      } catch (importError) {
        console.error("YouTube import failed:", importError)
        // Continue with manual creation if import fails
      }
    }

    const playlist = new Playlist(playlistData)
    await playlist.save()

    // Log activity
    await logActivity(playlist._id, req.user._id, "created", {
      playlist_name: playlist.name,
    })

    // Populate owner info for response
    await playlist.populate("owner_id", "name email avatar")

    res.status(201).json({
      id: playlist._id,
      title: playlist.name,
      description: playlist.description,
      thumbnail: playlist.thumbnail_url,
      videoCount: 0,
      isPublic: playlist.is_public,
      isCollaborative: playlist.is_collaborative,
      owner: {
        name: playlist.owner_id.name,
        avatar: playlist.owner_id.avatar,
      },
      collaborators: 0,
      views: 0,
      createdAt: playlist.created_at,
      lastModified: playlist.updated_at,
      tags: playlist.tags,
      category: playlist.category,
      status: playlist.status,
    })
  } catch (error) {
    console.error("Error creating playlist:", error)
    if (error.code === 11000) {
      return res.status(400).json({ error: "Playlist name already exists" })
    }
    res.status(500).json({ error: "Failed to create playlist" })
  }
})

// Get specific playlist
router.get("/:id", optionalAuth, async (req, res) => {
  try {
    const playlist = await Playlist.findById(req.params.id).populate("owner_id", "name email avatar").lean()

    if (!playlist) {
      return res.status(404).json({ error: "Playlist not found" })
    }

    // Check access permissions
    const isOwner = req.user && playlist.owner_id._id.toString() === req.user._id.toString()
    const isCollaborator = req.user
      ? await PlaylistCollaborator.findOne({
          playlist_id: playlist._id,
          user_id: req.user._id,
          status: "accepted",
        })
      : null

    if (!playlist.is_public && !isOwner && !isCollaborator) {
      return res.status(403).json({ error: "Access denied" })
    }

    // Get playlist items
    const items = await PlaylistItem.find({ playlist_id: playlist._id })
      .populate("added_by", "name avatar")
      .sort({ position: 1 })
      .lean()

    // Get collaborators
    const collaborators = await PlaylistCollaborator.find({
      playlist_id: playlist._id,
      status: "accepted",
    })
      .populate("user_id", "name email avatar")
      .sort({ added_at: 1 })
      .lean()

    // Get comments
    const comments = await PlaylistComment.find({
      playlist_id: playlist._id,
      parent_comment_id: null,
    })
      .populate("user_id", "name avatar")
      .sort({ created_at: -1 })
      .limit(20)
      .lean()

    // Get recent activity
    const activities = await PlaylistActivity.find({ playlist_id: playlist._id })
      .populate("user_id", "name avatar")
      .sort({ created_at: -1 })
      .limit(10)
      .lean()

    // Format response
    const formattedPlaylist = {
      id: playlist._id,
      title: playlist.name,
      description: playlist.description,
      thumbnail: playlist.thumbnail_url,
      isPublic: playlist.is_public,
      isCollaborative: playlist.is_collaborative,
      owner: {
        name: playlist.owner_id.name,
        avatar: playlist.owner_id.avatar,
      },
      videos: items.map((item) => ({
        id: item._id,
        title: item.title,
        channel: item.channel.name,
        duration: formatDuration(item.duration),
        thumbnail: item.thumbnail_url,
        addedBy: item.added_by.name,
        addedAt: item.added_at,
        views: item.metadata.views,
        likes: item.metadata.likes,
        description: item.description,
        youtubeUrl: item.youtube_url,
        position: item.position,
      })),
      collaborators: collaborators.map((collab) => ({
        id: collab.user_id._id,
        name: collab.user_id.name,
        avatar: collab.user_id.avatar,
        role: collab.permission_level,
        joinedAt: collab.added_at,
        lastActive: collab.last_active,
      })),
      comments: comments.map((comment) => ({
        id: comment._id,
        user: {
          name: comment.user_id.name,
          avatar: comment.user_id.avatar,
        },
        content: comment.content,
        timestamp: comment.created_at,
        replies: [], // TODO: Implement nested comments
      })),
      activities: activities.map((activity) => ({
        id: activity._id,
        user: activity.user_id ? activity.user_id.name : "System",
        action: activity.action,
        details: activity.details,
        timestamp: activity.created_at,
      })),
      stats: {
        totalViews: playlist.stats.total_views,
        totalDuration: formatDuration(playlist.stats.total_duration),
        createdAt: playlist.created_at,
        lastModified: playlist.updated_at,
      },
      tags: playlist.tags,
      category: playlist.category,
      userRole: isOwner ? "owner" : isCollaborator?.permission_level || null,
    }

    res.json(formattedPlaylist)
  } catch (error) {
    console.error("Error fetching playlist:", error)
    res.status(500).json({ error: "Failed to fetch playlist" })
  }
})

// Update playlist
router.put("/:id", authenticateToken, validatePlaylistUpdate, async (req, res) => {
  try {
    const playlist = await Playlist.findById(req.params.id)

    if (!playlist) {
      return res.status(404).json({ error: "Playlist not found" })
    }

    // Check permissions
    const isOwner = playlist.owner_id.toString() === req.user._id.toString()
    const isAdmin = await PlaylistCollaborator.findOne({
      playlist_id: playlist._id,
      user_id: req.user._id,
      permission_level: "admin",
      status: "accepted",
    })

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: "Access denied" })
    }

    const updateData = req.body
    const oldData = { ...playlist.toObject() }

    Object.assign(playlist, updateData)
    await playlist.save()

    // Log activity
    await logActivity(playlist._id, req.user._id, "updated", {
      changes: Object.keys(updateData),
      old_name: oldData.name,
      new_name: playlist.name,
    })

    await playlist.populate("owner_id", "name email avatar")

    res.json({
      id: playlist._id,
      title: playlist.name,
      description: playlist.description,
      thumbnail: playlist.thumbnail_url,
      videoCount: playlist.stats.video_count,
      isPublic: playlist.is_public,
      isCollaborative: playlist.is_collaborative,
      owner: {
        name: playlist.owner_id.name,
        avatar: playlist.owner_id.avatar,
      },
      tags: playlist.tags,
      category: playlist.category,
      status: playlist.status,
    })
  } catch (error) {
    console.error("Error updating playlist:", error)
    res.status(500).json({ error: "Failed to update playlist" })
  }
})

// Delete playlist
router.delete("/:id", authenticateToken, async (req, res) => {
  try {
    const playlist = await Playlist.findById(req.params.id)

    if (!playlist) {
      return res.status(404).json({ error: "Playlist not found" })
    }

    // Only owner can delete
    if (playlist.owner_id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: "Only the owner can delete this playlist" })
    }

    // Delete related data
    await Promise.all([
      PlaylistItem.deleteMany({ playlist_id: playlist._id }),
      PlaylistCollaborator.deleteMany({ playlist_id: playlist._id }),
      PlaylistComment.deleteMany({ playlist_id: playlist._id }),
      PlaylistActivity.deleteMany({ playlist_id: playlist._id }),
    ])

    await playlist.deleteOne()

    res.json({ message: "Playlist deleted successfully" })
  } catch (error) {
    console.error("Error deleting playlist:", error)
    res.status(500).json({ error: "Failed to delete playlist" })
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