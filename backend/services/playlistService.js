const Playlist = require("../models/PlaylistManager")
const PlaylistItem = require("../models/PlaylistItem")
const PlaylistCollaborator = require("../models/PlaylistCollaborator")
const PlaylistComment = require("../models/PlaylistComment")
const PlaylistActivity = require("../models/PlaylistActivity")
const User = require("../models/User")
const youtubeService = require("./youtubeService")
const { generateToken } = require("../utils/tokenGenerator")
const { sendCollaborationInvite } = require("./emailService")

/**
 * Playlist Service
 * Handles all playlist-related business logic
 */
class PlaylistService {
  /**
   * Get all playlists with filtering, pagination, and search
   */
  async getAllPlaylists(filters = {}, userId = null) {
    const {
      page = 1,
      limit = 12,
      search = "",
      filter = "all",
      sort = "recent",
      category = "",
      tags = ""
    } = filters

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
      if (!userId) {
        throw new Error("Authentication required for private playlists")
      }
      query.owner_id = userId
      query.is_public = false
    } else if (filter === "collaborative") {
      query.is_collaborative = true
      query.status = "active"
    } else {
      // All playlists - only public playlists + private playlists shared with user
      if (userId) {
        const sharedPlaylistIds = await PlaylistCollaborator.find({
          user_id: userId,
          status: "accepted",
        }).distinct("playlist_id")

        query.$or = [
          { is_public: true, status: "active" },
          {
            _id: { $in: sharedPlaylistIds },
            is_public: false,
            owner_id: { $ne: userId },
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
      case "popular":
        sortQuery = { "stats.video_count": -1, views: -1 }
        break
      case "trending":
        sortQuery = { views: -1, updated_at: -1 }
        break
      case "oldest":
        sortQuery = { created_at: 1 }
        break
      case "alphabetical":
        sortQuery = { name: 1 }
        break
      default:
        sortQuery = { updated_at: -1 }
    }

    // Execute query
    const playlists = await Playlist.find(query)
      .sort(sortQuery)
      .skip(skip)
      .limit(limitNum)
      .populate("owner_id", "name email picture")
      .lean()

    const total = await Playlist.countDocuments(query)

    // Add collaboration info for each playlist
    if (userId) {
      for (const playlist of playlists) {
        const role = await this.getUserRole(playlist._id, userId)
        playlist.user_role = role
      }
    }

    return {
      playlists,
      pagination: {
        current_page: pageNum,
        total_pages: Math.ceil(total / limitNum),
        total_items: total,
        items_per_page: limitNum,
      },
    }
  }

  /**
   * Get a single playlist by ID
   */
  async getPlaylistById(playlistId, userId = null) {
    const playlist = await Playlist.findById(playlistId)
      .populate("owner_id", "name email picture")
      .lean()

    if (!playlist) {
      throw new Error("Playlist not found")
    }

    // Check access permissions
    const hasAccess = await this.checkViewAccess(playlistId, userId)
    if (!hasAccess) {
      throw new Error("Access denied")
    }

    // Add user role if authenticated
    if (userId) {
      playlist.user_role = await this.getUserRole(playlistId, userId)
    }

    // Get playlist items
    const items = await PlaylistItem.find({ playlist_id: playlistId })
      .sort({ position: 1 })
      .populate("added_by", "name picture")
      .lean()

    playlist.items = items

    return playlist
  }

  /**
   * Create a new playlist
   */
  async createPlaylist(playlistData, userId) {
    const playlist = new Playlist({
      ...playlistData,
      owner_id: userId,
      created_at: new Date(),
      updated_at: new Date(),
    })

    await playlist.save()

    // Log activity
    await this.logActivity(playlist._id, userId, "created", { name: playlist.name })

    return playlist
  }

  /**
   * Update a playlist
   */
  async updatePlaylist(playlistId, updates, userId) {
    // Check permission
    const hasPermission = await this.checkPermission(playlistId, userId, "admin")
    if (!hasPermission) {
      throw new Error("Permission denied")
    }

    const playlist = await Playlist.findByIdAndUpdate(
      playlistId,
      { ...updates, updated_at: new Date() },
      { new: true }
    )

    if (!playlist) {
      throw new Error("Playlist not found")
    }

    // Log activity
    await this.logActivity(playlistId, userId, "updated", { fields: Object.keys(updates) })

    return playlist
  }

  /**
   * Delete a playlist
   */
  async deletePlaylist(playlistId, userId) {
    const playlist = await Playlist.findById(playlistId)
    if (!playlist) {
      throw new Error("Playlist not found")
    }

    // Only owner can delete
    if (playlist.owner_id.toString() !== userId.toString()) {
      throw new Error("Only the owner can delete this playlist")
    }

    // Delete all related data
    await Promise.all([
      PlaylistItem.deleteMany({ playlist_id: playlistId }),
      PlaylistCollaborator.deleteMany({ playlist_id: playlistId }),
      PlaylistComment.deleteMany({ playlist_id: playlistId }),
      PlaylistActivity.deleteMany({ playlist_id: playlistId }),
      Playlist.findByIdAndDelete(playlistId),
    ])

    return { message: "Playlist deleted successfully" }
  }

  /**
   * Add video to playlist
   */
  async addVideoToPlaylist(playlistId, videoData, userId) {
    // Check permission
    const hasPermission = await this.checkPermission(playlistId, userId, "editor")
    if (!hasPermission) {
      throw new Error("Permission denied")
    }

    // Get video info from YouTube
    const videoInfo = await youtubeService.getVideoInfo(videoData.youtube_url)

    // Check for duplicates
    const existing = await PlaylistItem.findOne({
      playlist_id: playlistId,
      youtube_id: videoInfo.videoId,
    })

    if (existing) {
      throw new Error("Video already exists in playlist")
    }

    // Get next position
    const lastItem = await PlaylistItem.findOne({ playlist_id: playlistId })
      .sort({ position: -1 })
      .lean()
    const position = lastItem ? lastItem.position + 1 : 0

    // Create playlist item
    const item = new PlaylistItem({
      playlist_id: playlistId,
      youtube_url: videoData.youtube_url,
      youtube_id: videoInfo.videoId,
      title: videoInfo.title,
      thumbnail: videoInfo.thumbnail,
      duration: videoInfo.durationSeconds,
      channel: {
        name: videoInfo.channel?.name || "Unknown",
        url: videoInfo.channel?.url || "",
        thumbnail: videoInfo.channel?.thumbnail || "",
      },
      metadata: {
        views: videoInfo.views,
        likes: videoInfo.likes,
        description: videoInfo.description,
      },
      added_by: userId,
      position,
    })

    await item.save()

    // Update playlist stats
    await this.updatePlaylistStats(playlistId)

    // Log activity
    await this.logActivity(playlistId, userId, "added_video", { 
      video_title: videoInfo.title,
      video_id: videoInfo.videoId
    })

    return item
  }

  /**
   * Remove video from playlist
   */
  async removeVideoFromPlaylist(playlistId, itemId, userId) {
    // Check permission
    const hasPermission = await this.checkPermission(playlistId, userId, "editor")
    if (!hasPermission) {
      throw new Error("Permission denied")
    }

    const item = await PlaylistItem.findOne({
      _id: itemId,
      playlist_id: playlistId,
    })

    if (!item) {
      throw new Error("Video not found in playlist")
    }

    await PlaylistItem.findByIdAndDelete(itemId)

    // Reorder remaining items
    await this._reorderItems(playlistId)

    // Update playlist stats
    await this.updatePlaylistStats(playlistId)

    // Log activity
    await this.logActivity(playlistId, userId, "removed_video", { 
      video_title: item.title,
      video_id: item.youtube_id
    })

    return { message: "Video removed successfully" }
  }

  /**
   * Reorder playlist items
   */
  async _reorderItems(playlistId) {
    const items = await PlaylistItem.find({ playlist_id: playlistId })
      .sort({ position: 1 })
      .lean()

    const updates = items.map((item, index) => ({
      updateOne: {
        filter: { _id: item._id },
        update: { $set: { position: index } },
      },
    }))

    if (updates.length > 0) {
      await PlaylistItem.bulkWrite(updates)
    }
  }

  /**
   * Reorder all playlist items with new positions (bulk update)
   */
  async reorderPlaylistItems(playlistId, items, userId) {
    // Check permission
    const hasPermission = await this.checkPermission(playlistId, userId, "editor")
    if (!hasPermission) {
      throw new Error("Permission denied")
    }

    // Update positions
    const updatePromises = items.map((item) => 
      PlaylistItem.findByIdAndUpdate(item.id, { position: item.position })
    )

    await Promise.all(updatePromises)

    // Update playlist modified time
    await Playlist.findByIdAndUpdate(playlistId, { updated_at: new Date() })

    // Log activity
    await this.logActivity(playlistId, userId, "reordered_videos", {
      items_count: items.length,
    })

    return { message: "Playlist items reordered successfully" }
  }

  /**
   * Move a single playlist item to a new position
   */
  async movePlaylistItem(playlistId, itemId, newPosition, userId) {
    // Validate position
    if (newPosition === undefined || newPosition < 0) {
      throw new Error("Invalid position")
    }

    // Check permission
    const hasPermission = await this.checkPermission(playlistId, userId, "editor")
    if (!hasPermission) {
      throw new Error("Permission denied")
    }

    // Get the item
    const item = await PlaylistItem.findOne({
      _id: itemId,
      playlist_id: playlistId,
    })

    if (!item) {
      throw new Error("Video not found in playlist")
    }

    const oldPosition = item.position

    // If position is the same, do nothing
    if (oldPosition === newPosition) {
      return { 
        message: "Position unchanged",
        item: {
          id: item._id,
          title: item.title,
          position: newPosition
        }
      }
    }

    // Get total count to ensure new position is valid
    const count = await PlaylistItem.countDocuments({ playlist_id: playlistId })
    if (newPosition >= count) {
      throw new Error("Position out of range")
    }

    // Update positions of other items
    if (newPosition > oldPosition) {
      // Moving down - shift items between old and new position up
      await PlaylistItem.updateMany(
        { 
          playlist_id: playlistId, 
          position: { $gt: oldPosition, $lte: newPosition } 
        },
        { $inc: { position: -1 } }
      )
    } else {
      // Moving up - shift items between new and old position down
      await PlaylistItem.updateMany(
        { 
          playlist_id: playlistId, 
          position: { $gte: newPosition, $lt: oldPosition } 
        },
        { $inc: { position: 1 } }
      )
    }

    // Update the item's position
    item.position = newPosition
    await item.save()

    // Update playlist modified time
    await Playlist.findByIdAndUpdate(playlistId, { updated_at: new Date() })

    // Log activity
    await this.logActivity(playlistId, userId, "moved_video", {
      video_title: item.title,
      from_position: oldPosition,
      to_position: newPosition
    })

    return { 
      message: "Video moved successfully",
      item: {
        id: item._id,
        title: item.title,
        new_position: newPosition
      }
    }
  }

  /**
   * Update playlist statistics
   */
  async updatePlaylistStats(playlistId) {
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
  }

  /**
   * Check if user has view access to playlist
   */
  async checkViewAccess(playlistId, userId) {
    const playlist = await Playlist.findById(playlistId)
    if (!playlist) {
      return false
    }

    // Public playlists are accessible to all
    if (playlist.is_public && playlist.status === "active") {
      return true
    }

    // No user ID means no access to private playlists
    if (!userId) {
      return false
    }

    // Owner always has access
    if (playlist.owner_id.toString() === userId.toString()) {
      return true
    }

    // Check if user is a collaborator
    const collaboration = await PlaylistCollaborator.findOne({
      playlist_id: playlistId,
      user_id: userId,
      status: "accepted",
    })

    return !!collaboration
  }

  /**
   * Check if user has specific permission level on playlist
   */
  async checkPermission(playlistId, userId, requiredLevel = "viewer") {
    const playlist = await Playlist.findById(playlistId)
    if (!playlist) {
      return false
    }

    // Owner has all permissions
    if (playlist.owner_id.toString() === userId.toString()) {
      return true
    }

    // Check collaborator permissions
    const collaboration = await PlaylistCollaborator.findOne({
      playlist_id: playlistId,
      user_id: userId,
      status: "accepted",
    })

    if (!collaboration) {
      // Check if playlist is public and only viewer access is required
      return playlist.is_public && requiredLevel === "viewer"
    }

    // Permission hierarchy: admin > editor > viewer
    const permissionLevels = {
      viewer: 1,
      editor: 2,
      admin: 3,
    }

    const userLevel = permissionLevels[collaboration.permission_level] || 0
    const requiredLevelNum = permissionLevels[requiredLevel] || 0

    return userLevel >= requiredLevelNum
  }

  /**
   * Get user's role in playlist
   */
  async getUserRole(playlistId, userId) {
    const playlist = await Playlist.findById(playlistId)
    if (!playlist) {
      return null
    }

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
  }

  /**
   * Log playlist activity
   */
  async logActivity(playlistId, userId, action, details = {}, metadata = {}) {
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

  /**
   * Generate playlist export data
   */
  async generatePlaylistExport(playlistId, format = "json") {
    const playlist = await Playlist.findById(playlistId)
      .populate("owner_id", "name email")
      .lean()

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
        return this._generateCSVExport(exportData)
      case "txt":
        return this._generateTextExport(exportData)
      default:
        return JSON.stringify(exportData, null, 2)
    }
  }

  /**
   * Generate CSV export
   */
  _generateCSVExport(data) {
    const headers = ["Position", "Title", "Channel", "Duration", "YouTube URL", "Added By", "Added At"]
    const rows = data.videos.map((video) => [
      video.position + 1,
      `"${video.title.replace(/"/g, '""')}"`,
      `"${video.channel.replace(/"/g, '""')}"`,
      this._formatDuration(video.duration),
      video.youtube_url,
      video.added_by,
      new Date(video.added_at).toLocaleDateString(),
    ])

    return [headers.join(","), ...rows.map((row) => row.join(","))].join("\n")
  }

  /**
   * Generate text export
   */
  _generateTextExport(data) {
    let text = `Playlist: ${data.playlist.name}\n`
    text += `Description: ${data.playlist.description}\n`
    text += `Owner: ${data.playlist.owner}\n`
    text += `Created: ${new Date(data.playlist.created_at).toLocaleDateString()}\n`
    text += `Videos: ${data.playlist.stats.video_count}\n\n`

    data.videos.forEach((video, index) => {
      text += `${index + 1}. ${video.title}\n`
      text += `   Channel: ${video.channel}\n`
      text += `   Duration: ${this._formatDuration(video.duration)}\n`
      text += `   URL: ${video.youtube_url}\n`
      text += `   Added by: ${video.added_by} on ${new Date(video.added_at).toLocaleDateString()}\n\n`
    })

    return text
  }

  /**
   * Format duration in seconds to readable format
   */
  _formatDuration(seconds) {
    if (!seconds) return "0:00"
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
    }
    return `${minutes}:${secs.toString().padStart(2, "0")}`
  }

  // ============================================
  // Owned / shared / favorites
  // ============================================

  /**
   * Get the user's own playlists with search, status filter, and sorting
   */
  async getMyPlaylists(userId, options = {}) {
    const { page = 1, limit = 12, search = "", status = "all", sort = "recent" } = options

    const pageNum = Number.parseInt(page)
    const limitNum = Number.parseInt(limit)
    const skip = (pageNum - 1) * limitNum

    // Build query
    const query = { owner_id: userId }

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
      { $match: { owner_id: userId } },
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

    return {
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
    }
  }

  /**
   * Get playlists shared with the user (accepted collaborations)
   */
  async getSharedPlaylists(userId, options = {}) {
    const { page = 1, limit = 12, search = "", role = "all", sort = "recent" } = options

    const pageNum = Number.parseInt(page)
    const limitNum = Number.parseInt(limit)
    const skip = (pageNum - 1) * limitNum

    // Build collaborator query
    const collaboratorQuery = {
      user_id: userId,
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
          user_id: { $ne: userId },
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
      { $match: { user_id: userId, status: "accepted" } },
      { $group: { _id: "$permission_level", count: { $sum: 1 } } },
    ])

    const stats = {
      total: total,
      admin: roleStats.find((r) => r._id === "admin")?.count || 0,
      editor: roleStats.find((r) => r._id === "editor")?.count || 0,
      viewer: roleStats.find((r) => r._id === "viewer")?.count || 0,
      unreadComments: Object.values(unreadMap).reduce((sum, count) => sum + count, 0),
    }

    return {
      playlists: formattedPlaylists,
      stats,
      pagination: {
        current: pageNum,
        total: Math.ceil(total / limitNum),
        count: total,
        limit: limitNum,
      },
    }
  }

