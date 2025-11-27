/**
 * Service for Rekon Sales (Sales Reconciliation)
 * Updated version with modular architecture and proper field mapping
 */
import logger from "../../config/logger.js";
import RekonSales from "./models/rekon_sales.model.js";
import DetailRekonSales from "./models/detail_rekon_sales.model.js";
import MtranVsCd from "./models/mtran_vs_cd.model.js";
import dbStore from "../../config/db_store.js";
import config from "./rekon_sales.config.js";
import CacheManager from "./cache.manager.js";
import storeService from "../store/storeService.js";
import pLimit from "p-limit";
import moment from "moment-timezone";
import RekapRemoteService from "../rekap_remote/rekap_remote.service.js";
import notesService from "../notes/notes.service.js";
import progressService from "../progress/progress.service.js";

// Import helper modules
import StoreQueryHelper from "./helpers/store.query.helper.js";
import RekonCalculator from "./helpers/rekon.calculator.js";

class RekonSalesService {
  constructor() {
    // Initialize cache manager
    this.cacheManager = new CacheManager(config);
    this.initialized = false;
  }

  /**
   * Initialize service
   */
  async initialize() {
    if (this.initialized) return;

    try {
      await this.cacheManager.initialize();
      this.initialized = true;
      logger.info("[rekon_sales.service] Service initialized");
    } catch (error) {
      logger.error(`[rekon_sales.service] Failed to initialize: ${error.message}`);
      throw error;
    }
  }

