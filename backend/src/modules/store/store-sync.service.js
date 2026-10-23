/**
 * Store master synchronization - merges TOKOMAIN.ini / master-tokomain.csv snapshot
 * with WRC master toko (kode cabang + nama toko) from all cabang.
 *
 * ATURAN CABANG (kebijakan baru):
 *  - m_cabang (master cabang) adalah SATU-SATUNYA sumber kebenaran cabang valid.
 *  - Resolusi cabang per toko berprioritas:
 *      1) kolom cabang dari sumber (TOKOMAIN.ini CABANG / master-tokomain.csv kdcab)
 *      2) peta WRC (mstr_toko_all) — hanya untuk cabang yang terdaftar di m_cabang
 *      3) cabang existing toko di stores.json
 *    Hanya kode yang terdaftar di m_cabang yang dipakai. Jika tidak ada satupun
 *    yang terdaftar, toko TIDAK boleh masuk / diperbarui di stores.json.
 *  - Cabang WRC yang tidak terdaftar di m_cabang tidak pernah dipakai (hanya dilapor).
 *  - Toko yang branch-nya punya nilai nyata tapi tak terdaftar dibersihkan dari
 *    stores.json (cleanupUnregisteredBranchStores) agar mass screening "All" dan
 *    riwayat mass scan hanya memuat cabang terdaftar.
 */
import fs from "fs/promises";
import path from "path";
import mysql from "mysql2/promise";
import ExcelJS from "exceljs";
import logger from "../../config/logger.js";
import WrcBulananService from "../../services/wrc.service.js";
import MCabangService from "../m_cabang/m_cabang.service.js";
import storeService from "./storeService.js";
import moment from "moment-timezone";

const LAST_SYNC_PATH = path.join(process.cwd(), "data/master-store-sync.json");
const MONITORING_CACHE_PATH = path.join(process.cwd(), "data/store-monitoring.json");
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

const WRC_TOKO_ALL_QUERY = `
  SELECT kode_toko AS kodeToko, nama_toko AS namaToko
  FROM poscabang.mstr_toko_all
  WHERE (tok_tgl_tutup = '0000-00-00' OR tok_tgl_tutup IS NULL OR tok_tgl_tutup >= CURDATE())
    AND tgl_buka <= CURDATE()
    AND tgl_buka != '0000-00-00'
`;

class StoreSyncService {
  constructor() {
    this.wrcService = new WrcBulananService();
  }

  async readLastSync() {
    try {
      const data = await fs.readFile(LAST_SYNC_PATH, "utf8");
      return JSON.parse(data);
    } catch (error) {
      if (error.code === "ENOENT") return null;
      if (error instanceof SyntaxError) {
        logger.warn("master-store-sync.json corrupted, ignoring");
        return null;
      }
      throw error;
    }
  }

  async writeLastSync(meta) {
    await fs.mkdir(path.dirname(LAST_SYNC_PATH), { recursive: true });
    await fs.writeFile(LAST_SYNC_PATH, JSON.stringify(meta, null, 2));
  }

  /**
   * Get sync status: latest TOKOMAIN snapshot meta + last sync meta
   */
  async getSyncStatus() {
    const snapshot = await storeService.getTokomainSnapshot();
    const lastSync = await this.readLastSync();

    return {
      snapshot: snapshot
        ? {
            updatedAt: snapshot.updatedAt,
            uploadedBy: snapshot.uploadedBy,
            deviceId: snapshot.deviceId,
            clientIp: snapshot.clientIp,
            sourcePath: snapshot.sourcePath,
            stats: snapshot.stats,
            count: snapshot.records?.length || 0,
          }
        : null,
      lastSync,
    };
  }

  /**
   * Query mstr_toko_all from a single cabang WRC. Graceful: failure -> [].
   * @param {string} cab - Branch code
   * @returns {Promise<{cab: string, rows: Array}>}
   */
  async fetchWrcStores(cab) {
    let connection = null;
    try {
      connection = await mysql.createConnection(await this.wrcService.getConnWRC(cab));
      const [rows] = await connection.query(WRC_TOKO_ALL_QUERY);
      logger.info(`[store-sync] WRC ${cab}: ${rows?.length || 0} toko aktif dari mstr_toko_all`);
      return { cab, rows: rows || [] };
    } catch (error) {
      logger.warn(`[store-sync] WRC query gagal untuk cabang ${cab}: ${error.message}`);
      return { cab, rows: [] };
    } finally {
      if (connection) {
        await connection.end().catch(() => {});
      }
    }
  }

  /**
   * Resolusi cabang terdaftar untuk satu toko, dengan urutan prioritas:
   *   1) kolom cabang dari sumber snapshot (TOKOMAIN.ini / master CSV)
   *   2) peta WRC (mstr_toko_all)
   *   3) cabang existing toko di stores.json
   * Hanya kode yang terdaftar di m_cabang yang dikembalikan. Jika tidak ada
   * satupun yang terdaftar -> null (toko tidak boleh masuk stores.json).
   *
   * @param {Object} p
   * @param {string} [p.sourceCab] - Kode cabang dari kolom sumber
   * @param {string} [p.wrcCab] - Kode cabang dari peta WRC
   * @param {string} [p.existingCab] - Cabang existing toko di stores.json
   * @param {Set<string>} p.registered - Set kdcab terdaftar di m_cabang
   * @returns {string|null}
   */
  _resolveRegisteredBranch({ sourceCab, wrcCab, existingCab, registered }) {
    const norm = v => String(v || "").trim().toUpperCase();
    const candidates = [norm(sourceCab), norm(wrcCab), norm(existingCab)];
    for (const cab of candidates) {
      if (cab && registered.has(cab)) return cab;
    }
    return null;
  }

