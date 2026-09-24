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

    const data = await service.getByUser(username, parseInt(limit) || 50);
    const unread = await service.getUnreadCount(username);
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
    const result = await service.markRead(id);
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
    await service.markAllRead(username);
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
    const count = await service.getUnreadCount(username);
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

  // Init event (readJson kini async) + pasang listener & heartbeat setelahnya.
  // Semua write DIBERI GUARD writableEnded/destroyed agar koneksi yang sudah
  // menutup tidak melempar ERR_STREAM_WRITE_AFTER_END dari dalam interval (bisa crash).
  (async () => {
    const existing = await service.getByUser(username);
    const unread = await service.getUnreadCount(username);
    if (res.writableEnded || res.destroyed) return;
    res.write(`event: init\ndata: ${JSON.stringify({ notifications: existing, unread })}\n\n`);

    // Listen untuk notifikasi baru
    const handler = (notif) => {
      if (res.writableEnded || res.destroyed) return;
      res.write(`event: new\ndata: ${JSON.stringify(notif)}\n\n`);
    };
    eventEmitter.on(`notif:${username}`, handler);

    // Heartbeat
    const heartbeat = setInterval(() => {
      if (res.writableEnded || res.destroyed) return;
      res.write(":heartbeat\n\n");
    }, 30000);

    // Cleanup on disconnect
    req.on("close", () => {
      eventEmitter.off(`notif:${username}`, handler);
      clearInterval(heartbeat);
      if (!res.writableEnded) res.end();
    });
  })().catch(err => {
    logger.error(`SSE notifications init untuk ${username} gagal: ${err.message}`);
    if (!res.writableEnded) res.end();
  });
};
