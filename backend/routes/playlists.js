const express = require("express")
const router = express.Router()
const { authenticateToken, optionalAuth } = require("../middleware/auth")
const { validatePlaylistCreate, validatePlaylistUpdate } = require("../middleware/validation")
const { uploadThumbnail } = require("../config/cloudinary")
const Playlist = require("../models/PlaylistManager")
const PlaylistItem = require("../models/PlaylistItem")
const PlaylistCollaborator = require("../models/PlaylistCollaborator")
const PlaylistComment = require("../models/PlaylistComment")
const PlaylistActivity = require("../models/PlaylistActivity")
const { getYouTubeVideoInfo, getYouTubePlaylistInfo } = require("../utils/youtube")
const { logActivity, updatePlaylistStats } = require("../utils/playlistUtils")

// Test endpoint to verify authentication and route access
router.get("/test-auth", authenticateToken, (req, res) => {
  res.json({
    message: "Authentication working",
    user: {
      id: req.user._id.toString(),
      email: req.user.email,
      name: req.user.name
    }
  })
})

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
      // All playlists - only public playlists + private playlists shared with user
      if (req.user) {
        // Get shared playlist IDs
        const sharedPlaylistIds = await PlaylistCollaborator.find({
          user_id: req.user._id,
          status: "accepted",
        }).distinct("playlist_id")

        query.$or = [
          // Public playlists (active status)
          { is_public: true, status: "active" },
          // Private playlists shared with the user (not owned by them)
          {
            _id: { $in: sharedPlaylistIds },
            is_public: false,
            owner_id: { $ne: req.user._id }, // Exclude user's own private playlists
          },
        ]
      } else {
        // Unauthenticated users only see public playlists
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

    // Get user's favorites if authenticated
    let userFavorites = []
    if (req.user) {
      const User = require("../models/User")
      const user = await User.findById(req.user._id).select("favorites.playlists")
      userFavorites = user?.favorites?.playlists?.map(id => id.toString()) || []
    }

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
      isFavorite: userFavorites.includes(playlist._id.toString()),
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
// Create a new playlist
router.post("/", authenticateToken, uploadThumbnail.single("thumbnail"), validatePlaylistCreate, async (req, res) => {
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
      status = "active", // can be "active" or "draft"
      save_as_draft = false,
    } = req.body

    // Parse tags if it's a string (from form data)
    let parsedTags = tags
    if (typeof tags === 'string') {
      try {
        parsedTags = JSON.parse(tags)
      } catch {
        parsedTags = tags.split(',').map(tag => tag.trim()).filter(Boolean)
      }
    }

    // Determine final status
    const finalStatus = save_as_draft === 'true' || save_as_draft === true ? "draft" : status

    let playlistData = {
      owner_id: req.user._id,
      name,
      description,
      is_public: finalStatus === "draft" ? false : is_public, // Drafts are always private
      is_collaborative,
      category,
      tags: parsedTags,
      thumbnail_url: req.file ? req.file.path : thumbnail_url, // Use uploaded file or provided URL
      status: finalStatus,
    }

    // Handle YouTube playlist import
    if (import_url) {
      try {
        const importedData = await getYouTubePlaylistInfo(import_url)
        playlistData = {
          ...playlistData,
          name: importedData.title || name,
          description: importedData.description || description,
          thumbnail_url: req.file ? req.file.path : (importedData.thumbnail || thumbnail_url),
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

    // Import videos if this is from a YouTube playlist
    if (import_url) {
      try {
        const importedData = await getYouTubePlaylistInfo(import_url)
        
        // Import videos from the playlist
        if (importedData.videos && importedData.videos.length > 0) {
          for (let i = 0; i < importedData.videos.length; i++) {
            const video = importedData.videos[i]
            
            try {
              // Fetch full video metadata for proper views, likes, duration data
              let videoInfo
              try {
                const videoUrl = `https://www.youtube.com/watch?v=${video.videoId || video.video_id}`
                videoInfo = await getYouTubeVideoInfo(videoUrl)
              } catch (metadataError) {
                // Fallback to basic video data
                videoInfo = {
                  id: video.videoId || video.video_id,
                  videoId: video.videoId || video.video_id,
                  title: video.title,
                  thumbnail: video.thumbnail,
                  durationSeconds: video.durationSeconds || 0,
                  channel: video.channel,
                  views: 0,
                  likes: 0,
                  description: "",
                  publishedAt: null,
                  language: null
                }
              }
              
              const playlistItem = new PlaylistItem({
                playlist_id: playlist._id,
                youtube_url: `https://www.youtube.com/watch?v=${videoInfo.videoId}`,
                youtube_id: videoInfo.videoId,
                title: videoInfo.title,
                description: (videoInfo.description || "").substring(0, 2000),
                thumbnail_url: videoInfo.thumbnail || videoInfo.thumbnailUrl,
                duration: videoInfo.durationSeconds || 0,
                channel: {
                  name: (typeof videoInfo.channel === 'object' ? videoInfo.channel?.name : videoInfo.channel) || "Unknown Channel",
                  url: (typeof videoInfo.channel === 'object' ? videoInfo.channel?.url : "") || "",
                  thumbnail: (typeof videoInfo.channel === 'object' ? videoInfo.channel?.thumbnail : "") || "",
                },
                added_by: req.user._id,
                position: i,
                metadata: {
                  views: videoInfo.views || 0,
                  likes: videoInfo.likes || 0,
                  published_at: videoInfo.publishedAt || null,
                  language: videoInfo.language || null,
                },
              })
              
              await playlistItem.save()
            } catch (itemError) {
              console.error(`Error adding video ${video.videoId || video.video_id} to playlist:`, itemError)
            }
          }
          
          // Update playlist stats with actual saved data including total views
          await updatePlaylistStats(playlist._id)
          
        }
      } catch (importError) {
        console.error("Error importing videos from YouTube playlist:", importError)
        // Continue even if video import fails
      }
    }

    // Log activity
    await logActivity(playlist._id, req.user._id, finalStatus === "draft" ? "drafted" : "created", {
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
      status: playlist.status,
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
    })
  } catch (error) {
    console.error("Error creating playlist:", error)
    if (error.code === 11000) {
      return res.status(400).json({ error: "Playlist name already exists" })
    }
    res.status(500).json({ error: "Failed to create playlist" })
  }
})

// Get user's favorite playlists
router.get("/favorites", authenticateToken, async (req, res) => {
  try {
    const User = require("../models/User")
    const { page = 1, limit = 12 } = req.query

    const pageNum = Number.parseInt(page)
    const limitNum = Number.parseInt(limit)
    const skip = (pageNum - 1) * limitNum

    // Get user with populated favorites
    const user = await User.findById(req.user._id).populate({
      path: "favorites.playlists",
      populate: {
        path: "owner_id",
        select: "name email avatar",
      },
    })

    if (!user) {
      return res.status(404).json({ error: "User not found" })
    }

    const favoritePlaylists = user.favorites?.playlists || []
    
    const total = favoritePlaylists.length
    const paginatedFavorites = favoritePlaylists.slice(skip, skip + limitNum)

    // Format the playlists to match the expected structure
    const formattedPlaylists = paginatedFavorites.map(playlist => ({
      id: playlist._id.toString(),
      title: playlist.name,
      description: playlist.description,
      thumbnail: playlist.thumbnail_url || "/placeholder.svg",
      videoCount: playlist.stats.video_count,
      isPublic: playlist.is_public,
      isCollaborative: playlist.is_collaborative,
      owner: {
        name: playlist.owner_id?.name || "Unknown",
        avatar: playlist.owner_id?.avatar || "/placeholder.svg",
      },
      collaborators: 0, // Will be populated if needed
      views: playlist.stats.total_views,
      createdAt: playlist.created_at,
      lastModified: playlist.updated_at,
      tags: playlist.tags,
      category: playlist.category,
      status: playlist.status,
      isFavorite: true,
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
    console.error("Error fetching favorites:", error)
    res.status(500).json({ error: "Failed to fetch favorites" })
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

    // Check if playlist is in user's favorites
    let isFavorite = false
    if (req.user) {
      const User = require("../models/User")
      const user = await User.findById(req.user._id).select("favorites.playlists")
      isFavorite = user?.favorites?.playlists?.some(id => id.toString() === playlist._id.toString()) || false
    }

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
          id: comment.user_id._id.toString(),
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
      isFavorite,
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

// Add collaborator to playlist
router.post("/:id/collaborators", authenticateToken, async (req, res) => {
  try {
    const { email, permission_level = "viewer" } = req.body

    if (!email) {
      return res.status(400).json({ error: "Email is required" })
    }

    if (!["viewer", "editor", "admin"].includes(permission_level)) {
      return res.status(400).json({ error: "Invalid permission level" })
    }

    const playlist = await Playlist.findById(req.params.id)

    if (!playlist) {
      return res.status(404).json({ error: "Playlist not found" })
    }

    // Only owner can add collaborators
    if (playlist.owner_id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: "Only the owner can add collaborators" })
    }

    // Check if already a collaborator (by email since user might not exist yet)
    const existingCollaborator = await PlaylistCollaborator.findOne({
      playlist_id: playlist._id,
      invited_email: email.toLowerCase(),
    })

    if (existingCollaborator) {
      return res.status(400).json({ error: "User is already invited as a collaborator on this playlist" })
    }

    // Create collaborator invite (email-based, user_id will be set when they accept)
    
    // Generate a unique token for the invite
    const { generateToken } = require("../utils/tokenGenerator")
    const inviteToken = generateToken()
    
    const collaborator = new PlaylistCollaborator({
      playlist_id: playlist._id,
      invited_email: email.toLowerCase(), // Store email instead of user_id initially
      token: inviteToken, // Add the token field
      permission_level,
      invited_by: req.user._id,
      status: "pending", // Will be changed to "accepted" when user accepts
    })

    await collaborator.save()

    // Log activity
    await logActivity(playlist._id, req.user._id, "invited_collaborator", {
      invited_email: email.toLowerCase(),
      permission_level,
    })

    // Send email invite
    const { sendCollaborationInvite } = require("../services/emailService")
    await sendCollaborationInvite(email.toLowerCase(), {
      playlistName: playlist.name,
      inviterName: req.user.name,
      role: permission_level,
      acceptUrl: `${process.env.FRONTEND_URL || "http://localhost:3000"}/playlists/${playlist._id}/accept-invite?token=${collaborator.token}`,
    })

    res.json({
      message: "Collaboration invite sent successfully",
      collaborator: {
        id: collaborator._id,
        email: email.toLowerCase(),
        role: permission_level,
        status: "pending",
      },
    })
  } catch (error) {
    console.error("Error adding collaborator:", error)
    res.status(500).json({ error: "Failed to add collaborator" })
  }
})

// Accept collaboration invite
router.post("/:id/collaborators/accept", authenticateToken, async (req, res) => {
  try {
    const { token } = req.body

    const collaborator = await PlaylistCollaborator.findOne({ token: token })
      .populate("playlist_id")
      .populate("user_id")

    if (!collaborator) {
      return res.status(404).json({ error: "Invalid invite token" })
    }

    // Check if this invite is for the authenticated user
    let isCorrectUser = false
    
    if (collaborator.user_id) {
      // User-ID based invite
      isCorrectUser = collaborator.user_id._id.toString() === req.user._id.toString()
    } else if (collaborator.invited_email) {
      // Email-based invite - link it to the authenticated user
      const invitedEmail = collaborator.invited_email.toLowerCase().trim()
      const userEmail = req.user.email.toLowerCase().trim()
      isCorrectUser = invitedEmail === userEmail
      console.log('  Match:', isCorrectUser)
      
      if (isCorrectUser) {
        console.log('✅ Linking email-based invite to authenticated user')
        collaborator.user_id = req.user._id
        // Keep the invited_email for record-keeping, don't clear it
      }
    }

    if (!isCorrectUser) {
      console.log('❌ This invite is not for the authenticated user')
      return res.status(403).json({ error: "This invite is not for you" })
    }

    if (collaborator.status === "accepted") {
      console.log('⚠️ Invite already accepted')
      return res.status(400).json({ error: "Invite already accepted" })
    }

    // Update collaborator status
    collaborator.status = "accepted"
    collaborator.last_active = new Date()
    await collaborator.save()

    console.log('✅ Collaboration invite accepted successfully')

    // Log activity
    await logActivity(collaborator.playlist_id._id, req.user._id, "accepted_collaboration", {
      playlist_name: collaborator.playlist_id.name,
      permission_level: collaborator.permission_level
    })

    res.json({ 
      message: "Collaboration invite accepted successfully",
      playlist: {
        id: collaborator.playlist_id._id,
        name: collaborator.playlist_id.name,
        role: collaborator.permission_level
      }
    })
  } catch (error) {
    console.error("❌ Error accepting collaboration invite:", error)
    res.status(500).json({ error: "Failed to accept invite" })
  }
})

// Reject collaboration invite
router.post("/:id/collaborators/reject", authenticateToken, async (req, res) => {
  try {
    const { token } = req.body

    const collaborator = await PlaylistCollaborator.findOne({ token: token })
      .populate("playlist_id")
      .populate("user_id")

    if (!collaborator) {
      return res.status(404).json({ error: "Invalid invite token" })
    }

    // Check if this invite is for the authenticated user
    let isCorrectUser = false
    
    if (collaborator.user_id) {
      // User-ID based invite
      isCorrectUser = collaborator.user_id._id.toString() === req.user._id.toString()
    } else if (collaborator.invited_email) {
      // Email-based invite
      isCorrectUser = collaborator.invited_email.toLowerCase() === req.user.email.toLowerCase()
    }

    if (!isCorrectUser) {
      return res.status(403).json({ error: "This invite is not for you" })
    }

    if (collaborator.status === "accepted") {
      return res.status(400).json({ error: "Invite already accepted" })
    }

    collaborator.status = "declined"
    await collaborator.save()

    // Log activity
    await logActivity(collaborator.playlist_id._id, req.user._id, "declined_collaboration", {
      playlist_name: collaborator.playlist_id.name,
    })

    res.json({ message: "Collaboration invite rejected successfully" })
  } catch (error) {
    console.error("Error rejecting collaboration invite:", error)
    res.status(500).json({ error: "Failed to reject invite" })
  }
})

// Get invite details
router.get("/:id/collaborators/invite/:token", optionalAuth, async (req, res) => {
  try {
    const { token } = req.params

    console.log('=== GET INVITE DETAILS ===')
    console.log('Token:', token)
    console.log('User:', req.user ? `${req.user._id} (${req.user.email})` : 'Not authenticated')

    const collaborator = await PlaylistCollaborator.findOne({ token: token })
      .populate("playlist_id", "name description")
      .populate("user_id", "name email")
      .populate("invited_by", "name email")

    if (!collaborator) {
      console.log('❌ No collaborator found for token:', token)
      return res.status(404).json({ error: "Invalid invite token" })
    }

    console.log('Found collaborator:', {
      id: collaborator._id,
      user_id: collaborator.user_id?._id,
      invited_email: collaborator.invited_email,
      status: collaborator.status,
      permission_level: collaborator.permission_level,
      playlist_id: collaborator.playlist_id?._id
    })

    if (!collaborator.playlist_id) {
      console.log('❌ Playlist not found or deleted')
      return res.status(404).json({ error: "Playlist not found or deleted" })
    }

    if (!collaborator.invited_by) {
      console.log('❌ Inviter not found')
      return res.status(404).json({ error: "Inviter not found" })
    }

    // If user is authenticated, check if this invite is for them
    if (req.user) {
      let isCorrectUser = false
      
      if (collaborator.user_id) {
        // User-ID based invite
        isCorrectUser = collaborator.user_id._id.toString() === req.user._id.toString()
        console.log('🔐 Checking user ID match:')
        console.log('  - Collaborator user ID:', collaborator.user_id._id.toString())
        console.log('  - Authenticated user ID:', req.user._id.toString())
        console.log('  - Match:', isCorrectUser)
      } else if (collaborator.invited_email) {
        // Email-based invite
        isCorrectUser = collaborator.invited_email.toLowerCase() === req.user.email.toLowerCase()
        console.log('📧 Checking email match:')
        console.log('  - Collaborator invited email:', collaborator.invited_email)
        console.log('  - Authenticated user email:', req.user.email)
        console.log('  - Match:', isCorrectUser)
      }

      if (!isCorrectUser) {
        console.log('❌ User mismatch - this invite is not for the authenticated user')
        return res.status(403).json({ error: "This invite is not for you" })
      }
      console.log('✅ User match confirmed')
    } else {
      console.log('ℹ️ No user authenticated - returning basic invite details')
    }
    const responseData = {
      invite: {
        id: collaborator._id,
        playlist: {
          id: collaborator.playlist_id._id,
          name: collaborator.playlist_id.name,
          description: collaborator.playlist_id.description,
        },
        inviter: {
          name: collaborator.invited_by.name,
          email: collaborator.invited_by.email,
        },
        permission_level: collaborator.permission_level,
        status: collaborator.status,
        invited_at: collaborator.added_at,
      },
    }
    
    console.log('📤 Sending response:', responseData)
    res.json(responseData)
  } catch (error) {
    console.error("❌ Error fetching invite details:", error)
    console.error("Error stack:", error.stack)
    res.status(500).json({ error: "Failed to fetch invite details", details: error.message })
  }
})

// Remove collaborator
router.delete("/:id/collaborators/:collaboratorId", authenticateToken, async (req, res) => {
  try {
    console.log(`🗑️ Remove Collaborator Request:`)
    console.log(`  - Playlist ID: ${req.params.id}`)
    console.log(`  - Collaborator ID: ${req.params.collaboratorId}`)
    console.log(`  - User ID: ${req.user._id}`)
    
    const playlist = await Playlist.findById(req.params.id)

    if (!playlist) {
      return res.status(404).json({ error: "Playlist not found" })
    }

    const isOwner = playlist.owner_id.toString() === req.user._id.toString()
    
    // Check if user is admin collaborator
    const isAdmin = await PlaylistCollaborator.findOne({
      playlist_id: playlist._id,
      user_id: req.user._id,
      permission_level: "admin",
      status: "accepted",
    })

    // Only owner or admin can remove collaborators
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: "Only the owner or admin can remove collaborators" })
    }

    // First try to find by direct ID (backward compatibility)
    let collaborator = await PlaylistCollaborator.findById(req.params.collaboratorId)
    
    // If not found, try to find by user_id (which is what the frontend is likely sending)
    if (!collaborator) {
      collaborator = await PlaylistCollaborator.findOne({
        playlist_id: req.params.id,
        user_id: req.params.collaboratorId
      })
      console.log(`  - Found collaborator by user_id: ${collaborator ? 'Yes' : 'No'}`)
    }

    if (!collaborator) {
      return res.status(404).json({ error: "Collaborator not found" })
    }
    
    console.log(`  - Collaborator found: ${collaborator._id}`)
    console.log(`  - Permission level: ${collaborator.permission_level}`)

    // Prevent non-owners from removing other admins or the owner
    if (!isOwner) {
      if (collaborator.permission_level === "admin") {
        return res.status(403).json({ error: "Only the owner can remove admin collaborators" })
      }
    }

    // Cannot remove the owner (even though owner won't be in collaborators table)
    if (collaborator.user_id && collaborator.user_id.toString() === playlist.owner_id.toString()) {
      return res.status(403).json({ error: "Cannot remove the playlist owner" })
    }

    console.log(`  - Deleting collaborator: ${collaborator._id}`)
    const deleteResult = await PlaylistCollaborator.findByIdAndDelete(collaborator._id)
    console.log(`  - Delete result: ${deleteResult ? 'Success' : 'Failed'}`)

    // Log activity
    await logActivity(playlist._id, req.user._id, "removed_collaborator", {
      removed_user_id: collaborator.user_id,
      removed_email: collaborator.invited_email,
      permission_level: collaborator.permission_level,
    })

    res.json({ message: "Collaborator removed successfully" })
  } catch (error) {
    console.error("Error removing collaborator:", error)
    res.status(500).json({ error: "Failed to remove collaborator" })
  }
})

// Add a comment to a playlist
router.post("/:id/comments", authenticateToken, async (req, res) => {
  try {
    const { content } = req.body
    
    if (!content || content.trim() === "") {
      return res.status(400).json({ error: "Comment cannot be empty" })
    }
    
    const playlist = await Playlist.findById(req.params.id)
    if (!playlist) {
      return res.status(404).json({ error: "Playlist not found" })
    }
    
    // Check if user has access to the playlist
    const isOwner = playlist.owner_id.toString() === req.user._id.toString()
    const isCollaborator = await PlaylistCollaborator.findOne({
      playlist_id: playlist._id,
      user_id: req.user._id,
      status: "accepted",
    })
    
    // Only owner, collaborators, or public playlist viewers can comment
    if (!isOwner && !isCollaborator && !playlist.is_public) {
      return res.status(403).json({ error: "You don't have permission to comment on this playlist" })
    }
    
    const comment = new PlaylistComment({
      playlist_id: playlist._id,
      user_id: req.user._id,
      content: content.trim().substring(0, 1000), // Limit comment length
      parent_comment_id: req.body.parent_comment_id || null,
    })
    
    await comment.save()
    
    // Log activity
    await logActivity(playlist._id, req.user._id, "comment_added", {
      comment_id: comment._id,
    })
    
    // Return the comment with user info
    await comment.populate("user_id", "name email avatar")
    
    res.status(201).json({
      id: comment._id,
      user: {
        id: comment.user_id._id.toString(),
        name: comment.user_id.name,
        avatar: comment.user_id.avatar,
      },
      content: comment.content,
      timestamp: comment.created_at,
      replies: [],
    })
  } catch (error) {
    console.error("Error adding comment:", error)
    res.status(500).json({ error: "Failed to add comment" })
  }
})

// Delete a comment
router.delete("/:id/comments/:commentId", authenticateToken, async (req, res) => {
  try {
    console.log("Delete comment request received:", {
      playlistId: req.params.id,
      commentId: req.params.commentId,
      userId: req.user._id
    });
    
    // First, find the comment without populating to check if it exists
    const comment = await PlaylistComment.findById(req.params.commentId)
    
    if (!comment) {
      console.log("Comment not found:", req.params.commentId);
      return res.status(404).json({ error: "Comment not found" })
    }
    
    // Get the playlist ID directly
    const playlistId = comment.playlist_id;
    
    console.log("Found comment:", {
      id: comment._id,
      user_id: comment.user_id,
      playlist_id: playlistId,
      content: comment.content.substring(0, 20) + "..."
    });
    
    // Find the playlist separately
    const playlist = await Playlist.findById(playlistId);
    if (!playlist) {
      console.log("Playlist not found for comment:", playlistId);
      return res.status(404).json({ error: "Playlist not found" });
    }
    
    // Check if user has permission to delete the comment
    const isCommentOwner = comment.user_id.toString() === req.user._id.toString()
    const isPlaylistOwner = playlist.owner_id.toString() === req.user._id.toString()
    
    // Only comment author and playlist owner can delete comments (not admins)
    console.log("Permission check:", {
      isCommentOwner,
      isPlaylistOwner
    });
    
    if (!isCommentOwner && !isPlaylistOwner) {
      console.log("Permission denied to delete comment");
      return res.status(403).json({ error: "You don't have permission to delete this comment" })
    }
    
    console.log("Deleting comment:", comment._id);
    await PlaylistComment.findByIdAndDelete(req.params.commentId)
    
    // Log activity
    await logActivity(playlistId, req.user._id, "comment_deleted", {})
    
    console.log("Comment deleted successfully");
    res.json({ message: "Comment deleted successfully" })
  } catch (error) {
    console.error("Error deleting comment:", error)
    res.status(500).json({ error: "Failed to delete comment", message: error.message })
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

// Add playlist to favorites
router.post("/:id/favorite", authenticateToken, async (req, res) => {
  try {
    const User = require("../models/User")
    const playlistId = req.params.id
    const userId = req.user._id

    // Check if playlist exists
    const playlist = await Playlist.findById(playlistId)
    if (!playlist) {
      return res.status(404).json({ error: "Playlist not found" })
    }

    // Add to favorites if not already there
    const user = await User.findById(userId)
    if (!user.favorites) {
      user.favorites = { playlists: [] }
    }
    if (!user.favorites.playlists) {
      user.favorites.playlists = []
    }
    if (!user.favorites.playlists.includes(playlistId)) {
      user.favorites.playlists.push(playlistId)
      await user.save()
    }

    res.json({ message: "Playlist added to favorites", isFavorite: true })
  } catch (error) {
    console.error("Error adding to favorites:", error)
    res.status(500).json({ error: "Failed to add to favorites" })
  }
})

// Remove playlist from favorites
router.delete("/:id/favorite", authenticateToken, async (req, res) => {
  try {
    const User = require("../models/User")
    const playlistId = req.params.id
    const userId = req.user._id

    // Remove from favorites
    const user = await User.findById(userId)
    if (!user.favorites) {
      user.favorites = { playlists: [] }
    }
    if (!user.favorites.playlists) {
      user.favorites.playlists = []
    }
    user.favorites.playlists = user.favorites.playlists.filter(
      id => id.toString() !== playlistId
    )
    await user.save()

    res.json({ message: "Playlist removed from favorites", isFavorite: false })
  } catch (error) {
    console.error("Error removing from favorites:", error)
    res.status(500).json({ error: "Failed to remove from favorites" })
  }
})

module.exports = router