  /**
   * Execute the master store sync (TOKOMAIN.ini + WRC).
   * @param {Object} user - Current user (req.user)
   * @param {boolean} force - Skip the 24-hour guard
   * @returns {Promise<Object>}
   */
  async syncMaster(user, force = false) {
    const snapshot = await storeService.getTokomainSnapshot();
    if (!snapshot || !snapshot.records || snapshot.records.length === 0) {
      return {
        success: false,
        needsSnapshot: true,
        message: "Belum ada data TOKOMAIN. Upload TOKOMAIN.ini terlebih dahulu.",
      };
    }

    const now = new Date();
    const lastSync = await this.readLastSync();
    const lastSyncedAt = lastSync?.lastSyncedAt ? new Date(lastSync.lastSyncedAt) : null;

    if (!force && lastSyncedAt && now - lastSyncedAt < TWENTY_FOUR_HOURS_MS) {
      return {
        success: false,
        needsConfirmation: true,
        lastSync,
        message: `Sync master toko baru saja dilakukan pada ${lastSync.lastSyncedAt} oleh ${lastSync.syncedBy}.`,
      };
    }

    logger.info(`[store-sync] Memulai sync master toko oleh ${user?.username || "system"} (force=${force})`);

    // Daftar cabang yang boleh masuk stores.json (master cabang)
    const registered = await storeService.getRegisteredCabangSet();

    // 1. Fetch WRC master toko dari semua cabang (paralel)
    let cabangs = [];
    try {
      cabangs = await this.wrcService.getAllCabangWrc();
    } catch (error) {
      logger.error(`[store-sync] getAllCabangWrc gagal: ${error.message}`);
      throw new Error(`Gagal mengambil daftar cabang WRC: ${error.message}`);
    }

    const unregisteredWrcCabangs = cabangs
      .map(c => String(c || "").trim().toUpperCase())
      .filter(c => c && !registered.has(c));

    const results = await Promise.all(cabangs.map(cab => this.fetchWrcStores(cab)));

    // Urutkan cabang agar urutan pemrosesan deterministik
    results.sort((a, b) => String(a.cab).localeCompare(String(b.cab)));

    // 2. Build map kodeToko -> { cab, nama }, HANYA untuk cabang terdaftar di m_cabang.
    //    Jika satu kode toko muncul di >1 cabang (anomali data), kode tsb
    //    dianggap ambigu dan di-skip (tidak mengubah branch yang mungkin sudah benar).
    const wrcMap = new Map();
    const duplicateCodes = [];
    for (const result of results) {
      const cabKey = String(result.cab || "").trim().toUpperCase();
      const cabRegistered = registered.has(cabKey);
      for (const row of result.rows) {
        const key = String(row.kodeToko).trim().toUpperCase();
        if (!key) continue;
        if (wrcMap.has(key)) {
          duplicateCodes.push(key);
          wrcMap.delete(key); // ambiguous: milik lebih dari 1 cabang -> jangan sentuh
          continue;
        }
        if (!cabRegistered) continue; // cabang tak terdaftar -> tidak dipakai (hanya dilapor)
        wrcMap.set(key, { cab: cabKey, nama: row.namaToko });
      }
    }

    logger.info(
      `[store-sync] Cabang terdaftar di m_cabang: ${registered.size}; cabang WRC tak terdaftar (diabaikan): ${unregisteredWrcCabangs.join(", ") || "-"}`,
    );

    // 3. Merge snapshot -> stores.json
    let created = 0;
    let updated = 0;
    let unchanged = 0;
    const skippedWrc = [];

    for (const record of snapshot.records) {
      const code = String(record.storeCode).toUpperCase();
      const info = wrcMap.get(code);
      const existing =
        record.type === "INDUK"
          ? await storeService.getStoreByCode(record.storeCode)
          : await storeService.getStoreByCodeAndStation(record.storeCode, record.station);

      const branch = this._resolveRegisteredBranch({
        sourceCab: record.cabang,
        wrcCab: info?.cab,
        existingCab: existing?.branch || existing?.cab,
        registered,
      });

      if (branch === null) {
        // Cabang tak terdaftar -> toko tidak boleh masuk / diperbarui di stores.json.
        // Existing ber-cabang karangan akan dibersihkan cleanupUnregisteredBranchStores().
        skippedWrc.push(record.storeCode);
        continue;
      }

      const storeData = {
        storeCode: record.storeCode,
        station: record.station,
        dbHost: record.ip,
        notes: record.type,
        storeName: info?.nama || record.storeCode,
        branch,
      };

      try {
        if (existing) {
          const isChanged =
            existing.dbHost !== storeData.dbHost ||
            existing.storeName !== storeData.storeName ||
            String(existing.branch || "").trim().toUpperCase() !== branch ||
            existing.notes !== storeData.notes;

          if (isChanged) {
            await storeService.updateStore(existing.id, storeData);
            updated++;
          } else {
            unchanged++;
          }
        } else {
          await storeService.upsertStore(storeData);
          created++;
        }
      } catch (error) {
        logger.warn(`[store-sync] Gagal memproses toko ${record.storeCode}: ${error.message}`);
      }
    }

    // 4. Bersihkan sisa toko ber-cabang tak terdaftar dari stores.json
    const cleanup = await storeService.cleanupUnregisteredBranchStores();

    // 5. Persist meta
    const syncMeta = {
      lastSyncedAt: now.toISOString(),
      syncedBy: user?.username || "system",
      syncedByFullName: user?.fullName || user?.username || "system",
      source: "TOKOMAIN.ini",
      summary: {
        snapshotCount: snapshot.records.length,
        induk: snapshot.stats?.induk || 0,
        stb: snapshot.stats?.stb || 0,
        registeredCabangs: registered.size,
        unregisteredWrcCabangs,
        wrcCabangs: cabangs.length,
        wrcToko: wrcMap.size,
        created,
        updated,
        unchanged,
        skippedWrcCount: skippedWrc.length,
        skippedWrc: skippedWrc,
        removedUnregistered: cleanup.removed,
        removedStores: cleanup.removedStores,
        duplicateWrcCodes: duplicateCodes,
      },
    };
    await this.writeLastSync(syncMeta);

    logger.info(
      `[store-sync] Selesai TOKOMAIN.ini: ${updated} updated, ${created} created, ${unchanged} unchanged, ${skippedWrc.length} skip (cabang tak terdaftar/tanpa WRC), ${cleanup.removed} dibersihkan`,
    );

    return { success: true, ...syncMeta };
  }

