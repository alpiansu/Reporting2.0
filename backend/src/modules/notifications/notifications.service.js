/**
 * Notifications Service — JSON-based, follow pattern notes.service.js
 *
 * Health fix (memory/lag), TANPA mengubah nama method, bentuk return, maupun response API
 * (semua method kini async/Promise — pemanggil di controller/service sudah di-await):
 *  - I/O diubah dari sync (readFileSync/writeFileSync) ke async (fs/promises) agar tidak
 *    memblokir event loop setiap create/markRead.
 *  - Operasi baca-tulis (create/markRead/markAllRead/update/dibersihkan) diserialisasi
 *    dengan mutex per-proses, dan penulisan atomic (temp + rename) → file tidak korup
 *    saat beberapa operasi berjalan berbarengan.
 *  - Pemangkasan: notifikasi READ >30 hari dibuang (sama seperti aturan lama), tetapi
 *    notifikasi UNREAD kini juga dibuang setelah90 hari — dulu unread disimpan
 *    selamanya sehingga notifications.json tumbuh tanpa batas.
 *  - scheduleCleanup(): jalankan pemangkasan saat start + interval1 jam.
 */
import fs from "fs/promises";
import path from "path";
import { Mutex } from "async-mutex";
import logger from "../../config/logger.js";
import { writeAtomicWithRetry } from "../../utils/file.utils.js";

const JSON_PATH = path.join(process.cwd(), "data/notifications.json");
const CACHE_TTL = 60 * 1000; // 1 menit
const READ_MAX_AGE = 30 * 24 * 60 * 60 * 1000; // notifikasi sudah dibaca →30 hari
const UNREAD_MAX_AGE = 90 * 24 * 60 * 60 * 1000; // notifikasi belum dibaca → tetap maks90 hari

class NotificationsService {
  constructor() {
    this.cache = null;
    this.lastLoaded = 0;
    this.eventEmitter = null; // di-set dari controller untuk SSE broadcast
    this.mutex = new Mutex(); // serialisasi operasi baca-tulis-file
    this.cleanupTimer = null;
  }

  setEventEmitter(emitter) {
    this.eventEmitter = emitter;
  }

  async ensureJsonFile() {
    const dir = path.dirname(JSON_PATH);
    await fs.mkdir(dir, { recursive: true });
    try {
      // Buat file kosong hanya jika belum ada (aman untuk proses paralel)
      await fs.writeFile(JSON_PATH, "[]", { flag: "wx" });
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
    }
  }

  async readJson(force = false) {
    const now = Date.now();
    if (!force && this.cache && now - this.lastLoaded < CACHE_TTL) {
      return this.cache;
    }
    await this.ensureJsonFile();
    const raw = await fs.readFile(JSON_PATH, "utf-8");
    this.cache = JSON.parse(raw || "[]");
    this.lastLoaded = now;
    return this.cache;
  }

  async writeJson(data) {
    await this.ensureJsonFile();
    await writeAtomicWithRetry(JSON_PATH, JSON.stringify(data, null, 2));
    this.cache = null;
    this.lastLoaded = 0;
  }

