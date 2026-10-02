/**
 * Resilient Database Connection Wrapper
 * Provides graceful degradation when database is unavailable
 */
import { Sequelize } from "sequelize";
import dotenv from "dotenv";
import logger from "./logger.js";
import fs from "fs/promises";
import path from "path";

dotenv.config();

// ── [Health fix #14] Batas waktu & perilaku pool ──────────────────────────────
// Bug lama (log 2026-09-30): hook beforeDisconnect menandai DB "mati" saat pool
// membuang koneksi idle (pool.idle = 10 detik) → tiap reconnect membangun instance
// Sequelize BARU lalu close() instance lama → pool.drain() menggantung selamanya
// bila ada koneksi in-use → SEMUA request yang menunggu getDatabase() ikut
// menggantung → UI "pending tanpa henti". Kini: reconnect MEMAKAI instance yang
// sama (tanpa close), semua operasi koneksi/ambil-DB dibatasi deadline, dan
// koneksi mati dibuang paksa lewat forceDestroyPool() (tanpa pernah menunggu drain).
const GET_DB_TIMEOUT_MS = 15000; // getDatabase(): lempar DatabaseUnavailableError (503) bila lewat
const SLOW_WAIT_WARN_MS = 2000; // peringatan dini bila request tertahan menunggu DB
const AUTH_TIMEOUT_MS = 10000; // authenticate()/heartbeat dibatasi agar tidak menggantung di koneksi setengah matang
const CLOSE_TIMEOUT_MS = 5000; // batas menunggu close() polite sebelum paksa buang koneksi
const OP_TIMEOUT_MS = 60000; // default deadline operasi via executeOperation (bisa di-override per panggilan)
const HEARTBEAT_MS = 30000; // interval pemeriksaan kesehatan koneksi
const HEARTBEAT_TIMEOUT_MS = 8000; // deadline 1 heartbeat

/**
 * Batasi sebuah promise dengan deadline. Bila melebihi → reject
 * DatabaseUnavailableError (statusCode 503 → dijawab databaseErrorHandler),
 * sehingga tidak ada proses yang bisa menggantung tanpa batas.
 */
function withDeadline(promise, ms, label) {
  let timer;
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new DatabaseUnavailableError(`${label} melebihi ${ms}ms`)), ms);
  });
  return Promise.race([Promise.resolve(promise), deadline]).finally(() => clearTimeout(timer));
}

class ResilientDatabase {
  constructor() {
    this.sequelize = null;
    this.isConnected = false;
    this.connectionAttempts = 0;
    this.maxRetries = 3;
    this.retryDelay = 5000; // 5 seconds
    this.lastConnectionAttempt = null;
    this.lastConnectionFailure = null;
    this.connectionCooldown = 30000; // 30 seconds cooldown after real failures
    this.connectionPromise = null;
    this.retryPromise = null;
    this.generation = 0;
    this.heartbeatTimer = null;
    this.heartbeatBusy = false;

    // JSON file paths for offline data
    this.dataPath = path.join(process.cwd(), "data");
    this.offlineDataFiles = {
      stores: path.join(this.dataPath, "stores.json"),
      users: path.join(this.dataPath, "users.json"),
      rekon_wt_harian: path.join(this.dataPath, "rekon_wt_harian.json"),
      rekap_remote: path.join(this.dataPath, "rekap_remote.json"),
    };
  }

  /**
   * Initialize database connection with retry mechanism
   */
  async initialize() {
    try {
      await this.ensureDataDirectory();
      await this.connect();
    } catch (error) {
      logger.warn(`Database initialization failed: ${error.message}. Running in offline mode.`);
      this.isConnected = false;
    }
  }

  /**
   * Ensure data directory exists for offline storage
   */
  async ensureDataDirectory() {
    try {
      await fs.mkdir(this.dataPath, { recursive: true });
    } catch (error) {
      logger.error(`Failed to create data directory: ${error.message}`);
    }
  }

  /**
   * Attempt to connect to database. Concurrent callers share one connection attempt.
   */
  async connect(options = {}) {
    const { force = false } = options;

    if (this.connectionPromise) {
      logger.info("Database connection attempt already in progress, waiting for existing attempt...");
      return this.connectionPromise;
    }

    if (!force && this.lastConnectionFailure && Date.now() - this.lastConnectionFailure < this.connectionCooldown) {
      throw new Error("Connection attempt in cooldown period");
    }

    this.lastConnectionAttempt = Date.now();
    this.connectionPromise = this.createConnection();

    try {
      return await this.connectionPromise;
    } finally {
      this.connectionPromise = null;
    }
  }

