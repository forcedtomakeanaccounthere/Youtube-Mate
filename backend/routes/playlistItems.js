const express = require("express")
const router = express.Router()
const { authenticateToken } = require("../middleware/auth")
const { validatePlaylistItem } = require("../middleware/validation")
const playlistController = require("../controllers/playlistController")

/**
 * Playlist Items Routes
 * REFACTORED - All routes now use playlistController
 * 
 * These routes handle adding, removing, and reordering videos within playlists
 */

// Add video to playlist
// POST /api/playlists/:playlistId/items
router.post("/:playlistId/items", 
  authenticateToken, 
  validatePlaylistItem, 
  async (req, res) => {
    // Map playlistId to id for controller compatibility
    req.params.id = req.params.playlistId
    await playlistController.addVideo(req, res)
  }
)

// Remove video from playlist
// DELETE /api/playlists/:playlistId/items/:itemId
router.delete("/:playlistId/items/:itemId", 
  authenticateToken, 
  async (req, res) => {
    // Map playlistId to id for controller compatibility
    req.params.id = req.params.playlistId
    await playlistController.removeVideo(req, res)
  }
)

// Reorder playlist items (bulk update)
// PUT /api/playlists/:playlistId/items/reorder
router.put("/:playlistId/items/reorder", 
  authenticateToken, 
  async (req, res) => {
    // Map playlistId to id for controller compatibility
    req.params.id = req.params.playlistId
    await playlistController.reorderItems(req, res)
  }
)

// Move a playlist item to a new position
// PUT /api/playlists/:playlistId/items/:itemId/move
router.put("/:playlistId/items/:itemId/move", 
  authenticateToken, 
  async (req, res) => {
    // Map playlistId to id for controller compatibility
    req.params.id = req.params.playlistId
    await playlistController.moveItem(req, res)
  }
)

module.exports = router
