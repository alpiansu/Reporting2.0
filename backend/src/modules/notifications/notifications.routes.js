/**
 * Notifications Routes
 */
import { Router } from "express";
import { authenticateJWT } from "../../middlewares/index.js";
import {
  getAll,
  markRead,
  markAllRead,
  getUnreadCount,
  sseStream,
} from "./notifications.controller.js";

const router = Router();

// REST endpoints
router.get("/", authenticateJWT, getAll);
router.put("/:id/read", authenticateJWT, markRead);
router.put("/read-all", authenticateJWT, markAllRead);
router.get("/unread-count", authenticateJWT, getUnreadCount);

// SSE stream (no JWT auth — relies on URL param, but in production add token-based auth)
router.get("/sse/:username", sseStream);

export default router;
