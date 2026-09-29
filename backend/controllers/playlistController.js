const playlistService = require("../services/playlistService")

/**
 * Playlist Controller
 * Handles HTTP requests/responses for playlist-related endpoints
 */
class PlaylistController {
  /**
   * Get all playlists with filtering and pagination
   * GET /api/playlists
   */
  async getAllPlaylists(req, res) {
    try {
      const filters = {
        page: req.query.page,
        limit: req.query.limit,
        search: req.query.search,
        filter: req.query.filter,
        sort: req.query.sort,
        category: req.query.category,
        tags: req.query.tags,
      }

      const userId = req.user ? req.user._id : null
      const result = await playlistService.getAllPlaylists(filters, userId)
      
      res.json(result)
    } catch (error) {
      console.error("Error fetching playlists:", error)
      
      if (error.message === "Authentication required for private playlists") {
        return res.status(401).json({ error: error.message })
      }
      
      res.status(500).json({ error: "Failed to fetch playlists" })
    }
  }

  /**
   * Get playlist by ID
   * GET /api/playlists/:id
   */
  async getPlaylistById(req, res) {
    try {
      const userId = req.user ? req.user._id : null
      const playlist = await playlistService.getPlaylistById(req.params.id, userId)
      
      res.json(playlist)
    } catch (error) {
      console.error("Error fetching playlist:", error)
      
      if (error.message === "Playlist not found") {
        return res.status(404).json({ error: error.message })
      }
      if (error.message === "Access denied") {
        return res.status(403).json({ error: error.message })
      }
      
      res.status(500).json({ error: "Failed to fetch playlist" })
    }
  }

