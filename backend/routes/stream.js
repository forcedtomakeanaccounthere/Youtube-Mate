const express = require("express")
const { authenticateToken } = require("../middleware/auth")
const streamController = require("../controllers/streamController")

const router = express.Router()

/**
 * Stream Routes
 * REFACTORED - All routes now use streamController
 * 
 * These routes handle watch party/streaming room functionality
 */

// Create streaming room
router.post("/rooms", streamController.createRoom.bind(streamController))

// Get room by ID
router.get("/rooms/:roomId", streamController.getRoom.bind(streamController))

// Update room settings
router.patch("/rooms/:roomId", streamController.updateRoom.bind(streamController))

// End streaming room
router.post("/rooms/:roomId/end", streamController.endRoom.bind(streamController))

// Create join request
router.post("/join-requests", streamController.createJoinRequest.bind(streamController))

// Get pending join requests for a room
router.get("/join-requests/:roomId", streamController.getJoinRequests.bind(streamController))

// Update join decision
router.post("/join-requests/:roomId/:requestId/decision", streamController.updateJoinDecision.bind(streamController))

// Get join decision status
router.get("/join-requests/:roomId/:requestId/decision", streamController.getJoinDecision.bind(streamController))

// Send invite email
router.post("/invite-email", authenticateToken, streamController.sendInviteEmail.bind(streamController))

module.exports = router