  /**
   * Execute master store sync from uploaded master-tokomain.csv.
   * Fasa 1: resolusi cabang (sumber kdcab -> WRC -> existing) + insert/update nama + IP.
   * Fasa 2: pastikan seluruh stores.json hanya berisi cabang terdaftar di m_cabang.
   * Fasa 3: bersihkan sisa toko ber-cabang tak terdaftar.
   *
   * Catatan:
   *   - Bagian yang mengandalkan db_edp.rekap_ip sengaja tidak dipakai di alur ini.
   *   - Cabang WRC yang tidak terdaftar di m_cabang tidak pernah dipakai (hanya dilapor).
   * @param {Object} user - Current user (req.user)
   * @param {boolean} force - Skip the 24-hour guard
   * @returns {Promise<Object>}
   */
  async syncFromMasterCsv(user, force = false) {
    const snapshot = await storeService.getMasterCsvSnapshot();
    if (!snapshot || !snapshot.records || snapshot.records.length === 0) {
      return {
        success: false,
        needsSnapshot: true,
        message: "Belum ada data master-tokomain.csv. Upload file CSV terlebih dahulu.",
      };
    }

    const now = new Date();
    const lastSync = await this.readLastSync();
    const lastSyncedAt = lastSync?.lastSyncedAt ? new Date(lastSync.lastSyncedAt) : null;

    if (!force && lastSyncedAt && now - lastSyncedAt < TWENTY_FOUR_HOURS_MS) {
      return {
        success: false,
        needsConfirmation: true,
        lastSync,
        message: `Data master toko baru saja di-update oleh ${lastSync.syncedByFullName || lastSync.syncedBy} pada ${lastSync.lastSyncedAt}. Apakah Anda yakin ingin melakukan proses update master toko lagi?`,
      };
    }

    logger.info(
      `[store-sync] Memulai sync master toko dari CSV oleh ${user?.fullName || user?.username || "system"} (force=${force})`,
    );

    // Daftar cabang yang boleh masuk stores.json (master cabang)
    const registered = await storeService.getRegisteredCabangSet();

    // Fasa 0: Fetch WRC master toko dari semua cabang (paralel) — untuk resolusi cabang
    let cabangs = [];
    try {
      cabangs = await this.wrcService.getAllCabangWrc();
    } catch (error) {
      logger.error(`[store-sync] getAllCabangWrc gagal: ${error.message}`);
      throw new Error(`Gagal mengambil daftar cabang WRC: ${error.message}`);
    }

    const unregisteredWrcCabangs = cabangs
      .map(c => String(c || "").trim().toUpperCase())
      .filter(c => c && !registered.has(c));

    const results = await Promise.all(cabangs.map(cab => this.fetchWrcStores(cab)));

    // Urutkan cabang agar urutan pemrosesan deterministik
    results.sort((a, b) => String(a.cab).localeCompare(String(b.cab)));

    // Build map kodeToko -> cab (HANYA untuk cabang terdaftar di m_cabang)
    const wrcMap = new Map();
    const duplicateCodes = [];
    for (const result of results) {
      const cabKey = String(result.cab || "").trim().toUpperCase();
      const cabRegistered = registered.has(cabKey);
      for (const row of result.rows) {
        const key = String(row.kodeToko).trim().toUpperCase();
        if (!key) continue;
        if (wrcMap.has(key)) {
          duplicateCodes.push(key);
          wrcMap.delete(key); // ambiguous: milik lebih dari 1 cabang -> jangan sentuh
          continue;
        }
        if (!cabRegistered) continue; // cabang tak terdaftar -> tidak dipakai (hanya dilapor)
        wrcMap.set(key, cabKey);
      }
    }

    logger.info(
      `[store-sync] Cabang terdaftar di m_cabang: ${registered.size}; cabang WRC tak terdaftar (diabaikan): ${unregisteredWrcCabangs.join(", ") || "-"}`,
    );

    // Peta cepat record snapshot per kode toko (untuk kolom kdcab sumber pada Fasa 2)
    const snapshotByCode = new Map();
    for (const record of snapshot.records) {
      snapshotByCode.set(String(record.storeCode).toUpperCase(), record);
    }

    // Fasa 1: resolusi cabang + insert/update nama + IP
    let created = 0;
    let updatedIp = 0;
    let unchangedIp = 0;
    let branchAssigned = 0;
    const skippedUnregistered = [];

    for (const record of snapshot.records) {
      const code = String(record.storeCode).toUpperCase();
      const existing =
        record.type === "INDUK"
          ? await storeService.getStoreByCode(record.storeCode)
          : await storeService.getStoreByCodeAndStation(record.storeCode, record.station);

      const branch = this._resolveRegisteredBranch({
        sourceCab: record.cabang,
        wrcCab: wrcMap.get(code),
        existingCab: existing?.branch || existing?.cab,
        registered,
      });

      if (branch === null) {
        // Cabang tak terdaftar -> toko tidak boleh masuk / diperbarui di stores.json.
        // Existing ber-cabang karangan akan dibersihkan cleanupUnregisteredBranchStores().
        skippedUnregistered.push(record.storeCode);
        continue;
      }

      const storeData = {
        storeCode: record.storeCode,
        station: record.station,
        dbHost: record.ip,
        notes: record.type,
        storeName: record.storeName,
        branch,
      };

      try {
        if (existing) {
          const isIpOrNameChanged =
            existing.dbHost !== storeData.dbHost || existing.storeName !== storeData.storeName;
          const isBranchChanged = String(existing.branch || "").trim().toUpperCase() !== branch;

          if (isIpOrNameChanged || isBranchChanged) {
            await storeService.updateStore(existing.id, storeData);
            if (isIpOrNameChanged) updatedIp++;
            else branchAssigned++;
          } else {
            unchangedIp++;
          }
        } else {
          await storeService.upsertStore(storeData);
          created++;
        }
      } catch (error) {
        logger.warn(
          `[store-sync] Gagal memproses toko ${record.storeCode} (Fasa 1): ${error.message}`,
        );
      }
    }

    // Fasa 2: pastikan seluruh stores.json hanya berisi cabang terdaftar
    const storeList = await storeService.getAllStoresRaw();
    logger.info(
      `[store-sync] Fase 2: cek kode cabang untuk ${storeList.length} store dari stores.json`,
    );

    let branchUpdated = 0;
    let branchUnchanged = 0;
    let branchSkipped = 0;

    for (const store of storeList) {
      const code = String(store.storeCode || "").toUpperCase();
      const rec = snapshotByCode.get(code);
      const branch = this._resolveRegisteredBranch({
        sourceCab: rec?.cabang,
        wrcCab: wrcMap.get(code),
        existingCab: store.branch || store.cab,
        registered,
      });

      if (branch === null) {
        // Tak terpecahkan jadi cabang terdaftar -> akan dibersihkan di Fasa 3
        branchSkipped++;
        continue;
      }

      if (String(store.branch || "").trim().toUpperCase() !== branch) {
        try {
          await storeService.updateStore(store.id, { branch });
          branchUpdated++;
          logger.debug(`[store-sync] Update cabang toko ${store.storeCode} -> ${branch}`);
        } catch (error) {
          logger.warn(`[store-sync] Gagal update cabang toko ${store.storeCode}: ${error.message}`);
        }
      } else {
        branchUnchanged++;
      }
    }

    // Fasa 3: bersihkan sisa toko ber-cabang tak terdaftar dari stores.json
    const cleanup = await storeService.cleanupUnregisteredBranchStores();

    // Persist meta rumah (1 paket log history untuk frontend)
    const syncMeta = {
      lastSyncedAt: now.toISOString(),
      syncedBy: user?.username || "system",
      syncedByFullName: user?.fullName || user?.username || "system",
      source: "master-tokomain.csv",
      summary: {
        snapshotCount: snapshot.records.length,
        induk: snapshot.stats?.induk || 0,
        stb: snapshot.stats?.stb || 0,
        invalidCsv: snapshot.stats?.invalid || 0,
        registeredCabangs: registered.size,
        unregisteredWrcCabangs,
        wrcCabangs: cabangs.length,
        wrcToko: wrcMap.size,
        created,
        updatedIp,
        unchangedIp,
        branchAssigned,
        branchUpdated,
        branchUnchanged,
        branchSkipped,
        skippedUnregisteredCount: skippedUnregistered.length,
        skippedUnregistered: skippedUnregistered.slice(0, 100),
        removedUnregistered: cleanup.removed,
        removedStores: cleanup.removedStores,
        duplicateWrcCodes: duplicateCodes,
      },
    };
    await this.writeLastSync(syncMeta);

    logger.info(
      `[store-sync] Selesai master-csv: ${created} created, ${updatedIp} ip/nama updated, ${branchAssigned} cabang ditetapkan, ${branchUpdated} cabang updated, ${cleanup.removed} toko cabang tak terdaftar dibersihkan, ${skippedUnregistered.length} skip (cabang tak terdaftar)`,
    );

    return { success: true, ...syncMeta };
  }

