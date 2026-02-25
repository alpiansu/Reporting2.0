import express from "express";
import dashboardController from "./dashboard.controller.js";
import { authenticateJWT } from "../../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/stats", authenticateJWT, dashboardController.getStats);
router.get("/recent-activity", authenticateJWT, dashboardController.getRecentActivity);

export default router;