  /**
   * Create new playlist
   * POST /api/playlists
   */
  async createPlaylist(req, res) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Authentication required" })
      }

      const playlist = await playlistService.createPlaylist(req.body, req.user._id)
      res.status(201).json(playlist)
    } catch (error) {
      console.error("Error creating playlist:", error)
      res.status(500).json({ error: "Failed to create playlist" })
    }
  }

  /**
   * Update playlist
   * PUT /api/playlists/:id
   */
  async updatePlaylist(req, res) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Authentication required" })
      }

      const playlist = await playlistService.updatePlaylist(
        req.params.id,
        req.body,
        req.user._id
      )
      
      res.json(playlist)
    } catch (error) {
      console.error("Error updating playlist:", error)
      
      if (error.message === "Playlist not found") {
        return res.status(404).json({ error: error.message })
      }
      if (error.message === "Permission denied") {
        return res.status(403).json({ error: error.message })
      }
      
      res.status(500).json({ error: "Failed to update playlist" })
    }
  }

  /**
   * Delete playlist
   * DELETE /api/playlists/:id
   */
  async deletePlaylist(req, res) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Authentication required" })
      }

      const result = await playlistService.deletePlaylist(req.params.id, req.user._id)
      res.json(result)
    } catch (error) {
      console.error("Error deleting playlist:", error)
      
      if (error.message === "Playlist not found") {
        return res.status(404).json({ error: error.message })
      }
      if (error.message.includes("Only the owner")) {
        return res.status(403).json({ error: error.message })
      }
      
      res.status(500).json({ error: "Failed to delete playlist" })
    }
  }

  /**
   * Add video to playlist
   * POST /api/playlists/:id/videos
   */
  async addVideo(req, res) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Authentication required" })
      }

      const item = await playlistService.addVideoToPlaylist(
        req.params.id,
        req.body,
        req.user._id
      )
      
      res.status(201).json(item)
    } catch (error) {
      console.error("Error adding video to playlist:", error)
      
      if (error.message === "Playlist not found" || error.message === "Permission denied") {
        return res.status(error.message === "Playlist not found" ? 404 : 403).json({ 
          error: error.message 
        })
      }
      if (error.message === "Video already exists in playlist") {
        return res.status(409).json({ error: error.message })
      }
      
      res.status(500).json({ error: "Failed to add video to playlist" })
    }
  }

  /**
   * Remove video from playlist
   * DELETE /api/playlists/:id/videos/:itemId
   */
  async removeVideo(req, res) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Authentication required" })
      }

      const result = await playlistService.removeVideoFromPlaylist(
        req.params.id,
        req.params.itemId,
        req.user._id
      )
      
      res.json(result)
    } catch (error) {
      console.error("Error removing video from playlist:", error)
      
      if (error.message === "Video not found in playlist") {
        return res.status(404).json({ error: error.message })
      }
      if (error.message === "Permission denied") {
        return res.status(403).json({ error: error.message })
      }
      
      res.status(500).json({ error: "Failed to remove video from playlist" })
    }
  }

  /**
   * Update playlist stats
   * POST /api/playlists/:id/stats
   */
  async updateStats(req, res) {
    try {
      const stats = await playlistService.updatePlaylistStats(req.params.id)
      res.json(stats)
    } catch (error) {
      console.error("Error updating playlist stats:", error)
      res.status(500).json({ error: "Failed to update playlist stats" })
    }
  }

  /**
   * Reorder playlist items (bulk update)
   * PUT /api/playlists/:id/items/reorder
   */
  async reorderItems(req, res) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Authentication required" })
      }

      const { items } = req.body // Array of { id, position }

      if (!items || !Array.isArray(items)) {
        return res.status(400).json({ error: "Items array is required" })
      }

      const result = await playlistService.reorderPlaylistItems(
        req.params.id,
        items,
        req.user._id
      )
      
      res.json(result)
    } catch (error) {
      console.error("Error reordering playlist items:", error)
      
      if (error.message === "Permission denied") {
        return res.status(403).json({ error: error.message })
      }
      
      res.status(500).json({ error: "Failed to reorder playlist items" })
    }
  }

  /**
   * Move a single playlist item to a new position
   * PUT /api/playlists/:id/items/:itemId/move
   */
  async moveItem(req, res) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Authentication required" })
      }

      const { new_position } = req.body

      if (new_position === undefined) {
        return res.status(400).json({ error: "new_position is required" })
      }

      const result = await playlistService.movePlaylistItem(
        req.params.id,
        req.params.itemId,
        new_position,
        req.user._id
      )
      
      res.json(result)
    } catch (error) {
      console.error("Error moving playlist item:", error)
      
      if (error.message === "Permission denied") {
        return res.status(403).json({ error: error.message })
      }
      if (error.message === "Video not found in playlist") {
        return res.status(404).json({ error: error.message })
      }
      if (error.message === "Invalid position" || error.message === "Position out of range") {
        return res.status(400).json({ error: error.message })
      }
      
      res.status(500).json({ error: "Failed to move video" })
    }
  }

  /**
   * Export playlist
   * GET /api/playlists/:id/export
   */
  async exportPlaylist(req, res) {
    try {
      const format = req.query.format || "json"
      const exportData = await playlistService.generatePlaylistExport(req.params.id, format)
      
      const contentTypes = {
        json: "application/json",
        csv: "text/csv",
        txt: "text/plain",
      }

      const extensions = {
        json: "json",
        csv: "csv",
        txt: "txt",
      }

      res.setHeader("Content-Type", contentTypes[format] || "application/json")
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="playlist.${extensions[format] || "json"}"`
      )
      res.send(exportData)
    } catch (error) {
      console.error("Error exporting playlist:", error)
      
      if (error.message === "Playlist not found") {
        return res.status(404).json({ error: error.message })
      }
      
      res.status(500).json({ error: "Failed to export playlist" })
    }
  }

  /**
   * Check user's permission level
   * GET /api/playlists/:id/permission
   */
  async checkPermission(req, res) {
    try {
      if (!req.user) {
        return res.json({ hasPermission: false, role: null })
      }

      const requiredLevel = req.query.level || "viewer"
      const hasPermission = await playlistService.checkPermission(
        req.params.id,
        req.user._id,
        requiredLevel
      )
      
      const role = await playlistService.getUserRole(req.params.id, req.user._id)
      
      res.json({ hasPermission, role })
    } catch (error) {
      console.error("Error checking permission:", error)
      res.status(500).json({ error: "Failed to check permission" })
    }
  }

  /**
   * Test endpoint to verify authentication
   * GET /api/playlists/test-auth
   */
  async testAuth(req, res) {
    res.json({
      message: "Authentication working",
      user: {
        id: req.user._id.toString(),
        email: req.user.email,
        name: req.user.name,
      },
    })
  }

  // ============================================
  // Owned / shared / favorites
  // ============================================

  /**
   * Get the authenticated user's own playlists
   * GET /api/playlists/mine
   */
  async getMyPlaylists(req, res) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Authentication required" })
      }

      const result = await playlistService.getMyPlaylists(req.user._id, {
        page: req.query.page,
        limit: req.query.limit,
        search: req.query.search,
        status: req.query.status,
        sort: req.query.sort,
      })

      res.json(result)
    } catch (error) {
      console.error("Error fetching user playlists:", error)
      res.status(500).json({ error: "Failed to fetch user playlists" })
    }
  }

  /**
   * Get playlists shared with the authenticated user
   * GET /api/playlists/shared
   */
  async getSharedPlaylists(req, res) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Authentication required" })
      }

      const result = await playlistService.getSharedPlaylists(req.user._id, {
        page: req.query.page,
        limit: req.query.limit,
        search: req.query.search,
        role: req.query.role,
        sort: req.query.sort,
      })

      res.json(result)
    } catch (error) {
      console.error("Error fetching shared playlists:", error)
      res.status(500).json({ error: "Failed to fetch shared playlists" })
    }
  }

  /**
   * Get the authenticated user's favorite playlists
   * GET /api/playlists/favorites
   */
  async getFavoritePlaylists(req, res) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Authentication required" })
      }

      const result = await playlistService.getFavoritePlaylists(req.user._id, {
        page: req.query.page,
        limit: req.query.limit,
      })

      res.json(result)
    } catch (error) {
      console.error("Error fetching favorites:", error)

      if (error.message === "User not found") {
        return res.status(404).json({ error: error.message })
      }

      res.status(500).json({ error: "Failed to fetch favorites" })
    }
  }

  /**
   * Add a playlist to the authenticated user's favorites
   * POST /api/playlists/:id/favorite
   */
  async addFavorite(req, res) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Authentication required" })
      }

      const result = await playlistService.addToFavorites(req.user._id, req.params.id)

      res.json(result)
    } catch (error) {
      console.error("Error adding to favorites:", error)

      if (error.message === "Playlist not found") {
        return res.status(404).json({ error: error.message })
      }

      res.status(500).json({ error: "Failed to add to favorites" })
    }
  }

  /**
   * Remove a playlist from the authenticated user's favorites
   * DELETE /api/playlists/:id/favorite
   */
  async removeFavorite(req, res) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Authentication required" })
      }

      const result = await playlistService.removeFromFavorites(req.user._id, req.params.id)

      res.json(result)
    } catch (error) {
      console.error("Error removing from favorites:", error)
      res.status(500).json({ error: "Failed to remove from favorites" })
    }
  }

  // ============================================
  // Collaborators
  // ============================================

  /**
   * Invite a collaborator to a playlist
   * POST /api/playlists/:id/collaborators
   */
  async inviteCollaborator(req, res) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Authentication required" })
      }

      const { email, permission_level = "viewer" } = req.body

      if (!email) {
        return res.status(400).json({ error: "Email is required" })
      }

      if (!["viewer", "editor", "admin"].includes(permission_level)) {
        return res.status(400).json({ error: "Invalid permission level" })
      }

      const result = await playlistService.inviteCollaborator(req.params.id, req.user, {
        email,
        permission_level,
      })

      res.json(result)
    } catch (error) {
      console.error("Error adding collaborator:", error)

      if (error.message === "Playlist not found") {
        return res.status(404).json({ error: error.message })
      }
      if (error.message === "Only the owner can add collaborators") {
        return res.status(403).json({ error: error.message })
      }
      if (error.message === "User is already invited as a collaborator on this playlist") {
        return res.status(400).json({ error: error.message })
      }

      res.status(500).json({ error: "Failed to add collaborator" })
    }
  }

  /**
   * Accept a collaboration invite
   * POST /api/playlists/:id/collaborators/accept
   */
  async acceptInvite(req, res) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Authentication required" })
      }

      const { token } = req.body
      const result = await playlistService.acceptInvite(req.user, token)

      res.json(result)
    } catch (error) {
      console.error("Error accepting collaboration invite:", error)

      if (error.message === "Invalid invite token") {
        return res.status(404).json({ error: error.message })
      }
      if (error.message === "This invite is not for you") {
        return res.status(403).json({ error: error.message })
      }
      if (error.message === "Invite already accepted") {
        return res.status(400).json({ error: error.message })
      }

      res.status(500).json({ error: "Failed to accept invite" })
    }
  }

  /**
   * Reject a collaboration invite
   * POST /api/playlists/:id/collaborators/reject
   */
  async rejectInvite(req, res) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Authentication required" })
      }

      const { token } = req.body
      const result = await playlistService.rejectInvite(req.user, token)

      res.json(result)
    } catch (error) {
      console.error("Error rejecting collaboration invite:", error)

      if (error.message === "Invalid invite token") {
        return res.status(404).json({ error: error.message })
      }
      if (error.message === "This invite is not for you") {
        return res.status(403).json({ error: error.message })
      }
      if (error.message === "Invite already accepted") {
        return res.status(400).json({ error: error.message })
      }

      res.status(500).json({ error: "Failed to reject invite" })
    }
  }

  /**
   * Get collaboration invite details by token
   * GET /api/playlists/:id/collaborators/invite/:token
   */
  async getInviteDetails(req, res) {
    try {
      const result = await playlistService.getInviteDetails(req.params.token, req.user || null)

      res.json(result)
    } catch (error) {
      console.error("Error fetching invite details:", error)

      if (error.message === "Invalid invite token") {
        return res.status(404).json({ error: error.message })
      }
      if (error.message === "Playlist not found or deleted") {
        return res.status(404).json({ error: error.message })
      }
      if (error.message === "Inviter not found") {
        return res.status(404).json({ error: error.message })
      }
      if (error.message === "This invite is not for you") {
        return res.status(403).json({ error: error.message })
      }

      res.status(500).json({ error: "Failed to fetch invite details", details: error.message })
    }
  }

  /**
   * Remove a collaborator from a playlist
   * DELETE /api/playlists/:id/collaborators/:collaboratorId
   */
  async removeCollaborator(req, res) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Authentication required" })
      }

      const result = await playlistService.removeCollaborator(
        req.params.id,
        req.params.collaboratorId,
        req.user._id
      )

      res.json(result)
    } catch (error) {
      console.error("Error removing collaborator:", error)

      if (error.message === "Playlist not found") {
        return res.status(404).json({ error: error.message })
      }
      if (error.message === "Collaborator not found") {
        return res.status(404).json({ error: error.message })
      }
      if (
        error.message === "Only the owner or admin can remove collaborators" ||
        error.message === "Only the owner can remove admin collaborators" ||
        error.message === "Cannot remove the playlist owner"
      ) {
        return res.status(403).json({ error: error.message })
      }

      res.status(500).json({ error: "Failed to remove collaborator" })
    }
  }

  // ============================================
  // Comments
  // ============================================

  /**
   * Add a comment to a playlist
   * POST /api/playlists/:id/comments
   */
  async addComment(req, res) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Authentication required" })
      }

      const { content } = req.body

      if (!content || content.trim() === "") {
        return res.status(400).json({ error: "Comment cannot be empty" })
      }

      const comment = await playlistService.addComment(
        req.params.id,
        req.user._id,
        content,
        req.body.parent_comment_id || null
      )

      res.status(201).json(comment)
    } catch (error) {
      console.error("Error adding comment:", error)

      if (error.message === "Playlist not found") {
        return res.status(404).json({ error: error.message })
      }
      if (error.message === "You don't have permission to comment on this playlist") {
        return res.status(403).json({ error: error.message })
      }

      res.status(500).json({ error: "Failed to add comment" })
    }
  }

  /**
   * Delete a comment
   * DELETE /api/playlists/:id/comments/:commentId
   */
  async deleteComment(req, res) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Authentication required" })
      }

      const result = await playlistService.deleteComment(req.params.commentId, req.user._id)

      res.json(result)
    } catch (error) {
      console.error("Error deleting comment:", error)

      if (error.message === "Comment not found") {
        return res.status(404).json({ error: error.message })
      }
      if (error.message === "Playlist not found") {
        return res.status(404).json({ error: error.message })
      }
      if (error.message === "You don't have permission to delete this comment") {
        return res.status(403).json({ error: error.message })
      }

      res.status(500).json({ error: "Failed to delete comment", message: error.message })
    }
  }
}

module.exports = new PlaylistController()
