/**
 * Notifications Controller
 */
import service from "./notifications.service.js";
import { apiResponse } from "../../utils/index.js";
import logger from "../../config/logger.js";
import { EventEmitter } from "events";

// EventEmitter untuk SSE broadcast
const eventEmitter = new EventEmitter();
service.setEventEmitter(eventEmitter);

/**
 * GET /api/notifications?username=xxx&limit=50
 */
export const getAll = async (req, res) => {
  try {
    const { username, limit } = req.query;
    if (!username) return apiResponse.badRequest(res, "username required");

    const data = service.getByUser(username, parseInt(limit) || 50);
    const unread = service.getUnreadCount(username);
    res.json({ success: true, data, unread, count: data.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * PUT /api/notifications/:id/read
 */
export const markRead = async (req, res) => {
  try {
    const { id } = req.params;
    const result = service.markRead(id);
    if (!result) return apiResponse.notFound(res, "Notification not found");
    res.json({ success: true, message: "Marked as read" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * PUT /api/notifications/read-all
 * Body: { username }
 */
export const markAllRead = async (req, res) => {
  try {
    const { username } = req.body;
    if (!username) return apiResponse.badRequest(res, "username required");
    service.markAllRead(username);
    res.json({ success: true, message: "All marked as read" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/notifications/unread-count?username=xxx
 */
export const getUnreadCount = async (req, res) => {
  try {
    const { username } = req.query;
    if (!username) return apiResponse.badRequest(res, "username required");
    const count = service.getUnreadCount(username);
    res.json({ success: true, data: { count } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/notifications/sse/:username
 * SSE stream for real-time push notifications
 */
export const sseStream = (req, res) => {
  const { username } = req.params;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.flushHeaders();

  // Kirim existing unread notifications sebagai init event
  const existing = service.getByUser(username);
  const unread = service.getUnreadCount(username);
  res.write(`event: init\ndata: ${JSON.stringify({ notifications: existing, unread })}\n\n`);

  // Listen untuk notifikasi baru
  const handler = (notif) => {
    res.write(`event: new\ndata: ${JSON.stringify(notif)}\n\n`);
  };
  eventEmitter.on(`notif:${username}`, handler);

  // Heartbeat
  const heartbeat = setInterval(() => {
    res.write(":heartbeat\n\n");
  }, 30000);

  // Cleanup on disconnect
  req.on("close", () => {
    eventEmitter.off(`notif:${username}`, handler);
    clearInterval(heartbeat);
  });
};
