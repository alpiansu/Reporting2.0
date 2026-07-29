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

  /**
   * Cari notifikasi yang cocok dengan username + type + metadata tertentu.
   * Menerima multiple metadataFilters (AND), bukan single key-value.
   * @param {Object} params
   * @param {string} params.username
   * @param {string} params.type
   * @param {Object} params.metadataFilters - Object berisi key-value yang harus cocok semua
   *   Contoh: findByMetadata({ username: "admin", type: "penyesuaian-worsened", metadataFilters: { kdtk: "TW75001", periode: "2607" } })
   * @returns {Object|null} Notifikasi yang cocok, atau null jika tidak ada
   */
  findByMetadata({ username, type, metadataFilters = {} }) {
    const all = this.readJson();
    return all.find(n =>
      n.username === username &&
      n.type === type &&
      Object.entries(metadataFilters).every(([key, value]) =>
        n.metadata && n.metadata[key] === value
      )
    ) || null;
  }

  /**
   * Update notifikasi yang sudah ada: timpa message, title, metadata, reset read=false.
   * Broadcast via SSE agar frontend mendapat update real-time.
   * @param {string} notifId
   * @param {Object} updates - { title, message, metadata }
   * @returns {Object|null} Notifikasi yang sudah di-update, atau null jika tidak ditemukan
   */
  update(notifId, { title, message, metadata = {} }) {
    const notifications = this.readJson();
    const idx = notifications.findIndex(n => n.id === notifId);
    if (idx === -1) return null;

    const notif = notifications[idx];
    notif.title = title || notif.title;
    notif.message = message || notif.message;
    notif.metadata = { ...notif.metadata, ...metadata };
    notif.read = false; // Reset read karena ada info terbaru
    notif.updated_at = new Date().toISOString();

    this.writeJson(notifications);
    logger.info(`[Notifications] Updated for ${notif.username}: ${notif.title}`);

    // Broadcast update via SSE
    if (this.eventEmitter) {
      this.eventEmitter.emit(`notif:${notif.username}`, { ...notif, _update: true });
    }

    return notif;
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
