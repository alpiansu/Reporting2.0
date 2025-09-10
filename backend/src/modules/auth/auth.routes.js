import express from 'express';
import { login,
  register,
  getProfile,
  changePassword,
  updateProfile,
  refreshToken,
  logout,
  uploadProfileImage,
  deleteProfileImage } from './auth.controller.js';
import { authenticateJWT } from '../../middlewares/index.js';
import multerProfileImage from '../../middlewares/multerProfileImage.js';

const router = express.Router();

// Public routes
router.post("/login", login);
router.post("/register", register);

// Protected routes
router.get("/profile", authenticateJWT, getProfile);
router.put("/change-password", authenticateJWT, changePassword);
router.put("/profile", authenticateJWT, updateProfile);
router.post("/profile-image", authenticateJWT, multerProfileImage.single("image"), uploadProfileImage);
router.delete("/profile-image", authenticateJWT, deleteProfileImage);
router.post("/refresh-token", authenticateJWT, refreshToken);
router.post("/logout", authenticateJWT, logout);

export default router;
