const express = require("express")
const router = express.Router()
const youtubeController = require("../controllers/youtubeController")

// Get playlist info (similar to download page)
router.get("/playlist/info", youtubeController.getPlaylistInfo.bind(youtubeController))

// Get video info
router.get("/video/info", youtubeController.getVideoInfo.bind(youtubeController))

// Get video chapters
router.get("/video/chapters", youtubeController.getVideoChapters.bind(youtubeController))

module.exports = router