  /**
   * Ensure service is initialized
   */
  async ensureInitialized() {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  /**
   * Get cache key for summary data
   */
  getCacheKey(year, month, cabang = "All") {
    return this.cacheManager.generateKey({ type: "summary", year, month, cabang });
  }

  /**
   * Invalidate all cache
   */
  invalidateCache() {
    this.cacheManager.clear();
    logger.info("[rekon_sales.service] Cache invalidated");
  }

  /**
   * Sync data to JSON file (per periode)
   */
  async syncToJsonFile(year, month) {
    try {
      const model = await RekonSales.getModel();
      const sequelize = model.sequelize;

      // Query agregasi untuk periode tertentu
      const [rows] = await sequelize.query(
        `
        SELECT 
          RECID,
          CAB,
          KDTK,
          TGL AS TANGGAL,
          NET_TOKO,
          NET_GL,
          NET_CD,
          SEL_NET_GL,
          SEL_NET_CD,
          PPN_TOKO,
          PPN_GL,
          PPN_CD,
          SEL_PPN_GL,
          SEL_PPN_CD,
          NET_RETUR_ECOM,
          PPN_RETUR_ECOM,
          RETUR_PPNJP_ISTORE,
          updated_at AS UPDTIME
        FROM rekon_sales
        WHERE RECID = '*'
          AND MONTH(TGL) = :month
          AND YEAR(TGL) = :year
        ORDER BY CAB, KDTK, TGL
      `,
        {
          replacements: { month, year },
        }
      );

      const formattedData = rows.map(r => ({
        RECID: r.RECID,
        CAB: r.CAB,
        KDTK: r.KDTK,
        TANGGAL: r.TANGGAL,
        NET_TOKO: parseFloat(r.NET_TOKO) || 0,
        NET_GL: parseFloat(r.NET_GL) || 0,
        NET_CD: parseFloat(r.NET_CD) || 0,
        SEL_NET_GL: parseFloat(r.SEL_NET_GL) || 0,
        SEL_NET_CD: parseFloat(r.SEL_NET_CD) || 0,
        PPN_TOKO: parseFloat(r.PPN_TOKO) || 0,
        PPN_GL: parseFloat(r.PPN_GL) || 0,
        PPN_CD: parseFloat(r.PPN_CD) || 0,
        SEL_PPN_GL: parseFloat(r.SEL_PPN_GL) || 0,
        SEL_PPN_CD: parseFloat(r.SEL_PPN_CD) || 0,
        NET_RETUR_ECOM: parseFloat(r.NET_RETUR_ECOM) || 0,
        PPN_RETUR_ECOM: parseFloat(r.PPN_RETUR_ECOM) || 0,
        RETUR_PPNJP_ISTORE: parseFloat(r.RETUR_PPNJP_ISTORE) || 0,
        UPDTIME: r.UPDTIME,
      }));

      // Save to JSON file (per periode)
      await this.cacheManager.saveToFile(year, month, formattedData);

      // Update in-memory cache
      const cacheKey = this.getCacheKey(year, month);
      this.cacheManager.set(cacheKey, formattedData, config.cache.summaryTTL);

      logger.info(`[rekon_sales.service] Synced ${formattedData.length} records to JSON for ${year}-${month}`);

      return formattedData;
    } catch (error) {
      logger.error(`[rekon_sales.service] Failed to sync to JSON: ${error.message}`);
      throw error;
    }
  }

  /**
   * Load data from cache or file
   */
  async loadData(year, month, cabang = "All") {
    try {
      await this.ensureInitialized();

      const cacheKey = this.getCacheKey(year, month, cabang);

      // Try memory cache first
      let data = this.cacheManager.get(cacheKey, config.cache.summaryTTL);

      if (data) {
        logger.debug(`[rekon_sales.service] Data loaded from memory cache for ${year}-${month}`);
        return data;
      }

      // Try file cache
      data = await this.cacheManager.loadFromFile(year, month);

      if (data && data.length > 0) {
        // Store in memory cache
        this.cacheManager.set(cacheKey, data, config.cache.summaryTTL);
        logger.info(`[rekon_sales.service] Data loaded from file cache for ${year}-${month}`);
        return data;
      }

      // No cache available, sync from database
      logger.info(`[rekon_sales.service] No cache available, syncing from database for ${year}-${month}`);
      data = await this.syncToJsonFile(year, month);

      return data;
    } catch (error) {
      logger.error(`[rekon_sales.service] Error loading data: ${error.message}`);
      throw error;
    }
  }

  /**
   * Process single store screening
   */
  async processSingleStore(store, strMonth, strYear, dataGL) {
    const { storeCode, cab } = store;
    const results = { success: false, records: null, hasIssue: false };

    try {
      // Get store info
      const storeInfo = await storeService.getStoreIPHost(storeCode);

      if (!storeInfo) {
        await RekapRemoteService.addToTemp(cab, storeCode, "rekon_sales", `[${storeCode}] store info not found`);
        return results;
      }

      // Create DB connection
      const storeConnection = await dbStore.createDbStore(storeInfo.dbHost, config.connectionRetry.maxRetries);

      if (!storeConnection) {
        await RekapRemoteService.addToTemp(
          cab,
          storeCode,
          "rekon_sales",
          `[${storeCode}] failed to connect after ${config.connectionRetry.maxRetries} attempts`
        );
        return results;
      }

      try {
        await RekapRemoteService.addToTemp(cab, storeCode, "rekon_sales", `[${storeCode}] fetching mtran data...`);

        // STEP 1: Fetch mtran vs closing detail using helper
        const mtranData = await StoreQueryHelper.fetchMtranVsCD(storeConnection, strMonth, strYear);

        if (mtranData.length === 0) {
          await RekapRemoteService.addToTemp(cab, storeCode, "rekon_sales", `[${storeCode}] no data found`);
          results.success = true;
          results.hasIssue = false;
          return results;
        }

        await RekapRemoteService.addToTemp(
          cab,
          storeCode,
          "rekon_sales",
          `[${storeCode}] processing ${mtranData.length} transactions...`
        );

        // STEP 2: Rekon vs GL using calculator
        const rekonResults = await RekonCalculator.calculateRekon(
          cab,
          storeCode,
          strMonth,
          strYear,
          mtranData,
          dataGL,
          storeConnection
        );

        if (rekonResults.length > 0) {
          // STEP 3: Check differences (mtran vs closing detail) if needed
          let diffData = [];
          const hasDifferences = rekonResults.some(r => Math.abs(r.SEL_NET_CD) > config.tolerance);

          if (hasDifferences) {
            diffData = await StoreQueryHelper.cekSelisihMtranVsCD(storeConnection, strMonth, strYear);
          }

          // Save results
          await this.saveRekonResults(cab, storeCode, strMonth, strYear, rekonResults, diffData);

          await RekapRemoteService.addToTemp(
            cab,
            storeCode,
            "rekon_sales",
            `[${storeCode}] found ${rekonResults.length} issues`
          );

          results.records = rekonResults;
          results.hasIssue = true;
          results.success = true;
        } else {
          results.success = true;
          results.hasIssue = false;
        }
      } finally {
        await storeConnection.end();
      }
    } catch (err) {
      await RekapRemoteService.addToTemp(cab, storeCode, "rekon_sales", `[${storeCode}] ERROR: ${err.message}`);
      logger.error(`[rekon_sales.service] Error processing store ${storeCode}: ${err.message}`);
    }

    return results;
  }

  /**
   * Rekon vs GL - Main reconciliation logic
   */
  async rekonVsGl(cab, kdtk, strMonth, strYear, mtranData, dataGL, storeConnection) {
    try {
      logger.info(`[rekon_sales.service] Starting rekonVsGl for store ${kdtk}`);

      const cariData = async (kodeToko, tglGL) => {
        return dataGL.filter(item => item.KODE_TOKO === kodeToko && item.TGL_GL === tglGL);
      };

      // Aggregate data per date
      const valResume = {};
      const dataResume = mtranData.map(async item => {
        const dataGLItem = await cariData(item.SHOP, item.TANGGAL);
        const keyData = `${item.SHOP}-${item.TANGGAL}`;

        if (!valResume[keyData]) {
          valResume[keyData] = {
            CAB: item.CAB,
            SHOP: item.SHOP,
            TANGGAL: item.TANGGAL,
            NET_MTRAN: 0,
            NET_GL: dataGLItem.length > 0 ? parseFloat(dataGLItem[0].NET_GL) : 0,
            NET_ClosingDetail: 0,
            SEL_NET_GL: 0,
            SEL_NET_CD: 0,
            PPN_MTRAN: 0,
            PPN_GL: dataGLItem.length > 0 ? parseFloat(dataGLItem[0].PPN_GL) : 0,
            PPN_CD: 0,
            SEL_PPN_GL: 0,
            SEL_PPN_CD: 0,
            NET_RETUR_ECOM: dataGLItem.length > 0 ? parseFloat(dataGLItem[0].NET_RETUR_ECOM) : 0,
            PPN_RETUR_ECOM: dataGLItem.length > 0 ? parseFloat(dataGLItem[0].PPN_RETUR_ECOM) : 0,
            RETUR_PPNJP_ISTORE: 0,
          };
        }

        valResume[keyData].NET_MTRAN += parseFloat(item.NET_MTRAN);
        valResume[keyData].NET_ClosingDetail += parseFloat(item.NET_ClosingDetail);
        valResume[keyData].PPN_MTRAN += parseFloat(item.PPN_MTRAN) - parseFloat(item.PPN_IO || 0);
        valResume[keyData].PPN_CD += parseFloat(item.PPN_CD);
        valResume[keyData].RETUR_PPNJP_ISTORE += parseFloat(item.RETUR_PPNJP_ISTORE || 0);

        // Reset detail records
        await this.resetDetailRecid(item.SHOP, item.TANGGAL);
      });
      await Promise.all(dataResume);

      // Calculate differences
      const keysResume = Object.keys(valResume);
      keysResume.forEach(key => {
        const item = valResume[key];
        item.SEL_NET_GL = parseFloat(item.NET_MTRAN) - parseFloat(item.NET_GL);
        item.SEL_NET_CD = parseFloat(item.NET_MTRAN) - parseFloat(item.NET_ClosingDetail);
        item.SEL_PPN_GL = parseFloat(item.PPN_MTRAN) - parseFloat(item.PPN_GL);
        item.SEL_PPN_CD = parseFloat(item.PPN_MTRAN) - parseFloat(item.PPN_CD);
      });

      // Check kode pesanan
      const checkKodePesanan = await this.rekonKodePesanan(cab, kdtk, mtranData, dataGL);

      // Filter data based on threshold
      const finalData = [];
      const tolerance = config.tolerance || 50;

      for (const key of keysResume) {
        const item = valResume[key];
        const [keyKdtk, keyTgl] = this.extractKeys(key);

        const resultKodePesanan = checkKodePesanan.filter(issue => issue.SHOP === keyKdtk && issue.TANGGAL === keyTgl);

        if (
          Math.abs(item.SEL_NET_GL) > tolerance ||
          Math.abs(item.SEL_NET_CD) > tolerance ||
          Math.abs(item.SEL_PPN_GL) > tolerance ||
          Math.abs(item.SEL_PPN_CD) > tolerance ||
          resultKodePesanan.length > 0
        ) {
          finalData.push(item);
        }
      }

      // Skip records where closing detail is zero
      const filteredData = await this.skipDataClosingDetailZero(finalData, tolerance);

      logger.info(`[rekon_sales.service] Completed rekonVsGl for store ${kdtk}, found ${filteredData.length} issues`);
      return filteredData;
    } catch (error) {
      logger.error(`[rekon_sales.service] Error in rekonVsGl: ${error.message}`);
      throw error;
    }
  }

  /**
   * Rekon kode pesanan - Check order code differences
   */
  async rekonKodePesanan(cab, kdtk, mtranData, dataGL) {
    try {
      logger.info(`[rekon_sales.service] Starting rekonKodePesanan for store ${kdtk}`);

      const cariData = async (kodeToko, tglGL) => {
        return dataGL.filter(item => item.KODE_TOKO === kodeToko && item.TGL_GL === tglGL);
      };

      const valResume = {};
      const dataResume = mtranData.map(async item => {
        const dataGLItem = await cariData(item.SHOP, item.TANGGAL);
        const kodePesananGL = await wrcService.tarikKodePesanan(cab, item.SHOP, item.TANGGAL);
        const keyData = `${item.SHOP}-${item.TANGGAL}`;

        if (!valResume[keyData]) {
          valResume[keyData] = {
            CAB: item.CAB,
            SHOP: item.SHOP,
            TANGGAL: item.TANGGAL,
            SUBKEY: "SEL_KODEPESANAN",
            KODEPESANANTOKO: "",
            KODEPSANANGL: kodePesananGL,
            SELKODE: [],
          };
        }

        if (item.KODEPESANAN && item.KODEPESANAN !== "") {
          valResume[keyData].KODEPESANANTOKO += `,${item.KODEPESANAN}`;
        }
      });
      await Promise.all(dataResume);

      // Find differences
      const finalData = [];
      const keysResume = Object.keys(valResume);

      for (const key of keysResume) {
        const item = valResume[key];
        const kodePesananToko = item.KODEPESANANTOKO;
        const kodePesananGL = item.KODEPSANANGL;

        if (kodePesananGL && kodePesananToko) {
          if (kodePesananToko !== "" || kodePesananGL !== "") {
            const missingValues = this.findMissingValues(kodePesananToko, kodePesananGL);

            if (missingValues && missingValues.length > 0) {
              missingValues.forEach(value => {
                if (value !== "") {
                  finalData.push({
                    CAB: item.CAB,
                    SHOP: item.SHOP,
                    TANGGAL: item.TANGGAL,
                    SUBKEY: "SEL_KODEPESANAN",
                    SELKODE: value,
                  });
                }
              });
            }
          }
        }
      }

      // Save to detail table
      if (finalData.length > 0) {
        await this.saveDetailRekonSales(finalData);
      }

      logger.info(`[rekon_sales.service] Completed rekonKodePesanan, found ${finalData.length} issues`);
      return finalData;
    } catch (error) {
      logger.error(`[rekon_sales.service] Error in rekonKodePesanan: ${error.message}`);
      throw error;
    }
  }

  /**
   * Helper: Extract keys from combined key
   */
  extractKeys(dataSource) {
    const strKdtk = dataSource.substring(0, 4);
    const strTanggal = dataSource.substring(5, 15);
    return [strKdtk, strTanggal];
  }

  /**
   * Helper: Find missing values between two comma-separated strings
   */
  findMissingValues(string1, string2) {
    const array1 = string1.split(",").filter(Boolean);
    const array2 = string2.split(",").filter(Boolean);

    const set1 = new Set(array1);
    const set2 = new Set(array2);

    const difference = new Set([...set1].filter(x => !set2.has(x)));
    const differenceArray = Array.from(difference);

    return differenceArray.length === 0 ? false : differenceArray;
  }

  /**
   * Helper: Skip data if closing detail is zero and differences are within tolerance
   */
  async skipDataClosingDetailZero(dataCheck, tolerance = 50) {
    const dataFixed = [];

    for (const item of dataCheck) {
      const selGLNet = item.SEL_NET_GL;
      const selGLPpn = item.SEL_PPN_GL;
      const netCD = item.NET_ClosingDetail;
      const ppnCD = item.PPN_CD;

      if (Math.abs(selGLNet) > tolerance || Math.abs(selGLPpn) > tolerance || netCD !== 0 || ppnCD !== 0) {
        dataFixed.push(item);
      }
    }

    return dataFixed;
  }

  /**
   * Save rekon results to database
   */
  async saveRekonResults(cab, kdtk, strMonth, strYear, rekonResults, diffData) {
    try {
      // Delete existing records
      await this.deleteRekonSales(kdtk, strMonth, strYear);

      // Prepare rekon sales data
      const rekonSalesData = rekonResults.map(item => ({
        RECID: "*",
        CAB: item.CAB,
        SHOP: item.SHOP,
        TANGGAL: item.TANGGAL,
        NET_MTRAN: item.NET_MTRAN,
        NET_GL: item.NET_GL,
        NET_CLOSINGDETAIL: item.NET_ClosingDetail,
        SEL_NET_GL: item.SEL_NET_GL,
        SEL_NET_CD: item.SEL_NET_CD,
        PPN_MTRAN: item.PPN_MTRAN,
        PPN_GL: item.PPN_GL,
        PPN_CD: item.PPN_CD,
        SEL_PPN_GL: item.SEL_PPN_GL,
        SEL_PPN_CD: item.SEL_PPN_CD,
        NET_RETUR_ECOM: item.NET_RETUR_ECOM,
        PPN_RETUR_ECOM: item.PPN_RETUR_ECOM,
        RETUR_PPNJP_ISTORE: item.RETUR_PPNJP_ISTORE,
        UPDTIME: new Date(),
      }));

      // Save rekon sales
      await RekonSales.bulkCreate(rekonSalesData, {
        updateOnDuplicate: [
          "RECID",
          "NET_MTRAN",
          "NET_GL",
          "NET_CLOSINGDETAIL",
          "SEL_NET_GL",
          "SEL_NET_CD",
          "PPN_MTRAN",
          "PPN_GL",
          "PPN_CD",
          "SEL_PPN_GL",
          "SEL_PPN_CD",
          "NET_RETUR_ECOM",
          "PPN_RETUR_ECOM",
          "RETUR_PPNJP_ISTORE",
          "UPDTIME",
        ],
      });

      // Save mtran vs cd differences if any
      if (diffData && diffData.length > 0) {
        await this.deleteMtranVsCd(kdtk, strMonth, strYear);
        await this.saveMtranVsCd(diffData);
      }

      logger.info(`[rekon_sales.service] Saved rekon results for store ${kdtk}`);
    } catch (error) {
      logger.error(`[rekon_sales.service] Error saving rekon results: ${error.message}`);
      throw error;
    }
  }

  /**
   * Main screening method
   * Supports 3 levels: All cabang, 1 cabang, or 1 specific store
   */
  async screening(options) {
    // Ensure services are initialized
    await storeService.ensureInitialized();

    const { cabang, periode, kdtk, username } = options;

    // Parse periode (YYYY-MM format)
    const [strYear, strMonth] = periode.split("-");

    // === LEVEL 3: Single Store Screening (No Progress Task) ===
    if (kdtk) {
      logger.info(`[rekon_sales.service] Starting single store screening: ${kdtk}, periode: ${periode}`);

      try {
        // Get store info to determine cabang
        const storeInfo = await storeService.getStoreByCode(kdtk);
        const storeCab = storeInfo ? storeInfo.branch || storeInfo.cab : "UNKNOWN";

        // Get GL data from WRC
        const dataGL = await wrcService.openDataGLWrc(storeCab, kdtk, strMonth, strYear);

        // Process single store
        const result = await this.processSingleStore({ storeCode: kdtk, cab: storeCab }, strMonth, strYear, dataGL);

        // Save logs to database
        await RekapRemoteService.saveLogsToDatabase();

        // Update resolved records
        await this.updateResolvedRecords({
          month: strMonth,
          year: strYear,
          level: 3,
          kdtk: kdtk,
          hasIssue: result.hasIssue,
        });

        // Sync to JSON file
        await this.syncToJsonFile();

        return {
          success: true,
          message: `Single store screening completed for ${kdtk}`,
          hasIssues: result.hasIssue,
          issuesCount: result.records ? result.records.length : 0,
        };
      } catch (error) {
        logger.error(`[rekon_sales.service] Error during single store screening: ${error.message}`);
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
      // === STEP 1: Determine branches ===
      let branches = [];
      if (cabang === "All" || cabang === "ALL") {
        const allStores = storeService.stores;
        branches = [...new Set(allStores.filter(s => s.notes === "INDUK").map(s => s.branch || s.cab))];
      } else {
        branches = [cabang];
      }

      logger.info(`[rekon_sales.service] Branches to process: ${branches.join(", ")}`);

      // === STEP 2: Collect all stores ===
      const storeGroups = await Promise.all(
        branches.map(cab =>
          limitBranches(async () => {
            const stores = await storeService.getStoresByBranch(cab, true);
            logger.info(`[rekon_sales.service] Found ${stores.length} stores for branch ${cab}`);
            return stores.map(s => ({ ...s, cab }));
          })
        )
      );

      const storesToProcess = storeGroups.flat();

      logger.info(`[rekon_sales.service] Total stores to process: ${storesToProcess.length}`);

      // === STEP 3: Register progress task ===
      try {
        const timeStart = moment().format("YYYY-MM-DD HH:mm:ss");
        await progressService.startProgress(taskId, storesToProcess.length, {
          description: "Registering task for rekon sales screening",
          startedBy: username,
          status: "registering",
          createdAt: timeStart,
        });

        logger.info(`[rekon_sales.service] Progress task registered: ${taskId}`);
      } catch (error) {
        logger.error(`[rekon_sales.service] Error registering progress: ${error.message}`);

        if (error.message.includes("Maximum concurrent")) {
          await progressService.failProgress(taskId, {
            description: `Task failed: ${error.message}`,
            status: "failed",
          });
          throw new Error("[rekon_sales.service] System is busy processing other tasks");
        }

        await progressService.failProgress(taskId, {
          description: `Task failed: ${error.message}`,
          status: "failed",
        });
        throw new Error("[rekon_sales.service] Failed to register progress task");
      }

      logger.info(`[rekon_sales.service] Starting screening for branches: ${branches.join(", ")}`);

      // === STEP 4: Get GL data for all branches ===
      const glDataByBranch = {};
      for (const cab of branches) {
        logger.info(`[rekon_sales.service] Fetching GL data for branch: ${cab}`);
        const glData = await wrcService.openDataGLWrc(cab, "ALL", strMonth, strYear);

        if (!glData || glData.length === 0) {
          logger.warn(`[rekon_sales.service] No GL data returned for branch ${cab}`);
          glDataByBranch[cab] = [];
        } else {
          glDataByBranch[cab] = glData;
          logger.info(`[rekon_sales.service] Branch ${cab}: ${glData.length} GL records fetched`);
        }
      }

      // Track stores
      const screenedStores = new Set();
      const activeStores = new Set();

      let processedCount = 0;
      const totalStores = storesToProcess.length;

      const incrementProgress = async (storeCode, statusText) => {
        processedCount++;

        await progressService.updateProgress(taskId, processedCount, {
          description: `Store ${storeCode} → ${statusText} (${processedCount}/${totalStores})`,
          status: "Screening Stores",
        });
      };

      // === STEP 5: Process each store ===
      await Promise.all(
        storesToProcess.map(store =>
          limitStores(async () => {
            const { cab, storeCode } = store;

            screenedStores.add(storeCode);

            try {
              const result = await withTimeout(
                this.processSingleStore(store, strMonth, strYear, glDataByBranch[cab]),
                config.parallelProcessing.storeTimeoutMs,
                `process store ${storeCode}`
              );

              if (result.success) {
                if (result.hasIssue) {
                  activeStores.add(storeCode);
                  await incrementProgress(storeCode, `Has Issues ⚠️ (${result.records.length} dates)`);
                } else {
                  await incrementProgress(storeCode, "No Issues ✅");
                }
              } else {
                await incrementProgress(storeCode, "Error ❌");
              }
            } catch (err) {
              await RekapRemoteService.addToTemp(cab, storeCode, "rekon_sales", `[${storeCode}] ERROR: ${err.message}`);
              await incrementProgress(storeCode, "Error ❌");
            }
          })
        )
      );

      logger.info(`[rekon_sales.service] Screening completed for periode ${periode}`);
      logger.info(
        `[rekon_sales.service] Screened: ${screenedStores.size}, Active (has issues): ${activeStores.size}, Ready: ${
          screenedStores.size - activeStores.size
        }`
      );

      // === STEP 6: Update resolved records ===
      await progressService.updateProgress(taskId, processedCount, {
        description: "Updating resolved records (RECID = 1)",
        status: "finalizing",
      });

      await this.updateResolvedRecords({
        month: strMonth,
        year: strYear,
        level: cabang === "All" || cabang === "ALL" ? 1 : 2,
        cabang: cabang === "All" || cabang === "ALL" ? null : cabang,
        screenedStores: Array.from(screenedStores),
        activeStores: Array.from(activeStores),
      });

      // === STEP 7: Save logs ===
      await progressService.updateProgress(taskId, processedCount, {
        description: "Saving logs to database",
        status: "finalizing",
      });

      await RekapRemoteService.saveLogsToDatabase();

      // === STEP 8: Sync to JSON ===
      await progressService.updateProgress(taskId, processedCount, {
        description: "Syncing data to JSON file, please wait...",
        status: "finalizing",
      });

      await this.syncToJsonFile();
      logger.info(`[rekon_sales.service] Synchronized data to JSON file`);

      // === STEP 9: Complete progress ===
      const timeCompleted = moment().format("YYYY-MM-DD HH:mm:ss");
      await progressService.completeProgress(taskId, {
        description: "All stores processed successfully",
        status: "completed",
        completedAt: timeCompleted,
      });

      return {
        success: true,
        message: "Screening process completed",
        screenedStores: screenedStores.size,
        activeStores: activeStores.size,
        resolvedStores: screenedStores.size - activeStores.size,
      };
    } catch (error) {
      logger.error(`[rekon_sales.service] Error during screening: ${error.message}`);

      await progressService.failProgress(taskId, {
        description: `Task failed: ${error.message}`,
        status: "failed",
      });

      throw error;
    }
  }

  /**
   * Update resolved records
   */
  async updateResolvedRecords(params) {
    const { month, year, level, cabang, kdtk, hasIssue, screenedStores, activeStores } = params;

    try {
      const model = await RekonSales.getModel();
      const sequelize = model.sequelize;
      const { Sequelize } = await import("sequelize");

      let query = "";
      let replacements = { month, year };

      // LEVEL 3: Single Store
      if (level === 3) {
        if (hasIssue) {
          logger.info(`[rekon_sales.service] Level 3: Store ${kdtk} has issues, no RECID update`);
          return 0;
        } else {
          query = `
            UPDATE rekon_sales 
            SET RECID = '1' 
            WHERE MONTH(TANGGAL) = :month 
              AND YEAR(TANGGAL) = :year
              AND SHOP = :kdtk
              AND RECID = '*'
          `;
          replacements.kdtk = kdtk;

          logger.info(`[rekon_sales.service] Level 3: Updating RECID='1' for store ${kdtk}`);
        }
      }
      // LEVEL 2: Single Branch
      else if (level === 2) {
        if (!screenedStores || screenedStores.length === 0) {
          logger.info(`[rekon_sales.service] Level 2: No stores screened, skipping`);
          return 0;
        }

        query = `
          UPDATE rekon_sales 
          SET RECID = '1' 
          WHERE MONTH(TANGGAL) = :month 
            AND YEAR(TANGGAL) = :year
            AND CAB = :cabang
            AND RECID = '*'
            AND SHOP IN (:screenedStores)
        `;
        replacements.cabang = cabang;
        replacements.screenedStores = screenedStores;

        if (activeStores && activeStores.length > 0) {
          query += ` AND SHOP NOT IN (:activeStores)`;
          replacements.activeStores = activeStores;
        }

        logger.info(
          `[rekon_sales.service] Level 2: Updating for cabang ${cabang}, screened: ${screenedStores.length}, active: ${
            activeStores?.length || 0
          }`
        );
      }
      // LEVEL 1: All Branches
      else if (level === 1) {
        if (!screenedStores || screenedStores.length === 0) {
          logger.info(`[rekon_sales.service] Level 1: No stores screened, skipping`);
          return 0;
        }

        query = `
          UPDATE rekon_sales 
          SET RECID = '1' 
          WHERE MONTH(TANGGAL) = :month 
            AND YEAR(TANGGAL) = :year
            AND RECID = '*'
            AND SHOP IN (:screenedStores)
        `;
        replacements.screenedStores = screenedStores;

        if (activeStores && activeStores.length > 0) {
          query += ` AND SHOP NOT IN (:activeStores)`;
          replacements.activeStores = activeStores;
        }

        logger.info(
          `[rekon_sales.service] Level 1: Updating all cabang, screened: ${screenedStores.length}, active: ${
            activeStores?.length || 0
          }`
        );
      }

      // Execute query
      const [results, metadata] = await sequelize.query(query, {
        replacements,
        type: Sequelize.QueryTypes.UPDATE,
      });

      logger.info(`[rekon_sales.service] Updated ${metadata} records to RECID='1'`);

      return metadata;
    } catch (error) {
      logger.error(`[rekon_sales.service] Error updating resolved records: ${error.message}`);
      throw error;
    }
  }

  // Helper methods for database operations
  async resetDetailRecid(kdtk, tanggal) {
    try {
      const model = await DetailRekonSales.getModel();
      await model.update(
        { RECID: "1" },
        {
          where: {
            KDTK: kdtk,
            TGL: tanggal,
          },
        }
      );
    } catch (error) {
      logger.error(`[rekon_sales.service] Error resetting detail RECID: ${error.message}`);
    }
  }

  async saveDetailRekonSales(data) {
    try {
      if (data.length === 0) return;

      const detailData = data.map(item => ({
        RECID: "*",
        CAB: item.CAB,
        KDTK: item.SHOP,
        TGL: item.TANGGAL,
        SUBKEY: item.SUBKEY,
        VALSUBKEY: item.SELKODE,
      }));

      await DetailRekonSales.bulkCreate(detailData, {
        updateOnDuplicate: ["VALSUBKEY", "RECID"],
      });
    } catch (error) {
      logger.error(`[rekon_sales.service] Error saving detail rekon sales: ${error.message}`);
      throw error;
    }
  }

  async deleteRekonSales(kdtk, month, year) {
    try {
      const model = await RekonSales.getModel();
      await model.destroy({
        where: {
          SHOP: kdtk,
          [model.sequelize.Sequelize.Op.and]: [
            model.sequelize.where(model.sequelize.fn("MONTH", model.sequelize.col("TANGGAL")), month),
            model.sequelize.where(model.sequelize.fn("YEAR", model.sequelize.col("TANGGAL")), year),
          ],
        },
      });
    } catch (error) {
      logger.error(`[rekon_sales.service] Error deleting rekon sales: ${error.message}`);
    }
  }

  async saveMtranVsCd(data) {
    try {
      if (data.length === 0) return;

      await MtranVsCd.bulkCreate(data, {
        updateOnDuplicate: Object.keys(data[0]),
      });
    } catch (error) {
      logger.error(`[rekon_sales.service] Error saving mtran vs cd: ${error.message}`);
      throw error;
    }
  }

  async deleteMtranVsCd(kdtk, month, year) {
    try {
      const model = await MtranVsCd.getModel();
      await model.destroy({
        where: {
          KDTK: kdtk,
          MONTH: month,
          YEAR: year,
        },
      });
    } catch (error) {
      logger.error(`[rekon_sales.service] Error deleting mtran vs cd: ${error.message}`);
    }
  }

  /**
   * Build filter function for data filtering
   */
  buildFilterFunction(params = {}) {
    const { cabang, month, year, kdtk } = params;

    return item => {
      if (cabang && cabang !== "All" && item.CAB !== cabang) {
        return false;
      }

      if (kdtk && item.KDTK !== kdtk) {
        return false;
      }

      if (month || year) {
        const itemDate = moment(item.TANGGAL);
        if (month && itemDate.format("MM") !== month) {
          return false;
        }
        if (year && itemDate.format("YYYY") !== year) {
          return false;
        }
      }

      return true;
    };
  }

  /**
   * Get summary statistics from JSON file
   */
  async getSummary(options = {}) {
    const { cabang, month, year } = options;

    try {
      await this.ensureDataLoaded();

      const filterFn = this.buildFilterFunction({ cabang, month, year });
      const filteredData = this.rekonSalesData.filter(filterFn);

      // Calculate statistics
      const uniqueStores = new Set(filteredData.map(item => item.KDTK));
      const totalIssues = filteredData.length;
      const totalSelNetGL = filteredData.reduce((sum, item) => sum + Math.abs(item.SEL_NET_GL || 0), 0);
      const totalSelNetCD = filteredData.reduce((sum, item) => sum + Math.abs(item.SEL_NET_CD || 0), 0);

      return {
        data: {
          total_stores: uniqueStores.size,
          total_issues: totalIssues,
          total_sel_net_gl: totalSelNetGL,
          total_sel_net_cd: totalSelNetCD,
        },
      };
    } catch (error) {
      logger.error(`[rekon_sales.service] Error getting summary: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get resume by store (paginated)
   */
  async getResumeByKdtk(options = {}) {
    const {
      cabang = "All",
      month,
      year,
      page = 1,
      limit = 10,
      sortColumn = "KDTK",
      sortOrder = "ASC",
      searchQuery,
    } = options;

    if (!month || !year) throw new Error("Month and year are required");

    try {
      await this.ensureDataLoaded();
      await storeService.ensureInitialized();

      let filtered = this.rekonSalesData.filter(
        i =>
          moment(i.TANGGAL).format("MM") === month &&
          moment(i.TANGGAL).format("YYYY") === year &&
          (cabang === "All" || i.CAB === cabang)
      );

      // Aggregate by store
      const aggregated = {};
      filtered.forEach(item => {
        if (!aggregated[item.KDTK]) {
          aggregated[item.KDTK] = {
            CAB: item.CAB,
            KDTK: item.KDTK,
            TOTAL_ISSUES: 0,
            TOTAL_SEL_NET_GL: 0,
            TOTAL_SEL_NET_CD: 0,
            DATES: [],
          };
        }
        aggregated[item.KDTK].TOTAL_ISSUES++;
        aggregated[item.KDTK].TOTAL_SEL_NET_GL += Math.abs(item.SEL_NET_GL || 0);
        aggregated[item.KDTK].TOTAL_SEL_NET_CD += Math.abs(item.SEL_NET_CD || 0);
        aggregated[item.KDTK].DATES.push(item.TANGGAL);
      });

      // Enrich with store name
      let results = [];
      for (const kdtk of Object.keys(aggregated)) {
        let storeName = "-";
        try {
          const storeInfo = await storeService.getStoreByCode(kdtk);
          if (storeInfo?.storeName) storeName = storeInfo.storeName;
        } catch {
          logger.warn(`[rekon_sales.service] Store name not found for ${kdtk}`);
        }
        results.push({
          ...aggregated[kdtk],
          NAMA: storeName,
        });
      }

      // Enrich with notes
      try {
        const notes = await notesService.getAll();
        const notesByKey = new Map(notes.filter(n => n.tableName === "rekon_sales").map(n => [n.unixKey, n]));

        for (let i = 0; i < results.length; i++) {
          // Use first date as key (or aggregate all dates)
          const firstDate = results[i].DATES[0];
          const key = `${results[i].KDTK}${firstDate}`;
          const note = notesByKey.get(key) || null;
          results[i] = {
            ...results[i],
            note: note
              ? {
                  unixKey: note.unixKey,
                  noteText: note.noteText,
                  pic: note.pic,
                  fullName: note.fullName || null,
                  updated_at: note.updated_at || null,
                }
              : null,
          };
        }
      } catch (err) {
        logger.warn(`[rekon_sales.service] Failed to enrich with notes: ${err.message}`);
      }

      // Search
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        results = results.filter(item => {
          const fields = ["CAB", "KDTK", "NAMA"];
          const matchNormal = fields.some(field => item[field] && item[field].toString().toLowerCase().includes(q));

          const matchNote =
            item.note &&
            ((item.note.noteText && item.note.noteText.toLowerCase().includes(q)) ||
              (item.note.pic && item.note.pic.toLowerCase().includes(q)) ||
              (item.note.fullName && item.note.fullName.toLowerCase().includes(q)));

          return matchNormal || matchNote;
        });
      }

      // Sorting
      const allowedSortColumns = ["CAB", "KDTK", "NAMA", "TOTAL_ISSUES", "TOTAL_SEL_NET_GL", "TOTAL_SEL_NET_CD"];
      const col = allowedSortColumns.includes(sortColumn) ? sortColumn : "KDTK";
      const order = sortOrder?.toUpperCase() === "DESC" ? "DESC" : "ASC";

      results.sort((a, b) => {
        let av = a[col];
        let bv = b[col];

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
      logger.error(`[rekon_sales.service] Error getResumeByKdtk: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get detailed data for a specific store and date
   */
  async getStoreDetails(options = {}) {
    const { kdtk, tanggal } = options;

    if (!kdtk || !tanggal) {
      throw new Error("kdtk and tanggal are required");
    }

    try {
      const model = await RekonSales.getModel();

      const record = await model.findOne({
        where: {
          SHOP: kdtk,
          TANGGAL: tanggal,
        },
      });

      if (!record) {
        return null;
      }

      // Get store name
      let storeName = "-";
      try {
        const storeInfo = await storeService.getStoreByCode(kdtk);
        if (storeInfo?.storeName) storeName = storeInfo.storeName;
      } catch {
        logger.warn(`[rekon_sales.service] Store name not found for ${kdtk}`);
      }

      // Get note
      let note = null;
      try {
        const unixKey = `${kdtk}${tanggal}`;
        note = await notesService.getByKey(unixKey, "rekon_sales");
      } catch {
        // Note not found
      }

      return {
        CAB: record.CAB,
        SHOP: record.SHOP,
        KDTK: record.SHOP,
        NAMA: storeName,
        TANGGAL: record.TANGGAL,
        NET_MTRAN: record.NET_MTRAN,
        NET_GL: record.NET_GL,
        NET_CLOSINGDETAIL: record.NET_CLOSINGDETAIL,
        SEL_NET_GL: record.SEL_NET_GL,
        SEL_NET_CD: record.SEL_NET_CD,
        PPN_MTRAN: record.PPN_MTRAN,
        PPN_GL: record.PPN_GL,
        PPN_CD: record.PPN_CD,
        SEL_PPN_GL: record.SEL_PPN_GL,
        SEL_PPN_CD: record.SEL_PPN_CD,
        NET_RETUR_ECOM: record.NET_RETUR_ECOM,
        PPN_RETUR_ECOM: record.PPN_RETUR_ECOM,
        RETUR_PPNJP_ISTORE: record.RETUR_PPNJP_ISTORE,
        UPDTIME: record.UPDTIME,
        note: note
          ? {
              unixKey: note.unixKey,
              noteText: note.noteText,
              pic: note.pic,
              fullName: note.fullName || null,
              updated_at: note.updated_at || null,
            }
          : null,
      };
    } catch (error) {
      logger.error(`[rekon_sales.service] Error getStoreDetails: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get differences (mtran vs closing detail)
   */
  async getDifferences(options = {}) {
    const { kdtk, tanggal, page = 1, limit = 50 } = options;

    try {
      const model = await MtranVsCd.getModel();

      const { count, rows } = await model.findAndCountAll({
        where: {
          KDTK: kdtk,
          TANGGAL: tanggal,
        },
        limit: parseInt(limit),
        offset: (parseInt(page) - 1) * parseInt(limit),
        order: [
          ["DOCNO", "ASC"],
          ["SEQNO", "ASC"],
        ],
      });

      return {
        data: rows,
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / parseInt(limit)),
      };
    } catch (error) {
      logger.error(`[rekon_sales.service] Error getDifferences: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get kode pesanan issues
   */
  async getKodePesananIssues(options = {}) {
    const { kdtk, tanggal } = options;

    try {
      const model = await DetailRekonSales.getModel();

      const records = await model.findAll({
        where: {
          KDTK: kdtk,
          TGL: tanggal,
          SUBKEY: "SEL_KODEPESANAN",
        },
      });

      return {
        data: records,
      };
    } catch (error) {
      logger.error(`[rekon_sales.service] Error getKodePesananIssues: ${error.message}`);
      throw error;
    }
  }

  /**
   * Export full data set
   */
  async getExportData(options = {}) {
    const { cabang = "All", month, year, searchQuery } = options;

    if (!month || !year) throw new Error("Month and year are required");

    try {
      await this.ensureDataLoaded();
      await storeService.ensureInitialized();

      const summary = await this.getSummary({ cabang, month, year });

      // Get all stores data
      const resumeData = await this.getResumeByKdtk({
        cabang,
        month,
        year,
        page: 1,
        limit: 99999, // Get all
        searchQuery,
      });

      return {
        summary: summary.data,
        stores: resumeData.data,
      };
    } catch (error) {
      logger.error(`[rekon_sales.service] Error getExportData: ${error.message}`);
      throw error;
    }
  }
}

export default new RekonSalesService();
