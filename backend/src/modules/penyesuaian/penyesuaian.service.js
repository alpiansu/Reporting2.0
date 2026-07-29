/**
 * Service for Penyesuaian (Sesuai Toko)
 */
import fs from "fs/promises";
import path from "path";
import logger from "../../config/logger.js";
import SesuaiToko from "./penyesuaian.model.js";
import SesuaiTokoSummary from "./penyesuaian_summary.model.js";
import dbStore from "../../config/db_store.js";
import config from "./penyesuaian.config.js";
import storeService from "../store/storeService.js";
import pLimit from "p-limit";
import moment from "moment-timezone";
import RekapRemoteService from "../rekap_remote/rekap_remote.service.js";
import notesService from "../notes/notes.service.js";
import progressService from "../progress/progress.service.js";
import storeInspectorService from "../../services/storeInspector.service.js";
import UserService from "../user/user.service.js";
import { isNumericString, toNumber, formatNumber } from "../../utils/numberUtils.js";
import { fileUtils } from "../../utils/index.js";
import screeningGuard from "../../utils/screeningGuard.js";

// Path untuk folder JSON penyesuaian (akan di-split per periode)
const PENYESUAIAN_DATA_DIR = path.join(process.cwd(), "data/penyesuaian");

class PenyesuaianService {
  constructor() {
    this.penyesuaianData = [];
    this.loadedPeriod = null; // Menandakan periode mana yang sedang di-load di memory

    // TTL Cache Management
    this.lastLoadTime = null;
    this.TTL = 15 * 60 * 1000; // Dikurangi ke 15 menit agar lebih responsif terhadap update database
    this.isLoading = false; // Prevent concurrent loading

    // 🔥 New multi-key cache for database records (per kdtk/cabang)
    this.cacheDetailData = new Map();
    this.cacheTTL = 5 * 60 * 1000; // 5 minutes

    // 📋 Legacy notes cache (in-memory, di-refresh saat sync atau saat TTL habis)
    this.legacyNotesCache = new Map();
    this.legacyNotesCachedAt = 0;
    this.legacyNotesTTL = 30 * 60 * 1000; // 30 menit
    this.legacyNotesPeriode = null;

    // 🏪 Branch aggregate caches (branch-extremes, branch-top items)
    // Menyimpan hasil aggregasi per cabang untuk menghindari query DB setiap kali
    this.branchExtremesCache = new Map(); // Map<periode, { data, cachedAt }>
    this.branchTopItemsCache = new Map(); // Map<`${cabang}:${periode}`, { data, cachedAt }>
    this.aggregateCacheTTL = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Mendapatkan path file JSON untuk periode tertentu
   */
  getJsonPath(periode) {
    if (!periode) return null;
    return path.join(PENYESUAIAN_DATA_DIR, `penyesuaian_${periode}.json`);
  }

  /**
   * Initialize the service by loading data from JSON file
   * Creates the file and directory if they don't exist
   */
  async initialize(periode) {
    if (!periode) throw new Error("Periode is required for initialization");
    try {
      await fs.mkdir(PENYESUAIAN_DATA_DIR, { recursive: true });

      const jsonPath = this.getJsonPath(periode);
      try {
        const data = await fileUtils.readFileWithRetry(jsonPath);
        this.penyesuaianData = JSON.parse(data);
        this.loadedPeriod = periode;
        logger.info(`Loaded ${this.penyesuaianData.length} records for period ${periode} from JSON`);
      } catch (err) {
        if (err.code === "ENOENT") {
          this.penyesuaianData = [];
          this.loadedPeriod = periode;
          await this.saveToFile(periode);
        } else throw err;
      }
    } catch (error) {
      logger.error(`[penyesuaian.service] Failed to initialize period ${periode}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Save penyesuaian data to JSON file for a specific period
   */
  async saveToFile(periode) {
    if (!periode) throw new Error("Periode is required to save data");
    try {
      const jsonPath = this.getJsonPath(periode);
      await fileUtils.writeAtomicWithRetry(jsonPath, JSON.stringify(this.penyesuaianData, null, 2));
      logger.debug(`Saved ${this.penyesuaianData.length} records to JSON file: ${jsonPath}`);
    } catch (error) {
      logger.error(`Failed to save penyesuaian period ${periode} to file: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generate cache key based on periode, cabang, and kdtk
   */
  generateCacheKey(periode, cabang, kdtk) {
    return JSON.stringify({ periode, cabang, kdtk });
  }

  /**
   * Check if cache entry is still valid (based on lastAccessTime)
   */
  isCacheFromDbValid(entry) {
    if (!entry) return false;
    const now = Date.now();
    return now - entry.lastAccessTime < this.cacheTTL;
  }

  /**
   * Load data langsung dari database sesuai filter
   * Jika kdtk ada → abaikan cabang, else filter by cabang
   */
  async loadRecordsDetailFromDb({ periode, cabang, kdtk }, hasRefreshed = false) {
    logger.info(`[penyesuaian.service] menjalankan loadRecordsDetailFromDb dengan status hasRefreshed:${hasRefreshed}`);
    const model = await SesuaiToko.getModel();
    const sequelize = model.sequelize;
    const { Sequelize } = await import("sequelize");
    const strYear = moment(periode, "YYMM").format("YYYY");
    const strMonth = moment(periode, "YYMM").format("MM");

    const whereClauses = [`PERIODE = :periode`, `RECID = '*'`, `ABS(SESUAI) > 1000`];

    const replacements = { periode };

    if (kdtk) {
      whereClauses.push(`KDTK = :kdtk`);
      replacements.kdtk = kdtk;
    } else if (cabang && cabang !== "All") {
      whereClauses.push(`CABANG = :cabang`);
      replacements.cabang = cabang;
    }

    const query = `
    SELECT
      RECID_PRODMAST AS RECID,
      PRDCD,
      SINGKATAN,
      PTAG,
      CAST(a.SESUAI AS SIGNED) AS SESUAI,
      CAST(BEGBAL AS SIGNED) AS BEGBAL,
      CAST(TRFIN AS SIGNED) AS TRFIN,
      CAST(TRFOUT AS SIGNED) AS TRFOUT,
      CAST(RP_SALES AS SIGNED) AS RP_SALES,
      CAST(RP_RETUR_SALES AS SIGNED) AS RP_RETUR_SALES,
      CAST(ADJ AS SIGNED) AS ADJ,
      CAST(BA AS SIGNED) AS BA,
      CAST(BS AS SIGNED) AS BS,
      CAST(ACOST AS SIGNED) AS ACOST,
      CAST(LCOST AS SIGNED) AS LCOST,
      CAST(STOCK AS SIGNED) AS STOCK,
      CAST(RP_STOCK AS SIGNED) AS RP_STOCK,
      CASE
        WHEN DATE(a.UPDTIME) = DATE(b.UPDTIME) THEN 'OK'
        WHEN DATE(a.UPDTIME) > DATE(b.UPDTIME) THEN 'UPD-SUMMARY'
        WHEN DATE(a.UPDTIME) < DATE(b.UPDTIME) THEN 'UPD'
        ELSE 'UNKNOWN'
    END AS STATUS_UPDTIME
    FROM sesuai_toko a left join 
    (SELECT cabang, periode, kdtk, updtime FROM sesuai_toko_summary) b USING(cabang, periode, kdtk)
    WHERE ${whereClauses.join(" AND ")}
    ORDER BY a.SESUAI DESC
  `;

    logger.info(`[penyesuaian.service] menjalankan query ambil data detail penyesuaian toko ${kdtk}`);
    const records = await sequelize.query(query, {
      replacements,
      type: Sequelize.QueryTypes.SELECT,
    });

    logger.info(
      `[penyesuaian.service] hasil query ambil data detail penyesuaian toko ${kdtk} mendapatkan ${records.length} baris data`,
    );

    if (records.length == 0 || records[0]?.STATUS_UPDTIME != "OK") {
      // ✅ Bug 2 fix: Guard rekursi dipindah ke DALAM if block
      if (hasRefreshed) {
        logger.warn(
          `[penyesuaian.service] Loop ke 2 atas toko ${kdtk} dengan status saat ini ${records[0]?.STATUS_UPDTIME}`,
        );
        if (records.length == 0) {
          return [];
        }
      }

      // ✅ Bug 1 fix: Gunakan optional chaining + fallback value
      const statusUpdtime = records[0]?.STATUS_UPDTIME ?? "EMPTY";
      logger.info(
        `[penyesuaian.service] status updtime ${statusUpdtime} tarik data detail penyesuaian toko ${kdtk} terlebih dahulu!`,
      );

      await this.getDetailFromStore(kdtk, periode);

      // ✅ Bug 3 fix: length dicek duluan, gunakan ===
      if (records.length > 0 && statusUpdtime === "UPD-SUMMARY") {
        logger.info(`[penyesuaian.service] jalankan processSingleStore toko ${kdtk}`);
        const result = await this.processSingleStore({ storeCode: kdtk, cabang }, periode, strYear, strMonth);
        // Invalidate cache to force reload from JSON file on next request
        this.invalidateCache();
        // Sync to JSON file
        await this.syncToJsonFile(periode);
        if (result.hasIssue === false) {
          const err = new Error("Nilai penyesuaian toko ini sudah di bawah ambang batas Rp 500.000, data detail tidak dapat ditampilkan.");
          err.code = "STORE_BELOW_THRESHOLD";
          throw err;
        }
      }

      return await this.loadRecordsDetailFromDb({ periode, cabang, kdtk }, true);
    }

    // Blok hasRefreshed yang lama di sini sudah tidak perlu → hapus
    return records;
  }

  /**
   * Optional: Cleanup expired cache entries
   */
  cleanupCache() {
    const now = Date.now();
    for (const [key, entry] of this.cacheDetailData.entries()) {
      if (now - entry.lastAccessTime > this.cacheTTL) {
        this.cacheDetailData.delete(key);
        logger.debug(`[penyesuaian.service] Cache expired & removed for key=${key}`);
      }
    }
    this.cleanupAggregateCache();
  }

  /**
   * Cleanup expired aggregate cache entries (branch-extremes, branch-top-items)
   */
  cleanupAggregateCache() {
    const now = Date.now();
    for (const [key, entry] of this.branchExtremesCache.entries()) {
      if (now - entry.cachedAt > this.aggregateCacheTTL) {
        this.branchExtremesCache.delete(key);
        logger.debug(`[penyesuaian.service] Branch extremes cache expired & removed for periode=${key}`);
      }
    }
    for (const [key, entry] of this.branchTopItemsCache.entries()) {
      if (now - entry.cachedAt > this.aggregateCacheTTL) {
        this.branchTopItemsCache.delete(key);
        logger.debug(`[penyesuaian.service] Branch top items cache expired & removed for key=${key}`);
      }
    }
  }

  /**
   * Check if cached data is still valid based on TTL
   * @returns {boolean} True if cache is valid, false if expired
   */
  isCacheValid(periode) {
    if (!this.loadedPeriod || this.loadedPeriod !== periode || !this.lastLoadTime) {
      return false;
    }

    const now = Date.now();
    const isExpired = now - this.lastLoadTime > this.TTL;
    return !isExpired;
  }

  /**
   * Invalidate legacy notes cache
   */
  invalidateLegacyCache() {
    this.legacyNotesCache = new Map();
    this.legacyNotesCachedAt = 0;
    this.legacyNotesPeriode = null;
    logger.info("[penyesuaian.service] Legacy notes cache invalidated");
  }

  /**
   * Cek apakah legacy notes cache masih valid untuk periode tertentu
   */
  isLegacyCacheValid(periode) {
    if (!this.legacyNotesPeriode || this.legacyNotesPeriode !== periode) return false;
    if (this.legacyNotesCachedAt === 0) return false;
    return Date.now() - this.legacyNotesCachedAt < this.legacyNotesTTL;
  }

  /**
   * Refresh in-memory legacy notes cache secara batch (satu kali query DB)
   * Dipanggil saat sync selesai, atau saat TTL habis dari enrichWithNotes
   * @param {Array} data - Array data penyesuaian (harus punya CABANG, KDTK, PERIODE)
   * @param {string} periode - Periode yang sedang aktif
   */
  async refreshLegacyNotesCache(data, periode) {
    try {
      if (!data || data.length === 0) {
        this.legacyNotesCache = new Map();
        this.legacyNotesCachedAt = Date.now();
        this.legacyNotesPeriode = periode;
        return;
      }

      // Kumpulkan semua idNotes unik (format: CABANG+KDTK+PERIODE)
      const allIdNotes = data.map(item => `${item.CABANG}${item.KDTK}${item.PERIODE}`);
      const uniqueIdNotes = [...new Set(allIdNotes)];

      // Query sekali ke DB legacy secara batch
      const legacyNotes = await notesService.getLegacyNotesFallback("web_reporting.sesuaiToko", uniqueIdNotes);

      // Simpan ke Map
      this.legacyNotesCache = new Map(legacyNotes.map(n => [n.legacyIdNote, n]));
      this.legacyNotesCachedAt = Date.now();
      this.legacyNotesPeriode = periode;

      logger.info(
        `[penyesuaian.service] Legacy notes cache refreshed: ${this.legacyNotesCache.size} entries, periode=${periode}, TTL expires at: ${new Date(this.legacyNotesCachedAt + this.legacyNotesTTL).toISOString()}`,
      );
    } catch (err) {
      logger.error(`[penyesuaian.service] Failed to refresh legacy notes cache: ${err.message}`);
    }
  }

  /**
   * Invalidate cache manually
   */
  invalidateCache() {
    this.penyesuaianData = [];
    this.loadedPeriod = null;
    this.lastLoadTime = null;
    this.isLoading = false;
    this.cacheDetailData.clear();
    this.invalidateLegacyCache();
    this.branchExtremesCache.clear();
    this.branchTopItemsCache.clear();
    logger.info("Penyesuaian cache invalidated manually");
  }

  /**
   * Ensure data is loaded with TTL-based lazy loading
   * Only loads data when needed and cache is expired
   */
  async ensureDataLoaded(periode) {
    if (!periode) throw new Error("Periode is required to load data");

    // If cache is still valid for this period, skip
    if (this.isCacheValid(periode)) {
      return;
    }

    // Prevent concurrent loading
    if (this.isLoading) {
      // Wait for ongoing loading to complete
      while (this.isLoading) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return;
    }

    try {
      this.isLoading = true;
      logger.info(`Loading penyesuaian data for period ${periode} (cache expired or wrong period)`);

      await this.initialize(periode);
      this.lastLoadTime = Date.now();

      logger.info(
        `Data loaded successfully for ${periode}. TTL expires at: ${new Date(this.lastLoadTime + this.TTL).toISOString()}`,
      );
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * 🔁 Sync data ke JSON file hanya berupa hasil agregasi SUM(SESUAI) untuk periode tertentu
   */
  async syncToJsonFile(periode) {
    if (!periode) throw new Error("Periode is required for sync");
    try {
      // 🛠️ ALUR BARU: Ambil data resume langsung dari tabel summary
      const rows = await SesuaiTokoSummary.findAll({
        where: { PERIODE: periode },
      });

      this.penyesuaianData = rows.map(r => ({
        CABANG: r.CABANG,
        KDTK: r.KDTK,
        PERIODE: r.PERIODE,
        SESUAI: Number(r.SESUAI) || 0,
        UPDTIME: r.UPDTIME,
        RECID: r.RECID, // Simpan status RECID ke JSON
      }));

      await this.saveToFile(periode);
      this.loadedPeriod = periode;
      this.lastLoadTime = Date.now();

      // 🧹 Invalidate aggregate caches untuk periode ini karena data berubah
      this.branchExtremesCache.delete(periode);
      // Hapus semua branchTopItemsCache yang menyangkut periode ini
      for (const key of this.branchTopItemsCache.keys()) {
        if (key.endsWith(`:${periode}`)) {
          this.branchTopItemsCache.delete(key);
        }
      }

      logger.info(
        `[penyesuaian.service] Synced ${this.penyesuaianData.length} records from Summary to JSON for period ${periode}`,
      );

      // 🔄 Force refresh legacy notes cache setelah sync selesai
      // Ini memastikan data legacy notes selalu up-to-date pasca screening
      await this.refreshLegacyNotesCache(this.penyesuaianData, periode);

      return this.penyesuaianData.length;
    } catch (error) {
      logger.error(`[penyesuaian.service] Failed to sync data for period ${periode}: ${error.message}`);
      throw error;
    }
  }

  /**
   * 🛠️ Fungsi baru untuk mengupdate tabel summary berdasarkan data detail (Upsert)
   * Berfungsi sebagai "Single Source of Truth" untuk resume per toko.
   */
  /**
   * Sync semua periode yang tersedia di tabel summary ke file JSON per periode.
   */
  async syncAllData() {
    try {
      logger.info("[penyesuaian.service] Starting full JSON sync from DB summary");

      const model = await SesuaiTokoSummary.getModel();
      const sequelize = model.sequelize;
      const [rows] = await sequelize.query(`
        SELECT DISTINCT PERIODE
        FROM sesuai_toko_summary
        WHERE PERIODE IS NOT NULL AND PERIODE <> ''
        ORDER BY PERIODE
      `);

      let totalFiles = 0;
      let totalRecords = 0;

      for (const row of rows) {
        const periode = row.PERIODE;
        const recordCount = await this.syncToJsonFile(periode);
        totalFiles++;
        totalRecords += recordCount;
      }

      logger.info(`[penyesuaian.service] Full JSON sync completed: ${totalRecords} records, ${totalFiles} files`);
      return { totalFiles, totalRecords };
    } catch (error) {
      logger.error(`[penyesuaian.service] Failed full JSON sync: ${error.message}`);
      throw error;
    }
  }

  async updateSummaryFromRecords(records) {
    if (!records || records.length === 0) return;

    try {
      const { CABANG, KDTK, PERIODE } = records[0];

      // Hitung total SESUAI in-memory
      const totalSesuai = records.reduce((sum, rec) => sum + (Number(rec.SESUAI) || 0), 0);
      const maxUpdTime = records.reduce((max, rec) => {
        const current = new Date(rec.UPDTIME);
        return current > max ? current : max;
      }, new Date(0));

      await SesuaiTokoSummary.upsert({
        CABANG,
        KDTK,
        PERIODE,
        SESUAI: totalSesuai,
        UPDTIME: maxUpdTime,
        RECID: "*", // Jika ada records detail, berarti statusnya unresolved
      });

      logger.debug(`[penyesuaian.service] Summary updated for ${KDTK} (${PERIODE}): SESUAI=${totalSesuai}`);
    } catch (error) {
      logger.error(`[penyesuaian.service] Failed to update summary from records: ${error.message}`);
    }
  }

  /**
   * 🛠️ Fungsi baru untuk mengupdate status summary menjadi Resolved ('1')
   * Aturan: RECID = '1', SESUAI dan UPDTIME tetap dipertahankan sebagai informasi historis.
   */
  async markSummaryAsResolved(params) {
    const { periode, kdtk } = params;
    try {
      // Kita hanya update RECID menjadi '1'. SESUAI dan UPDTIME dibiarkan (Historical).
      await SesuaiTokoSummary.update(
        { RECID: "1" },
        {
          where: { PERIODE: periode, KDTK: kdtk },
        },
      );
      logger.debug(`[penyesuaian.service] Summary marked as RESOLVED for ${kdtk} (${periode})`);
    } catch (error) {
      logger.error(`[penyesuaian.service] Failed to mark summary as resolved: ${error.message}`);
    }
  }

  /**
   * Calculate previous periode (1 month before)
   * @param {string} periode - Current periode in YYMM format
   * @returns {string} Previous periode in YYMM format
   */
  getPreviousPeriode(periode) {
    const currentDate = moment(periode, "YYMM");
    const previousDate = currentDate.subtract(1, "months");
    return previousDate.format("YYMM");
  }

  /**
   * Generate filetToko table name
   * @param {string} kdtk - Store code
   * @param {string} periode - Current periode in YYMM format
   * @returns {string} Table name (e.g., TW752510)
   */
  getFiletTokoTableName(kdtk, periode) {
    const previousPeriode = this.getPreviousPeriode(periode);
    return `${kdtk}${previousPeriode}`;
  }

  /**
   * Process single store screening
   * @param {Object} store - Store object with storeCode and cab
   * @param {string} strPeriode - Period in YYMM format
   * @param {string} strYear - Year in YYYY format
   * @param {string} strMonth - Month in MM format
   * @returns {Promise<Object>} Result with success status, records, and hasIssue flag
   */
  async processSingleStore(store, strPeriode, strYear, strMonth, sharedConnection = null, sessionId, options = {}) {
    const { suppressIntermediateLogs = false } = options;
    const { storeCode, cab } = store;

    const results = { success: false, records: [], hasIssue: false };
    const isShared = !!sharedConnection;

    try {
      // --- Store info --- //
      const storeInfo = await storeService.getStoreIPHost(storeCode);

      if (!storeInfo) {
        await RekapRemoteService.addToTemp(cab, storeCode, "penyesuaian", `[${storeCode}] store info not found`);
        return results;
      }

      // --- Create DB connection (or use shared) --- //
      const storeConnection = isShared
        ? sharedConnection
        : await dbStore.createDbStore(storeInfo.dbHost, config.connectionRetry.maxRetries);

      if (!storeConnection) {
        await RekapRemoteService.addToTemp(
          cab,
          storeCode,
          "penyesuaian",
          `[${storeCode}] failed to connect after ${config.connectionRetry.maxRetries} attempts`,
        );
        return results;
      }

      try {
        // Generate filetToko table name
        const filetToko = this.getFiletTokoTableName(storeCode, strPeriode);

        // STEP 1: Run filter query to check if store has data exceeding threshold
        const filterQuery = config.queries.filter(filetToko, strPeriode, strMonth, strYear);
        const [filterResult] = await storeConnection.query(filterQuery, [strMonth, strYear, strMonth, strYear]);
        if (!suppressIntermediateLogs) {
          await RekapRemoteService.addToTemp(
            cab,
            storeCode,
            "penyesuaian",
            `[${storeCode}] filter query completed, threshold check: ${filterResult.length > 0 ? "EXCEEDED" : "OK"}`,
          );
        }

        logger.info(`[penyesuaian.service] filterResult.length : ${filterResult.length}`);
        // STEP 2: If threshold exceeded, run detail query
        if (filterResult.length > 0) {
          await SesuaiTokoSummary.upsert(filterResult[0]);
          results.success = true;
          results.hasIssue = true;
        } else {
          await this.markSummaryAsResolved({ periode: strPeriode, kdtk: storeCode });
          results.success = true;
          results.hasIssue = false;
        }

        if (!suppressIntermediateLogs) {
          await RekapRemoteService.addToTemp(
            cab,
            storeCode,
            "penyesuaian",
            `[${storeCode}] ${results.hasIssue ? "issue_found" : "success"}`,
          );
        }
      } finally {
        if (!isShared && storeConnection) {
          await storeConnection.end();
        }
      }
    } catch (err) {
      logger.error(`[penyesuaian.service] processSingleStore : error : ${err}`);
      await RekapRemoteService.addToTemp(cab, storeCode, "penyesuaian", `[${storeCode}] ERROR: ${err.message}`);
    }

    return results;
  }

  /**
   * Screening stores to penyesuaian based on store query
   * Supports 3 levels: All cabang, 1 cabang, or 1 specific store
   */
  async screening(options) {
    // Ensure storeService is initialized
    await storeService.ensureInitialized();

    const { cabang, periode, kdtk, username, fullName, force } = options;
    const sessionId = await SesuaiToko.startScreeningSession();

    // === LEVEL 3: Single Store Screening (No Progress Task) ===
    if (kdtk) {
      logger.info(`[penyesuaian.service] Starting single store screening: ${kdtk}, periode: ${periode}`);

      try {
        // Get store info to determine cabang
        const storeInfo = await storeService.getStoreByCode(kdtk);
        const storeCab = storeInfo ? storeInfo.branch || storeInfo.cab : "UNKNOWN";

        // Convert periode
        const strPeriode = periode;
        const strYear = moment(periode, "YYMM").format("YYYY");
        const strMonth = moment(periode, "YYMM").format("MM");

        // Process single store
        const result = await this.processSingleStore(
          { storeCode: kdtk, cab: storeCab },
          strPeriode,
          strYear,
          strMonth,
          null,
          sessionId,
        );

        // ✅ FINALIZING

        // Save logs to database
        await RekapRemoteService.saveLogsToDatabase();

        // Invalidate cache to force reload from JSON file on next request
        this.invalidateCache();
        // Sync to JSON file
        await this.syncToJsonFile(strPeriode);

        return {
          success: true,
          message: `Single store screening completed for ${kdtk}`,
          processedRecords: result.records.length,
        };
      } catch (error) {
        logger.error(`[penyesuaian.service] Error during single store screening: ${error.message}`);
        throw error;
      }
    }

    // === LEVEL 1 & 2: Multi-Store Screening (With Progress Task) ===
    const taskId = `${config.taskProgressName}_${username}`;
    const limitBranches = pLimit(config.parallelProcessing.branchConcurrencyLimit);
    const limitStores = pLimit(config.parallelProcessing.concurrencyLimit);

    const withTimeout = (promise, ms, label) => {
      return Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error(`Timeout: ${label}`)), ms)),
      ]);
    };

    try {
      // === STEP 1: Branches ===
      let branches = [];
      if (cabang === "All" || cabang === "ALL") {
        const allStores = storeService.stores;
        branches = [...new Set(allStores.filter(s => s.notes === "INDUK").map(s => s.branch || s.cab))];
      } else {
        branches = [cabang];
      }

      logger.info(`[penyesuaian.service] Branches to process: ${branches.join(", ")}`);

      // === STEP 2: Collect all stores ===
      const storeGroups = await Promise.all(
        branches.map(cab =>
          limitBranches(async () => {
            const stores = await storeService.getStoresByBranch(cab, true);
            logger.info(`[penyesuaian.service] Found ${stores.length} stores for branch ${cab}`);
            // tambahkan info cabang ke tiap store
            return stores.map(s => ({ ...s, cab }));
          }),
        ),
      );

      const storesToProcess = storeGroups.flat();

      logger.info(`[penyesuaian.service] Total stores to process: ${storesToProcess.length}`);

      // Register progress task
      try {
        const timeStart = moment().format("YYYY-MM-DD HH:mm:ss");
        await progressService.startProgress(taskId, storesToProcess.length, {
          module: "penyesuaian",
          title: "Screening Penyesuaian",
          description: "registering task",
          startedBy: fullName || username,
          status: "registering",
          createdAt: timeStart,
        });

        logger.info(`Progress task registered for user ${username}, taskId: ${taskId}`);
      } catch (error) {
        logger.error(`Error registering progress task: ${error.message}`);

        if (error.message.includes("Maximum concurrent")) {
          await progressService.failProgress(taskId, {
            description: `Task failed: ${error.message}`,
            status: "failed",
          });
          throw new Error("[service penyesuaian] System is busy processing other tasks");
        }

        await progressService.failProgress(taskId, {
          description: `Task failed: ${error.message}`,
          status: "failed",
        });
        throw new Error("[service penyesuaian] Failed to register progress task");
      }

      logger.info(`[penyesuaian.service] Starting screening for branches: ${branches.join(", ")}`);

      // === PREPARE PROCESSING ===
      // Convert from string periode (YYMM)
      const strPeriode = periode;
      const strYear = moment(periode, "YYMM").format("YYYY");
      const strMonth = moment(periode, "YYMM").format("MM");

      // Track stores: screened vs active (has issues)
      const newRecords = [];
      const screenedStores = new Set(); // All stores that were processed (success or error)
      const activeStores = new Set(); // Stores that still have issues

      let processedCount = 0;
      const totalStores = storesToProcess.length;

      const incrementProgress = async (storeCode, statusText) => {
        processedCount++;

        await progressService.updateProgress(taskId, processedCount, {
          description: `Store ${storeCode} → ${statusText} (${processedCount}/${totalStores})`,
          status: "Screening to Stores",
        });
      };

      // step 3, loop each stores asynchronously
      await Promise.all(
        storesToProcess.map(store =>
          limitStores(async () => {
            const { cab, storeCode } = store;

            // Check if task was cancelled before starting this store
            if (progressService.isAborted(taskId)) {
              logger.info(`[penyesuaian] Skipping store ${storeCode} — task aborted`);
              screenedStores.add(storeCode); // still mark as processed so counts are correct
              await incrementProgress(storeCode, "Dibatalkan ⛔");
              return;
            }

            // === DAILY GUARD: Skip toko yang sudah sukses screening hari ini ===
            if (!force) {
              const guard = await screeningGuard.isSuccessToday("penyesuaian", storeCode);
              if (guard.screened) {
                screenedStores.add(storeCode);
                await incrementProgress(storeCode, `Skip (sudah screen ${guard.updtime})`);
                return;
              }
            }

            // Always mark as screened (even if error/timeout)
            screenedStores.add(storeCode);

            // Track this store as actively being processed (for real-time SSE display)
            progressService.addProcessingStore(taskId, storeCode);

            try {
              const result = await withTimeout(
                this.processSingleStore(store, strPeriode, strYear, strMonth, null, sessionId),
                config.parallelProcessing.storeTimeoutMs,
                `process store ${storeCode}`,
              );

              if (result.success) {
                // logger.info(`[penyesuaian.service] value result: ${JSON.stringify(result)}`);
                if (result.hasIssue) {
                  // Store has issues
                  activeStores.add(storeCode);
                  newRecords.push(...result.records);
                  await incrementProgress(storeCode, `Success ✅ (${result.records.length} rows)`);
                } else {
                  // Store below threshold (no issues)
                  await incrementProgress(storeCode, "Masih Dibawah Nilai Toleransi ✓");
                }
              } else {
                await incrementProgress(storeCode, "Error ❌");
              }
            } catch (err) {
              await RekapRemoteService.addToTemp(cab, storeCode, "penyesuaian", `[${storeCode}] ERROR: ${err.message}`);
              await incrementProgress(storeCode, "Error ❌");
            } finally {
              progressService.removeProcessingStore(taskId, storeCode);
            }
          }),
        ),
      );

      logger.info(`[penyesuaian.service] Screening process completed for periode ${periode}`);
      logger.info(
        `[penyesuaian.service] Screened stores: ${screenedStores.size}, Active stores (has issues): ${activeStores.size}`,
      );

      // If task was cancelled during store processing, stop before finalizing
      if (progressService.isAborted(taskId)) {
        logger.info(`[penyesuaian] Task ${taskId} was cancelled — skipping finalization`);
        throw new Error("Proses dibatalkan oleh pengguna");
      }

      // ── Finalizing phase ─────────────────────────────────────────────────────
      // Each step below updates progress BEFORE the operation so that `updatedAt`
      // stays fresh during long-running DB calls. This prevents the stale-task
      // detector from incorrectly expiring an actively finalizing task.

      await progressService.updateProgress(taskId, processedCount, {
        description: "Merging staging data & cleaning up resolved stores…",
        status: "finalizing",
      });

      // ── Sisa finalizing ──
      await progressService.updateProgress(taskId, processedCount, {
        description: "Saving logs to database…",
        status: "finalizing",
      });
      await RekapRemoteService.saveLogsToDatabase();

      await progressService.updateProgress(taskId, processedCount, {
        description: "Syncing data to JSON file, please wait…",
        status: "finalizing",
      });
      await this.syncToJsonFile(strPeriode);
      logger.info(`Synchronized ${newRecords.length} new records from database to JSON file`);

      const timeCompleted = moment().format("YYYY-MM-DD HH:mm:ss");
      await progressService.completeProgress(taskId, {
        description: "All stores processed",
        status: "completed",
        completedAt: timeCompleted,
      });

      return {
        success: true,
        message: "Screening process completed",
        processedRecords: newRecords.length,
        screenedStores: screenedStores.size,
        activeStores: activeStores.size,
      };
    } catch (error) {
      // If task was cancelled by user, don't call failProgress (already handled by cancelTask)
      if (progressService.isAborted(taskId)) {
        logger.info(`[penyesuaian] Task ${taskId} was cancelled — skipping failProgress`);
        return { success: false, message: "Proses dibatalkan oleh pengguna", cancelled: true };
      }

      logger.error(`[penyesuaian.service] Error during screening: ${error.message}`);

      await progressService.failProgress(taskId, {
        description: `Task failed: ${error.message}`,
        status: "failed",
      });

      throw error;
    } finally {
      // Cleanup processing stores tracking for this task
      progressService.clearProcessingStores(taskId);

      // Cleanup: Invalidate cache to force reload from JSON file on next request
      await SesuaiToko.cleanupScreeningSession(sessionId);
      this.invalidateCache();
    }
  }

  /**
   * Build filter function for data filtering (DRY principle)
   * IMPORTANT: Always filter RECID='*' for display
   * @param {Object} params - Filter parameters
   * @returns {Function} Filter function
   */
  buildFilterFunction(params = {}) {
    const { cabang, periode, kdtk } = params;

    return item => {
      // CRITICAL: Always filter for RECID='*' (unresolved records only)
      if (item.RECID !== "*") {
        return false;
      }

      // Filter by cabang
      if (cabang && cabang !== "All" && item.CABANG !== cabang) {
        return false;
      }

      // Filter by kdtk
      if (kdtk && item.KDTK !== kdtk) {
        return false;
      }

      // Filter by periode
      if (periode && item.PERIODE !== periode) {
        return false;
      }

      return true;
    };
  }

  /**
   * Get summary statistics from JSON file
   * Only count RECID='*' records
   * @param {Object} options - Query options (cabang, periode)
   * @returns {Promise<Object>} Summary statistics
   */
  async getSummary(options = {}) {
    const { cabang, periode } = options;

    try {
      // Ensure data is loaded from JSON file for the requested period
      await this.ensureDataLoaded(periode);

      // Build filter function (includes RECID='*' filter)
      const filterFn = this.buildFilterFunction({ cabang, periode });

      // Filter data
      const filteredData = this.penyesuaianData.filter(filterFn);

      // Calculate summary
      const uniqueStores = new Set(filteredData.map(item => item.KDTK));
      const totalSesuai = filteredData.reduce((sum, item) => sum + (Number(item.SESUAI) || 0), 0);

      return {
        data: {
          jml_toko: uniqueStores.size,
          total_sesuai: totalSesuai,
          total_records: filteredData.length,
        },
      };
    } catch (error) {
      logger.error(`[penyesuaian.service] Error getting summary: ${error.message}`);
      throw error;
    }
  }

  /**
   * Ambil resume nilai per KDTK dari file JSON (tanpa query DB)
   */
  async getResumeByKdtk(options = {}) {
    const {
      cabang = "All",
      periode,
      page = 1,
      limit = 10,
      sortColumn = "KDTK",
      sortOrder = "ASC",
      searchQuery,
    } = options;

    if (!periode) throw new Error("Periode wajib diisi");

    try {
      await this.ensureDataLoaded(periode);
      await storeService.ensureInitialized();

      let filtered = this.penyesuaianData.filter(
        i => i.PERIODE === periode && (cabang === "All" || i.CABANG === cabang) && i.RECID === "*",
      );

      // Ambil nama toko dari storeService
      let results = [];
      for (const item of filtered) {
        let storeName = "-";
        try {
          const storeInfo = await storeService.getStoreByCode(item.KDTK);
          if (storeInfo?.storeName) storeName = storeInfo.storeName;
        } catch {
          logger.warn(`[penyesuaian.service] Nama toko tidak ditemukan untuk ${item.KDTK}`);
        }
        results.push({
          CABANG: item.CABANG,
          PERIODE: item.PERIODE,
          KDTK: item.KDTK,
          NAMA: storeName,
          SESUAI: Number(item.SESUAI.toFixed(2)),
          UPDTIME: item.UPDTIME,
        });
      }

      results = await this.enrichWithNotes(results);

      // 🔍 Search (optional)
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        results = results.filter(item => {
          // fields biasa
          const fields = ["CABANG", "KDTK", "NAMA", "SESUAI"];

          // cocokkan field normal
          const matchNormal = fields.some(field => item[field] && item[field].toString().toLowerCase().includes(q));

          // cocokkan field di dalam note
          const matchNote =
            item.note &&
            ((item.note.noteText && item.note.noteText.toLowerCase().includes(q)) ||
              (item.note.pic && item.note.pic.toLowerCase().includes(q)) ||
              (item.note.fullName && item.note.fullName.toLowerCase().includes(q)));

          return matchNormal || matchNote;
        });
      }

      // Sorting
      const allowedSortColumns = ["CABANG", "KDTK", "SESUAI", "UPDTIME"];
      const col = allowedSortColumns.includes(sortColumn) ? sortColumn : "KDTK";
      const order = sortOrder?.toUpperCase() === "DESC" ? "DESC" : "ASC";

      results.sort((a, b) => {
        let av = a[col],
          bv = b[col];
        if (col === "UPDTIME") {
          av = av ? new Date(av).getTime() : 0;
          bv = bv ? new Date(bv).getTime() : 0;
        }
        if (typeof av === "number" || !isNaN(Number(av))) {
          av = Number(av);
          bv = Number(bv);
        }
        return order === "ASC" ? (av > bv ? 1 : av < bv ? -1 : 0) : av < bv ? 1 : av > bv ? -1 : 0;
      });

      // Pagination
      const totalRecords = results.length;
      const start = (page - 1) * limit;
      const paginated = results.slice(start, start + limit);

      return {
        data: paginated,
        total: totalRecords,
        page,
        limit,
        totalPages: Math.ceil(totalRecords / limit),
      };
    } catch (error) {
      logger.error(`[penyesuaian.service] Error getResumeByKdtk: ${error.message}`);
      throw error;
    }
  }