  /**
   * [Health fix #14] Reconnect TIDAK lagi membangun instance baru + close()
   * instance lama (itu sumber pool.drain() yang menggantung → semua request
   * menunggu DB ikut pending tanpa henti). Bila masih ada instance, cukup
   * authenticate ulang — pool membuka koneksi baru seperlunya. Kegagalan/koneksi
   * kotor dibuang paksa lewat forceDestroyPool() tanpa pernah menunggu drain.
   */
  async createConnection() {
    const isNew = !this.sequelize;
    const instance = isNew ? this.buildSequelize() : this.sequelize;

    try {
      await withDeadline(instance.authenticate(), AUTH_TIMEOUT_MS, "authenticate database");
    } catch (error) {
      this.isConnected = false;
      this.connectionAttempts++;
      this.lastConnectionFailure = Date.now();
      logger.error(`Database connection failed (attempt ${this.connectionAttempts}): ${error.message}`);

      // Buang sisa koneksi (termasuk yang setengah matang) agar attempt
      // berikutnya membuka koneksi baru dari nol — tanpa drain menggantung.
      this.forceDestroyPool(instance);

      throw error;
    }

    this.sequelize = instance;
    this.isConnected = true;
    this.connectionAttempts = 0;
    this.lastConnectionFailure = null;
    this.generation++;
    logger.info("Database connection established successfully");

    if (isNew) {
      this.setupConnectionHandlers();
      this.startHeartbeat();
    }

    return instance;
  }

