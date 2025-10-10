import logger from "../../config/logger.js";
import SaldoVirtual from "../../models/saldovirtual.model.js";
import dbStore from "../../config/db_store.js";
import config from "./rekon_virtual_mrg.config.js";
import storeService from "../store/storeService.js";
import pLimit from "p-limit";
import moment from "moment-timezone";
import apiResponse from "../../utils/apiResponse.js";

class RekonVirtualService {
  // Screening stores to rekon virtual margin based on store query
  async screening(options) {
    //ensure storeService is initialized
    await storeService.ensureInitialized();

    let branches = [];
    if (options.cabang == "ALL") {
      const allStores = storeService.stores;
      branches = [...new Set(allStores.filter(s => s.notes === "INDUK").map(s => s.branch || s.cab))];
    } else {
      branches = [options.cabang];
    }

    //convert from string periode (YYMM)
    const strYear = moment(options.periode, "YYMM").format("YYYY");
    const strMonth = moment(options.periode, "YYMM").format("MM");

    //loop each branch event if branch only has one branch
    const limitBranches = pLimit(config.parallelProcessing.branchConcurrencyLimit);
    const limitStores = pLimit(config.parallelProcessing.concurrencyLimit);
    async () => {
      // Process branches asynchronously
      await Promise.all(
        branches.map(async cab =>
          limitBranches(async () => {
            const stores = await storeService.getStoresByBranch(cab, true);

            // loop each store asynchronously
            await Promise.all(
              stores.map(async store =>
                limitStores(async () => {
                  // Get store info
                  const storeInfo = await storeService.getStoreIPHost(store.SHOP);

                  if (!storeInfo) {
                    logger.error(`[rekon_virtual_mrg.service] Store information not found for ${store.SHOP}`);
                    return;
                  }

                  // Create database connection
                  const storeConnection = await dbStore.createDbStore(
                    storeInfo.dbHost,
                    config.connectionRetry.maxRetries
                  );
                  try {
                    logger.info(`[rekon_virtual_mrg.service] Processing store ${store.SHOP} (${cab})`);
                    const result = await storeConnection.query(config.queries.store, [strMonth, strYear]);

                    //result if exists insert into database
                    try {
                      if (result.length > 0) {
                        logger.info(
                          `[rekon_virtual_mrg.service] found ${result.length} records for ${store.SHOP} (${cab})`
                        );
                        await SaldoVirtual.bulkCreate(result);
                        logger.info(
                          `[rekon_virtual_mrg.service] Successfully inserted ${result.length} records for ${store.SHOP} (${cab})`
                        );
                      } else {
                        logger.info(`[rekon_virtual_mrg.service] No data found for ${store.SHOP} (${cab})`);
                      }
                    } catch (err) {
                      logger.error(
                        `[rekon_virtual_mrg.service] Error inserting ${store.SHOP} (${cab}) into database: ${err.message}`
                      );
                    }

                    return apiResponse.success(`Successfully processed store ${store.SHOP} (${cab})`);
                  } catch (err) {
                    logger.error(`[rekon_virtual_mrg.service] Error processing ${store.SHOP}: ${err.message}`);
                    return apiResponse.error(`Error processing ${store.SHOP} (${cab})`);
                  } finally {
                    await storeConnection.end(); // pastikan ditutup
                  }
                })
              )
            );
          })
        )
      );
    };
  }

  /**
   * Get all records with pagination
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Paginated results
   */
  async getAllRecords(options = {}) {
    const { page = 1, limit = 10, shop, cabang, startDate, endDate } = options;

    try {
      const whereClause = {};
      if (shop) whereClause.SHOP = shop;
      if (cabang) whereClause.CABANG = cabang;
      if (startDate && endDate) {
        whereClause.TANGGAL = {
          [Op.between]: [startDate, endDate],
        };
      }

      const { count, rows } = await SaldoVirtual.findAndCountAll({
        where: whereClause,
        limit: limit,
        offset: (page - 1) * limit,
        order: [["UPDTIME", "DESC"]],
      });

      return {
        data: rows,
        total: count,
        page: page,
        totalPages: Math.ceil(count / limit),
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
   * Create new record
   */
  async createRecord(data) {
    try {
      const record = await SaldoVirtual.create({
        ...data,
        LASTCATCH: new Date(),
      });
      return record;
    } catch (error) {
      logger.error(`[rekon_virtual_mrg.service] Error creating record: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update existing record
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

      return this.getRecord(cabang, shop, tanggal, prdcd);
    } catch (error) {
      logger.error(`[rekon_virtual_mrg.service] Error updating record: ${error.message}`);
      throw error;
    }
  }

  /**
   * Delete record
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

      return true;
    } catch (error) {
      logger.error(`[rekon_virtual_mrg.service] Error deleting record: ${error.message}`);
      throw error;
    }
  }

  /**
   * Bulk insert records from store query
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
      const [results] = await storeConnection.query(config.queries.store, [month, year]);

      // Bulk create records
      if (results.length > 0) {
        await SaldoVirtual.bulkCreate(results, {
          updateOnDuplicate: ["QTY_MSTRAN", "QTY_MTRAN", "SEL", "LASTCATCH"],
        });
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
}

export default new RekonVirtualService();
