/**
 * Store master synchronization - merges TOKOMAIN.ini snapshot (kode toko + IP + tipe)
 * with WRC master toko (kode cabang + nama toko) from all cabang.
 *
 * Flow:
 *  1. getAllCabangWrc() -> connect each cabang WRC, read poscabang.mstr_toko_all
 *  2. Build kodeToko -> { cab, nama } map
 *  3. Merge with TOKOMAIN snapshot records -> upsert stores.json
 *  4. Persist last-sync meta (waktu, user, ringkasan) + 24-jam guard
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
   * Execute the master store sync.
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

    // 1. Fetch WRC master toko dari semua cabang (paralel)
    let cabangs = [];
    try {
      cabangs = await this.wrcService.getAllCabangWrc();
    } catch (error) {
      logger.error(`[store-sync] getAllCabangWrc gagal: ${error.message}`);
      throw new Error(`Gagal mengambil daftar cabang WRC: ${error.message}`);
    }

    const results = await Promise.all(cabangs.map(cab => this.fetchWrcStores(cab)));

    // Urutkan cabang agar urutan pemrosesan deterministik
    results.sort((a, b) => String(a.cab).localeCompare(String(b.cab)));

    // 2. Build map kodeToko -> { cab, nama }
    //    Jika satu kode toko muncul di >1 cabang (anomali data), kode tsb
    //    dianggap ambigu dan di-skip (tidak mengubah branch yang mungkin sudah benar).
    const wrcMap = new Map();
    const duplicateCodes = [];
    for (const result of results) {
      for (const row of result.rows) {
        const key = String(row.kodeToko).trim().toUpperCase();
        if (!key) continue;
        if (wrcMap.has(key)) {
          duplicateCodes.push(key);
          wrcMap.delete(key); // ambiguous: milik lebih dari 1 cabang -> jangan sentuh
          continue;
        }
        wrcMap.set(key, { cab: result.cab, nama: row.namaToko });
      }
    }

    // 3. Merge snapshot -> stores.json
    let created = 0;
    let updated = 0;
    let unchanged = 0;
    const skippedWrc = [];

    for (const record of snapshot.records) {
      const info = wrcMap.get(record.storeCode.toUpperCase());
      if (!info) {
        skippedWrc.push(record.storeCode);
        continue;
      }

      const storeData = {
        storeCode: record.storeCode,
        station: record.station,
        dbHost: record.ip,
        notes: record.type,
        storeName: info.nama || record.storeCode,
        branch: info.cab,
      };

      try {
        const existing =
          record.type === "INDUK"
            ? await storeService.getStoreByCode(record.storeCode)
            : await storeService.getStoreByCodeAndStation(record.storeCode, record.station);

        if (existing) {
          const isChanged =
            existing.dbHost !== storeData.dbHost ||
            existing.storeName !== storeData.storeName ||
            existing.branch !== storeData.branch ||
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

    // 4. Persist meta
    const syncMeta = {
      lastSyncedAt: now.toISOString(),
      syncedBy: user?.username || "system",
      syncedByFullName: user?.fullName || user?.username || "system",
      source: "TOKOMAIN.ini",
      summary: {
        snapshotCount: snapshot.records.length,
        induk: snapshot.stats?.induk || 0,
        stb: snapshot.stats?.stb || 0,
        wrcCabangs: cabangs.length,
        wrcToko: wrcMap.size,
        created,
        updated,
        unchanged,
        skippedWrcCount: skippedWrc.length,
        skippedWrc: skippedWrc,
        duplicateWrcCodes: duplicateCodes,
      },
    };
    await this.writeLastSync(syncMeta);

    logger.info(
      `[store-sync] Selesai TOKOMAIN.ini: ${updated} updated, ${created} created, ${unchanged} unchanged, ${skippedWrc.length} skip (tanpa WRC)`,
    );

    return { success: true, ...syncMeta };
  }

  /**
   * Execute master store sync from uploaded master-tokomain.csv.
   * Fasa 1: insert ignore / on duplicate key update nama + IP.
   * Fasa 2: update kode cab dari semua server WRC yang tersedia (update saja, bukan insert).
   * Proses berurutan: Fasa 1 selesai + stores.json tersimpan, baru Fasa 2 jalan.
   *
   * Catatan:
   *   - Bagian yang mengandalkan db_edp.rekap_ip sengaja tidak dipakai di alur ini.
   *     Implementasi lama dikomen di bawah untuk referensi / re-enable nanti.
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

    // Fasa 1: insert ignore / on duplicate key update nama + IP
    let created = 0;
    let updatedIp = 0;
    let unchangedIp = 0;

    for (const record of snapshot.records) {
      const storeData = {
        storeCode: record.storeCode,
        station: record.station,
        dbHost: record.ip,
        notes: record.type,
        storeName: record.storeName,
        branch: undefined, // kode cabang tidak di-update di Fasa 1
      };

      try {
        const existing =
          record.type === "INDUK"
            ? await storeService.getStoreByCode(record.storeCode)
            : await storeService.getStoreByCodeAndStation(record.storeCode, record.station);

        if (existing) {
          const isIpOrNameChanged =
            existing.dbHost !== storeData.dbHost || existing.storeName !== storeData.storeName;

          if (isIpOrNameChanged) {
            await storeService.updateStore(existing.id, storeData);
            updatedIp++;
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

    // Fasa 2: update kode cab dari semua server WRC yang tersedia (update saja)
    let cabangs = [];
    try {
      cabangs = await this.wrcService.getAllCabangWrc();
    } catch (error) {
      logger.error(`[store-sync] getAllCabangWrc gagal: ${error.message}`);
      throw new Error(`Gagal mengambil daftar cabang WRC: ${error.message}`);
    }

    const results = await Promise.all(cabangs.map(cab => this.fetchWrcStores(cab)));

    // Urutkan cabang agar urutan pemrosesan deterministik
    results.sort((a, b) => String(a.cab).localeCompare(String(b.cab)));

    // Build map kodeToko -> cab (update saja, bukan insert)
    const wrcMap = new Map();
    const duplicateCodes = [];
    for (const result of results) {
      for (const row of result.rows) {
        const key = String(row.kodeToko).trim().toUpperCase();
        if (!key) continue;
        if (wrcMap.has(key)) {
          duplicateCodes.push(key);
          wrcMap.delete(key); // ambiguous: milik lebih dari 1 cabang -> jangan sentuh
          continue;
        }
        wrcMap.set(key, result.cab);
      }
    }

    let branchUpdated = 0;
    let branchUnchanged = 0;
    let branchSkipped = 0;

    // Ambil seluruh store dari storeService (INDUK + STB, tanpa filter)
    const storeList = await storeService.getAllStoresRaw();
    logger.info(
      `[store-sync] Fase 2: cek kode cabang untuk ${storeList.length} store dari stores.json`,
    );

    for (const store of storeList) {
      const wrcCab = wrcMap.get(String(store.storeCode || "").toUpperCase());
      if (!wrcCab) {
        branchSkipped++;
        continue;
      }

      if (store.branch !== wrcCab) {
        try {
          await storeService.updateStore(store.id, { branch: wrcCab });
          branchUpdated++;
          logger.debug(
            `[store-sync] Update cabang toko ${store.storeCode} -> ${wrcCab}`,
          );
        } catch (error) {
          logger.warn(
            `[store-sync] Gagal update cabang toko ${store.storeCode}: ${error.message}`,
          );
        }
      } else {
        branchUnchanged++;
      }
    }

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
        wrcCabangs: cabangs.length,
        wrcToko: wrcMap.size,
        created,
        updatedIp,
        unchangedIp,
        branchUpdated,
        branchUnchanged,
        branchSkipped,
        duplicateWrcCodes: duplicateCodes,
      },
    };
    await this.writeLastSync(syncMeta);

    logger.info(
      `[store-sync] Selesai master-csv: ${created} created, ${updatedIp} ip/nama updated, ${unchangedIp} ip/nama unchanged, ${branchUpdated} cabang updated, ${branchUnchanged} cabang unchanged, ${branchSkipped} cabang skip (tanpa WRC)`,
    );

    return { success: true, ...syncMeta };
  }
}

export default StoreSyncService;