  /**
   * Baca cache monitoring toko dari file store-monitoring.json
   */
  async readStoreMonitoring() {
    try {
      const data = await fs.readFile(MONITORING_CACHE_PATH, "utf8");
      return JSON.parse(data);
    } catch (error) {
      if (error.code === "ENOENT") return null;
      if (error instanceof SyntaxError) {
        logger.warn("store-monitoring.json corrupted, ignoring");
        return null;
      }
      throw error;
    }
  }

  /**
   * Tulis cache monitoring toko ke file store-monitoring.json
   */
  async writeStoreMonitoring(data) {
    await fs.mkdir(path.dirname(MONITORING_CACHE_PATH), { recursive: true });
    await fs.writeFile(MONITORING_CACHE_PATH, JSON.stringify(data, null, 2));
  }

  /**
   * Fetch data toko akan buka, tutup sementara, akan tutup, dan sudah tutup dari server WRC cabang tertentu.
   */
  async fetchWrcMonitoringData(cab) {
    let connection;
    try {
      const config = await this.wrcService.getConnWRC(cab);
      connection = await mysql.createConnection({
        ...config,
        connectTimeout: 10000,
      });

      // 1. Query Toko Akan Buka, Baru Bulan Ini, Akan Tutup, Sudah Tutup
      const qTokoAll = `
        SELECT 
          kode_toko AS kodeToko, 
          nama_toko AS namaToko, 
          kode_gudang AS kodeGudang,
          DATE_FORMAT(tgl_buka, '%Y-%m-%d') AS tglBuka,
          DATE_FORMAT(tok_tgl_tutup, '%Y-%m-%d') AS tglTutup
        FROM poscabang.mstr_toko_all
        WHERE (tgl_buka > CURDATE() OR (MONTH(tgl_buka) = MONTH(CURDATE()) AND YEAR(tgl_buka) = YEAR(CURDATE())))
           OR (tok_tgl_tutup IS NOT NULL AND tok_tgl_tutup != '0000-00-00')
      `;
      const [allRows] = await connection.query(qTokoAll);

      // 2. Query Toko Tutup Sementara (TS) - INNER JOIN ke mstr_toko_all
      const qTokoTs = `
        SELECT 
          ts.kode_toko AS kodeToko,
          all_t.nama_toko AS namaToko,
          all_t.kode_gudang AS kodeGudang,
          DATE_FORMAT(ts.tgl_tutup, '%Y-%m-%d') AS tglTutup,
          ts.tgl_keterangan AS keterangan
        FROM poscabang.mstr_toko_ts ts
        INNER JOIN poscabang.mstr_toko_all all_t ON ts.kode_toko = all_t.kode_toko
        ORDER BY ts.kode_toko ASC, ts.tgl_tutup ASC
      `;
      let tsRows = [];
      try {
        const [rows] = await connection.query(qTokoTs);
        tsRows = rows;
      } catch (err) {
        logger.warn(`[store-sync] Query mstr_toko_ts failed for cabang ${cab}: ${err.message}`);
      }
      // 4. Query Toko Takeover (nama identik, beda kode toko, selisih tanggal tutup-buka 0 s/d 1 hari)
      const qTakeover = `
        SELECT 
          t_old.kode_toko AS kodeLama,
          t_old.nama_toko AS namaToko,
          t_old.kode_gudang AS kodeGudang,
          DATE_FORMAT(t_old.tok_tgl_tutup, '%Y-%m-%d') AS tglTutupLama,
          t_new.kode_toko AS kodeBaru,
          DATE_FORMAT(t_new.tgl_buka, '%Y-%m-%d') AS tglBukaBaru,
          DATEDIFF(t_new.tgl_buka, t_old.tok_tgl_tutup) AS selisihHari
        FROM poscabang.mstr_toko_all t_old
        JOIN poscabang.mstr_toko_all t_new 
          ON TRIM(t_old.nama_toko) = TRIM(t_new.nama_toko)
          AND t_old.kode_toko != t_new.kode_toko
        WHERE t_old.tok_tgl_tutup IS NOT NULL 
          AND t_old.tok_tgl_tutup != '0000-00-00'
          AND t_new.tgl_buka IS NOT NULL 
          AND t_new.tgl_buka != '0000-00-00'
          AND DATEDIFF(t_new.tgl_buka, t_old.tok_tgl_tutup) BETWEEN 0 AND 1
        ORDER BY t_new.tgl_buka DESC
      `;
      let takeoverRows = [];
      try {
        const [rows] = await connection.query(qTakeover);
        takeoverRows = rows;
      } catch (err) {
        logger.warn(`[store-sync] Query takeover failed for cabang ${cab}: ${err.message}`);
      }


      // 3. Query saldo toko dari kodetoko_YYMM terbaru untuk cek saldo toko sudah tutup
      let saldoMap = new Map();
      let latestKodetokoTable = null;
      try {
        const [tables] = await connection.query("SHOW TABLES LIKE 'kodetoko_%'");
        const tableNames = tables
          .map(t => Object.values(t)[0])
          .filter(name => /^kodetoko_\d{4}$/.test(name))
          .sort()
          .reverse();

        if (tableNames.length > 0) {
          latestKodetokoTable = tableNames[0];
          const [saldoRows] = await connection.query(`
            SELECT 
              KODE_TOKO AS kodeToko,
              SUM(SALDO_AKH) AS totalQty,
              SUM(RP_SLD_AKH) AS totalRp
            FROM poscabang.${latestKodetokoTable}
            GROUP BY KODE_TOKO
          `);
          for (const s of saldoRows) {
            saldoMap.set(String(s.kodeToko).trim(), {
              qty: Number(s.totalQty) || 0,
              rp: Number(s.totalRp) || 0,
            });
          }
        }
      } catch (err) {
        logger.warn(`[store-sync] Query kodetoko table failed for cabang ${cab}: ${err.message}`);
      }

      // 4. Transformasi dan Kategorisasi
      const nowJkt = moment().tz("Asia/Jakarta");
      const todayStr = nowJkt.format("YYYY-MM-DD");
      const maxAkanBukaStr = nowJkt.clone().add(21, "days").format("YYYY-MM-DD");
      const curMonth = nowJkt.month() + 1;
      const curYear = nowJkt.year();
      const periodeSaldo = latestKodetokoTable ? latestKodetokoTable.replace("kodetoko_", "") : null;

      const akanBuka = [];
      const akanTutup = [];
      const sudahTutup = [];

      for (const row of allRows) {
        const kodeToko = String(row.kodeToko).trim();
        const namaToko = String(row.namaToko || "").trim();
        const kodeGudang = String(row.kodeGudang || cab).trim();
        const tglBuka = row.tglBuka && row.tglBuka !== "0000-00-00" ? row.tglBuka : null;
        const tglTutup = row.tglTutup && row.tglTutup !== "0000-00-00" ? row.tglTutup : null;

        // Cek Toko Akan Buka & Toko Baru Bulan Ini
        if (tglBuka) {
          const [bYear, bMonth] = tglBuka.split("-").map(Number);
          const isBulanIni = bYear === curYear && bMonth === curMonth;

          // 1) Toko Baru (Bulan Ini): Buka di bulan berjalan & sudah buka (tglBuka <= todayStr)
          if (isBulanIni && tglBuka <= todayStr) {
            akanBuka.push({
              kodeToko,
              namaToko,
              cabang: cab,
              kodeGudang,
              tglBuka,
              tglTutup,
              isNewThisMonth: true,
              statusText: "Toko Baru (Bulan Ini)",
            });
          }
          // 2) Toko Akan Buka: Tanggal buka di masa depan & range kurang dari 3 minggu (<= 21 hari) ke depan dari hari ini
          else if (tglBuka > todayStr && tglBuka <= maxAkanBukaStr) {
            akanBuka.push({
              kodeToko,
              namaToko,
              cabang: cab,
              kodeGudang,
              tglBuka,
              tglTutup,
              isNewThisMonth: false,
              statusText: "Akan Buka",
            });
          }
          // Toko dengan tglBuka > 3 minggu ke depan dilewati dari monitoring aktif
        }

        // Cek Toko Akan Tutup & Sudah Tutup
        if (tglTutup) {
          if (tglTutup > todayStr) {
            akanTutup.push({
              kodeToko,
              namaToko,
              cabang: cab,
              kodeGudang,
              tglBuka,
              tglTutup,
              statusText: "Akan Tutup",
            });
          } else {
            // Sudah Tutup
            const saldoInfo = saldoMap.get(kodeToko);
            const saldoQty = saldoInfo ? saldoInfo.qty : 0;
            const saldoRp = saldoInfo ? saldoInfo.rp : 0;
            const isZero = !saldoInfo || (saldoQty === 0 && saldoRp === 0);

            sudahTutup.push({
              kodeToko,
              namaToko,
              cabang: cab,
              kodeGudang,
              tglBuka,
              tglTutup,
              statusSaldo: isZero ? "NOL" : "ADA_SISA",
              saldoQty,
              saldoRp,
              periodeSaldo,
              statusText: isZero ? "Saldo Nol (Clear)" : "Ada Sisa Saldo",
            });
          }
        }
      }

      // 5. Agregasi Toko Tutup Sementara (TS)
      const tsMap = new Map();
      for (const ts of tsRows) {
        const k = String(ts.kodeToko).trim();
        if (!tsMap.has(k)) {
          tsMap.set(k, {
            kodeToko: k,
            namaToko: String(ts.namaToko || "").trim(),
            cabang: cab,
            kodeGudang: String(ts.kodeGudang || cab).trim(),
            dates: [],
            keteranganList: new Set(),
          });
        }
        const entry = tsMap.get(k);
        if (ts.tglTutup) {
          entry.dates.push(ts.tglTutup);
        }
        if (ts.keterangan) {
          entry.keteranganList.add(String(ts.keterangan).trim());
        }
      }

      
      const takeover = takeoverRows.map((r) => {
        const kodeLama = String(r.kodeLama || "").trim();
        const kodeBaru = String(r.kodeBaru || "").trim();
        const isOldReg = kodeLama.toUpperCase().startsWith("T");
        const isNewReg = kodeBaru.toUpperCase().startsWith("T");
        let tipeTransisi = "Takeover";
        if (!isOldReg && isNewReg) tipeTransisi = "Franchise ➜ Reguler";
        else if (isOldReg && !isNewReg) tipeTransisi = "Reguler ➜ Franchise";
        else if (!isOldReg && !isNewReg) tipeTransisi = "Franchise ➜ Franchise";
        else if (isOldReg && isNewReg) tipeTransisi = "Reguler ➜ Reguler";

        return {
          kodeLama,
          kodeBaru,
          namaToko: String(r.namaToko || "").trim(),
          cabang: cab,
          kodeGudang: String(r.kodeGudang || cab).trim(),
          tglTutupLama: r.tglTutupLama,
          tglBukaBaru: r.tglBukaBaru,
          tglTakeover: r.tglBukaBaru,
          selisihHari: Number(r.selisihHari) || 0,
          tipeTransisi,
        };
      });

      const tutupSementara = [];
      for (const [k, item] of tsMap.entries()) {
        const sortedDates = [...new Set(item.dates)].sort();
        const tglMulai = sortedDates[0] || null;
        const tglSelesai = sortedDates[sortedDates.length - 1] || null;
        const totalHari = sortedDates.length;
        const keterangan = Array.from(item.keteranganList).filter(Boolean).join(", ") || "-";

        tutupSementara.push({
          kodeToko: item.kodeToko,
          namaToko: item.namaToko,
          cabang: cab,
          kodeGudang: item.kodeGudang,
          tglMulai,
          tglSelesai,
          totalHari,
          keterangan,
          daftarTanggal: sortedDates,
        });
      }

      return {
        cabang: cab,
        success: true,
        akanBuka,
        tutupSementara,
        akanTutup,
        sudahTutup,
        takeover,
      };
    } catch (err) {
      logger.error(`[store-sync] fetchWrcMonitoringData failed for cabang ${cab}: ${err.message}`);
      return {
        cabang: cab,
        success: false,
        error: err.message,
        akanBuka: [],
        tutupSementara: [],
        akanTutup: [],
        sudahTutup: [],
        takeover: [],
      };
    } finally {
      if (connection) {
        try {
          await connection.end();
        } catch (_) {}
      }
    }
  }

