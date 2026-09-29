const express = require("express")
const router = express.Router()
const { authenticateToken, optionalAuth } = require("../middleware/auth")
const { validatePlaylistCreate, validatePlaylistUpdate } = require("../middleware/validation")
const { uploadThumbnail } = require("../config/cloudinary")
const playlistController = require("../controllers/playlistController")

/**
 * Playlist Routes
 * All handlers live in controllers/playlistController.js (HTTP) and
 * services/playlistService.js (business logic).
 *
 * NOTE: specific single-segment GET paths (/test-auth, /mine, /shared,
 * /favorites) MUST be registered before GET /:id, otherwise Express
 * captures them as :id.
 */

// ============================================
// Specific GET routes (must precede /:id)
// ============================================

// Test auth endpoint
router.get("/test-auth", authenticateToken, playlistController.testAuth.bind(playlistController))

// Get user's own playlists
router.get("/mine", authenticateToken, playlistController.getMyPlaylists.bind(playlistController))

// Get shared playlists (playlists where user is a collaborator)
router.get("/shared", authenticateToken, playlistController.getSharedPlaylists.bind(playlistController))

// Get user's favorite playlists
router.get("/favorites", authenticateToken, playlistController.getFavoritePlaylists.bind(playlistController))

// ============================================
// Basic CRUD
// ============================================

// Get all playlists with filtering (public + user's own + shared)
router.get("/", optionalAuth, playlistController.getAllPlaylists.bind(playlistController))

// Get single playlist by ID
router.get("/:id", optionalAuth, playlistController.getPlaylistById.bind(playlistController))

// Create new playlist
router.post("/", authenticateToken, uploadThumbnail.single("thumbnail"), validatePlaylistCreate, playlistController.createPlaylist.bind(playlistController))

// Update playlist
router.put("/:id", authenticateToken, validatePlaylistUpdate, playlistController.updatePlaylist.bind(playlistController))

// Delete playlist
router.delete("/:id", authenticateToken, playlistController.deletePlaylist.bind(playlistController))

// Export playlist
router.get("/:id/export", playlistController.exportPlaylist.bind(playlistController))

// Check user permission on playlist
router.get("/:id/permission", playlistController.checkPermission.bind(playlistController))

// ============================================
// Favorites
// ============================================

// Add playlist to favorites
router.post("/:id/favorite", authenticateToken, playlistController.addFavorite.bind(playlistController))

// Remove playlist from favorites
router.delete("/:id/favorite", authenticateToken, playlistController.removeFavorite.bind(playlistController))

// ============================================
// Collaborators
// ============================================

// Add collaborator to playlist
router.post("/:id/collaborators", authenticateToken, playlistController.inviteCollaborator.bind(playlistController))

// Accept collaboration invite
router.post("/:id/collaborators/accept", authenticateToken, playlistController.acceptInvite.bind(playlistController))

// Reject collaboration invite
router.post("/:id/collaborators/reject", authenticateToken, playlistController.rejectInvite.bind(playlistController))

// Get invite details
router.get("/:id/collaborators/invite/:token", optionalAuth, playlistController.getInviteDetails.bind(playlistController))

// Remove collaborator
router.delete("/:id/collaborators/:collaboratorId", authenticateToken, playlistController.removeCollaborator.bind(playlistController))

// ============================================
// Comments
// ============================================

// Add a comment to a playlist
router.post("/:id/comments", authenticateToken, playlistController.addComment.bind(playlistController))

// Delete a comment
router.delete("/:id/comments/:commentId", authenticateToken, playlistController.deleteComment.bind(playlistController))

module.exports = router
