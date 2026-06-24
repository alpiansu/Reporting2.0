/**
 * Combined Screening Service
 * Runs multiple screening modules per store using a SINGLE shared DB connection.
 *
 * Architecture:
 *   1 connection per store → run N modules sequentially → close connection
 *   Instead of N connections per store (1 per module).
 */
import logger from "../../config/logger.js";
import config from "./combined_screening.config.js";
import dbStore from "../../config/db_store.js";
import storeService from "../store/storeService.js";
import pLimit from "p-limit";
import moment from "moment-timezone";
import mysql from "mysql2/promise";
import screeningGuard from "../../utils/screeningGuard.js";
import progressService from "../progress/progress.service.js";
import RekapRemoteService from "../rekap_remote/rekap_remote.service.js";
import rekapRemoteStagingService from "../rekap_remote/rekap_remote_staging.service.js";

// Module services
import rekonVirtualService from "../rekon_virtual_mrg/rekon_virtual_mrg.service.js";
import penyesuaianService from "../penyesuaian/penyesuaian.service.js";
import prepClosingService from "../prep-closing/prep_closing.service.js";
import rekonPersediaanService from "../rekon_persediaan/rekon_persediaan.service.js";
import rekonSalesService from "../rekon_sales/rekon_sales.service.js";
import { wrcExtractorService } from "../prep-closing/wrc_extractor.service.js";
import wrcBulananService from "../../services/wrc.service.js";
import WrcDataHelper from "../rekon_sales/helpers/wrc.data.helper.js";

const wrcService = new wrcBulananService();

class CombinedScreeningService {
  constructor() {
    this.moduleServiceMap = {
      rekon_virtual_mrg: rekonVirtualService,
      penyesuaian: penyesuaianService,
      prep_closing: prepClosingService,
      rekon_persediaan: rekonPersediaanService,
      rekon_sales: rekonSalesService,
    };
  }

  // Helper to persist module screening result to RekapRemoteService
  async persistModuleResult(moduleName, cab, storeCode, status, detail = "") {
    const msg = `[${storeCode}] ${status}` + (detail ? ` – ${detail}` : "");
    await RekapRemoteService.addToTemp(cab, storeCode, moduleName, msg);
  }

