import fs from "fs/promises";
import path from "path";
import moment from "moment-timezone";
import logger from "../../config/logger.js";
import resilientDb from "../../config/resilient-database.js";
import User from "../../models/user.model.js";
import penyesuaianService from "../penyesuaian/penyesuaian.service.js";
import rekonVirtualMrgService from "../rekon_virtual_mrg/rekon_virtual_mrg.service.js";
import spaceHddService from "../ceklist-prep-closing/services/space_hdd.service.js";
import storeService from "../store/storeService.js";

class DashboardService {
  constructor() {
    this.dataDir = path.join(process.cwd(), "data");
  }

  async readJsonFile(filename) {
    try {
      const filePath = path.join(this.dataDir, filename);
      const data = await fs.readFile(filePath, "utf8");
      return JSON.parse(data);
    } catch (error) {
      if (error.code === "ENOENT") return [];
      logger.error(`Error reading ${filename}: ${error.message}`);
      return [];
    }
  }

  async _readPenyesuaianData() {
    try {
      const dirPath = path.join(this.dataDir, "penyesuaian");
      const files = await fs.readdir(dirPath);
      const penyesuaianFiles = files.filter(f => f.startsWith("penyesuaian_") && f.endsWith(".json"));

      let allRecords = [];
      for (const file of penyesuaianFiles) {
        try {
          const data = await fs.readFile(path.join(dirPath, file), "utf8");
          const parsed = JSON.parse(data);
          if (Array.isArray(parsed)) allRecords = allRecords.concat(parsed);
        } catch (e) {
          logger.warn(`Error reading ${file}: ${e.message}`);
        }
      }
      return allRecords;
    } catch (error) {
      if (error.code === "ENOENT") return [];
      logger.error(`Error reading penyesuaian data: ${error.message}`);
      return [];
    }
  }

