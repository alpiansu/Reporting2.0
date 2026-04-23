/**
 * Service for Rekon Virtual Margin Based
 */
import fs from "fs/promises";
import path from "path";
import logger from "../../config/logger.js";
import SaldoVirtual from "../../models/saldovirtual.model.js";
import dbStore from "../../config/db_store.js";
import config from "./rekon_virtual_mrg.config.js";
import storeService from "../store/storeService.js";
import pLimit from "p-limit";
import moment from "moment-timezone";
import RekapRemoteService from "../rekap_remote/rekap_remote.service.js";
import noteCategoriesService from "../note_categories/noteCategories.service.js";
import notesService from "../notes/notes.service.js";
import progressService from "../progress/progress.service.js";
import { Op } from "sequelize";

// Path untuk folder JSON rekon_virtual_mrg_based (akan di-split per periode)
const VIRTUAL_MRG_DATA_DIR = path.join(process.cwd(), "data/virtual_mrg_based");

class RekonVirtualService {
  constructor() {
    this.virtualData = [];
    this.loadedPeriod = null; // Menandakan periode mana yang sedang di-load di memory
    this.initialized = false;

    // TTL Cache Management
    this.lastLoadTime = null;
    this.TTL = 60 * 60 * 1000; // 1 hour in milliseconds
    this.isLoading = false; // Prevent concurrent loading
  }

  /**
   * Get JSON file path for a specific period
   * @param {string} periode - Period in YYMM format
   */
  getJsonPath(periode) {
    if (!periode) return null;
    return path.join(VIRTUAL_MRG_DATA_DIR, `rekon_virtual_mrg_${periode}.json`);
  }

  /**
   * Initialize the service by loading data from JSON file for specific period
   * Creates the file and directory if they don't exist
   */
  async initialize(periode) {
    if (!periode) return;
    try {
      // Create directory if it doesn't exist
      await fs.mkdir(VIRTUAL_MRG_DATA_DIR, { recursive: true });

      const jsonPath = this.getJsonPath(periode);
      try {
        // Try to read the file
        const data = await fs.readFile(jsonPath, "utf8");
        const rawData = JSON.parse(data);

        // Ensure numeric fields are numbers when loading from JSON
        this.virtualData = rawData.map(item => ({
          ...item,
          ACOST: Number(item.ACOST) || 0,
          PRICE: Number(item.PRICE) || 0,
          QTY_MSTRAN: Number(item.QTY_MSTRAN) || 0,
          QTY_MTRAN: Number(item.QTY_MTRAN) || 0,
          SEL: Number(item.SEL) || 0,
        }));

        logger.info(`Loaded ${this.virtualData.length} rekon_virtual_mrg records for periode ${periode} from JSON`);
      } catch (error) {
        // If file doesn't exist or is invalid, create an empty file
        if (error.code === "ENOENT" || error instanceof SyntaxError) {
          this.virtualData = [];
          this.loadedPeriod = periode;
          await this.saveToFile(periode);
          logger.info(`Created new rekon_virtual_mrg_${periode}.json file`);
        } else {
          throw error;
        }
      }

      this.loadedPeriod = periode;
      this.initialized = true;
    } catch (error) {
      logger.error(`Failed to initialize rekon_virtual_mrg service: ${error.message}`);
      throw error;
    }
  }

  /**
   * Save rekon_virtual_mrg data to JSON file
   */
  async saveToFile(periode) {
    if (!periode) return;
    try {
      const jsonPath = this.getJsonPath(periode);
      if (!jsonPath) return;
      await fs.writeFile(jsonPath, JSON.stringify(this.virtualData, null, 2));
      logger.debug(`Saved ${this.virtualData.length} rekon_virtual_mrg records to JSON file: ${jsonPath}`);
    } catch (error) {
      logger.error(`Failed to save rekon_virtual_mrg to file: ${error.message}`);
      throw error;
    }
  }

