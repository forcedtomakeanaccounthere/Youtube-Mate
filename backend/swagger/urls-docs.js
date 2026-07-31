/**
 * @swagger
 * /api/urls/shorten:
 *   post:
 *     summary: Create shortened URL
 *     tags: [URL Shortening]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [originalUrl]
 *             properties:
 *               originalUrl:
 *                 type: string
 *               customAlias:
 *                 type: string
 *               timestamp:
 *                 type: object
 *               analyticsEnabled:
 *                 type: boolean
 *               expiryDate:
 *                 type: string
 *               tags:
 *                 type: array
 *               notes:
 *                 type: string
 *     responses:
 *       201:
 *         description: URL shortened
 * 
 * /api/urls/bulk-shorten:
 *   post:
 *     summary: Bulk URL shortening
 *     tags: [URL Shortening]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               urls:
 *                 type: array
 *     responses:
 *       200:
 *         description: Bulk operation completed
 * 
 * /api/urls/my-urls:
 *   get:
 *     summary: Get user URLs
 *     tags: [URL Shortening]
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
 *       - name: search
 *         in: query
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: URLs retrieved
 * 
 * /api/urls/{id}:
 *   get:
 *     summary: Get URL details
 *     tags: [URL Shortening]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: URL details
 *   put:
 *     summary: Update URL
 *     tags: [URL Shortening]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: URL updated
 *   delete:
 *     summary: Delete URL
 *     tags: [URL Shortening]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: URL deleted
 */

module.exports = {};