  /**
   * Ambil resume nilai per KDTK dari file JSON (tanpa query DB)
   */
  async getSingleResumeKdtk(options = {}) {
    const { periode, kdtk } = options;

    try {
      await this.ensureDataLoaded(periode);
      await storeService.ensureInitialized();

      let filtered = this.penyesuaianData.filter(i => i.PERIODE === periode && i.KDTK === kdtk);

      // Ambil nama toko dari storeService
      let results = [];
      for (const item of filtered) {
        let storeName = "-";
        try {
          const storeInfo = await storeService.getStoreByCode(item.KDTK);
          if (storeInfo?.storeName) storeName = storeInfo.storeName;
        } catch {
          logger.warn(`[penyesuaian.service] Nama toko tidak ditemukan untuk ${item.KDTK}`);
        }
        results.push({
          CABANG: item.CABANG,
          PERIODE: item.PERIODE,
          KDTK: item.KDTK,
          NAMA: storeName,
          SESUAI: Number(item.SESUAI.toFixed(2)),
          UPDTIME: item.UPDTIME,
        });
      }

      results = await this.enrichWithNotes(results);

      return results;
    } catch (error) {
      logger.error(`[penyesuaian.service] Error getSingleResumeKdtk: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get all records without pagination and filtering from JSON file
   * Only return RECID='*' records
   * @param {Object} options - Query options
   * @returns {Promise<Object>} All records
   */
  async getAll(options = {}) {
    const { cabang, periode } = options;

    try {
      // Ensure data is loaded from JSON file for requested period
      await this.ensureDataLoaded(periode);

      // Build filter function (includes RECID='*' filter)
      const filterFn = this.buildFilterFunction({ cabang, periode });

      // Filter data
      let filteredData = this.penyesuaianData.filter(filterFn);

      const enrichedData = await this.enrichWithNotes(filteredData);

      return {
        data: enrichedData,
      };
    } catch (error) {
      logger.error(`[penyesuaian.service] Error getting all records: ${error.message}`);
      throw error;
    }
  }

  //buat function untuk melihat detail langsung open connection ke store, tanpa cache, tanpa json file, tanpa summary, langsung query ke store
  async getDetailFromStore(kdtk, strPeriode) {
    try {
      const strYear = moment(strPeriode, "YYMM").format("YYYY");
      const strMonth = moment(strPeriode, "YYMM").format("MM");
      const results = { success: false, records: [], hasIssue: false };
      const filetToko = this.getFiletTokoTableName(kdtk, strPeriode);
      const query = config.queries.fullDetail(filetToko, strPeriode);
      await storeService.ensureInitialized();
      const storeIp = await storeService.getStoreIPHost(kdtk);

      if (!storeIp) {
        throw new Error(`Store IP info not found for ${kdtk}`);
      }
      const storeConnection = await dbStore.createDbStore(storeIp.dbHost, config.connectionRetry.maxRetries);

      if (!storeConnection) {
        throw new Error(`Connection to store ${kdtk} has failed to open!`);
      }
      const [detailResult] = await storeConnection.query(query, [strMonth, strYear, strMonth, strYear]);
      //insert detail ke table sesuai_toko
      if (detailResult.length > 0) {
        // Normalize field names to match model (uppercase)
        const normalizedRecords = detailResult.map(record => ({
          RECID: "*", // Default value for tracking
          CABANG: record.CAB,
          PERIODE: record.PERIODE,
          KDTK: record.KDTK,
          PRDCD: record.PRDCD,
          SINGKATAN: record.SINGKATAN,
          RECID_PRODMAST: record.RECID_PRODMAST,
          PTAG: record.PTAG,
          BEGBAL: record.BEGBAL,
          TRFIN: record.TRFIN,
          TRFOUT: record.TRFOUT,
          RP_SALES: record.RP_SALES,
          RP_RETUR_SALES: record.RP_RETUR_SALES,
          ADJ: record.ADJ,
          BA: record.BA,
          BS: record.BS,
          ACOST: record.ACOST,
          LCOST: record.lcost,
          STOCK: record.stock,
          RP_STOCK: record.rp_stock,
          SESUAI: record.sesuai,
          UPDTIME: new Date(),
        }));

        //hapus dulu data detail di sesuai_toko
        await SesuaiToko.destroy({
          where: { kdtk: kdtk, periode: strPeriode },
        });

        // Bulk create records to database (detail table)
        await SesuaiToko.bulkCreate(normalizedRecords);

        results.records = normalizedRecords;
        results.hasIssue = true; // Store has issues
        results.success = true;
      } else {
        results.success = true; // Below threshold is still success
        results.hasIssue = false; // No issues
      }
      return results;
    } catch (error) {
      logger.error(`[penyesuaian.service] Error getting detail from store: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get all records (with cache, search, sort, and pagination in-memory)
   * Includes cache cleanup and robust error handling
   */
  async getAllRecords(options = {}) {
    const {
      page = 1,
      limit = 10,
      kdtk,
      cabang,
      periode,
      searchQuery,
      sortColumn = "SESUAI", // default: urutkan berdasarkan SESUAI
      sortOrder = "DESC",
    } = options;

    try {
      // 🧩 Validasi input
      if (!periode) throw new Error("Periode wajib diisi");

      // 🧹 Bersihkan cache lama dulu
      this.cleanupCache();

      const key = this.generateCacheKey(periode, cabang, kdtk);
      const now = Date.now();

      let cacheEntry = this.cacheDetailData.get(key);

      let warning = null;

      // 🔄 Cek apakah cache masih valid
      if (!cacheEntry || !this.isCacheValid(cacheEntry)) {
        let freshData;
        try {
          freshData = await this.loadRecordsDetailFromDb({
            periode,
            cabang,
            kdtk,
          });
        } catch (loadError) {
          if (loadError.code === "STORE_BELOW_THRESHOLD") {
            freshData = [];
            warning = loadError.message;
          } else {
            throw loadError;
          }
        }
        cacheEntry = {
          data: freshData,
          lastFetchTime: now,
          lastAccessTime: now,
        };
        this.cacheDetailData.set(key, cacheEntry);
        logger.info(`[penyesuaian.service] Cache refreshed for key=${key}`);
      } else {
        // ⏳ Perpanjang TTL (karena ada aktivitas)
        cacheEntry.lastAccessTime = now;
        this.cacheDetailData.set(key, cacheEntry);
        logger.debug(`[penyesuaian.service] Cache hit for key=${key}`);
      }

      let filteredData = [...cacheEntry.data];

      // 🔍 Search (optional)
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        filteredData = filteredData.filter(item =>
          ["PRDCD", "SINGKATAN", "SESUAI"].some(
            field => item[field] && item[field].toString().toLowerCase().includes(q),
          ),
        );
      }

      // 📊 Sorting (numeric-aware)
      const allowedSortColumns = [
        "RECID",
        "CABANG",
        "PERIODE",
        "KDTK",
        "PRDCD",
        "SINGKATAN",
        "RECID_PRODMAST",
        "PTAG",
        "BEGBAL",
        "TRFIN",
        "TRFOUT",
        "RP_SALES",
        "RP_RETUR_SALES",
        "ADJ",
        "BA",
        "BS",
        "ACOST",
        "LCOST",
        "STOCK",
        "RP_STOCK",
        "SESUAI",
        "UPDTIME",
      ];

      const col = allowedSortColumns.includes(sortColumn) ? sortColumn : "UPDTIME";
      const order = sortOrder?.toUpperCase() === "ASC" ? "ASC" : "DESC";

      filteredData.sort((a, b) => {
        let av = a[col];
        let bv = b[col];

        if (col === "UPDTIME") {
          av = av ? new Date(av).getTime() : 0;
          bv = bv ? new Date(bv).getTime() : 0;
        } else if (isNumericString(av) && isNumericString(bv)) {
          av = toNumber(av);
          bv = toNumber(bv);
        } else {
          av = (av || "").toString();
          bv = (bv || "").toString();
        }

        if (av === bv) return 0;
        return order === "ASC" ? (av > bv ? 1 : -1) : av < bv ? 1 : -1;
      });

      // 📄 Pagination
      const totalRecords = filteredData.length;
      const start = (page - 1) * limit;
      const paginated = filteredData.slice(start, start + limit);

      // 🔢 Format numbering di tahap akhir (tanpa ubah logic sorting)
      const formattedData = paginated.map(row => {
        const formattedRow = {};
        for (const [key, value] of Object.entries(row)) {
          formattedRow[key] = isNumericString(value) && key !== `PRDCD` ? formatNumber(value) : value;
        }
        return formattedRow;
      });

      // 🚀 Return hasil akhir
      const result = {
        data: formattedData,
        total: totalRecords,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(totalRecords / limit),
        fromCache: true,
      };
      if (warning) result.warning = warning;
      return result;
    } catch (error) {
      logger.error(`[penyesuaian.service] Error in getAllRecords: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get record by primary key
   */
  async getRecord(cabang, kdtk, periode, prdcd) {
    try {
      const record = await SesuaiToko.findOne({
        where: {
          CABANG: cabang,
          KDTK: kdtk,
          PERIODE: periode,
          PRDCD: prdcd,
        },
      });

      return record;
    } catch (error) {
      logger.error(`[penyesuaian.service] Error getting record: ${error.message}`);
      throw error;
    }
  }

  /**
   * Parse snapshot dari noteText yang disimpan dengan format pipelane:
   *   {noteText}|{snapshotSesuai}|{snapshotUpdtime}
   *
   * @param {string} fullNoteText - Raw noteText dari DB (dengan atau tanpa snapshot)
   * @param {Object|null} freshSnapshot - Snapshot terbaru (opsional, untuk response simpan)
   * @returns {{ noteText: string, snapshot: Object|null }}
   */
  parseNoteSnapshot(fullNoteText, freshSnapshot = null) {
    if (!fullNoteText) {
      return { noteText: "", snapshot: null };
    }

    // Jika ada freshSnapshot dari save (response), langsung parse tanpa split
    if (freshSnapshot) {
      return {
        noteText: fullNoteText,
        snapshot: {
          sesuaSaatNote: freshSnapshot.snapshotSesuai,
          updtimeSaatNote: freshSnapshot.snapshotUpdtime,
        },
      };
    }

    // Split dari belakang: ambil 2 segmen terakhir sebagai snapshot
    const parts = fullNoteText.split("|");

    if (parts.length < 3) {
      // Legacy note — tanpa snapshot
      return { noteText: fullNoteText, snapshot: null };
    }

    const snapshotSesuaiRaw = parts[parts.length - 2];
    const snapshotUpdtimeRaw = parts[parts.length - 1];
    const cleanNoteText = parts.slice(0, -2).join("|");

    // Validasi format snapshot: angka integer + datetime
    if (!/^-?\d+$/.test(snapshotSesuaiRaw) || !/^\d{4}-\d{2}-\d{2}/.test(snapshotUpdtimeRaw)) {
      return { noteText: fullNoteText, snapshot: null };
    }

    return {
      noteText: cleanNoteText,
      snapshot: {
        sesuaSaatNote: parseInt(snapshotSesuaiRaw, 10),
        updtimeSaatNote: snapshotUpdtimeRaw,
      },
    };
  }

  /**
   * Merge notes and category info into penyesuaianData
   * Parse snapshot dari noteText yang disimpan dengan format pipelane
   */
  async enrichWithNotes(data) {
    try {
      const notes = await notesService.getAll();

      const notesByKey = new Map(notes.filter(n => n.tableName === "sesuai_toko").map(n => [n.unixKey, n]));

      let enrichedData = data.map(item => {
        const unixKey = `${item.KDTK}${item.PERIODE}`;
        const note = notesByKey.get(unixKey) || null;

        if (!note) {
          return { ...item, note: null };
        }

        // ✨ Parse snapshot dari noteText
        const parsed = this.parseNoteSnapshot(note.noteText);

        return {
          ...item,
          note: {
            unixKey: note.unixKey,
            noteText: parsed.noteText,           // clean text tanpa snapshot
            pic: note.pic,
            fullName: note.fullName || null,
            updated_at: note.updated_at || null,
            snapshot: parsed.snapshot,           // { sesuaSaatNote, updtimeSaatNote } atau null
          },
        };
      });

      // --- FALLBACK LOGIC: Ambil dari in-memory cache (bukan langsung DB) ---
      const itemsWithoutNote = enrichedData.filter(item => !item.note);

      if (itemsWithoutNote.length > 0) {
        // Ambil periode dari data (gunakan elemen pertama sebagai referensi)
        const periode = data[0]?.PERIODE;

        // ✅ Opsi C: Cek TTL cache dulu. Jika expired → refresh sekali, lalu baca dari cache
        if (!this.isLegacyCacheValid(periode)) {
          logger.info(
            `[penyesuaian.service] Legacy notes cache expired/invalid, refreshing once for periode=${periode}...`,
          );
          await this.refreshLegacyNotesCache(data, periode);
        } else {
          logger.debug(
            `[penyesuaian.service] Legacy notes cache hit for periode=${periode} (${this.legacyNotesCache.size} entries)`,
          );
        }

        // Map ulang data → baca dari in-memory cache (no DB hit)
        enrichedData = enrichedData.map(item => {
          if (item.note) return item; // Sudah punya note dari sistem baru, skip

          const legacyIdNote = `${item.CABANG}${item.KDTK}${item.PERIODE}`;
          const legacyNote = this.legacyNotesCache.get(legacyIdNote);

          if (legacyNote) {
            // ✨ Parse snapshot dari legacy note juga
            const parsed = this.parseNoteSnapshot(legacyNote.noteText);

            return {
              ...item,
              note: {
                unixKey: legacyNote.unixKey,
                noteText: parsed.noteText,           // clean text tanpa snapshot
                pic: legacyNote.pic,
                fullName: legacyNote.fullName,
                updated_at: legacyNote.updated_at,
                snapshot: parsed.snapshot,           // { sesuaSaatNote, updtimeSaatNote } atau null
              },
            };
          }

          return item;
        });
      }

      return enrichedData;
    } catch (err) {
      logger.error(`[penyesuaian.service] Error enriching data with notes: ${err.message}`);
      return data;
    }
  }
  /**
   * Generate auto-note untuk suatu toko berdasarkan analisa item-item penyesuaian.
   *
   * Algoritma:
   *   1. Ambil semua item toko dari sesuai_toko (RECID='*')
   *   2. Jika semua item < |50.000| tapi total > |500.000| → minor accumulation
   *   3. Pilih 1-3 item dominan (jika item#1 > 50% total → 1 item saja)
   *   4. Deep dive ke storeInspector untuk item dominan
   *   5. Generate teks ringkas & simpan via notesService
   *
   * @param {Object} params
   * @param {string} params.cabang
   * @param {string} params.kdtk
   * @param {string} params.periode
   * @param {string} params.pic - Username pembuat note
   * @returns {Promise<Object>} Note yang sudah disimpan
   */
  async generateAutoNote({ cabang, kdtk, periode, pic }) {
    logger.info(`[penyesuaian.service] generateAutoNote: kdtk=${kdtk}, periode=${periode}`);
    const tableName = "sesuai_toko";
    const unixKey = `${kdtk}${periode}`;

    // 1. Ambil semua item toko dari sesuai_toko
    // Jika belum ada data detail (misal user belum klik Detail), tarik dulu dari store
    let model = await SesuaiToko.getModel();
    let items = await model.findAll({
      where: {
        KDTK: kdtk,
        PERIODE: periode,
        RECID: "*",
      },
    });

    if (!items || items.length === 0) {
      logger.info(`[penyesuaian.service] generateAutoNote: data detail ${kdtk}/${periode} kosong, menarik dari store...`);
      await this.getDetailFromStore(kdtk, periode);
      // Re-query setelah data ditarik
      model = await SesuaiToko.getModel();
      items = await model.findAll({
        where: {
          KDTK: kdtk,
          PERIODE: periode,
          RECID: "*",
        },
      });
    }

    if (!items || items.length === 0) {
      throw new Error(`Data detail untuk toko ${kdtk} periode ${periode} tetap kosong setelah ditarik dari store`);
    }

    const rawItems = items.map(r => r.toJSON());
    const totalSesuai = rawItems.reduce((s, i) => s + (Number(i.SESUAI) || 0), 0);
    const absTotal = rawItems.reduce((s, i) => s + Math.abs(Number(i.SESUAI) || 0), 0);
    const maxAbsItem = Math.max(...rawItems.map(i => Math.abs(Number(i.SESUAI) || 0)));

    let noteText = "";

    // 2. CEK MINOR ACCUMULATION
    // Jika semua item < |50.000| → minor accumulation (tidak ada item dominan)
    // Tidak perlu cek absTotal > 500rb karena toko pasti > toleransi (muncul di resume)
    const MINOR_THRESHOLD = 50000;
    const isMinorAccumulation = maxAbsItem < MINOR_THRESHOLD;

    if (isMinorAccumulation) {
      const arah = totalSesuai >= 0 ? "kenaikan" : "penurunan";
      noteText =
        `Tidak ada penyesuaian nilai HPP yang signifikan pada item tertentu, ` +
        `karena angka penyesuaian yang muncul merupakan akumulasi ${arah} ` +
        `nilai barang dari selisih harga yang minor di berbagai item, ` +
        `bukan karena adanya perbedaan yang signifikan pada satu produk tertentu.`;

      logger.info(`[penyesuaian.service] generateAutoNote ${kdtk}/${periode}: minor accumulation (${absTotal})`);
    } else {
      // 3. PILIH ITEM DOMINAN (sesuai arah total penyesuaian)
      // Jika total plus → cari item dengan SESUAI positif (penyebab kenaikan)
      // Jika total minus → cari item dengan SESUAI negatif (penyebab penurunan)
      const isTotalPlus = totalSesuai >= 0;
      const sameDirItems = rawItems.filter(i => isTotalPlus
        ? Number(i.SESUAI) > 0
        : Number(i.SESUAI) < 0
      );
      let sameDirAbsTotal = sameDirItems.reduce(
        (s, i) => s + Math.abs(Number(i.SESUAI) || 0), 0
      );

      let sorted = [...sameDirItems]
        .map(i => ({ ...i, absSesuai: Math.abs(Number(i.SESUAI) || 0) }))
        .sort((a, b) => b.absSesuai - a.absSesuai);

      if (sorted.length === 0) {
        // Fallback: jika tidak ada item searah (aneh), ambil item terbesar secara abs
        sorted = [...rawItems]
          .map(i => ({ ...i, absSesuai: Math.abs(Number(i.SESUAI) || 0) }))
          .sort((a, b) => b.absSesuai - a.absSesuai);
        sameDirAbsTotal = absTotal;
      }

      const candidates = [];
      for (const item of sorted) {
        if (candidates.length === 0) {
          candidates.push(item);
          if (item.absSesuai / sameDirAbsTotal > 0.5) break; // 1 item > 50%, cukup
        } else if (candidates.length < 3) {
          candidates.push(item);
        } else {
          break;
        }
      }

      // 4. DEEP DIVE via storeInspector
      const storeInfo = await storeService.getStoreByCode(kdtk);
      const storeName = storeInfo?.storeName || kdtk;

      const lines = [`Analisa item penyesuaian - ${storeName} (${kdtk}) - Periode ${periode}`];

      for (const item of candidates) {
        const prdcd = item.PRDCD;
        const nama = item.SINGKATAN || prdcd;
        const sesuiVal = Number(item.SESUAI) || 0;
        const begbal = Number(item.BEGBAL) || 0;

        let detailInfo = `Rp ${Math.abs(sesuiVal).toLocaleString("en-US")}`;

        try {
          const analysis = await storeInspectorService.inspect({
            kdtk,
            prdcd,
            periode,
            begbal,
          });

          const acostAnalysis = analysis.acostAnalysis;
          const changes = acostAnalysis.changes || [];

          if (acostAnalysis.cause === "transaction_evidence" && changes.length > 0) {
            // Ambil perubahan pertama yang signifikan untuk diringkas
            const firstChange = changes[0];
            const tgl = firstChange.tanggal
              ? moment(firstChange.tanggal).format("DD MMMM YYYY")
              : "";
            const hargaDari = Number(firstChange.dari).toLocaleString("en-US");
            const hargaKe = Number(firstChange.ke).toLocaleString("en-US");
            const sourceLabel = {
              bpb_i: "BPB/Transfer Masuk",
              retur_k: "Retur",
              trfout_o: "Transfer Keluar",
              konversi_bm: "Konversi Racikan",
              ba: "Barang Afkir",
              bs: "Barang Rusak",
              stock_opname: "Stock Opname",
              mtran_hpp: "Penjualan (HPP)",
            }[firstChange.source] || firstChange.source;

            detailInfo = `${sourceLabel} — harga berubah ${tgl ? `per ${tgl} ` : ""}dari Rp ${hargaDari} menjadi Rp ${hargaKe}`;

            // Cek apakah retur K dengan LCOST match
            if (
              firstChange.source === "retur_k" &&
              firstChange.lcostMatch === true
            ) {
              detailInfo += " (LCOST sesuai rule)";
            }
          } else if (acostAnalysis.cause === "protect_sync") {
            detailInfo = "Item BKL — harga sync dengan protect";
          } else if (acostAnalysis.cause === "protect_mismatch") {
            detailInfo =
              `Item BKL — harga mismatch dengan protect (ACOST: Rp ${Number(acostAnalysis.acostSekarang).toLocaleString("en-US")}, ` +
              `Protect: Rp ${Number(acostAnalysis.hargablProtect).toLocaleString("en-US")})`;
          } else if (acostAnalysis.cause === "unexplained_acost_anomaly") {
            detailInfo = `Perubahan harga tanpa transaksi tercatat (BEGBAL: Rp ${Number(acostAnalysis.begbal).toLocaleString("en-US")}, ACOST: Rp ${Number(acostAnalysis.acostSekarang).toLocaleString("en-US")})`;
          }
        } catch (inspectErr) {
          logger.warn(
            `[penyesuaian.service] Gagal deep dive ${kdtk}/${prdcd}: ${inspectErr.message}`,
          );
          // Fallback: berdasarkan data sesuai_toko
          detailInfo += ` (data dari sesuai_toko — BEGBAL: Rp ${begbal.toLocaleString("en-US")})`;
        }

        const arah = sesuiVal >= 0 ? "kenaikan" : "penurunan";
        lines.push(
          `• ${nama} - ${prdcd}: ${arah} Rp ${Math.abs(sesuiVal).toLocaleString("en-US")} — ${detailInfo}`,
        );
      }

      noteText = lines.join("\n");
      logger.info(`[penyesuaian.service] generateAutoNote ${kdtk}/${periode}: ${candidates.length} item(s) dianalisa`);
    }

    // 5. SIMPAN NOTE (dengan snapshot)
    const snapshot = await this.getSnapshotSesuai(cabang, kdtk, periode);
    let fullNoteText = noteText;
    if (snapshot) {
      fullNoteText = `${noteText}|${snapshot.snapshotSesuai}|${snapshot.snapshotUpdtime}`;
    }

    const noteData = {
      Cabang: cabang,
      unixKey,
      noteText: fullNoteText,
      pic: pic || "system",
      categoryId: null,
      tableName,
    };

    const note = await notesService.upsert(noteData);
    const parsed = this.parseNoteSnapshot(noteText, snapshot);

    const us = new UserService();
    const user = await us.findByCredentials(pic);

    const result = {
      ...note.toJSON(),
      noteText: parsed.noteText,
      snapshot: parsed.snapshot,
      fullName: user?.fullName || null,
    };

    return result;
  }

  /**
   * Ambil snapshot SESUAI dari sesuai_toko_summary untuk disimpan bersama note.
   */
  async getSnapshotSesuai(cabang, kdtk, periode) {
    try {
      const summary = await SesuaiTokoSummary.findOne({
        where: { CABANG: cabang, KDTK: kdtk, PERIODE: periode },
      });
      if (!summary) return null;

      const snapshotSesuai = Math.round(Number(summary.SESUAI) || 0);
      const formatLocal = (d) => {
        const date = d instanceof Date ? d : new Date(d);
        const pad = n => String(n).padStart(2, "0");
        return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
      };
      const snapshotUpdtime = summary.UPDTIME
        ? formatLocal(summary.UPDTIME)
        : formatLocal(new Date());

      return { snapshotSesuai, snapshotUpdtime };
    } catch (err) {
      logger.warn(`[penyesuaian.service] Gagal mengambil snapshot SESUAI: ${err.message}`);
      return null;
    }
  }

  /**
   * Get the single max positive and single max negative item per cabang.
   * Query langsung sesuai_toko untuk nilai SESUAI ekstrem per cabang.
   * @param {string} periode - Period in YYMM format
   * @returns {Promise<Object>} Branch extreme values
   */
  async getBranchExtremes(periode) {
    if (!periode) throw new Error("Periode wajib diisi");

    // 🔄 Cek cache dulu
    const cached = this.branchExtremesCache.get(periode);
    if (cached && Date.now() - cached.cachedAt < this.aggregateCacheTTL) {
      logger.debug(`[penyesuaian.service] Branch extremes cache HIT for periode=${periode}`);
      return cached.data;
    }
    logger.debug(`[penyesuaian.service] Branch extremes cache MISS for periode=${periode}, querying DB...`);

    try {
      await storeService.ensureInitialized();

      const model = await SesuaiToko.getModel();
      const sequelize = model.sequelize;
      const { Sequelize } = await import("sequelize");

      // Query: max positive (item dgn SESUAI positif tertinggi) per cabang
      const maxPositiveQuery = `
        SELECT a.CABANG, a.PRDCD, a.SINGKATAN, a.KDTK, CAST(a.SESUAI AS SIGNED) AS SESUAI
        FROM sesuai_toko a
        INNER JOIN (
          SELECT CABANG, MAX(SESUAI) AS max_val
          FROM sesuai_toko
          WHERE PERIODE = :periode AND RECID = '*' AND SESUAI > 0
          GROUP BY CABANG
        ) b ON a.CABANG = b.CABANG AND a.SESUAI = b.max_val
        WHERE a.PERIODE = :periode AND a.RECID = '*'
        ORDER BY a.CABANG
      `;

      // Query: min negative (item dgn SESUAI negatif terendah) per cabang
      const maxNegativeQuery = `
        SELECT a.CABANG, a.PRDCD, a.SINGKATAN, a.KDTK, CAST(a.SESUAI AS SIGNED) AS SESUAI
        FROM sesuai_toko a
        INNER JOIN (
          SELECT CABANG, MIN(SESUAI) AS min_val
          FROM sesuai_toko
          WHERE PERIODE = :periode AND RECID = '*' AND SESUAI < 0
          GROUP BY CABANG
        ) b ON a.CABANG = b.CABANG AND a.SESUAI = b.min_val
        WHERE a.PERIODE = :periode AND a.RECID = '*'
        ORDER BY a.CABANG
      `;

      // Query: semua cabang unik yang punya data
      const cabangQuery = `
        SELECT DISTINCT CABANG
        FROM sesuai_toko
        WHERE PERIODE = :periode AND RECID = '*'
        ORDER BY CABANG
      `;

      const [maxPositiveRows, maxNegativeRows, cabangRows] = await Promise.all([
        sequelize.query(maxPositiveQuery, {
          replacements: { periode },
          type: Sequelize.QueryTypes.SELECT,
        }),
        sequelize.query(maxNegativeQuery, {
          replacements: { periode },
          type: Sequelize.QueryTypes.SELECT,
        }),
        sequelize.query(cabangQuery, {
          replacements: { periode },
          type: Sequelize.QueryTypes.SELECT,
        }),
      ]);

      // Index by CABANG for fast lookup
      const maxPosByCab = {};
      for (const r of maxPositiveRows) {
        if (!maxPosByCab[r.CABANG] || Math.abs(Number(r.SESUAI)) > Math.abs(Number(maxPosByCab[r.CABANG].SESUAI))) {
          maxPosByCab[r.CABANG] = { prdcd: r.PRDCD, name: r.SINGKATAN, kdtk: r.KDTK, sesui: Math.round(Number(r.SESUAI)) };
        }
      }

      const maxNegByCab = {};
      for (const r of maxNegativeRows) {
        if (!maxNegByCab[r.CABANG] || Math.abs(Number(r.SESUAI)) > Math.abs(Number(maxNegByCab[r.CABANG].SESUAI))) {
          maxNegByCab[r.CABANG] = { prdcd: r.PRDCD, name: r.SINGKATAN, kdtk: r.KDTK, sesui: Math.round(Number(r.SESUAI)) };
        }
      }

      // Build branch name map from storeService's in-memory cache
      const branchNameMap = new Map();
      try {
        const allStores = storeService.stores;
        if (allStores && allStores.length > 0) {
          for (const s of allStores) {
            const branchCode = s.branch || s.cab;
            if (branchCode && !branchNameMap.has(branchCode)) {
              branchNameMap.set(branchCode, s.branchName || s.namaCabang || branchCode);
            }
          }
        }
      } catch {}

      const results = [];
      for (const row of cabangRows) {
        const cab = row.CABANG;
        results.push({
          cabang: cab,
          namaCabang: branchNameMap.get(cab) || cab,
          maxPositive: maxPosByCab[cab] || null,
          maxNegative: maxNegByCab[cab] || null,
        });
      }

      const result = {
        data: results,
        total: results.length,
      };

      // 📦 Simpan ke cache
      this.branchExtremesCache.set(periode, { data: result, cachedAt: Date.now() });
      logger.debug(`[penyesuaian.service] Branch extremes cached for periode=${periode}`);

      return result;
    } catch (error) {
      logger.error(`[penyesuaian.service] Error getting branch summary: ${error.message}`);
      // Hapus cache yang mungkin corrupt
      this.branchExtremesCache.delete(periode);
      throw error;
    }
  }

  /**
   * Get top 10 items causing adjustments in a specific branch.
   * Query langsung sesuai_toko diurutkan oleh ABS(SESUAI) DESC.
   * @param {string} cabang - Branch code
   * @param {string} periode - Period in YYMM format
   * @returns {Promise<Object>} Top items for the branch
   */
  async getBranchTopItems(cabang, periode) {
    if (!periode) throw new Error("Periode wajib diisi");
    if (!cabang) throw new Error("Cabang wajib diisi");

    // 🔄 Cek cache dulu
    const cacheKey = `${cabang}:${periode}`;
    const cached = this.branchTopItemsCache.get(cacheKey);
    if (cached && Date.now() - cached.cachedAt < this.aggregateCacheTTL) {
      logger.debug(`[penyesuaian.service] Branch top items cache HIT for key=${cacheKey}`);
      return cached.data;
    }
    logger.debug(`[penyesuaian.service] Branch top items cache MISS for key=${cacheKey}, querying DB...`);

    try {
      const model = await SesuaiToko.getModel();
      const sequelize = model.sequelize;
      const { Sequelize } = await import("sequelize");

      // Query top items by absolute SESUAI value
      const query = `
        SELECT
          PRDCD,
          SINGKATAN,
          KDTK,
          CAST(SESUAI AS SIGNED) AS SESUAI
        FROM sesuai_toko
        WHERE PERIODE = :periode AND CABANG = :cabang AND RECID = '*'
        ORDER BY ABS(SESUAI) DESC
        LIMIT 10
      `;

      const rows = await sequelize.query(query, {
        replacements: { periode, cabang },
        type: Sequelize.QueryTypes.SELECT,
      });

      // Enrich with store names
      const items = [];
      for (const r of rows) {
        let storeName = r.KDTK;
        try {
          const storeInfo = await storeService.getStoreByCode(r.KDTK);
          if (storeInfo?.storeName) storeName = storeInfo.storeName;
        } catch {}

        items.push({
          prdcd: r.PRDCD,
          name: r.SINGKATAN,
          sesui: Math.round(Number(r.SESUAI)),
          kdtk: r.KDTK,
          storeName,
        });
      }

      // Count total items in this branch
      const countQuery = `
        SELECT COUNT(*) AS total FROM sesuai_toko
        WHERE PERIODE = :periode AND CABANG = :cabang AND RECID = '*'
      `;
      const [countRow] = await sequelize.query(countQuery, {
        replacements: { periode, cabang },
        type: Sequelize.QueryTypes.SELECT,
      });

      const result = {
        data: items,
        total: items.length,
        totalRecords: Number(countRow?.total) || 0,
      };

      // 📦 Simpan ke cache
      this.branchTopItemsCache.set(cacheKey, { data: result, cachedAt: Date.now() });
      logger.debug(`[penyesuaian.service] Branch top items cached for key=${cacheKey}`);

      return result;
    } catch (error) {
      logger.error(`[penyesuaian.service] Error getting branch top items: ${error.message}`);
      // Hapus cache yang mungkin corrupt
      this.branchTopItemsCache.delete(cacheKey);
      throw error;
    }
  }

  /**
   * Get store-level insights from detail records.
   * Identifies top items contributing to the store's total SESUAI,
   * filtered by sign direction (plus/minus) matching the store total.
   */
  async getStoreInsights(kdtk, periode, cabang = null) {
    const records = await this.loadRecordsDetailFromDb({ periode, kdtk, cabang });

    if (!records || records.length === 0) {
      return {
        totalSesuai: 0,
        totalItems: 0,
        signDirection: "neutral",
        contributingItems: 0,
        filteredTotal: 0,
        topItems: [],
        paretoInfo: { itemsFor80Percent: 0, totalItems: 0 },
      };
    }

    const totalSesuai = records.reduce((sum, r) => sum + (Number(r.SESUAI) || 0), 0);

    const signDirection = totalSesuai >= 0 ? "positive" : "negative";
    const signFiltered =
      totalSesuai >= 0
        ? records.filter((r) => Number(r.SESUAI) > 0)
        : records.filter((r) => Number(r.SESUAI) < 0);

    const sorted = [...signFiltered].sort((a, b) => Math.abs(b.SESUAI) - Math.abs(a.SESUAI));

    const filteredTotal = sorted.reduce((sum, r) => sum + Math.abs(Number(r.SESUAI)), 0);

    const topItems = sorted.slice(0, 5).map((r) => ({
      prdcd: r.PRDCD,
      name: r.SINGKATAN,
      sesui: Number(r.SESUAI),
      absSesuai: Math.abs(Number(r.SESUAI)),
      contributionPercent: filteredTotal > 0 ? Math.round((Math.abs(Number(r.SESUAI)) / filteredTotal) * 100) : 0,
    }));

    let cumulative = 0;
    const paretoCount = sorted.filter((r) => {
      cumulative += Math.abs(Number(r.SESUAI));
      return cumulative / filteredTotal <= 0.8;
    }).length;

    return {
      totalSesuai: Math.round(totalSesuai),
      totalItems: records.length,
      signDirection,
      contributingItems: signFiltered.length,
      filteredTotal: Math.round(filteredTotal),
      topItems,
      paretoInfo: {
        itemsFor80Percent: paretoCount,
        totalItems: signFiltered.length,
      },
    };
  }
}

export default new PenyesuaianService();
