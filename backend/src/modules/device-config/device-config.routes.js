/**
 * Device config routes
 */
import express from "express";
import { registerDevice, getCurrentDevice, updateCurrentDevicePath } from "./device-config.controller.js";
import { authenticateJWT } from "../../middlewares/index.js";

const router = express.Router();

router.post("/register", authenticateJWT, registerDevice);
router.get("/current", authenticateJWT, getCurrentDevice);
router.put("/current", authenticateJWT, updateCurrentDevicePath);

export default router;