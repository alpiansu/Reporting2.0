/**
 * Notifications Service — JSON-based, follow pattern notes.service.js
 */
import fs from "fs";
import path from "path";
import logger from "../../config/logger.js";

const JSON_PATH = path.join(process.cwd(), "data/notifications.json");
const CACHE_TTL = 60 * 1000; // 1 menit

class NotificationsService {
  constructor() {
    this.cache = null;
    this.lastLoaded = 0;
    this.eventEmitter = null; // di-set dari controller untuk SSE broadcast
  }

  setEventEmitter(emitter) {
    this.eventEmitter = emitter;
  }

  ensureJsonFile() {
    const dir = path.dirname(JSON_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(JSON_PATH)) fs.writeFileSync(JSON_PATH, "[]");
  }

  readJson(force = false) {
    const now = Date.now();
    if (!force && this.cache && now - this.lastLoaded < CACHE_TTL) {
      return this.cache;
    }
    this.ensureJsonFile();
    const raw = fs.readFileSync(JSON_PATH, "utf-8");
    this.cache = JSON.parse(raw || "[]");
    this.lastLoaded = now;
    return this.cache;
  }

  writeJson(data) {
    this.ensureJsonFile();
    fs.writeFileSync(JSON_PATH, JSON.stringify(data, null, 2));
    this.cache = null;
    this.lastLoaded = 0;
  }

  /** Buat notifikasi baru */
  create({ username, type, title, message, link = null, metadata = {} }) {
    const notifications = this.readJson();
    const notif = {
      id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      username,
      type,
      title,
      message,
      link,
      metadata,
      read: false,
      created_at: new Date().toISOString(),
    };
    notifications.unshift(notif);
    this.writeJson(notifications);
    logger.info(`[Notifications] Created for ${username}: ${title}`);

    // Broadcast real-time via SSE
    if (this.eventEmitter) {
      this.eventEmitter.emit(`notif:${username}`, notif);
    }
    return notif;
  }

  /** Ambil notifikasi untuk user tertentu (unread first, lalu by date) */
  getByUser(username, limit = 50) {
    const all = this.readJson();
    return all
      .filter(n => n.username === username)
      .sort((a, b) => {
        if (a.read !== b.read) return a.read ? 1 : -1;
        return new Date(b.created_at) - new Date(a.created_at);
      })
      .slice(0, limit);
  }

  /** Hitung unread count untuk user */
  getUnreadCount(username) {
    const all = this.readJson();
    return all.filter(n => n.username === username && !n.read).length;
  }

  /** Mark notifikasi sebagai read */
  markRead(notifId) {
    const notifications = this.readJson();
    const idx = notifications.findIndex(n => n.id === notifId);
    if (idx === -1) return false;
    notifications[idx].read = true;
    notifications[idx].read_at = new Date().toISOString();
    this.writeJson(notifications);
    return true;
  }

  /** Mark all sebagai read untuk user */
  markAllRead(username) {
    const notifications = this.readJson();
    let changed = false;
    for (const n of notifications) {
      if (n.username === username && !n.read) {
        n.read = true;
        n.read_at = new Date().toISOString();
        changed = true;
      }
    }
    if (changed) this.writeJson(notifications);
    return changed;
  }

  /** Hapus notifikasi > 30 hari */
  cleanup() {
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    const notifications = this.readJson();
    const before = notifications.length;
    const filtered = notifications.filter(n => {
      const age = Date.now() - new Date(n.created_at).getTime();
      return age < thirtyDays || !n.read; // keep unread + recent
    });
    if (filtered.length !== before) {
      this.writeJson(filtered);
      logger.info(`[Notifications] Cleanup: removed ${before - filtered.length} old notifications`);
    }
  }
}

export default new NotificationsService();
