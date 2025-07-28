const { uploadService } = require('../services');
const logger = require('../config/logger');

/**
 * Controller for handling file uploads
 */
class UploadController {
  /**
   * Upload profile image
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  async uploadProfileImage(req, res, next) {
    try {
      const userId = req.user.id;
      
      if (!req.body.image) {
        return res.status(400).json({ message: 'No image provided' });
      }
      
      const fileData = {
        data: req.body.image,
        mimetype: req.body.mimetype || 'image/jpeg',
        originalname: req.body.filename || 'profile.jpg'
      };
      
      // Log untuk debugging
      console.log('Received image data type:', typeof req.body.image);
      console.log('Image data starts with:', req.body.image.substring(0, 50) + '...');
      
      const imagePath = await uploadService.saveProfileImage(userId, fileData);
      
      res.status(200).json({ imagePath });
    } catch (error) {
      logger.error(`Upload profile image error: ${error.message}`);
      
      if (error.message.includes('Invalid file type')) {
        return res.status(400).json({ message: error.message });
      }
      
      next(error);
    }
  }
  
  /**
   * Delete profile image
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  async deleteProfileImage(req, res, next) {
    try {
      const userId = req.user.id;
      
      const deleted = await uploadService.deleteProfileImage(userId);
      
      if (deleted) {
        res.status(200).json({ message: 'Profile image deleted successfully' });
      } else {
        res.status(404).json({ message: 'No profile image found' });
      }
    } catch (error) {
      logger.error(`Delete profile image error: ${error.message}`);
      next(error);
    }
  }
}

module.exports = new UploadController();