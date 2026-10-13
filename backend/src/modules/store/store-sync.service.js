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
import logger from "../../config/logger.js";
import WrcBulananService from "../../services/wrc.service.js";
import storeService from "./storeService.js";

const LAST_SYNC_PATH = path.join(process.cwd(), "data/master-store-sync.json");
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
}

export default StoreSyncService;