  /**
   * Sinkronisasi data monitoring toko dari seluruh cabang terdaftar di m_cabang.
   */
  async syncStoreMonitoring({ user = null } = {}) {
    const startTime = Date.now();
    const mCabangService = new MCabangService();
    const registeredCabangs = await mCabangService.getAllCabang();
    const branchCodes = (registeredCabangs || [])
      .map(c => String(c?.kdcab || "").trim().toUpperCase())
      .filter(Boolean);

    logger.info(`[store-sync] Memulai sync store monitoring untuk ${branchCodes.length} cabang...`);

    const fetchPromises = branchCodes.map(cab => this.fetchWrcMonitoringData(cab));
    const results = await Promise.all(fetchPromises);

    const akanBuka = [];
    const tutupSementara = [];
    const akanTutup = [];
    const sudahTutup = [];
    const takeover = [];
    const cabangSummary = [];

    let totalBaruBulanIni = 0;
    let totalSudahTutupAdaSisa = 0;
    let totalSudahTutupNol = 0;

    for (const res of results) {
      cabangSummary.push({
        cabang: res.cabang,
        success: res.success,
        error: res.error || null,
        countAkanBuka: res.akanBuka.length,
        countTutupSementara: res.tutupSementara.length,
        countAkanTutup: res.akanTutup.length,
        countSudahTutup: res.sudahTutup.length,
        countTakeover: res.takeover?.length || 0,
      });

      if (res.success) {
        for (const item of res.akanBuka) {
          if (item.isNewThisMonth) totalBaruBulanIni++;
          akanBuka.push(item);
        }
        for (const item of res.tutupSementara) {
          tutupSementara.push(item);
        }
        for (const item of res.akanTutup) {
          akanTutup.push(item);
        }
        for (const item of res.sudahTutup) {
          if (item.statusSaldo === "ADA_SISA") {
            totalSudahTutupAdaSisa++;
          } else {
            totalSudahTutupNol++;
          }
          sudahTutup.push(item);
        }
        for (const item of res.takeover || []) {
          takeover.push(item);
        }
      }
    }

    const durationMs = Date.now() - startTime;
    const now = new Date();

    
    // Hitung toko yang masuk dalam masa warning alert takeover (H-3 s.d. H+2)
    const todayZero = new Date();
    todayZero.setHours(0, 0, 0, 0);
    const msPerDay = 24 * 60 * 60 * 1000;

    const takeoverAlerts = takeover
      .map((item) => {
        if (!item.tglTakeover) return null;
        const targetDate = new Date(item.tglTakeover);
        targetDate.setHours(0, 0, 0, 0);
        // daysDiff: selisih hari dari today ke tglTakeover
        // misal today 2026-10-22, target 2026-10-25 => 3 (H-3)
        // target 2026-10-20 => -2 (H+2)
        const daysDiff = Math.round((targetDate - todayZero) / msPerDay);

        // Alert aktif dari H-3 (daysDiff = 3) sampai H+2 (daysDiff = -2)
        if (daysDiff >= -2 && daysDiff <= 3) {
          let statusAlert = "";
          let badgeSeverity = "warning";
          if (daysDiff > 1) {
            statusAlert = `${daysDiff} hari lagi (H-${daysDiff})`;
          } else if (daysDiff === 1) {
            statusAlert = "Besok (H-1)";
            badgeSeverity = "danger";
          } else if (daysDiff === 0) {
            statusAlert = "Hari Ini (H-0)";
            badgeSeverity = "danger";
          } else if (daysDiff === -1) {
            statusAlert = "Kemarin (H+1)";
            badgeSeverity = "info";
          } else if (daysDiff === -2) {
            statusAlert = "2 hari lalu (H+2)";
            badgeSeverity = "info";
          }

          return {
            ...item,
            daysDiff,
            statusAlert,
            badgeSeverity,
          };
        }
        return null;
      })
      .filter(Boolean)
      .sort((a, b) => a.daysDiff - b.daysDiff);

    const monitoringData = {
      meta: {
        lastSyncedAt: now.toISOString(),
        syncedBy: user?.username || "system",
        syncedByFullName: user?.fullName || user?.username || "system",
        durationMs,
        totalCabang: branchCodes.length,
        successfulCabang: results.filter(r => r.success).length,
        failedCabang: results.filter(r => !r.success).length,
      },
      summary: {
        totalAkanBuka: akanBuka.length,
        totalBaruBulanIni,
        totalTutupSementara: tutupSementara.length,
        totalAkanTutup: akanTutup.length,
        totalSudahTutup: sudahTutup.length,
        totalSudahTutupAdaSisa,
        totalSudahTutupNol,
        totalTakeover: takeover.length,
        totalTakeoverAlerts: takeoverAlerts.length,
      },
      cabangSummary,
      data: {
        akanBuka,
        tutupSementara,
        akanTutup,
        sudahTutup,
        takeover,
        takeoverAlerts,
      },
    };

    await this.writeStoreMonitoring(monitoringData);
    logger.info(
      `[store-sync] Selesai sync store monitoring dalam ${durationMs}ms: ` +
      `${akanBuka.length} akan buka (${totalBaruBulanIni} baru), ` +
      `${tutupSementara.length} TS, ${akanTutup.length} akan tutup, ${sudahTutup.length} sudah tutup.`
    );

    return monitoringData;
  }

