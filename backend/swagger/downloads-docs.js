/**
 * @swagger
 * /api/downloads/history:
 *   get:
 *     summary: Get download history
 *     tags: [Downloads]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: page
 *         in: query
 *         schema:
 *           type: integer
 *       - name: limit
 *         in: query
 *         schema:
 *           type: integer
 *       - name: format
 *         in: query
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: History retrieved
 * 
 * /api/downloads/{id}:
 *   get:
 *     summary: Get download by ID
 *     tags: [Downloads]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Download details
 *   delete:
 *     summary: Cancel download
 *     tags: [Downloads]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Download cancelled
 * 
 * /api/downloads/formats:
 *   post:
 *     summary: Get available formats
 *     tags: [Downloads]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               youtube_url:
 *                 type: string
 *     responses:
 *       200:
 *         description: Formats retrieved
 * 
 * /api/downloads/preview/{videoId}:
 *   get:
 *     summary: Get audio preview
 *     tags: [Downloads]
 *     parameters:
 *       - name: videoId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Audio stream
 * 
 * /api/downloads/file/{id}:
 *   get:
 *     summary: Serve downloaded file
 *     tags: [Downloads]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: File stream
 * 
 * /api/downloads:
 *   post:
 *     summary: Create download
 *     tags: [Downloads]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [youtube_url, format, quality]
 *             properties:
 *               youtube_url:
 *                 type: string
 *               format:
 *                 type: string
 *               quality:
 *                 type: string
 *     responses:
 *       201:
 *         description: Download started
 * 
 * /api/downloads/{id}/pause:
 *   post:
 *     summary: Pause download
 *     tags: [Downloads]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Download paused
 * 
 * /api/downloads/{id}/resume:
 *   post:
 *     summary: Resume download
 *     tags: [Downloads]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Download resumed
 * 
 * /api/downloads/queue/status:
 *   get:
 *     summary: Get queue status
 *     tags: [Downloads]
 *     responses:
 *       200:
 *         description: Queue status
 * 
 * /api/downloads/playlist/info:
 *   get:
 *     summary: Get playlist info
 *     tags: [Downloads]
 *     parameters:
 *       - name: url
 *         in: query
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Playlist info
 * 
 * /api/downloads/playlist:
 *   post:
 *     summary: Download playlist
 *     tags: [Downloads]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               playlist_url:
 *                 type: string
 *               download_options:
 *                 type: object
 *     responses:
 *       201:
 *         description: Playlist download started
 * 
 * /api/downloads/playlist/{id}:
 *   get:
 *     summary: Get playlist download status
 *     tags: [Downloads]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Playlist status
 * 
 * /api/downloads/stream:
 *   post:
 *     summary: Stream download
 *     tags: [Downloads]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [youtube_url, format, quality]
 *             properties:
 *               youtube_url:
 *                 type: string
 *               format:
 *                 type: string
 *               quality:
 *                 type: string
 *     responses:
 *       200:
 *         description: File stream
 */

module.exports = {};