  /**
   * Check if cached data is still valid based on TTL and period
   * @returns {boolean} True if cache is valid, false if expired or period changed
   */
  isCacheValid(periode) {
    if (!this.initialized || !this.lastLoadTime || this.loadedPeriod !== periode) {
      return false;
    }

    const now = Date.now();
    const isExpired = now - this.lastLoadTime > this.TTL;
    return !isExpired;
  }

  /**
   * Invalidate cache manually
   */
  invalidateCache() {
    this.virtualData = [];
    this.initialized = false;
    this.loadedPeriod = null;
    this.lastLoadTime = null;
    this.isLoading = false;
    logger.info("Rekon Virtual MRG cache invalidated manually");
  }

  /**
   * Ensure data is loaded with TTL-based lazy loading
   * Only loads data when needed, cache is expired, or period changed
   */
  async ensureDataLoaded(periode) {
    if (!periode) return;

    // If cache is still valid, no need to reload
    if (this.isCacheValid(periode)) {
      return;
    }

    // Prevent concurrent loading
    if (this.isLoading) {
      // Wait for ongoing loading to complete
      while (this.isLoading) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      if (this.isCacheValid(periode)) return;
    }

    try {
      this.isLoading = true;
      logger.info(`Loading rekon_virtual_mrg data from JSON file for periode ${periode} (cache expired or empty)`);

      await this.initialize(periode);
      this.lastLoadTime = Date.now();

      logger.info(`Data loaded successfully. TTL expires at: ${new Date(this.lastLoadTime + this.TTL).toISOString()}`);
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Synchronize data from database to JSON file for a specific period
   * Call this after any write operation to keep JSON in sync
   */
  async syncToJsonFile(periode) {
    if (!periode) return 0;
    try {
      const year = "20" + periode.substring(0, 2);
      const month = periode.substring(2, 4);
      const startDate = `${year}-${month}-01`;
      const endDate = moment(`${year}-${month}`, "YYYY-MM").endOf("month").format("YYYY-MM-DD");

      // Get data from database specifically for this period
      const dbData = await Promise.race([
        SaldoVirtual.findAll({
          where: {
            TANGGAL: {
              [Op.between]: [startDate, endDate],
            },
          },
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("syncToJsonFile findAll timeout after 60 seconds")), 60000)
        ),
      ]);

      // Convert to plain objects and ensure numeric fields are numbers
      this.virtualData = dbData.map(item => {
        const plainItem = item.get({ plain: true });

        return {
          ...plainItem,
          ACOST: Number(plainItem.ACOST) || 0,
          PRICE: Number(plainItem.PRICE) || 0,
          QTY_MSTRAN: Number(plainItem.QTY_MSTRAN) || 0,
          QTY_MTRAN: Number(plainItem.QTY_MTRAN) || 0,
          SEL: Number(plainItem.SEL) || 0,
        };
      });

      this.loadedPeriod = periode;

      // Save to file
      await this.saveToFile(periode);

      // Update cache timestamp since we just loaded fresh data
      this.lastLoadTime = Date.now();
      this.initialized = true;

      logger.info(`Synchronized ${this.virtualData.length} rekon_virtual_mrg records to JSON file for periode ${periode}`);
      logger.info(`Cache refreshed. TTL expires at: ${new Date(this.lastLoadTime + this.TTL).toISOString()}`);

      return this.virtualData.length;
    } catch (error) {
      logger.error(`Failed to synchronize rekon_virtual_mrg data: ${error.message}`);
      throw error;
    }
  }

  /**
   * Sync all data from database to period-based JSON files (Migration)
   */
  async syncAllData() {
    try {
      logger.info("Starting sync all data (Migration) to period-based JSON files...");
      const dbData = await SaldoVirtual.findAll();
      
      // Group by periode
      const groupedData = {};
      
      for (const item of dbData) {
        const plainItem = item.get({ plain: true });
        const record = {
          ...plainItem,
          ACOST: Number(plainItem.ACOST) || 0,
          PRICE: Number(plainItem.PRICE) || 0,
          QTY_MSTRAN: Number(plainItem.QTY_MSTRAN) || 0,
          QTY_MTRAN: Number(plainItem.QTY_MTRAN) || 0,
          SEL: Number(plainItem.SEL) || 0,
        };
        
        const periode = moment(record.TANGGAL).format("YYMM");
        if (!groupedData[periode]) {
          groupedData[periode] = [];
        }
        groupedData[periode].push(record);
      }
      
      // Save each group to its file
      let totalFiles = 0;
      let totalRecords = 0;
      
      await fs.mkdir(VIRTUAL_MRG_DATA_DIR, { recursive: true });
      for (const [periode, records] of Object.entries(groupedData)) {
        const jsonPath = this.getJsonPath(periode);
        await fs.writeFile(jsonPath, JSON.stringify(records, null, 2));
        logger.info(`Saved ${records.length} records to ${jsonPath}`);
        totalFiles++;
        totalRecords += records.length;
      }
      
      logger.info(`Migration complete: Saved ${totalRecords} records across ${totalFiles} period files`);
      return { totalFiles, totalRecords };
    } catch (error) {
      logger.error(`Error in syncAllData: ${error.message}`);
      throw error;
    }
  }
  /**
   * Screening stores to rekon virtual margin based on store query
   */
  async screening(options) {
    // Ensure storeService is initialized
    await storeService.ensureInitialized();

    //declare taskID on Top
    const username = options.username;
    const taskId = `${config.taskProgressName}_${username}`;

    //set limit btranches and stores
    const limitBranches = pLimit(config.parallelProcessing.branchConcurrencyLimit);
    const limitStores = pLimit(config.parallelProcessing.concurrencyLimit);

    const withTimeout = (promise, ms, label) => {
      return Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error(`Timeout: ${label}`)), ms)),
      ]);
    };

    let skipProgress = true;
    try {
      // === STEP 1: Branches ===
      let branches = [];
      if (options.cabang === "All" || options.cabang === "ALL") {
        const allStores = storeService.stores;
        branches = [...new Set(allStores.filter(s => s.notes === "INDUK").map(s => s.branch || s.cab))];
      } else {
        branches = [options.cabang];
      }

      logger.info(`[rekon_virtual_mrg.service] Branches to process: ${branches.join(", ")}`);

      // === STEP 2: Collect all stores ===
      const storeGroups = await Promise.all(
        branches.map(cab =>
          limitBranches(async () => {
            const stores = await storeService.getStoresByBranch(cab, true);
            logger.info(`[rekon_virtual_mrg.service] Found ${stores.length} stores for branch ${cab}`);

            // tambahkan info cabang ke tiap store
            return stores.map(s => ({ ...s, cab }));
          }),
        ),
      );

      let storesToProcess = storeGroups.flat();

      // === NEW: Filter by specific shops if provided ===
      if (options.shops && options.shops.length > 0) {
        storesToProcess = storesToProcess.filter(s => {
          const code = (s.storeCode || s.kdtk || "").toUpperCase();
          return options.shops.some(target => target.toUpperCase() === code);
        });
        logger.info(
          `[rekon_virtual_mrg.service] Filtered to ${storesToProcess.length} specific stores: ${options.shops.join(", ")}`,
        );
      }

      logger.info(`[rekon_virtual_mrg.service] Total stores to process: ${storesToProcess.length}`);

      skipProgress = storesToProcess.length <= 1;

      // Register progress task if not skipping
      if (!skipProgress) {
        try {
          const timeStart = moment().format("YYYY-MM-DD HH:mm:ss");
          await progressService.startProgress(taskId, storesToProcess.length, {
            module: "rekon_virtual_mrg",
            title: "Screening Virtual Margin",
            description: "registering task",
            startedBy: options.username,
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
            throw new Error("[service rekon_virtual_mrg] System is busy processing other tasks");
          }

          await progressService.failProgress(taskId, {
            description: `Task failed: ${error.message}`,
            status: "failed",
          });
          throw new Error("[service rekon_virtual_mrg] Failed to register progress task");
        }
      }

      logger.info(`[rekon_virtual_mrg.service] Starting screening for branches: ${branches.join(", ")}`);

      // === PREPARE PROCESSING ===
      // Convert from string periode (YYMM)
      const strYear = moment(options.periode, "YYMM").format("YYYY");
      const strMonth = moment(options.periode, "YYMM").format("MM");

      // Temporary array to collect new records
      const newRecords = [];

      let processedCount = 0;
      const totalStores = storesToProcess.length;

      const incrementProgress = async (storeCode, statusText) => {
        processedCount++;

        if (!skipProgress) {
          await progressService.updateProgress(taskId, processedCount, {
            description: `Store ${storeCode} → ${statusText} (${processedCount}/${totalStores})`,
            status: "Screening to Stores",
          });
        }
      };

      // step 3, loop each stores asycronously
      await Promise.all(
        storesToProcess.map(store =>
          limitStores(async () => {
            const { cab, storeCode } = store;

            try {
              // --- Store info --- //
              const storeInfo = await withTimeout(
                storeService.getStoreIPHost(storeCode),
                10000,
                `get store info ${storeCode}`,
              );

              if (!storeInfo) {
                await RekapRemoteService.addToTemp(
                  cab,
                  storeCode,
                  "rekon_virtual_mrg",
                  `[${storeCode}] store info not found`,
                );
                await incrementProgress(storeCode, "Store info not found ❌");
                return;
              }

              // --- Create DB connection --- //
              const storeConnection = await dbStore.createDbStore(storeInfo.dbHost, config.connectionRetry.maxRetries);

              if (!storeConnection) {
                await RekapRemoteService.addToTemp(
                  cab,
                  storeCode,
                  "rekon_virtual_mrg",
                  `[${storeCode}] failed to connect after ${config.connectionRetry.maxRetries} attempts`,
                );
                await incrementProgress(storeCode, "DB connection failed ❌");
                return;
              }

              try {
                const params = `${strYear}-${strMonth}`;
                const [result] = await storeConnection.query({ sql: config.queries.store, timeout: config.parallelProcessing.queryTimeoutMs }, [params, params, params, params]);

                await RekapRemoteService.addToTemp(
                  cab,
                  storeCode,
                  "rekon_virtual_mrg",
                  `[${storeCode}] query completed, got ${result.length} records`,
                );

                if (result.length > 0) {
                  const startDate = `${strYear}-${strMonth}-01`;
                  const endDate = moment(`${strYear}-${strMonth}`, "YYYY-MM").endOf("month").format("YYYY-MM-DD");
                  
                  // 1. Fetch current local records for this shop & period to compare against
                  const existingRecords = await SaldoVirtual.findAll({
                    where: {
                      CABANG: cab,
                      SHOP: storeCode,
                      TANGGAL: { [Op.between]: [startDate, endDate] }
                    },
                    attributes: ['TANGGAL', 'PRDCD']
                  });

                  // 2. Build reference set for incoming composite keys (TANGGAL + PRDCD)
                  const incomingKeys = new Set();
                  result.forEach(r => {
                    const dateStr = moment(r.TANGGAL).format("YYYY-MM-DD");
                    incomingKeys.add(`${dateStr}_${r.PRDCD}`);
                  });

                  // 3. Identify obsolete records (existing ones whose TANGGAL + PRDCD is not in incoming keys)
                  const obsoleteRecords = existingRecords.filter(ex => {
                    const dateStr = moment(ex.TANGGAL).format("YYYY-MM-DD");
                    return !incomingKeys.has(`${dateStr}_${ex.PRDCD}`);
                  });

                  // 4. Safely destroy obsolete records in chunks to prevent SQL param exhaustion
                  if (obsoleteRecords.length > 0) {
                    for (let i = 0; i < obsoleteRecords.length; i += 100) {
                      const chunk = obsoleteRecords.slice(i, i + 100);
                      await SaldoVirtual.destroy({
                        where: {
                          CABANG: cab,
                          SHOP: storeCode,
                          [Op.or]: chunk.map(obs => ({
                            TANGGAL: obs.TANGGAL,
                            PRDCD: obs.PRDCD
                          }))
                        }
                      });
                    }
                  }

                  await SaldoVirtual.bulkCreate(result, {
                    updateOnDuplicate: ["QTY_MSTRAN", "QTY_MTRAN", "SEL", "LASTCATCH"],
                  });

                  newRecords.push(...result);
                } else {
                  await this.deleteStorePeriod(cab, storeCode, strYear, strMonth);
                }

                await incrementProgress(storeCode, `Success ✅ (${result.length} rows)`);
              } finally {
                await storeConnection.end();
              }
            } catch (err) {
              await RekapRemoteService.addToTemp(
                cab,
                storeCode,
                "rekon_virtual_mrg",
                `[${storeCode}] ERROR: ${err.message}`,
              );

              await incrementProgress(storeCode, "Error ❌");
            }
          }),
        ),
      );

      logger.info(`[rekon_virtual_mrg.service] Screening process completed for periode ${options.periode}`);

      //update status to progress service if not skipping
      if (!skipProgress) {
        await progressService.updateProgress(taskId, processedCount, {
          description: "Finalizing screening process, saving logs to database",
          status: "finalizing",
        });
      }

      // Save logs to database - dengan global timeout agar tidak hang selamanya
      const FINALIZE_TIMEOUT_MS = 2 * 60 * 1000; // 2 menit
      try {
        await Promise.race([
          RekapRemoteService.saveLogsToDatabase(),
          new Promise((_, reject) =>
            setTimeout(
              () => reject(new Error("saveLogsToDatabase timeout after 2 minutes")),
              FINALIZE_TIMEOUT_MS
            )
          ),
        ]);
      } catch (saveErr) {
        logger.error(`[rekon_virtual_mrg.service] saveLogsToDatabase error/timeout: ${saveErr.message}`);
        // Tidak throw - lanjut agar completeProgress tetap terpanggil
      }

      //update status to progress service if not skipping
      if (!skipProgress) {
        await progressService.updateProgress(taskId, processedCount, {
          description: "Syncing data to JSON file, please wait...",
          status: "finalizing",
        });
      }

      // Sync database to JSON file - langsung merge ke memory
      if (newRecords.length > 0) {
        try {
          await this.ensureDataLoaded(options.periode);
          
          // Merge newRecords ke virtualData di memory (partial merge)
          // Field yang tidak ada di data store (seperti RECID) dipertahankan dari data lama di JSON
          for (const record of newRecords) {
            const idx = this.virtualData.findIndex(
              v => v.CABANG === record.CABANG &&
                   v.SHOP === record.SHOP &&
                   v.TANGGAL === record.TANGGAL &&
                   v.PRDCD === record.PRDCD
            );
            if (idx >= 0) {
              // Pertahankan field lama (misal RECID), timpa dengan data baru
              this.virtualData[idx] = { ...this.virtualData[idx], ...record };
            } else {
              // Record baru: tambahkan default RECID sesuai model (defaultValue: '*')
              this.virtualData.push({ RECID: '*', ...record });
            }
          }
          
          await this.saveToFile(options.periode);
          this.lastLoadTime = Date.now();
          logger.info(`[FINALIZE] JSON synced from memory, ${newRecords.length} records merged`);
        } catch (syncErr) {
          logger.error(`[rekon_virtual_mrg.service] syncToJsonFile error: ${syncErr.message}`);
        }
      }

      const timeCompleted = moment().format("YYYY-MM-DD HH:mm:ss");
      if (!skipProgress) {
        await progressService.completeProgress(taskId, {
          description: "All stores processed",
          status: "completed",
          completedAt: timeCompleted,
        });
      }

      return {
        success: true,
        message: "Screening process completed",
        processedRecords: newRecords.length,
      };
    } catch (error) {
      logger.error(`[rekon_virtual_mrg.service] Error during screening: ${error.message}`);

      if (!skipProgress) {
        await progressService.failProgress(taskId, {
          description: `Task failed: ${error.message}`,
          status: "failed",
        });
      }

      throw error;
    }
  }

  async deleteStorePeriod(cabang, shop, year, month) {
    try {
      const periode = year.substring(2) + month;
      // pastikan cache memory terload
      await this.ensureDataLoaded(periode);

      const ym = `${year}-${month}`;

      // cari record lama dari memory
      const oldRecords = this.virtualData.filter(
        item => item.CABANG === cabang && item.SHOP === shop && moment(item.TANGGAL).format("YYYY-MM") === ym,
      );

      if (oldRecords.length === 0) {
        logger.info(`[rekon_virtual_mrg.service - deleteStorePeriod] No old records for ${shop} (${ym})`);
        return 0;
      }

      // hapus dari database
      await SaldoVirtual.destroy({
        where: {
          CABANG: cabang,
          SHOP: shop,
          TANGGAL: {
            [Op.between]: [
              `${year}-${month}-01`,
              moment(`${year}-${month}`, "YYYY-MM").endOf("month").format("YYYY-MM-DD"),
            ],
          },
        },
      });

      // hapus dari memory
      this.virtualData = this.virtualData.filter(
        item => !(item.CABANG === cabang && item.SHOP === shop && moment(item.TANGGAL).format("YYYY-MM") === ym),
      );

      // simpan ulang file JSON
      await this.saveToFile();

      logger.info(
        `[rekon_virtual_mrg.service - deleteStorePeriod] Deleted ${oldRecords.length} records for SHOP=${shop} periode=${ym}`,
      );

      return oldRecords.length;
    } catch (error) {
      logger.error(`[rekon_virtual_mrg.service - deleteStorePeriod] Error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Build filter function for data filtering (DRY principle)
   * @param {Object} params - Filter parameters
   * @returns {Function} Filter function
   */
  buildFilterFunction(params = {}) {
    const { cabang, periode, shop } = params;

    return item => {
      // Filter by cabang
      if (cabang && cabang !== "All" && item.CABANG !== cabang) {
        return false;
      }

      // Filter by shop
      if (shop && item.SHOP !== shop) {
        return false;
      }

      // Filter by periode
      if (periode) {
        const year = "20" + periode.substring(0, 2);
        const month = periode.substring(2, 4);
        const startDate = `${year}-${month}-01`;
        const endDate = moment(`${year}-${month}`, "YYYY-MM").endOf("month").format("YYYY-MM-DD");

        const itemDate = moment(item.TANGGAL).format("YYYY-MM-DD");
        if (itemDate < startDate || itemDate > endDate) {
          return false;
        }
      }

      return true;
    };
  }

  /**
   * Get summary statistics from JSON file
   * @param {Object} options - Query options (cabang, periode)
   * @returns {Promise<Object>} Summary statistics
   */
  async getSummary(options = {}) {
    const { cabang, periode } = options;

    try {
      // Ensure data is loaded from JSON file
      await this.ensureDataLoaded(periode);

      // Build filter function
      const filterFn = this.buildFilterFunction({ cabang, periode });

      // Filter data
      const filteredData = this.virtualData.filter(filterFn);

      // Calculate summary
      const uniqueShops = new Set(filteredData.map(item => item.SHOP));
      const totalSel = filteredData.reduce((sum, item) => sum + (Number(item.SEL) || 0), 0);

      return {
        data: {
          jml_toko: uniqueShops.size,
          total_sel: totalSel,
          total_records: filteredData.length,
        },
      };
    } catch (error) {
      logger.error(`[rekon_virtual_mrg.service] Error getting summary: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get all records without pagination and filtering from JSON file
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Paginated results
   */
  async getAll(options = {}) {
    const { cabang, periode } = options;

    try {
      // Ensure data is loaded from JSON file
      await this.ensureDataLoaded(periode);

      // Build filter function
      const filterFn = this.buildFilterFunction({ cabang, periode });

      // Filter data
      let filteredData = this.virtualData.filter(filterFn);

      const enrichedData = await this.enrichWithNotes(filteredData);

      return {
        data: enrichedData,
      };
    } catch (error) {
      logger.error(`[rekon_virtual_mrg.service] Error getting all records: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get all records with pagination and filtering from JSON file
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Paginated results
   */
  async getAllRecords(options = {}) {
    const {
      page = 1,
      limit = 10,
      shop,
      cabang,
      periode,
      searchQuery,
      sortColumn = "LASTCATCH",
      sortOrder = "DESC",
    } = options;

    try {
      // Ensure data is loaded from JSON file
      await this.ensureDataLoaded(periode);

      // Build filter function
      const filterFn = this.buildFilterFunction({ cabang, periode, shop });

      // Filter data
      let filteredData = this.virtualData.filter(filterFn);

      // Apply search query if provided
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        filteredData = filteredData.filter(item => {
          return (
            (item.SHOP && item.SHOP.toLowerCase().includes(query)) ||
            (item.CABANG && item.CABANG.toLowerCase().includes(query)) ||
            (item.PRDCD && item.PRDCD.toLowerCase().includes(query)) ||
            (item.SINGKATAN && item.SINGKATAN.toLowerCase().includes(query))
          );
        });
      }

      // Sort data
      const allowedSortColumns = [
        "RECID",
        "CABANG",
        "SHOP",
        "TANGGAL",
        "PRDCD",
        "SINGKATAN",
        "ACOST",
        "PRICE",
        "QTY_MSTRAN",
        "QTY_MTRAN",
        "SEL",
        "LASTCATCH",
      ];
      const sanitizedSortColumn = allowedSortColumns.includes(sortColumn) ? sortColumn : "LASTCATCH";
      const sanitizedSortOrder = sortOrder && sortOrder.toUpperCase() === "ASC" ? "ASC" : "DESC";

      filteredData.sort((a, b) => {
        let aVal = a[sanitizedSortColumn];
        let bVal = b[sanitizedSortColumn];

        // Handle dates
        if (sanitizedSortColumn === "TANGGAL" || sanitizedSortColumn === "LASTCATCH") {
          aVal = aVal ? new Date(aVal).getTime() : 0;
          bVal = bVal ? new Date(bVal).getTime() : 0;
        }

        // Handle numbers
        if (typeof aVal === "number" || !isNaN(Number(aVal))) {
          aVal = Number(aVal) || 0;
          bVal = Number(bVal) || 0;
        }

        if (sanitizedSortOrder === "ASC") {
          return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
        } else {
          return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
        }
      });

      // Pagination
      const totalRecords = filteredData.length;
      const startIndex = (parseInt(page) - 1) * parseInt(limit);
      const endIndex = startIndex + parseInt(limit);
      const paginatedData = filteredData.slice(startIndex, endIndex);

      const enrichedData = await this.enrichWithNotes(paginatedData);

      return {
        data: enrichedData,
        total: totalRecords,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(totalRecords / parseInt(limit)),
      };
    } catch (error) {
      logger.error(`[rekon_virtual_mrg.service] Error getting records: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get record by primary key
   */
  async getRecord(cabang, shop, tanggal, prdcd) {
    try {
      const record = await SaldoVirtual.findOne({
        where: {
          CABANG: cabang,
          SHOP: shop,
          TANGGAL: tanggal,
          PRDCD: prdcd,
        },
      });

      return record;
    } catch (error) {
      logger.error(`[rekon_virtual_mrg.service] Error getting record: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create new record in database and sync to JSON
   */
  async createRecord(data) {
    try {
      const record = await SaldoVirtual.create({
        ...data,
        LASTCATCH: new Date(),
      });

      // Sync to JSON file after write operation
      const periode = moment(data.TANGGAL).format("YYMM");
      await this.syncToJsonFile(periode);

      return record;
    } catch (error) {
      logger.error(`[rekon_virtual_mrg.service] Error creating record: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update existing record in database and sync to JSON
   */
  async updateRecord(cabang, shop, tanggal, prdcd, data) {
    try {
      const [updated] = await SaldoVirtual.update(data, {
        where: {
          CABANG: cabang,
          SHOP: shop,
          TANGGAL: tanggal,
          PRDCD: prdcd,
        },
      });

      if (updated === 0) {
        throw new Error("Record not found");
      }

      // Sync to JSON file after write operation
      const periode = moment(tanggal).format("YYMM");
      await this.syncToJsonFile(periode);

      return this.getRecord(cabang, shop, tanggal, prdcd);
    } catch (error) {
      logger.error(`[rekon_virtual_mrg.service] Error updating record: ${error.message}`);
      throw error;
    }
  }

  /**
   * Delete record from database and sync to JSON
   */
  async deleteRecord(cabang, shop, tanggal, prdcd) {
    try {
      const deleted = await SaldoVirtual.destroy({
        where: {
          CABANG: cabang,
          SHOP: shop,
          TANGGAL: tanggal,
          PRDCD: prdcd,
        },
      });

      if (deleted === 0) {
        throw new Error("Record not found");
      }

      // Sync to JSON file after write operation
      const periode = moment(tanggal).format("YYMM");
      await this.syncToJsonFile(periode);

      return true;
    } catch (error) {
      logger.error(`[rekon_virtual_mrg.service] Error deleting record: ${error.message}`);
      throw error;
    }
  }

  /**
   * Bulk insert records from store query to database and sync to JSON
   */
  async insertFromStore(shop, year, month) {
    let storeConnection;
    try {
      // Get store info
      const storeInfo = await storeService.getStoreIPHost(shop);
      if (!storeInfo) {
        throw new Error(`Store information not found for ${shop}`);
      }

      // Create database connection
      storeConnection = await dbStore.createDbStore(storeInfo.dbHost, 2);

      // Execute store query
      const [results] = await storeConnection.query({ sql: config.queries.store, timeout: config.parallelProcessing.queryTimeoutMs }, [month, year]);

      // Bulk create records to database
      if (results.length > 0) {
        await SaldoVirtual.bulkCreate(results, {
          updateOnDuplicate: ["QTY_MSTRAN", "QTY_MTRAN", "SEL", "LASTCATCH"],
        });

        // Sync to JSON file after write operation
        const periode = year.toString().slice(-2) + month.toString().padStart(2, '0');
        await this.syncToJsonFile(periode);
      }

      return {
        success: true,
        processedRecords: results.length,
      };
    } catch (error) {
      logger.error(`[rekon_virtual_mrg.service] Error inserting from store: ${error.message}`);
      throw error;
    } finally {
      if (storeConnection) {
        await storeConnection.end();
      }
    }
  }

  /**
   * Merge notes and category info into virtualData
   */
  async enrichWithNotes(data) {
    try {
      // ambil semua notes & categories dari service (cached dengan TTL)
      const [notes, categoryResult] = await Promise.all([
        await notesService.getAll(),
        await noteCategoriesService.getAll(),
      ]);

      const categories = categoryResult.data || [];

      logger.info(
        `[rekon_virtual_mrg.service] Notes & Categories loaded: ${notes.length} notes, ${categories.length} categories`,
      );

      // buat lookup map untuk kategori agar cepat
      const categoryMap = new Map(categories.map(c => [c.id, c]));
      // proses penggabungan data
      return data.map(item => {
        // bentuk unixKey dari saldo_virtual
        const unixKey = `${item.SHOP}${item.TANGGAL}${item.PRDCD}`;

        // ambil semua note yang terkait dengan unixKey ini
        const note = notes.find(n => n.unixKey === unixKey && n.tableName === `saldovirtual`);
        if (!note) return { ...item, note: null };

        const category = categoryMap.get(note.categoryId) || null;

        // kembalikan data virtual + notes
        return {
          ...item,
          note: {
            ...note,
            category,
          },
        };
      });
    } catch (err) {
      logger.error(`[rekon_virtual_mrg.service] Error enriching data with notes: ${err.message}`);
      return data;
    }
  }
}

export default new RekonVirtualService();