  /**
   * Mengambil data monitoring toko (dengan opsi filter category, cabang, search, dll.)
   */
  async getStoreMonitoring(options = {}) {
    let cached = await this.readStoreMonitoring();
    if (!cached) {
      cached = await this.syncStoreMonitoring();
    }

    const {
      category = "all", // "akan_buka", "tutup_sementara", "akan_tutup", "sudah_tutup", "all"
      cabang = "",
      search = "",
      saldoStatus = "all", // "all", "ada_sisa", "nol"
      isNew = "", // "true", "false", ""
    } = options;

    const filterItem = (item) => {
      if (cabang && item.cabang !== cabang) return false;
      if (search) {
        const q = search.toLowerCase();
        const matchCode = (item.kodeToko || "").toLowerCase().includes(q);
        const matchName = (item.namaToko || "").toLowerCase().includes(q);
        const matchCab = (item.cabang || "").toLowerCase().includes(q);
        const matchKet = (item.keterangan || "").toLowerCase().includes(q);
        if (!matchCode && !matchName && !matchCab && !matchKet) return false;
      }
      return true;
    };

    let akanBuka = cached.data?.akanBuka || [];
    let tutupSementara = cached.data?.tutupSementara || [];
    let akanTutup = cached.data?.akanTutup || [];
    let sudahTutup = cached.data?.sudahTutup || [];
    let takeover = cached.data?.takeover || [];

    // Filter cabang & search
    akanBuka = akanBuka.filter(filterItem);
    tutupSementara = tutupSementara.filter(filterItem);
    akanTutup = akanTutup.filter(filterItem);
    sudahTutup = sudahTutup.filter(filterItem);
    takeover = takeover.filter(filterItem);

    // Filter saldoStatus khusus sudahTutup
    if (saldoStatus && saldoStatus !== "all") {
      const targetStatus = saldoStatus.toUpperCase();
      sudahTutup = sudahTutup.filter(item => item.statusSaldo === targetStatus);
    }

    // Filter isNew khusus akanBuka
    if (isNew === "true") {
      akanBuka = akanBuka.filter(item => item.isNewThisMonth);
    } else if (isNew === "false") {
      akanBuka =  akanBuka.filter(item => !item.isNewThisMonth);
    }

    return {
      meta: cached.meta,
      summary: {
        totalAkanBuka: akanBuka.length,
        totalBaruBulanIni: akanBuka.filter(x => x.isNewThisMonth).length,
        totalTutupSementara: tutupSementara.length,
        totalAkanTutup: akanTutup.length,
        totalSudahTutup: sudahTutup.length,
        totalSudahTutupAdaSisa: sudahTutup.filter(x => x.statusSaldo === "ADA_SISA").length,
        totalSudahTutupNol: sudahTutup.filter(x => x.statusSaldo === "NOL").length,
        totalTakeover: takeover.length,
        totalTakeoverAlerts: cached.data?.takeoverAlerts?.length || 0,
      },
      rawSummary: cached.summary,
      cabangSummary: cached.cabangSummary,
      data: {
        akanBuka: category === "all" || category === "akan_buka" ? akanBuka : [],
        tutupSementara: category === "all" || category === "tutup_sementara" ? tutupSementara : [],
        akanTutup: category === "all" || category === "akan_tutup" ? akanTutup : [],
        sudahTutup: category === "all" || category === "sudah_tutup" ? sudahTutup : [],
        takeover: category === "all" || category === "takeover" ? takeover : [],
        takeoverAlerts: cached.data?.takeoverAlerts || [],
      },
    };
  }

