import AuthService from "./auth.service.js";
import UserActivityService from "../user-activity/userActivity.service.js";
import logger from "../../config/logger.js";
import jwt from "../../config/jwt.js";

const userActivityService = new UserActivityService();
const authService = new AuthService();

/**
 * Login a user
 */
export const login = async (req, res, next) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: "Username and password are required" });
    }

    const result = await authService.login(username, password);

    // Get IP and user agent from request for activity logging
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers["user-agent"];

    // Log login activity with request details
    await userActivityService.logActivity({
      userId: result.user.id,
      type: "login",
      description: `User ${result.user.fullName} logged in`,
      ipAddress,
      userAgent,
    });

    res.status(200).json(result);
  } catch (error) {
    if (error.message === "User not found") {
      return res.status(401).json({ message: "User not found", field: "username" });
    } else if (error.message === "Invalid password") {
      return res.status(401).json({ message: "Invalid password", field: "password" });
    }
    next(error);
  }
};

/**
 * Register a new user
 */
export const register = async (req, res, next) => {
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

    // Get IP and user agent from request for activity logging
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers["user-agent"];

    // Log registration activity with request details
    await userActivityService.logActivity({
      userId: result.user.id,
      type: "register",
      description: "User registered",
      ipAddress,
      userAgent,
    });

    res.status(201).json(result);
  } catch (error) {
    // Handle duplicate username/email
    if (error.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({ message: "Username or email already exists" });
    }
    next(error);
  }
};

/**
 * Get current user profile
 */
export const getProfile = async (req, res, next) => {
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
};

/**
 * Change user password
 */
export const changePassword = async (req, res, next) => {
  try {
    const userId = req.user.id;
    // Pastikan req.body ada dan bertipe object
    const body = req.body || {};
    const { currentPassword, newPassword } = body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "Current password and new password are required" });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: "New password must be at least 6 characters long" });
    }

    await authService.changePassword(userId, currentPassword, newPassword);

    // Get IP and user agent from request for activity logging
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers["user-agent"];

    // Log password change activity with request details
    await userActivityService.logActivity({
      userId: userId,
      type: "password",
      description: "User changed password",
      ipAddress,
      userAgent,
    });

    res.status(200).json({ message: "Password changed successfully" });
  } catch (error) {
    if (error.message === "Current password is incorrect") {
      return res.status(400).json({ message: error.message });
    }
    next(error);
  }
};

/**
 * Update user profile
 */
export const updateProfile = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { fullName, email } = req.body;

    // Create profile data object with only allowed fields
    const profileData = {};

    if (fullName !== undefined) profileData.fullName = fullName;
    if (email !== undefined) profileData.email = email;

    // If profile image was uploaded and saved, it will be in req.body.profileImage
    if (req.body.profileImage !== undefined) {
      profileData.profileImage = req.body.profileImage;
    }

    const updatedUser = await authService.updateProfile(userId, profileData);

    // Get IP and user agent from request for activity logging
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers["user-agent"];

    // Log profile update activity with request details
    await userActivityService.logActivity({
      userId: userId,
      type: "profile",
      description: "User updated profile",
      ipAddress,
      userAgent,
    });

    res.status(200).json(updatedUser);
  } catch (error) {
    logger.error(`Update profile error: ${error.message}`);

    if (error.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({ message: "Email already in use" });
    }

    next(error);
  }
};

/**
 * Refresh JWT token
 */
export const refreshToken = async (req, res, next) => {
  // User is already authenticated by middleware
  const user = req.user;

  // Generate new token
  const token = jwt.generateToken(user);

  res.status(200).json({ token });
};

/**
 * Logout user
 */
export const logout = async (req, res, next) => {
  try {
    const userId = req.user?.id;

    // Get IP and user agent from request for activity logging
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers["user-agent"];

    // Log logout activity
    if (userId) {
      await authService.logout(userId, { ipAddress, userAgent });
    }

    // In a stateless JWT auth system, logout is handled client-side
    // by removing the token from storage
    res.status(200).json({ message: "Logged out successfully" });
  } catch (error) {
    logger.error(`Logout error: ${error.message}`);
    next(error);
  }
};

/**
 * Upload profile image
 */
export const uploadProfileImage = async (req, res, next) => {
  try {
    const userId = req.user.id;
    if (!req.file) {
      return res.status(400).json({ message: "No image file uploaded" });
    }
    // req.file contains: { path, mimetype, originalname, filename }
    const fileData = {
      path: req.file.path,
      mimetype: req.file.mimetype,
      originalname: req.file.originalname,
      filename: req.file.filename,
    };
    logger.info(`Uploading profile image for user ${userId}:`, fileData);
    const imagePath = await authService.saveProfileImage(userId, req.file);
    res.status(200).json({ imagePath });
  } catch (error) {
    logger.error(`Upload profile image error: ${error.message}`);
    if (error.message.includes("Invalid file type")) {
      return res.status(400).json({ message: error.message });
    }
    next(error);
  }
};

/**
 * Delete profile image
 */
export const deleteProfileImage = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const deleted = await authService.deleteProfileImage(userId);

    if (deleted) {
      res.status(200).json({ message: "Profile image deleted successfully" });
    } else {
      res.status(404).json({ message: "No profile image found" });
    }
  } catch (error) {
    logger.error(`Delete profile image error: ${error.message}`);
    next(error);
  }
};

// Default export for backward compatibility
export default {
  login,
  register,
  getProfile,
  changePassword,
  updateProfile,
  refreshToken,
  logout,
  uploadProfileImage,
  deleteProfileImage,
};
