const { authService } = require("../services");
const logger = require("../config/logger");

/**
 * Controller for handling authentication related requests
 */
class AuthController {
  /**
   * Login a user
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  async login(req, res, next) {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({ message: "Username and password are required" });
      }

      const result = await authService.login(username, password);

      res.status(200).json(result);
    } catch (error) {
      if (error.message === "User not found") {
        return res.status(401).json({ message: "User not found", field: "username" });
      } else if (error.message === "Invalid password") {
        return res.status(401).json({ message: "Invalid password", field: "password" });
      }
      next(error);
    }
  }

  /**
   * Register a new user
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  async register(req, res, next) {
    try {
      const { username, email, password, fullName, role } = req.body;

      // Validate required fields
      if (!username || !email || !password) {
        return res.status(400).json({ message: "Username, email, and password are required" });
      }

      // Create user data object
      const userData = {
        username,
        email,
        password,
        fullName: fullName || "",
        role: role || "user",
      };

      const result = await authService.register(userData);

      res.status(201).json(result);
    } catch (error) {
      // Handle duplicate username/email
      if (error.name === "SequelizeUniqueConstraintError") {
        return res.status(409).json({ message: "Username or email already exists" });
      }
      next(error);
    }
  }

  /**
   * Get current user profile
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  async getProfile(req, res, next) {
    try {
      const userId = req.user.id;
      const user = await authService.getProfile(userId);
      if (!user) {
        logger.warn(`User with id ${userId} not found or inactive when accessing profile`);
        return res.status(401).json({ message: "User not found or inactive" });
      }
      res.status(200).json(user);
    } catch (error) {
      logger.error(`Get profile error: ${error.message}`);
      next(error);
    }
  }

  /**
   * Change user password
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  async changePassword(req, res, next) {
    try {
      const userId = req.user.id;
      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: "Current password and new password are required" });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ message: "New password must be at least 6 characters long" });
      }

      await authService.changePassword(userId, currentPassword, newPassword);

      res.status(200).json({ message: "Password changed successfully" });
    } catch (error) {
      if (error.message === "Current password is incorrect") {
        return res.status(400).json({ message: error.message });
      }
      next(error);
    }
  }

  /**
   * Refresh JWT token
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  refreshToken(req, res) {
    // User is already authenticated by middleware
    const user = req.user;

    // Generate new token
    const token = require("../config/jwt").generateToken(user);

    res.status(200).json({ token });
  }
}

module.exports = new AuthController();