  /**
   * Export data monitoring ke file Excel (4 sheet: Akan Buka & Baru, Tutup Sementara, Akan Tutup, Sudah Tutup)
   */
  async exportStoreMonitoringExcel(options = {}) {
    const monitoringResult = await this.getStoreMonitoring(options);
    const { akanBuka, tutupSementara, akanTutup, sudahTutup, takeover } = monitoringResult.data;

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Reporting 2.0";
    workbook.created = new Date();

    const headerFill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF2C3E50" },
    };
    const headerFont = {
      name: "Arial",
      size: 10,
      bold: true,
      color: { argb: "FFFFFFFF" },
    };
    const borderThin = {
      top: { style: "thin", color: { argb: "FFDDDDDD" } },
      left: { style: "thin", color: { argb: "FFDDDDDD" } },
      bottom: { style: "thin", color: { argb: "FFDDDDDD" } },
      right: { style: "thin", color: { argb: "FFDDDDDD" } },
    };

    const styleWorksheet = (ws, columns) => {
      ws.columns = columns;
      const headerRow = ws.getRow(1);
      headerRow.height = 26;
      headerRow.eachCell((cell) => {
        cell.fill = headerFill;
        cell.font = headerFont;
        cell.alignment = { vertical: "middle", horizontal: "center" };
      });
    };