  async getStats() {
    try {
      const stores = await this.readJsonFile("stores.json");
      const penyesuaian = await this._readPenyesuaianData();
      const rekonSales = await this.readJsonFile("rekon_sales.json");

      const now = new Date();
      const today = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
      ).getTime();

      // Count unique INDUK stores by storeCode
      const uniqueStoreCodes = new Set(
        stores.filter((s) => s.notes === "INDUK").map((s) => s.storeCode),
      );
      const totalStores = uniqueStoreCodes.size;

      const syncedToday = stores.filter((s) => {
        const upd = new Date(s.updtime || s.updatedAt).getTime();
        return upd >= today && s.notes === "INDUK";
      }).length;

      const needsAttention = totalStores - syncedToday;

      // DB connection info
      const dbStatus = resilientDb.getStatus();

      return {
        totalStores,
        totalPenyesuaian: penyesuaian.length,
        totalRekonSales: rekonSales.length,
        syncedToday,
        needsAttention,
        lastSync: stores.length > 0 ? stores[0].updtime : null,
        dbHost: process.env.DB_HOST || "N/A",
        dbPort: process.env.DB_PORT || "3306",
        dbConnected: dbStatus.isConnected,
      };
    } catch (error) {
      logger.error(`Dashboard stats failed: ${error.message}`);
      throw error;
    }
  }

  async getRecentActivity() {
    try {
      const activityDir = path.join(this.dataDir, "user-activities.json");
      let allActivities = [];

      try {
        const files = await fs.readdir(activityDir);
        for (const file of files) {
          if (file.endsWith("-activities.json")) {
            const content = await fs.readFile(
              path.join(activityDir, file),
              "utf8",
            );
            const activities = JSON.parse(content);
            allActivities = allActivities.concat(activities);
          }
        }
      } catch (error) {
        logger.warn(
          `Could not read user activities directory: ${error.message}`,
        );
      }

      // Sort by date descending
      allActivities.sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
      );

      const recent = allActivities.slice(0, 15);

      // Enrich with user data from DB so the frontend can display names.
      const uniqueUserIds = [
        ...new Set(recent.map((a) => a.userId).filter(Boolean)),
      ];
      let userMap = {};

      if (uniqueUserIds.length > 0) {
        try {
          const allUsers = await User.findAll();
          allUsers.forEach((u) => {
            if (uniqueUserIds.includes(u.id)) {
              userMap[u.id] = {
                id: u.id,
                username: u.username,
                fullName: u.fullName || u.username,
              };
            }
          });
        } catch (dbErr) {
          logger.warn(
            `Could not enrich activities with user data: ${dbErr.message}`,
          );
        }
      }

      return recent.map((a) => ({
        ...a,
        user: userMap[a.userId] || null,
      }));
    } catch (error) {
      logger.error(`Dashboard recent activity failed: ${error.message}`);
      return [];
    }
  }

  /**
   * Mengumpulkan ringkasan kasus yang perlu difollow-up dari:
   * 1. Penyesuaian Toko (toko belum follow-up, total nominal belum FU, dan nilai fantastis)
   * 2. Saldo Virtual Margin Based (item belum follow-up per cabang)
   * 3. Checklist Closing Bulanan (Space HDD server cabang, sisa GB kritis/warning belum FU)
   *
   * @param {string} [requestedPeriode] - Format YYMM (misal: "2610")
   * @returns {Promise<Object>} KPI Summary & Matriks Cabang yang perlu follow-up
   */
  async getFollowUpResume(requestedPeriode) {
    const periode = requestedPeriode && /^\d{4}$/.test(requestedPeriode)
      ? requestedPeriode
      : moment().format("YYMM");

    logger.info(`[dashboard.service] Mengambil follow-up resume untuk periode: ${periode}`);

    // Inisialisasi metadata cabang & toko dari storeService
    await storeService.ensureInitialized();
    const branchNameMap = new Map();
    for (const s of storeService.stores || []) {
      const bCode = s.branch || s.cab;
      if (bCode && !branchNameMap.has(bCode)) {
        branchNameMap.set(bCode, s.branchName || s.namaCabang || bCode);
      }
    }

    // ── 1. KASUS PENYESUAIAN TOKO ──
    const penyesuaianStats = {
      totalStores: 0,
      unfollowedStores: 0,
      totalNominalUnfollowed: 0,
      avgNominalUnfollowed: 0,
      maxNominalUnfollowed: 0,
      minNominalUnfollowed: 0,
      maxStore: null,
      minStore: null,
      fantasticStores: [],
      byCabang: {},
      _unfollowedList: [],
    };

    try {
      await penyesuaianService.ensureDataLoaded(periode);
      const activeStores = (penyesuaianService.penyesuaianData || []).filter(
        (i) => i.PERIODE === periode && i.RECID === "*",
      );
      penyesuaianStats.totalStores = activeStores.length;

      if (activeStores.length > 0) {
        const enriched = await penyesuaianService.enrichWithNotes(activeStores);
        for (const store of enriched) {
          const cab = store.CABANG || "UNKNOWN";
          if (!penyesuaianStats.byCabang[cab]) {
            penyesuaianStats.byCabang[cab] = {
              totalStores: 0,
              unfollowedStores: 0,
              totalNominalUnfollowed: 0,
              avgNominalUnfollowed: 0,
              maxNominalUnfollowed: 0,
              minNominalUnfollowed: 0,
              maxStore: null,
              minStore: null,
              fantasticCount: 0,
              _unfollowedList: [],
            };
          }
          penyesuaianStats.byCabang[cab].totalStores++;

          const hasNote = Boolean(store.note && store.note.noteText && store.note.noteText.trim() !== "");
          if (!hasNote) {
            const absSesuai = Math.abs(Number(store.SESUAI) || 0);
            const storeItem = {
              cabang: store.CABANG,
              kdtk: store.KDTK,
              sesuai: Number(store.SESUAI) || 0,
              absSesuai,
              updtime: store.UPDTIME,
            };

            penyesuaianStats.unfollowedStores++;
            penyesuaianStats.totalNominalUnfollowed += absSesuai;
            penyesuaianStats._unfollowedList.push(storeItem);

            penyesuaianStats.byCabang[cab].unfollowedStores++;
            penyesuaianStats.byCabang[cab].totalNominalUnfollowed += absSesuai;
            penyesuaianStats.byCabang[cab]._unfollowedList.push(storeItem);

            // Toko bernilai fantastis (|SESUAI| >= Rp 1.000.000)
            if (absSesuai >= 1000000) {
              penyesuaianStats.byCabang[cab].fantasticCount++;
              penyesuaianStats.fantasticStores.push(storeItem);
            }
          }
        }

        // Kalkulasi Rata-rata, Max, dan Min global
        if (penyesuaianStats._unfollowedList.length > 0) {
          penyesuaianStats.avgNominalUnfollowed = Math.round(
            penyesuaianStats.totalNominalUnfollowed / penyesuaianStats.unfollowedStores,
          );
          const sortedGlobal = [...penyesuaianStats._unfollowedList].sort((a, b) => b.absSesuai - a.absSesuai);
          penyesuaianStats.maxStore = sortedGlobal[0];
          penyesuaianStats.maxNominalUnfollowed = sortedGlobal[0].absSesuai;
          penyesuaianStats.minStore = sortedGlobal[sortedGlobal.length - 1];
          penyesuaianStats.minNominalUnfollowed = sortedGlobal[sortedGlobal.length - 1].absSesuai;
        }
        delete penyesuaianStats._unfollowedList;

        // Kalkulasi Rata-rata, Max, dan Min per cabang
        for (const cab in penyesuaianStats.byCabang) {
          const cData = penyesuaianStats.byCabang[cab];
          if (cData._unfollowedList && cData._unfollowedList.length > 0) {
            cData.avgNominalUnfollowed = Math.round(
              cData.totalNominalUnfollowed / cData.unfollowedStores,
            );
            const sortedCab = [...cData._unfollowedList].sort((a, b) => b.absSesuai - a.absSesuai);
            cData.maxStore = sortedCab[0];
            cData.maxNominalUnfollowed = sortedCab[0].absSesuai;
            cData.minStore = sortedCab[sortedCab.length - 1];
            cData.minNominalUnfollowed = sortedCab[sortedCab.length - 1].absSesuai;
          }
          delete cData._unfollowedList;
        }

        // Urutkan toko fantastis dari nilai selisih terbesar
        penyesuaianStats.fantasticStores.sort((a, b) => b.absSesuai - a.absSesuai);

        // Berikan nama toko pada daftar fantastis
        for (const item of penyesuaianStats.fantasticStores.slice(0, 15)) {
          try {
            const sInfo = await storeService.getStoreByCode(item.kdtk);
            item.namaToko = sInfo?.storeName || item.kdtk;
          } catch {
            item.namaToko = item.kdtk;
          }
        }
      }
    } catch (err) {
      logger.warn(`[dashboard.service] Gagal memuat resume penyesuaian: ${err.message}`);
    }

    // ── 2. KASUS SALDO VIRTUAL MARGIN BASED ──
    const virtualMrgStats = {
      totalItems: 0,
      unfollowedItems: 0,
      unfollowedShops: 0,
      byCabang: {},
    };

    try {
      const virtualRes = await rekonVirtualMrgService.getAll({ cabang: "All", periode });
      const virtualRecords = virtualRes?.data || [];
      virtualMrgStats.totalItems = virtualRecords.length;

      const shopSet = new Set();
      for (const rec of virtualRecords) {
        const cab = rec.CABANG || "UNKNOWN";
        if (!virtualMrgStats.byCabang[cab]) {
          virtualMrgStats.byCabang[cab] = {
            totalItems: 0,
            unfollowedItems: 0,
            unfollowedShops: 0,
            totalSel: 0,
            _shops: new Set(),
          };
        }
        virtualMrgStats.byCabang[cab].totalItems++;

        const hasNote = Boolean(rec.note && rec.note.noteText && rec.note.noteText.trim() !== "");
        if (!hasNote) {
          virtualMrgStats.unfollowedItems++;
          shopSet.add(rec.SHOP);
          virtualMrgStats.byCabang[cab].unfollowedItems++;
          virtualMrgStats.byCabang[cab].totalSel += Number(rec.SEL) || 0;
          virtualMrgStats.byCabang[cab]._shops.add(rec.SHOP);
        }
      }
      virtualMrgStats.unfollowedShops = shopSet.size;

      for (const cab in virtualMrgStats.byCabang) {
        virtualMrgStats.byCabang[cab].unfollowedShops = virtualMrgStats.byCabang[cab]._shops.size;
        delete virtualMrgStats.byCabang[cab]._shops;
      }
    } catch (err) {
      logger.warn(`[dashboard.service] Gagal memuat resume virtual margin: ${err.message}`);
    }

    // ── 3. KASUS KESIAPAN CLOSING BULANAN (SPACE HDD) ──
    const closingSpaceStats = {
      totalBranches: 0,
      uncheckedBranches: 0,
      criticalUnfollowed: 0,
      warningUnfollowed: 0,
      byCabang: {},
    };

    try {
      const hddRows = await spaceHddService.getAll(periode, "All");
      closingSpaceStats.totalBranches = hddRows.length;

      for (const r of hddRows) {
        const cab = r.KDCAB;
        const isChecked = r.FREE_SPACE !== null && r.FREE_SPACE !== undefined && r.FREE_SPACE !== "";
        const freeGb = r.freeSpaceGb;
        const predGb = r.predictedUsage;
        const hasFu = Boolean(r.FU && r.FU.trim() !== "" && r.FU !== "—");

        let status = "ok";
        let needsFu = false;

        if (!isChecked) {
          status = "unchecked";
          needsFu = true;
          closingSpaceStats.uncheckedBranches++;
        } else if ((predGb !== null && predGb < 10) || (freeGb !== null && freeGb < 10)) {
          status = "critical";
          if (!hasFu) {
            needsFu = true;
            closingSpaceStats.criticalUnfollowed++;
          }
        } else if ((freeGb !== null && freeGb < 30) || (r.usageDiskSpace !== null && r.usageDiskSpace < -20)) {
          status = "warning";
          if (!hasFu) {
            needsFu = true;
            closingSpaceStats.warningUnfollowed++;
          }
        }

        closingSpaceStats.byCabang[cab] = {
          kdcab: cab,
          ip: r.IP || "—",
          os: r.OS || "—",
          freeSpace: r.FREE_SPACE || "Belum Cek",
          freeSpaceGb: freeGb,
          predictedGb: predGb,
          usageDiskSpace: r.usageDiskSpace,
          status,
          fu: r.FU || null,
          freeAfter: r.FREE_AFTER || null,
          hasFu,
          needsFu,
        };
      }
    } catch (err) {
      logger.warn(`[dashboard.service] Gagal memuat resume space closing: ${err.message}`);
    }

    // ── 4. GABUNGKAN KE BRANCH ATTENTION MATRIX ──
    let registeredBranches = [];
    try {
      registeredBranches = await storeService.getRegisteredBranches();
    } catch {
      registeredBranches = [];
    }

    const allCabSet = new Set([
      ...registeredBranches,
      ...Object.keys(penyesuaianStats.byCabang),
      ...Object.keys(virtualMrgStats.byCabang),
      ...Object.keys(closingSpaceStats.byCabang),
    ]);

    const branchMatrix = Array.from(allCabSet)
      .filter(Boolean)
      .map((cab) => {
        const namaCabang = branchNameMap.get(cab) || cab;
        const penyesuaian = penyesuaianStats.byCabang[cab] || {
          totalStores: 0,
          unfollowedStores: 0,
          totalNominalUnfollowed: 0,
          avgNominalUnfollowed: 0,
          maxNominalUnfollowed: 0,
          minNominalUnfollowed: 0,
          maxStore: null,
          minStore: null,
          fantasticCount: 0,
        };
        const virtualMrg = virtualMrgStats.byCabang[cab] || {
          totalItems: 0,
          unfollowedItems: 0,
          unfollowedShops: 0,
          totalSel: 0,
        };
        const closingSpace = closingSpaceStats.byCabang[cab] || {
          kdcab: cab,
          freeSpace: "—",
          freeSpaceGb: null,
          predictedGb: null,
          status: "unchecked",
          hasFu: false,
          needsFu: true,
        };

        const needsAttention =
          penyesuaian.unfollowedStores > 0 ||
          virtualMrg.unfollowedItems > 0 ||
          closingSpace.needsFu;

        return {
          cabang: cab,
          namaCabang,
          needsAttention,
          penyesuaian,
          virtualMrg,
          closingSpace,
        };
      });

    // Urutkan cabang: Cabang yang perlu attention di atas, lalu urut kode cabang
    branchMatrix.sort((a, b) => {
      if (a.needsAttention && !b.needsAttention) return -1;
      if (!a.needsAttention && b.needsAttention) return 1;
      return a.cabang.localeCompare(b.cabang);
    });

    return {
      periode,
      kpi: {
        penyesuaian: {
          totalStores: penyesuaianStats.totalStores,
          unfollowedStores: penyesuaianStats.unfollowedStores,
          totalNominalUnfollowed: Math.round(penyesuaianStats.totalNominalUnfollowed),
          avgNominalUnfollowed: penyesuaianStats.avgNominalUnfollowed,
          maxNominalUnfollowed: penyesuaianStats.maxNominalUnfollowed,
          minNominalUnfollowed: penyesuaianStats.minNominalUnfollowed,
          maxStore: penyesuaianStats.maxStore,
          minStore: penyesuaianStats.minStore,
          fantasticCount: penyesuaianStats.fantasticStores.length,
          fantasticStores: penyesuaianStats.fantasticStores.slice(0, 10),
        },
        virtualMrg: {
          totalItems: virtualMrgStats.totalItems,
          unfollowedItems: virtualMrgStats.unfollowedItems,
          unfollowedShops: virtualMrgStats.unfollowedShops,
        },
        closingSpace: {
          totalBranches: closingSpaceStats.totalBranches,
          uncheckedBranches: closingSpaceStats.uncheckedBranches,
          criticalUnfollowed: closingSpaceStats.criticalUnfollowed,
          warningUnfollowed: closingSpaceStats.warningUnfollowed,
          totalNeedsFu:
            closingSpaceStats.criticalUnfollowed +
            closingSpaceStats.warningUnfollowed +
            closingSpaceStats.uncheckedBranches,
        },
      },
      branches: branchMatrix,
    };
  }
}

export default new DashboardService();
