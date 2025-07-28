const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const logger = require('../config/logger');

/**
 * Service for handling file uploads
 */
class UploadService {
  constructor() {
    this.uploadsDir = path.join(__dirname, '../../public/uploads');
    this.profileImagesDir = path.join(this.uploadsDir, 'profile-images');
    this.writeFileAsync = promisify(fs.writeFile);
    this.mkdirAsync = promisify(fs.mkdir);
    this.statAsync = promisify(fs.stat);
    this.unlinkAsync = promisify(fs.unlink);
    
    // Ensure upload directories exist
    this.ensureUploadDirsExist();
  }
  
  /**
   * Ensure upload directories exist
   * @private
   */
  async ensureUploadDirsExist() {
    try {
      // Check and create main uploads directory
      try {
        await this.statAsync(this.uploadsDir);
      } catch (error) {
        if (error.code === 'ENOENT') {
          await this.mkdirAsync(this.uploadsDir, { recursive: true });
          logger.info(`Created uploads directory: ${this.uploadsDir}`);
        } else {
          throw error;
        }
      }
      
      // Check and create profile images directory
      try {
        await this.statAsync(this.profileImagesDir);
      } catch (error) {
        if (error.code === 'ENOENT') {
          await this.mkdirAsync(this.profileImagesDir, { recursive: true });
          logger.info(`Created profile images directory: ${this.profileImagesDir}`);
        } else {
          throw error;
        }
      }
    } catch (error) {
      logger.error(`Failed to create upload directories: ${error.message}`);
    }
  }
  
  /**
   * Save profile image
   * @param {number} userId - User ID
   * @param {Object} fileData - File data
   * @param {string} fileData.data - Base64 encoded file data
   * @param {string} fileData.mimetype - File MIME type
   * @param {string} fileData.originalname - Original file name
   * @returns {Promise<string>} Saved file path
   */
  async saveProfileImage(userId, fileData) {
    try {
      // Validate file data
      if (!fileData || !fileData.data) {
        throw new Error('Invalid file data');
      }
      
      // Validate file type
      const validMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      if (!validMimeTypes.includes(fileData.mimetype)) {
        throw new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed.');
      }
      
      // Get file extension from mimetype
      const extension = fileData.mimetype.split('/')[1];
      
      // Generate file name
      const fileName = `user-${userId}-profile.${extension}`;
      const filePath = path.join(this.profileImagesDir, fileName);
      
      // Remove existing profile image if exists
      try {
        await this.statAsync(filePath);
        await this.unlinkAsync(filePath);
        logger.info(`Removed existing profile image for user ${userId}`);
      } catch (error) {
        // File doesn't exist, ignore
      }
      
      // Save file
      // Extract base64 data from the full data URI
      let base64Data = fileData.data;
      
      // Jika data dimulai dengan 'data:' (data URI scheme), ekstrak bagian base64-nya
      if (base64Data.startsWith('data:')) {
        // Format: data:[<mediatype>][;base64],<data>
        base64Data = base64Data.split(',')[1];
        console.log('Extracted base64 data from data URI');
      } else {
        console.log('Data is already in base64 format');
      }
      
      console.log('Writing file to:', filePath);
      await this.writeFileAsync(filePath, Buffer.from(base64Data, 'base64'));
      
      // Return public URL path
      const publicPath = `/uploads/profile-images/${fileName}`;
      
      logger.info(`Saved profile image for user ${userId}: ${publicPath}`);
      
      return publicPath;
    } catch (error) {
      logger.error(`Failed to save profile image: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Delete profile image
   * @param {number} userId - User ID
   * @returns {Promise<boolean>} Success status
   */
  async deleteProfileImage(userId) {
    try {
      // Find all possible extensions
      const extensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
      let deleted = false;
      
      for (const extension of extensions) {
        const fileName = `user-${userId}-profile.${extension}`;
        const filePath = path.join(this.profileImagesDir, fileName);
        
        try {
          await this.statAsync(filePath);
          await this.unlinkAsync(filePath);
          deleted = true;
          logger.info(`Deleted profile image for user ${userId}: ${fileName}`);
        } catch (error) {
          // File doesn't exist or other error, continue to next extension
        }
      }
      
      return deleted;
    } catch (error) {
      logger.error(`Failed to delete profile image: ${error.message}`);
      throw error;
    }
  }
}

module.exports = new UploadService();