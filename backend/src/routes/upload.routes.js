const express = require("express");
const { uploadController } = require("../controllers");
const { authenticateJWT } = require("../middlewares");
const multerProfileImage = require("../middlewares/multerProfileImage");

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Upload
 *   description: File upload management
 */

/**
 * @swagger
 * /upload/profile-image:
 *   post:
 *     summary: Upload profile image
 *     description: Upload a new profile image for the current user
 *     tags: [Upload]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - image
 *             properties:
 *               image:
 *                 type: string
 *                 description: Base64 encoded image data
 *               mimetype:
 *                 type: string
 *                 description: MIME type of the image
 *                 example: image/jpeg
 *               filename:
 *                 type: string
 *                 description: Original filename
 *                 example: profile.jpg
 *     responses:
 *       200:
 *         description: Profile image uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 imagePath:
 *                   type: string
 *                   description: Path to the uploaded image
 *       400:
 *         description: Invalid request
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Error message
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post("/profile-image", authenticateJWT, multerProfileImage.single("image"), uploadController.uploadProfileImage);

/**
 * @swagger
 * /upload/profile-image:
 *   delete:
 *     summary: Delete profile image
 *     description: Delete the current user's profile image
 *     tags: [Upload]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile image deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Success message
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: No profile image found
 *       500:
 *         description: Server error
 */
router.delete("/profile-image", authenticateJWT, uploadController.deleteProfileImage);

module.exports = router;