  /**
   * Main entry point: run combined screening for all enabled modules.
   * @param {Object} options - { cabang, periode, username, fullName, force }
   */
  async screening(options) {
    await storeService.ensureInitialized();

    const { cabang, periode, username, fullName, force } = options;
    const taskId = `${config.taskProgressName}_${username}`;

    // ── 1. Resolve global context ─────────────────────────────────────────
    const strPeriode = periode; // YYMM
    const strYear = moment(periode, "YYMM").format("YYYY");
    const strMonth = moment(periode, "YYMM").format("MM");
    const globalContext = { strPeriode, strYear, strMonth };

    logger.info(
      `[combined_screening] Starting combined screening: cabang=${cabang}, periode=${periode}, force=${force}, by=${username}`,
    );

    // ── 2. Pre-load WRC cache (for prep_closing) ─────────────────────────
    const enabledModules = config.modules.filter(m => m.enabled);
    if (enabledModules.some(m => m.requiresWrcCache)) {
      try {
        await wrcExtractorService.loadCache();
        logger.info("[combined_screening] WRC cache pre-loaded for prep_closing");
      } catch (err) {
        logger.warn(`[combined_screening] WRC cache load failed: ${err.message} — prep_closing may still work`);
      }
    }

    // ── 3. Collect stores ────────────────────────────────────────────────
    let branches = [];
    if (cabang === "All" || cabang === "ALL") {
      const allStores = storeService.stores;
      branches = [...new Set(allStores.filter(s => s.notes === "INDUK").map(s => s.branch || s.cab))];
    } else {
      branches = [cabang];
    }

    const storeGroups = await Promise.all(
      branches.map(cab => storeService.getStoresByBranch(cab, true).then(stores => stores.map(s => ({ ...s, cab })))),
    );
    const storesToProcess = storeGroups.flat();

    logger.info(
      `[combined_screening] Total stores to process: ${storesToProcess.length} across ${branches.length} branches`,
    );

    // ── 4. Pre-compute per-branch resources ──────────────────────────────
    // Dates for rekon_persediaan
    const dates = [];
    if (enabledModules.some(m => m.name === "rekon_persediaan")) {
      const targetMoment = moment(`${strYear}-${strMonth}`, "YYYY-MM");
      const today = moment();
      const isCurrentMonth = targetMoment.isSame(today, "month");
      const lastDay = isCurrentMonth ? today.date() - 1 : targetMoment.daysInMonth();
      for (let i = 1; i <= lastDay; i++) {
        dates.push(moment(`${strYear}-${strMonth}-${i.toString().padStart(2, "0")}`).format("YYYY-MM-DD"));
      }
    }

    // WRC pools for rekon_persediaan (per branch)
    const wrcPools = new Map();
    const wrcDataCache = new Map();

    // GL data for rekon_sales (per branch)
    const glDataByBranch = new Map();
    if (enabledModules.some(m => m.name === "rekon_sales")) {
      for (const cab of branches) {
        try {
          logger.info(`[combined_screening] Fetching GL data for branch: ${cab}`);
          const { data: glData } = await WrcDataHelper.openDataGLWrc(cab, "ALL", strMonth, strYear);
          glDataByBranch.set(cab, glData || []);
          logger.info(`[combined_screening] Branch ${cab}: ${(glData || []).length} GL records`);
        } catch (err) {
          logger.warn(`[combined_screening] GL data fetch failed for ${cab}: ${err.message}`);
          glDataByBranch.set(cab, []);
        }
      }
    }

    // WRC batch fetch helper for rekon_persediaan (same pattern as module)
    const fetchWrcBatch = async (cab, pool) => {
      if (wrcDataCache.has(cab)) return wrcDataCache.get(cab);

      logger.info(`[combined_screening] Batching WRC data for branch ${cab}...`);
      const [tables] = await pool.query("SHOW TABLES LIKE 'glslp_%'");
      const existingTableNames = tables.map(t => Object.values(t)[0]);

      const queries = [];
      const params = [];
      for (const date of dates) {
        const table = `glslp_${moment(date).format("YYMMDD")}`;
        if (existingTableNames.includes(table)) {
          queries.push(`
            SELECT KODE_TOKO, ? as AS_DATE,
                   SUM(CASE WHEN SUBKODE = '01' THEN AMOUNT_DR+FEE_DPP_DR+FEE_DR_PPN ELSE 0 END) AS HPP_DRY,
                   SUM(CASE WHEN SUBKODE = '02' THEN AMOUNT_DR+FEE_DPP_DR+FEE_DR_PPN ELSE 0 END) AS HPP_ISTORE,
                   SUM(CASE WHEN SUBKODE = '03' THEN AMOUNT_DR+FEE_DPP_DR+FEE_DR_PPN ELSE 0 END) AS HPP_RESTO,
                   SUM(CASE WHEN SUBKODE = '06' THEN AMOUNT_DR+FEE_DPP_DR+FEE_DR_PPN ELSE 0 END) AS HPP_VIRTUAL,
                   SUM(CASE WHEN SUBKODE = '07' THEN AMOUNT_DR+FEE_DPP_DR+FEE_DR_PPN ELSE 0 END) AS HPP_SPC_STORE
            FROM ${table}
            WHERE KODE = 25
            GROUP BY KODE_TOKO
          `);
          params.push(date);
        }
      }

      const branchDataMap = new Map();
      if (queries.length > 0) {
        const [rows] = await pool.query(queries.join(" UNION ALL "), params);
        for (const row of rows) {
          const key = `${row.KODE_TOKO}_${moment(row.AS_DATE).format("YYYY-MM-DD")}`;
          branchDataMap.set(key, row);
        }
      }

      wrcDataCache.set(cab, branchDataMap);
      return branchDataMap;
    };

    // ── 5. Register progress task ────────────────────────────────────────
    try {
      const timeStart = moment().format("YYYY-MM-DD HH:mm:ss");
      await progressService.startProgress(taskId, storesToProcess.length, {
        module: "combined_screening",
        title: "Combined Screening (All Modules)",
        description: "registering task",
        startedBy: fullName || username,
        status: "registering",
        createdAt: timeStart,
      });
      logger.info(`[combined_screening] Progress task registered: ${taskId}`);
    } catch (error) {
      logger.error(`[combined_screening] Error registering progress: ${error.message}`);
      if (error.message.includes("Maximum concurrent") || error.code === "TASK_BUSY") {
        await progressService.failProgress(taskId, {
          description: `Task failed: ${error.message}`,
          status: "failed",
        });
        throw new Error("[combined_screening] System is busy processing other tasks");
      }
      await progressService.failProgress(taskId, {
        description: `Task failed: ${error.message}`,
        status: "failed",
      });
      throw new Error("[combined_screening] Failed to register progress task");
    }

    // ── 6. Process stores in parallel ────────────────────────────────────
    const limitStores = pLimit(config.parallelProcessing.concurrencyLimit);
    let processedCount = 0;
    const totalStores = storesToProcess.length;

    const withTimeout = (promise, ms, label) =>
      Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error(`Timeout: ${label}`)), ms))]);

    const incrementProgress = async (storeCode, statusText) => {
      processedCount++;
      await progressService.updateProgress(taskId, processedCount, {
        description: `Store ${storeCode} → ${statusText} (${processedCount}/${totalStores})`,
        status: "Screening (Combined)",
      });
    };

    const storeTimeoutMs = config.parallelProcessing.storeTimeoutMs;

    try {
      await Promise.all(
        storesToProcess.map(store =>
          limitStores(async () => {
            const { cab, storeCode } = store;

            // Check abort
            if (progressService.isAborted(taskId)) {
              logger.info(`[combined_screening] Skipping store ${storeCode} — task aborted`);
              await incrementProgress(storeCode, "Dibatalkan ⛔");
              return;
            }

            logger.info(`[combined_screening] [STORE] Starting ${storeCode} (${cab})`);
            const storeStart = Date.now();

            try {
              await withTimeout(
                this._processStoreAllModules(store, globalContext, force, enabledModules, {
                  dates,
                  wrcPools,
                  wrcDataCache,
                  fetchWrcBatch,
                  glDataByBranch,
                }),
                storeTimeoutMs,
                `store ${storeCode} exceeded ${storeTimeoutMs / 1000}s timeout`,
              );

              const elapsed = Date.now() - storeStart;
              logger.info(`[combined_screening] [STORE] ${storeCode} done in ${elapsed}ms`);
              await incrementProgress(storeCode, "Done ✅");
            } catch (storeErr) {
              const elapsed = Date.now() - storeStart;
              logger.error(`[combined_screening] [STORE] ${storeCode} FAILED after ${elapsed}ms: ${storeErr.message}`);
              for (const mod of enabledModules) {
                await this.persistModuleResult(mod.name, cab, storeCode, "error", storeErr.message);
              }
              await incrementProgress(storeCode, "Error ❌");
            }
          }),
        ),
      );

      // ── 7. Finalization ──────────────────────────────────────────────
      if (progressService.isAborted(taskId)) {
        logger.info(`[combined_screening] Task ${taskId} was cancelled — skipping finalization`);
        throw new Error("Proses dibatalkan oleh pengguna");
      }

      // Save rekap_remote logs to DB
      logger.info(`[combined_screening] [FINALIZATION 1/3] Saving rekap_remote logs to database...`);
      try {
        const saveResult = await RekapRemoteService.saveLogsToDatabase();
        logger.info(`[combined_screening] [FINALIZATION 1/3] rekap_remote saved: ${saveResult?.savedCount ?? 0} records`);
      } catch (saveErr) {
        logger.error(`[combined_screening] [FINALIZATION 1/3] saveLogsToDatabase error: ${saveErr.message}`);
      }

      // Sync JSON files for each enabled module (once after all stores)
      const syncedModules = [];
      if (config.syncAfterAllStores) {
        logger.info(`[combined_screening] [FINALIZATION 2/3] Syncing JSON files for ${enabledModules.length} modules...`);
        for (const mod of enabledModules) {
          const service = this.moduleServiceMap[mod.name];
          if (service && typeof service.syncToJsonFile === "function") {
            logger.info(`[combined_screening] [FINALIZATION 2/3]   → syncing ${mod.name}...`);
            const syncStart = Date.now();
            try {
              if (mod.name === "rekon_sales") {
                await service.syncToJsonFile(strYear, strMonth);
              } else if (mod.name === "rekon_virtual_mrg") {
                await service.ensureDataLoaded(periode);
              } else {
                await service.syncToJsonFile(strPeriode);
              }
              syncedModules.push(mod.name);
              logger.info(`[combined_screening] [FINALIZATION 2/3]   ✓ ${mod.name} synced in ${Date.now() - syncStart}ms`);
            } catch (e) {
              logger.warn(`[combined_screening] [FINALIZATION 2/3]   ✗ ${mod.name} sync failed in ${Date.now() - syncStart}ms: ${e.message}`);
            }
          }
        }
        logger.info(`[combined_screening] [FINALIZATION 2/3] Sync complete: ${syncedModules.join(", ")}`);
      }

      logger.info(`[combined_screening] [FINALIZATION 3/3] Marking task as completed...`);
      const timeCompleted = moment().format("YYYY-MM-DD HH:mm:ss");
      await progressService.completeProgress(taskId, {
        description: "All stores processed",
        status: "completed",
        completedAt: timeCompleted,
      });
      logger.info(`[combined_screening] [FINALIZATION 3/3] Task ${taskId} completed at ${timeCompleted}`);

      return {
        success: true,
        message: "Combined screening completed",
        totalStores,
        processedCount,
        syncedModules,
      };
    } catch (error) {
      if (progressService.isAborted(taskId)) {
        logger.info(`[combined_screening] Task ${taskId} was cancelled — skipping failProgress`);
        return { success: false, message: "Proses dibatalkan oleh pengguna", cancelled: true };
      }

      logger.error(`[combined_screening] Error: ${error.message}`);
      await progressService.failProgress(taskId, {
        description: error.message,
        status: "failed",
      });
      throw error;
    } finally {
      // Close all WRC pools
      for (const pool of wrcPools.values()) {
        try {
          await pool.end();
        } catch (e) {
          logger.warn(`[combined_screening] WRC pool close error: ${e.message}`);
        }
      }
    }
  }

  /**
   * Process ALL enabled modules for a single store using 1 shared connection.
   */
  async _processStoreAllModules(store, globalContext, force, enabledModules, branchResources) {
    const { cab, storeCode } = store;
    const { dates, wrcPools, wrcDataCache, fetchWrcBatch, glDataByBranch } = branchResources;
    const moduleResults = {};

    // ── Get store info ───────────────────────────────────────────────────
    let storeInfo;
    try {
      storeInfo = await storeService.getStoreIPHost(storeCode);
    } catch (err) {
      logger.error(`[combined_screening] getStoreIPHost(${storeCode}) error: ${err.message}`);
    }

    if (!storeInfo) {
      // Log failure for ALL modules
      for (const mod of enabledModules) {
        await this.persistModuleResult(mod.name, cab, storeCode, "error", "store info not found");
        moduleResults[mod.name] = "store_info_not_found";
      }
      return moduleResults;
    }

    // ── Open 1 shared connection ─────────────────────────────────────────
    let storeConnection;
    try {
      storeConnection = await dbStore.createDbStore(storeInfo.dbHost, 2);
    } catch (err) {
      logger.error(`[combined_screening] Connection failed for ${storeCode}: ${err.message}`);
    }

    if (!storeConnection) {
      for (const mod of enabledModules) {
        await this.persistModuleResult(mod.name, cab, storeCode, "error", "connection failed");
        moduleResults[mod.name] = "connection_failed";
      }
      return moduleResults;
    }

    // ── Pre-compute WRC resources for rekon_persediaan if needed ──────────
    let wrcContext = null;
    const persediaanModule = enabledModules.find(m => m.name === "rekon_persediaan");
    if (persediaanModule) {
      try {
        if (!wrcPools.has(cab)) {
          const wrcConfig = await wrcService.getConnWRC(cab);
          wrcPools.set(cab, mysql.createPool({ ...wrcConfig, connectionLimit: 10 }));
        }
        const wrcPool = wrcPools.get(cab);
        const branchWrcMap = await fetchWrcBatch(cab, wrcPool);
        wrcContext = { wrcPool, branchWrcMap };
      } catch (err) {
        logger.warn(`[combined_screening] WRC pool setup failed for ${cab}: ${err.message}`);
      }
    }

    // ── Loop modules sequentially with shared connection ─────────────────
    try {
      for (const moduleConfig of enabledModules) {
        // Guard check
        if (!force) {
          const guard = await screeningGuard.isSuccessToday(moduleConfig.name, storeCode);
          if (guard.screened) {
            logger.info(`[combined_screening] ${moduleConfig.name}/${storeCode}: skip (guard: ${guard.reason})`);
            await this.persistModuleResult(moduleConfig.name, cab, storeCode, "skip", guard.reason);
            moduleResults[moduleConfig.name] = "skip_guard";
            continue;
          }
        }

        // Execute module
        logger.info(`[combined_screening] [MODULE] ${storeCode}/${moduleConfig.name}: starting...`);
        const moduleStart = Date.now();
        try {
          await this._executeModuleScreening(moduleConfig, store, globalContext, storeConnection, {
            dates,
            wrcContext,
            glDataByBranch,
          });

          const moduleElapsed = Date.now() - moduleStart;
          logger.info(`[combined_screening] [MODULE] ${storeCode}/${moduleConfig.name}: done in ${moduleElapsed}ms`);
          await this.persistModuleResult(moduleConfig.name, cab, storeCode, "success");
          moduleResults[moduleConfig.name] = "success";
        } catch (moduleError) {
          const moduleElapsed = Date.now() - moduleStart;
          logger.error(`[combined_screening] [MODULE] ${storeCode}/${moduleConfig.name}: ERROR in ${moduleElapsed}ms — ${moduleError.message}`);
          await this.persistModuleResult(moduleConfig.name, cab, storeCode, "error", moduleError.message);
          moduleResults[moduleConfig.name] = `error: ${moduleError.message}`;
        }
      }
    } finally {
      // Close the shared connection
      try {
        await storeConnection.end();
      } catch (e) {
        logger.warn(`[combined_screening] Connection close error for ${storeCode}: ${e.message}`);
      }
    }

    return moduleResults;
  }

  /**
   * Dispatch to the correct module's processSingleStore with shared connection.
   */
  async _executeModuleScreening(moduleConfig, store, globalContext, sharedConnection, resources) {
    const { dates, wrcContext, glDataByBranch } = resources;
    const { cab } = store;
    const service = this.moduleServiceMap[moduleConfig.name];

    if (!service) {
      throw new Error(`Unknown module: ${moduleConfig.name}`);
    }

    const params = moduleConfig.resolveParams(globalContext);

    switch (moduleConfig.name) {
      case "rekon_virtual_mrg":
        return service.processSingleStore(store, params.strYear, params.strMonth, sharedConnection, { suppressIntermediateLogs: true });

      case "penyesuaian":
        return service.processSingleStore(store, params.strPeriode, params.strYear, params.strMonth, sharedConnection, null, { suppressIntermediateLogs: true });

      case "prep_closing":
        return service.processSingleStore(store, params.strPeriode, params.strYear, params.strMonth, sharedConnection, { suppressIntermediateLogs: true });

      case "rekon_persediaan":
        return service.processSingleStore(
          store,
          params.strPeriode,
          params.strYear,
          params.strMonth,
          dates,
          wrcContext,
          sharedConnection,
          { suppressIntermediateLogs: true },
        );

      case "rekon_sales": {
        const glData = glDataByBranch.get(cab) || [];
        // Use deferSave: false so results are saved immediately per-store
        // (combined screening doesn't do the batch aggregation pattern)
        return service.processSingleStore(
          store,
          params.strMonth,
          params.strYear,
          glData,
          { deferSave: false },
          sharedConnection,
        );
      }

      default:
        throw new Error(`Unknown module: ${moduleConfig.name}`);
    }
  }

  /**
   * Get current config (enabled/disabled modules)
   */
  getConfig() {
    return {
      modules: config.modules.map(m => ({
        name: m.name,
        enabled: m.enabled,
        requiresWrcCache: m.requiresWrcCache || false,
        requiresWrcPool: m.requiresWrcPool || false,
        requiresGlData: m.requiresGlData || false,
      })),
      parallelProcessing: config.parallelProcessing,
      taskProgressName: config.taskProgressName,
    };
  }

  /**
   * Toggle module enabled/disabled at runtime
   */
  toggleModule(moduleName, enabled) {
    const module = config.modules.find(m => m.name === moduleName);
    if (!module) throw new Error(`Module ${moduleName} not found in combined screening config`);
    module.enabled = enabled;
    logger.info(`[combined_screening] Module ${moduleName} ${enabled ? "enabled" : "disabled"}`);
    return { name: moduleName, enabled: module.enabled };
  }
}

export default new CombinedScreeningService();