    // Sheet 1: Toko Akan Buka & Baru
    const wsBuka = workbook.addWorksheet("Akan Buka & Baru");
    styleWorksheet(wsBuka, [
      { header: "No", key: "no", width: 6 },
      { header: "Cabang", key: "cabang", width: 10 },
      { header: "Kode Toko", key: "kodeToko", width: 12 },
      { header: "Nama Toko", key: "namaToko", width: 35 },
      { header: "Tanggal Buka", key: "tglBuka", width: 15 },
      { header: "Status", key: "statusText", width: 22 },
    ]);
    akanBuka.forEach((item, idx) => {
      const row = wsBuka.addRow({
        no: idx + 1,
        cabang: item.cabang,
        kodeToko: item.kodeToko,
        namaToko: item.namaToko,
        tglBuka: item.tglBuka,
        statusText: item.statusText,
      });
      row.eachCell((cell) => {
        cell.border = borderThin;
        cell.font = { name: "Arial", size: 9 };
      });
    });

    // Sheet 2: Tutup Sementara
    const wsTs = workbook.addWorksheet("Tutup Sementara");
    styleWorksheet(wsTs, [
      { header: "No", key: "no", width: 6 },
      { header: "Cabang", key: "cabang", width: 10 },
      { header: "Kode Toko", key: "kodeToko", width: 12 },
      { header: "Nama Toko", key: "namaToko", width: 35 },
      { header: "Tgl Mulai", key: "tglMulai", width: 14 },
      { header: "Tgl Selesai", key: "tglSelesai", width: 14 },
      { header: "Total Hari", key: "totalHari", width: 12 },
      { header: "Keterangan", key: "keterangan", width: 30 },
      { header: "Daftar Tanggal TS", key: "daftarTanggal", width: 45 },
    ]);
    tutupSementara.forEach((item, idx) => {
      const row = wsTs.addRow({
        no: idx + 1,
        cabang: item.cabang,
        kodeToko: item.kodeToko,
        namaToko: item.namaToko,
        tglMulai: item.tglMulai,
        tglSelesai: item.tglSelesai,
        totalHari: item.totalHari,
        keterangan: item.keterangan,
        daftarTanggal: (item.daftarTanggal || []).join(", "),
      });
      row.eachCell((cell) => {
        cell.border = borderThin;
        cell.font = { name: "Arial", size: 9 };
      });
    });

    // Sheet 3: Toko Akan Tutup
    const wsAkanTutup = workbook.addWorksheet("Akan Tutup");
    styleWorksheet(wsAkanTutup, [
      { header: "No", key: "no", width: 6 },
      { header: "Cabang", key: "cabang", width: 10 },
      { header: "Kode Toko", key: "kodeToko", width: 12 },
      { header: "Nama Toko", key: "namaToko", width: 35 },
      { header: "Tanggal Buka", key: "tglBuka", width: 15 },
      { header: "Rencana Tutup", key: "tglTutup", width: 15 },
    ]);
    akanTutup.forEach((item, idx) => {
      const row = wsAkanTutup.addRow({
        no: idx + 1,
        cabang: item.cabang,
        kodeToko: item.kodeToko,
        namaToko: item.namaToko,
        tglBuka: item.tglBuka || "-",
        tglTutup: item.tglTutup,
      });
      row.eachCell((cell) => {
        cell.border = borderThin;
        cell.font = { name: "Arial", size: 9 };
      });
    });

    // Sheet 4: Toko Sudah Tutup
    const wsSudahTutup = workbook.addWorksheet("Sudah Tutup");
    styleWorksheet(wsSudahTutup, [
      { header: "No", key: "no", width: 6 },
      { header: "Cabang", key: "cabang", width: 10 },
      { header: "Kode Toko", key: "kodeToko", width: 12 },
      { header: "Nama Toko", key: "namaToko", width: 35 },
      { header: "Tanggal Tutup", key: "tglTutup", width: 14 },
      { header: "Status Saldo", key: "statusSaldo", width: 16 },
      { header: "Periode Closing", key: "periodeSaldo", width: 15 },
      { header: "Qty Saldo Akhir", key: "saldoQty", width: 16 },
      { header: "Rp Saldo Akhir", key: "saldoRp", width: 18 },
    ]);
    sudahTutup.forEach((item, idx) => {
      const row = wsSudahTutup.addRow({
        no: idx + 1,
        cabang: item.cabang,
        kodeToko: item.kodeToko,
        namaToko: item.namaToko,
        tglTutup: item.tglTutup,
        statusSaldo: item.statusSaldo === "NOL" ? "Nol (Clear)" : "Ada Sisa",
        periodeSaldo: item.periodeSaldo || "-",
        saldoQty: item.saldoQty,
        saldoRp: item.saldoRp,
      });
      row.getCell("saldoQty").numFmt = "#,##0";
      row.getCell("saldoRp").numFmt = "#,##0";
      row.eachCell((cell) => {
        cell.border = borderThin;
        cell.font = { name: "Arial", size: 9 };
      });
    });

    
    // Sheet 5: Toko Takeover
    const wsTakeover = workbook.addWorksheet("Toko Takeover");
    styleWorksheet(wsTakeover, [
      { header: "No", key: "no", width: 6 },
      { header: "Cabang", key: "cabang", width: 10 },
      { header: "Nama Toko", key: "namaToko", width: 35 },
      { header: "Tipe Transisi", key: "tipeTransisi", width: 24 },
      { header: "Kode Lama", key: "kodeLama", width: 12 },
      { header: "Tgl Tutup Lama", key: "tglTutupLama", width: 15 },
      { header: "Kode Baru", key: "kodeBaru", width: 12 },
      { header: "Tgl Buka Baru", key: "tglBukaBaru", width: 15 },
      { header: "Selisih", key: "selisihHari", width: 10 },
    ]);
    (takeover || []).forEach((item, idx) => {
      const row = wsTakeover.addRow({
        no: idx + 1,
        cabang: item.cabang,
        namaToko: item.namaToko,
        tipeTransisi: item.tipeTransisi,
        kodeLama: item.kodeLama,
        tglTutupLama: item.tglTutupLama,
        kodeBaru: item.kodeBaru,
        tglBukaBaru: item.tglBukaBaru,
        selisihHari: `${item.selisihHari} Hari`,
      });
      row.eachCell((cell) => {
        cell.border = borderThin;
        cell.font = { name: "Arial", size: 9 };
      });
    });

    return workbook;
  }

}

export default StoreSyncService;