  /**
   * Buat instance Sequelize baru dengan konfigurasi pool proyek.
   */
  buildSequelize() {
    return new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASSWORD, {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      dialect: "mysql",
      timezone: "+07:00",
      logging: process.env.NODE_ENV === "development" ? console.log : false,
      define: {
        timestamps: true,
        underscored: true,
      },
      pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000,
      },
      retry: {
        max: this.maxRetries,
      },
    });
  }

  /**
   * Setup connection event handlers
   */
  setupConnectionHandlers() {
    if (!this.sequelize) return;

    try {
      // Handle connection errors using Sequelize hooks instead of connectionManager events
      this.sequelize.addHook("afterConnect", () => {
        // [Health fix #14] dipicu PER KONSESI saat pool membuka koneksi —
        // turunkan ke debug agar tidak membanjiri log (bukan event lifecycle DB).
        logger.debug("Database connection established via hook");
        this.isConnected = true;
      });

      this.sequelize.addHook("beforeDisconnect", () => {
        // [Health fix #14] REGRESI BUG UTAMA: hook ini dipicu PER KONSESI ketika
        // pool membuang koneksi idle (pool.idle = 10 detik) — perilaku NORMAL,
        // BUKAN tanda database mati. Dulu hook ini mengeset isConnected = false
        // sehingga request berikutnya menganggap DB down → teardown+rebuild
        // instance tiap ~10 detik (197x "disconnecting via hook" + 51 siklus
        // reconnect di log 2026-09-30) dan memicu close() yang menggantung →
        // semua request menunggu DB ikut pending tanpa henti.
        // Sekarang: TIDAK mengubah status; koneksi mati sesungguhnya terdeteksi
        // lewat kegagalan query / heartbeat (runHeartbeat).
        logger.debug("Database connection closing via hook (pool idle eviction — normal)");
      });
    } catch (error) {
      logger.warn(`Could not setup connection handlers: ${error.message}`);
    }
  }

  /**
   * Get database instance with automatic reconnection and retry
   */
  /**
   * Get database instance with automatic reconnection and retry.
   * [Health fix #14] Dibatasi GET_DB_TIMEOUT_MS: bila koneksi tidak siap juga,
   * melempar DatabaseUnavailableError (503) — TIDAK PERNAH menggantung tanpa batas.
   */
  async getDatabase() {
    if (this.isConnected && this.sequelize) {
      return this.sequelize;
    }

    // Peringatan dini: bila menunggu > 2 detik, ada request yang tertahan.
    // Log ini jadi jejak diagnostik utama — dulu kemacetan di getDatabase()
    // tidak meninggalkan log sama sekali (susah dilacak).
    const slowWarnTimer = setTimeout(() => {
      logger.warn(
        `[resilient-db] Request tertahan menunggu database >= ${SLOW_WAIT_WARN_MS}ms ` +
          `(generation=${this.generation}, connected=${this.isConnected})`
      );
    }, SLOW_WAIT_WARN_MS);

    try {
      return await withDeadline(this.awaitDatabaseReady(), GET_DB_TIMEOUT_MS, "Menunggu koneksi database");
    } finally {
      clearTimeout(slowWarnTimer);
    }
  }

  /**
   * [Health fix #14] Inti retry lama getDatabase() — TIDAK PERNAH reject:
   * connectionPromise gagal → jatuh ke siklus reconnect (hasil akhir null bila
   * DB benar-benar down). Kontrak pemanggil: instance sequelize | null.
   * [Health fix #13] Satu siklus retry DISHARE antar request yang datang
   * bersamaan (pola sama dengan connectionPromise di atas): dulu tiap request
   * menjalankan loop 3 attempt + sleep 2s/4s sendiri → saat DB down, N request
   * = badai force-reconnect dan N request macet ±6 detik.
   */
  async awaitDatabaseReady() {
    if (this.connectionPromise) {
      try {
        return await this.connectionPromise;
      } catch (error) {
        logger.warn(`Database connection in progress failed: ${error.message}`);
      }
    }

    if (!this.retryPromise) {
      const cycle = this.runReconnectCycle();
      this.retryPromise = cycle;
      const clearCycle = () => {
        if (this.retryPromise === cycle) this.retryPromise = null;
      };
      cycle.then(clearCycle, clearCycle);
    }
    return this.retryPromise;
  }

  /**
   * Satu siklus reconnect: maks 3 attempt ber-backoff (2s, 4s), lalu null.
   * Tidak pernah reject — semua error ditangkap di dalam loop.
   */
  async runReconnectCycle() {
    const maxRetries = 3;
    const retryDelay = 2000; // 2 seconds

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        logger.info(`Attempting to reconnect to database (attempt ${attempt}/${maxRetries})...`);
        await this.connect({ force: attempt > 1 });

        if (this.isConnected && this.sequelize) {
          logger.info("Database reconnected successfully");
          return this.sequelize;
        }
      } catch (error) {
        logger.warn(`Database reconnection attempt ${attempt} failed: ${error.message}`);

        if (attempt < maxRetries) {
          const delay = retryDelay * attempt;
          logger.info(`Waiting ${delay}ms before next retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    logger.warn("Database unavailable after all reconnection attempts, operating in offline mode");
    return null;
  }

  /**
   * Execute database operation with fallback to offline mode
   */
  async executeOperation(operation, fallbackData = null, options = {}) {
    const { timeoutMs = OP_TIMEOUT_MS } = options;

    let db;
    try {
      db = await this.getDatabase();
    } catch (error) {
      // getDatabase() melempar DatabaseUnavailableError (menunggu > deadline)
      if (fallbackData) {
        logger.info("Database unavailable, using fallback data");
        return fallbackData;
      }
      throw error;
    }

    if (!db) {
      if (fallbackData) {
        logger.info("Database unavailable, using fallback data");
        return fallbackData;
      }
      throw new DatabaseUnavailableError("Database is currently unavailable");
    }

    try {
      // [Health fix #14] batasi operasi agar query yang menggantung di koneksi
      // setengah matang tidak menahan request tanpa batas.
      return await withDeadline(Promise.resolve().then(() => operation(db)), timeoutMs, "Operasi database");
    } catch (error) {
      logger.error(`Database operation failed: ${error.message}`);
      this.isConnected = false;

      if (fallbackData) {
        logger.info("Database operation failed, using fallback data");
        return fallbackData;
      }

      throw error;
    }
  }

  /**
   * Read data from JSON file (offline mode)
   */
  async readOfflineData(dataType) {
    try {
      const filePath = this.offlineDataFiles[dataType];
      if (!filePath) {
        throw new Error(`Unknown data type: ${dataType}`);
      }

      const data = await fs.readFile(filePath, "utf8");
      return JSON.parse(data);
    } catch (error) {
      if (error.code === "ENOENT") {
        logger.warn(`Offline data file not found for ${dataType}`);
        return [];
      }
      logger.error(`Error reading offline data for ${dataType}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Write data to JSON file (for offline access)
   */
  async writeOfflineData(dataType, data) {
    try {
      const filePath = this.offlineDataFiles[dataType];
      if (!filePath) {
        throw new Error(`Unknown data type: ${dataType}`);
      }

      await fs.writeFile(filePath, JSON.stringify(data, null, 2));
      logger.info(`Offline data saved for ${dataType}`);
    } catch (error) {
      logger.error(`Error writing offline data for ${dataType}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Check if database is available
   */
  isDatabaseAvailable() {
    return this.isConnected && this.sequelize;
  }

  /**
   * Force reconnection attempt
   */
  async forceReconnect() {
    this.lastConnectionAttempt = null;
    this.lastConnectionFailure = null;
    this.connectionAttempts = 0;
    return await this.connect({ force: true });
  }

  /**
   * [Health fix #14] Buang paksa SEMUA koneksi di pool (available + in-use)
   * tanpa menunggu drain. Dipakai saat: (a) close() melebihi deadline,
   * (b) authenticate/heartbeat gagal — koneksi setengah matang harus dibuang
   * supaya query in-flight langsung error, bukan menggantung selamanya.
   */
  forceDestroyPool(instance) {
    const pool = instance?.connectionManager?.pool;
    if (!pool) return;

    // mendukung bentuk pool tunggal maupun replication { read, write }
    const pools = pool.read && pool.write ? [pool.read, pool.write] : [pool];

    for (const p of pools) {
      try {
        const resources = [
          ...(p._availableObjects || []).map(wrapped => wrapped.resource),
          ...(p._inUseObjects || []).map(wrapped => wrapped.resource),
        ];

        for (const resource of resources) {
          try {
            // paksa tutup socket mysql2 terlebih dulu agar query yang sedang
            // berjalan langsung error, bukan menunggu TCP timeout
            resource?.destroy?.();
          } catch {
            // socket mungkin sudah mati — abaikan
          }
          try {
            // perbarui state pool; JANGAN di-await (factory.destroy bisa menggantung)
            p.destroy(resource)?.catch?.(() => {});
          } catch {
            // abaikan
          }
        }

        logger.warn(`[resilient-db] Memaksa membuang ${resources.length} koneksi dari pool`);
      } catch (error) {
        logger.warn(`[resilient-db] Gagal membuang paksa pool: ${error.message}`);
      }
    }
  }

  /**
   * [Health fix #14] Heartbeat: authenticate ringan tiap 30 detik untuk mendeteksi
   * koneksi setengah matang (jaringan putus tanpa RST) yang membuat query
   * menggantung tanpa error. Bila gagal → tandai DB down + buang pool; request
   * berikutnya otomatis menjalankan siklus reconnect (health fix #13).
   */
  startHeartbeat() {
    if (this.heartbeatTimer) return;
    this.heartbeatTimer = setInterval(() => this.runHeartbeat(), HEARTBEAT_MS);
    this.heartbeatTimer.unref?.(); // jangan menahan proses saat shutdown
  }

  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  async runHeartbeat() {
    if (this.heartbeatBusy || !this.sequelize || !this.isConnected) return;
    this.heartbeatBusy = true;
    try {
      await withDeadline(this.sequelize.authenticate(), HEARTBEAT_TIMEOUT_MS, "heartbeat database");
    } catch (error) {
      logger.warn(`[resilient-db] Heartbeat database gagal: ${error.message} — menandai DB down & membuang koneksi`);
      this.isConnected = false;
      this.forceDestroyPool(this.sequelize);
    } finally {
      this.heartbeatBusy = false;
    }
  }

  /**
   * Close database connection
   */
  async close() {
    this.stopHeartbeat();
    const instance = this.sequelize;
    if (!instance) return;

    try {
      // [Health fix #14] close() → pool.drain() bisa menggantung selamanya bila
      // ada koneksi in-use; batasi lalu paksa buang koneksi tersisa.
      await withDeadline(instance.close(), CLOSE_TIMEOUT_MS, "Menutup koneksi database");
      logger.info("Database connection closed");
    } catch (error) {
      logger.warn(`Graceful close tidak selesai: ${error.message} — memaksa menutup koneksi tersisa`);
      this.forceDestroyPool(instance);
    } finally {
      this.isConnected = false;
      this.sequelize = null;
      this.generation++;
    }
  }

  /**
   * Get connection status
   */
  getStatus() {
    return {
      isConnected: this.isConnected,
      connectionAttempts: this.connectionAttempts,
      lastConnectionAttempt: this.lastConnectionAttempt,
      lastConnectionFailure: this.lastConnectionFailure,
      hasSequelize: !!this.sequelize,
      generation: this.generation,
      reconnecting: !!this.connectionPromise,
    };
  }

  getGeneration() {
    return this.generation;
  }
}

/**
 * Custom error for database unavailability
 */
class DatabaseUnavailableError extends Error {
  constructor(message) {
    super(message);
    this.name = "DatabaseUnavailableError";
    this.statusCode = 503;
    this.isOperational = true;
  }
}

// Create singleton instance
const resilientDb = new ResilientDatabase();

export default resilientDb;
export { DatabaseUnavailableError };