  /** Buat notifikasi baru */
  async create({ username, type, title, message, link = null, metadata = {} }) {
    const release = await this.mutex.acquire();
    let notif;
    try {
      const notifications = await this.readJson();
      notif = {
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
      await this.writeJson(notifications);
    } finally {
      release();
    }
    logger.info(`[Notifications] Created for ${username}: ${title}`);

    // Broadcast real-time via SSE
    if (this.eventEmitter) {
      this.eventEmitter.emit(`notif:${username}`, notif);
    }
    return notif;
  }

  /** Ambil notifikasi untuk user tertentu (unread first, lalu by date) */
  async getByUser(username, limit = 50) {
    const all = await this.readJson();
    return all
      .filter(n => n.username === username)
      .sort((a, b) => {
        if (a.read !== b.read) return a.read ? 1 : -1;
        return new Date(b.created_at) - new Date(a.created_at);
      })
      .slice(0, limit);
  }

  /** Hitung unread count untuk user */
  async getUnreadCount(username) {
    const all = await this.readJson();
    return all.filter(n => n.username === username && !n.read).length;
  }

  /** Mark notifikasi sebagai read */
  async markRead(notifId) {
    const release = await this.mutex.acquire();
    try {
      const notifications = await this.readJson();
      const idx = notifications.findIndex(n => n.id === notifId);
      if (idx === -1) return false;
      notifications[idx].read = true;
      notifications[idx].read_at = new Date().toISOString();
      await this.writeJson(notifications);
      return true;
    } finally {
      release();
    }
  }

  /** Mark all sebagai read untuk user */
  async markAllRead(username) {
    const release = await this.mutex.acquire();
    try {
      const notifications = await this.readJson();
      let changed = false;
      for (const n of notifications) {
        if (n.username === username && !n.read) {
          n.read = true;
          n.read_at = new Date().toISOString();
          changed = true;
        }
      }
      if (changed) await this.writeJson(notifications);
      return changed;
    } finally {
      release();
    }
  }

  /**
   * Cari notifikasi yang cocok dengan username + type + metadata tertentu.
   * Menerima multiple metadataFilters (AND), bukan single key-value.
   * @param {Object} params
   * @param {string} params.username
   * @param {string} params.type
   * @param {Object} params.metadataFilters - Object berisi key-value yang harus cocok semua
   *   Contoh: findByMetadata({ username: "admin", type: "penyesuaian-worsened", metadataFilters: { kdtk: "TW75001", periode: "2607" } })
   * @returns {Promise<Object|null>} Notifikasi yang cocok, atau null jika tidak ditemukan
   */
  async findByMetadata({ username, type, metadataFilters = {} }) {
    const all = await this.readJson();
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
   * @returns {Promise<Object|null>} Notifikasi yang sudah di-update, atau null jika tidak ditemukan
   */
  async update(notifId, { title, message, metadata = {} }) {
    let notif = null;
    const release = await this.mutex.acquire();
    try {
      const notifications = await this.readJson();
      const idx = notifications.findIndex(n => n.id === notifId);
      if (idx === -1) return null;

      notif = notifications[idx];
      notif.title = title || notif.title;
      notif.message = message || notif.message;
      notif.metadata = { ...notif.metadata, ...metadata };
      notif.read = false; // Reset read karena ada info terbaru
      notif.updated_at = new Date().toISOString();

      await this.writeJson(notifications);
    } finally {
      release();
    }
    logger.info(`[Notifications] Updated for ${notif.username}: ${notif.title}`);

    // Broadcast update via SSE
    if (this.eventEmitter) {
      this.eventEmitter.emit(`notif:${notif.username}`, { ...notif, _update: true });
    }

    return notif;
  }

  /**
   * Pemangkasan agar notifications.json tidak tumbuh tanpa batas:
   *  - notifikasi READ  → dibuang setelah30 hari (aturan lama, tidak berubah)
   *  - notifikasi UNREAD → dibuang setelah90 hari (aturan baru; dulu disimpan selamanya)
   * @returns {Promise<{removed:number}>} Jumlah notifikasi yang terbuang
   */
  async cleanup() {
    const release = await this.mutex.acquire();
    let removed = 0;
    try {
      const notifications = await this.readJson(true);
      const before = notifications.length;
      const filtered = notifications.filter(n => {
        const age = Date.now() - new Date(n.created_at).getTime();
        if (n.read) return age < READ_MAX_AGE;
        return age < UNREAD_MAX_AGE;
      });
      removed = before - filtered.length;
      if (removed > 0) {
        await this.writeJson(filtered);
        logger.info(`[Notifications] Cleanup: removed ${removed} old notifications (${before} -> ${filtered.length})`);
      }
    } finally {
      release();
    }
    return { removed };
  }

  /**
   * Jalankan cleanup saat start + berkala (default tiap1 jam).
   * Aman dipanggil berulang (hanya membuat timer sekali).
   * @param {number} intervalMs
   * @returns {NodeJS.Timeout|null}
   */
  scheduleCleanup(intervalMs = 60 * 60 * 1000) {
    if (this.cleanupTimer) return this.cleanupTimer;
    const run = () => {
      this.cleanup().catch(err => logger.error(`[Notifications] Cleanup error: ${err.message}`));
    };
    run(); // pemangkasan awal saat start
    this.cleanupTimer = setInterval(run, intervalMs);
    return this.cleanupTimer;
  }

  /** Hentikan timer cleanup (untuk tes/shutdown) */
  stopCleanup() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }
}

export default new NotificationsService();