  /**
   * Get the user's favorite playlists
   */
  async getFavoritePlaylists(userId, options = {}) {
    const { page = 1, limit = 12 } = options

    const pageNum = Number.parseInt(page)
    const limitNum = Number.parseInt(limit)
    const skip = (pageNum - 1) * limitNum

    // Get user with populated favorites
    const user = await User.findById(userId).populate({
      path: "favorites.playlists",
      populate: {
        path: "owner_id",
        select: "name email avatar",
      },
    })

    if (!user) {
      throw new Error("User not found")
    }

    const favoritePlaylists = user.favorites?.playlists || []

    const total = favoritePlaylists.length
    const paginatedFavorites = favoritePlaylists.slice(skip, skip + limitNum)

    // Format the playlists to match the expected structure
    const formattedPlaylists = paginatedFavorites.map((playlist) => ({
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

    return {
      playlists: formattedPlaylists,
      pagination: {
        current: pageNum,
        total: Math.ceil(total / limitNum),
        count: total,
        limit: limitNum,
      },
    }
  }

  /**
   * Add a playlist to the user's favorites
   */
  async addToFavorites(userId, playlistId) {
    // Check if playlist exists
    const playlist = await Playlist.findById(playlistId)
    if (!playlist) {
      throw new Error("Playlist not found")
    }

    // Add to favorites if not already there
    const user = await User.findById(userId)
    if (!user.favorites) {
      user.favorites = { playlists: [] }
    }
    if (!user.favorites.playlists) {
      user.favorites.playlists = []
    }
    const alreadyFavorite = user.favorites.playlists.some(
      (id) => id.toString() === playlistId.toString()
    )
    if (!alreadyFavorite) {
      user.favorites.playlists.push(playlistId)
      await user.save()
    }

    return { message: "Playlist added to favorites", isFavorite: true }
  }

  /**
   * Remove a playlist from the user's favorites
   */
  async removeFromFavorites(userId, playlistId) {
    const user = await User.findById(userId)
    if (!user.favorites) {
      user.favorites = { playlists: [] }
    }
    if (!user.favorites.playlists) {
      user.favorites.playlists = []
    }
    user.favorites.playlists = user.favorites.playlists.filter(
      (id) => id.toString() !== playlistId.toString()
    )
    await user.save()

    return { message: "Playlist removed from favorites", isFavorite: false }
  }

  // ============================================
  // Collaborators
  // ============================================

  /**
   * Invite a collaborator to a playlist by email (owner only)
   * @param {String} playlistId
   * @param {Object} user - Authenticated user (needs _id and name)
   * @param {Object} options - { email, permission_level }
   */
  async inviteCollaborator(playlistId, user, { email, permission_level = "viewer" }) {
    const playlist = await Playlist.findById(playlistId)

    if (!playlist) {
      throw new Error("Playlist not found")
    }

    // Only owner can add collaborators
    if (playlist.owner_id.toString() !== user._id.toString()) {
      throw new Error("Only the owner can add collaborators")
    }

    // Check if already a collaborator (by email since user might not exist yet)
    const existingCollaborator = await PlaylistCollaborator.findOne({
      playlist_id: playlist._id,
      invited_email: email.toLowerCase(),
    })

    if (existingCollaborator) {
      throw new Error("User is already invited as a collaborator on this playlist")
    }

    // Create collaborator invite (email-based, user_id will be set when they accept)
    const inviteToken = generateToken()

    const collaborator = new PlaylistCollaborator({
      playlist_id: playlist._id,
      invited_email: email.toLowerCase(), // Store email instead of user_id initially
      token: inviteToken,
      permission_level,
      invited_by: user._id,
      status: "pending", // Will be changed to "accepted" when user accepts
    })

    await collaborator.save()

    // Log activity
    await this.logActivity(playlist._id, user._id, "invited_collaborator", {
      invited_email: email.toLowerCase(),
      permission_level,
    })

    // Send email invite
    await sendCollaborationInvite(email.toLowerCase(), {
      playlistName: playlist.name,
      inviterName: user.name,
      role: permission_level,
      acceptUrl: `${process.env.FRONTEND_URL || "http://localhost:3000"}/playlists/${playlist._id}/accept-invite?token=${collaborator.token}`,
    })

    return {
      message: "Collaboration invite sent successfully",
      collaborator: {
        id: collaborator._id,
        email: email.toLowerCase(),
        role: permission_level,
        status: "pending",
      },
    }
  }

  /**
   * Accept a collaboration invite by token (links email-based invites to the user)
   * @param {Object} user - Authenticated user (needs _id and email)
   * @param {String} token
   */
  async acceptInvite(user, token) {
    const collaborator = await PlaylistCollaborator.findOne({ token: token })
      .populate("playlist_id")
      .populate("user_id")

    if (!collaborator) {
      throw new Error("Invalid invite token")
    }

    // Check if this invite is for the authenticated user
    let isCorrectUser = false

    if (collaborator.user_id) {
      // User-ID based invite
      isCorrectUser = collaborator.user_id._id.toString() === user._id.toString()
    } else if (collaborator.invited_email) {
      // Email-based invite - link it to the authenticated user
      const invitedEmail = collaborator.invited_email.toLowerCase().trim()
      const userEmail = user.email.toLowerCase().trim()
      isCorrectUser = invitedEmail === userEmail

      if (isCorrectUser) {
        collaborator.user_id = user._id
        // Keep the invited_email for record-keeping, don't clear it
      }
    }

    if (!isCorrectUser) {
      throw new Error("This invite is not for you")
    }

    if (collaborator.status === "accepted") {
      throw new Error("Invite already accepted")
    }

    // Update collaborator status
    collaborator.status = "accepted"
    collaborator.last_active = new Date()
    await collaborator.save()

    // Log activity
    await this.logActivity(collaborator.playlist_id._id, user._id, "accepted_collaboration", {
      playlist_name: collaborator.playlist_id.name,
      permission_level: collaborator.permission_level,
    })

    return {
      message: "Collaboration invite accepted successfully",
      playlist: {
        id: collaborator.playlist_id._id,
        name: collaborator.playlist_id.name,
        role: collaborator.permission_level,
      },
    }
  }

  /**
   * Reject (decline) a collaboration invite by token
   * @param {Object} user - Authenticated user (needs _id and email)
   * @param {String} token
   */
  async rejectInvite(user, token) {
    const collaborator = await PlaylistCollaborator.findOne({ token: token })
      .populate("playlist_id")
      .populate("user_id")

    if (!collaborator) {
      throw new Error("Invalid invite token")
    }

    // Check if this invite is for the authenticated user
    let isCorrectUser = false

    if (collaborator.user_id) {
      // User-ID based invite
      isCorrectUser = collaborator.user_id._id.toString() === user._id.toString()
    } else if (collaborator.invited_email) {
      // Email-based invite
      isCorrectUser = collaborator.invited_email.toLowerCase() === user.email.toLowerCase()
    }

    if (!isCorrectUser) {
      throw new Error("This invite is not for you")
    }

    if (collaborator.status === "accepted") {
      throw new Error("Invite already accepted")
    }

    collaborator.status = "declined"
    await collaborator.save()

    // Log activity
    await this.logActivity(collaborator.playlist_id._id, user._id, "declined_collaboration", {
      playlist_name: collaborator.playlist_id.name,
    })

    return { message: "Collaboration invite rejected successfully" }
  }

  /**
   * Get public details of a collaboration invite by token
   * @param {String} token
   * @param {Object|null} user - Authenticated user (or null for anonymous)
   */
  async getInviteDetails(token, user) {
    const collaborator = await PlaylistCollaborator.findOne({ token: token })
      .populate("playlist_id", "name description")
      .populate("user_id", "name email")
      .populate("invited_by", "name email")

    if (!collaborator) {
      throw new Error("Invalid invite token")
    }

    if (!collaborator.playlist_id) {
      throw new Error("Playlist not found or deleted")
    }

    if (!collaborator.invited_by) {
      throw new Error("Inviter not found")
    }

    // If user is authenticated, check if this invite is for them
    if (user) {
      let isCorrectUser = false

      if (collaborator.user_id) {
        // User-ID based invite
        isCorrectUser = collaborator.user_id._id.toString() === user._id.toString()
      } else if (collaborator.invited_email) {
        // Email-based invite
        isCorrectUser = collaborator.invited_email.toLowerCase() === user.email.toLowerCase()
      }

      if (!isCorrectUser) {
        throw new Error("This invite is not for you")
      }
    }

    return {
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
  }

  /**
   * Remove a collaborator from a playlist (owner or admin only)
   */
  async removeCollaborator(playlistId, collaboratorId, requesterId) {
    const playlist = await Playlist.findById(playlistId)

    if (!playlist) {
      throw new Error("Playlist not found")
    }

    const isOwner = playlist.owner_id.toString() === requesterId.toString()

    // Check if user is admin collaborator
    const isAdmin = await PlaylistCollaborator.findOne({
      playlist_id: playlist._id,
      user_id: requesterId,
      permission_level: "admin",
      status: "accepted",
    })

    // Only owner or admin can remove collaborators
    if (!isOwner && !isAdmin) {
      throw new Error("Only the owner or admin can remove collaborators")
    }

    // First try to find by direct ID (backward compatibility)
    let collaborator = await PlaylistCollaborator.findById(collaboratorId)

    // If not found, try to find by user_id (which is what the frontend is likely sending)
    if (!collaborator) {
      collaborator = await PlaylistCollaborator.findOne({
        playlist_id: playlistId,
        user_id: collaboratorId,
      })
    }

    if (!collaborator) {
      throw new Error("Collaborator not found")
    }

    // Prevent non-owners from removing other admins or the owner
    if (!isOwner) {
      if (collaborator.permission_level === "admin") {
        throw new Error("Only the owner can remove admin collaborators")
      }
    }

    // Cannot remove the owner (even though owner won't be in collaborators table)
    if (collaborator.user_id && collaborator.user_id.toString() === playlist.owner_id.toString()) {
      throw new Error("Cannot remove the playlist owner")
    }

    await PlaylistCollaborator.findByIdAndDelete(collaborator._id)

    // Log activity
    await this.logActivity(playlist._id, requesterId, "removed_collaborator", {
      removed_user_id: collaborator.user_id,
      removed_email: collaborator.invited_email,
      permission_level: collaborator.permission_level,
    })

    return { message: "Collaborator removed successfully" }
  }

  // ============================================
  // Comments
  // ============================================

  /**
   * Add a comment to a playlist (owner, accepted collaborators, or public viewers)
   */
  async addComment(playlistId, userId, content, parentCommentId = null) {
    const playlist = await Playlist.findById(playlistId)
    if (!playlist) {
      throw new Error("Playlist not found")
    }

    // Check if user has access to the playlist
    const isOwner = playlist.owner_id.toString() === userId.toString()
    const isCollaborator = await PlaylistCollaborator.findOne({
      playlist_id: playlist._id,
      user_id: userId,
      status: "accepted",
    })

    // Only owner, collaborators, or public playlist viewers can comment
    if (!isOwner && !isCollaborator && !playlist.is_public) {
      throw new Error("You don't have permission to comment on this playlist")
    }

    const comment = new PlaylistComment({
      playlist_id: playlist._id,
      user_id: userId,
      content: content.trim().substring(0, 1000), // Limit comment length
      parent_comment_id: parentCommentId,
    })

    await comment.save()

    // Log activity
    await this.logActivity(playlist._id, userId, "comment_added", {
      comment_id: comment._id,
    })

    // Return the comment with user info
    await comment.populate("user_id", "name email avatar")

    return {
      id: comment._id,
      user: {
        id: comment.user_id._id.toString(),
        name: comment.user_id.name,
        avatar: comment.user_id.avatar,
      },
      content: comment.content,
      timestamp: comment.created_at,
      replies: [],
    }
  }

  /**
   * Delete a comment (comment author or playlist owner only)
   */
  async deleteComment(commentId, userId) {
    const comment = await PlaylistComment.findById(commentId)

    if (!comment) {
      throw new Error("Comment not found")
    }

    // Find the playlist separately
    const playlist = await Playlist.findById(comment.playlist_id)
    if (!playlist) {
      throw new Error("Playlist not found")
    }

    // Check if user has permission to delete the comment
    const isCommentOwner = comment.user_id.toString() === userId.toString()
    const isPlaylistOwner = playlist.owner_id.toString() === userId.toString()

    // Only comment author and playlist owner can delete comments (not admins)
    if (!isCommentOwner && !isPlaylistOwner) {
      throw new Error("You don't have permission to delete this comment")
    }

    await PlaylistComment.findByIdAndDelete(commentId)

    // Log activity
    await this.logActivity(comment.playlist_id, userId, "comment_deleted", {})

    return { message: "Comment deleted successfully" }
  }
}

module.exports = new PlaylistService()
