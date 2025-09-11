/**
 * Staging service for sales_per_dept module
 * Handles JSON file synchronization for staging environment
 */
import fs from 'fs/promises';
import path from 'path';
import logger from '../../config/logger.js';
import SalesPerDept from '../../models/sales_per_dept.model.js';

// Path untuk file JSON sales_per_dept
const SALES_PER_DEPT_JSON_PATH = path.join(process.cwd(), "data/sales_per_dept.json");

class SalesPerDeptStagingService {
  constructor() {
    this.salesData = [];
    this.initialized = false;
  }

  /**
   * Initialize the service by loading data from JSON file
   * Creates the file and directory if they don't exist
   */
  async initialize() {
    try {
      // Create directory if it doesn't exist
      const dir = path.dirname(SALES_PER_DEPT_JSON_PATH);
      await fs.mkdir(dir, { recursive: true });

      try {
        // Try to read the file
        const data = await fs.readFile(SALES_PER_DEPT_JSON_PATH, "utf8");
        this.salesData = JSON.parse(data);
        logger.info(`Loaded ${this.salesData.length} sales_per_dept records from JSON file`);
      } catch (error) {
        // If file doesn't exist or is invalid, create an empty file
        if (error.code === "ENOENT" || error instanceof SyntaxError) {
          this.salesData = [];
          await this.saveToFile();
          logger.info("Created new sales_per_dept.json file");
        } else {
          throw error;
        }
      }

      this.initialized = true;
    } catch (error) {
      logger.error(`Failed to initialize sales_per_dept staging service: ${error.message}`);
      throw error;
    }
  }

  /**
   * Save sales_per_dept data to JSON file
   */
  async saveToFile() {
    try {
      await fs.writeFile(SALES_PER_DEPT_JSON_PATH, JSON.stringify(this.salesData, null, 2));
      logger.debug(`Saved ${this.salesData.length} sales_per_dept records to JSON file`);
    } catch (error) {
      logger.error(`Failed to save sales_per_dept to file: ${error.message}`);
      throw error;
    }
  }

  /**
   * Ensure the service is initialized before performing operations
   */
  async ensureInitialized() {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  /**
   * Synchronize data from database to JSON file
   */
  async syncToJsonFile() {
    try {
      // Get all data from database
      const dbData = await SalesPerDept.findAll();

      // Convert to plain objects
      this.salesData = dbData.map(item => item.get({ plain: true }));

      // Save to file
      await this.saveToFile();

      logger.info(`Synchronized ${this.salesData.length} sales_per_dept records to JSON file`);
      return this.salesData.length;
    } catch (error) {
      logger.error(`Failed to synchronize sales_per_dept data: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get sales data with filters (from JSON file)
   * @param {Object} filters - Filter options
   * @param {number} limit - Limit number of records
   * @param {number} offset - Offset for pagination
   * @returns {Promise<Object>} Filtered sales data
   */
  async getSalesData(filters = {}, limit = 100, offset = 0) {
    try {
      // Ensure data is loaded from JSON file
      await this.ensureInitialized();

      // Filter data from JSON file
      let filteredData = this.salesData.filter(item => {
        // Filter by cab
        if (filters.cab && item.cab !== filters.cab) {
          return false;
        }

        // Filter by periode
        if (filters.periode && item.periode !== filters.periode) {
          return false;
        }

        // Filter by tipestore
        if (filters.tipestore && item.tipestore !== filters.tipestore) {
          return false;
        }

        // Filter by dep_kd
        if (filters.dep_kd && item.dep_kd !== filters.dep_kd) {
          return false;
        }

        return true;
      });

      // Sort by total_sales descending (highest first)
      filteredData.sort((a, b) => {
        const salesA = parseFloat(a.total_sales || 0);
        const salesB = parseFloat(b.total_sales || 0);
        return salesB - salesA;
      });

      // Apply pagination
      const total = filteredData.length;
      const paginatedData = filteredData.slice(offset, offset + limit);

      return {
        data: paginatedData,
        total,
        limit,
        offset
      };
    } catch (error) {
      logger.error(`Error getting sales data from staging: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get summary statistics (from JSON file)
   * @param {string} periode - Periode filter
   * @returns {Promise<Object>} Summary statistics
   */
  async getSummary(periode = null) {
    try {
      // Ensure data is loaded from JSON file
      await this.ensureInitialized();

      // Filter data by periode if provided
      let filteredData = this.salesData;
      if (periode) {
        filteredData = this.salesData.filter(item => item.periode === periode);
      }

      // Calculate summary statistics
      const summary = {
        total: filteredData.length,
        totalSales: 0,
        totalHpp: 0,
        totalMargin: 0,
        byCab: {},
        byDept: {},
        byTipeStore: {}
      };

      // Calculate totals and group by various fields
      filteredData.forEach(item => {
        summary.totalSales += parseFloat(item.total_sales || 0);
        summary.totalHpp += parseFloat(item.total_hpp || 0);
        summary.totalMargin += parseFloat(item.margin_rp || 0);

        // Group by cab
        const cab = item.cab || 'unknown';
        if (!summary.byCab[cab]) {
          summary.byCab[cab] = { count: 0, totalSales: 0 };
        }
        summary.byCab[cab].count += 1;
        summary.byCab[cab].totalSales += parseFloat(item.total_sales || 0);

        // Group by department
        const dept = item.dep_name || 'unknown';
        if (!summary.byDept[dept]) {
          summary.byDept[dept] = { count: 0, totalSales: 0 };
        }
        summary.byDept[dept].count += 1;
        summary.byDept[dept].totalSales += parseFloat(item.total_sales || 0);

        // Group by tipe store
        const tipeStore = item.tipestore || 'unknown';
        if (!summary.byTipeStore[tipeStore]) {
          summary.byTipeStore[tipeStore] = { count: 0, totalSales: 0 };
        }
        summary.byTipeStore[tipeStore].count += 1;
        summary.byTipeStore[tipeStore].totalSales += parseFloat(item.total_sales || 0);
      });

      return summary;
    } catch (error) {
      logger.error(`Error getting summary from staging: ${error.message}`);
      throw error;
    }
  }

  /**
   * Add or update records in database and sync to JSON
   * @param {Array} records - Array of sales records
   * @returns {Promise<number>} Number of affected records
   */
  async upsertRecords(records) {
    try {
      let affectedCount = 0;

      for (const record of records) {
        await SalesPerDept.upsert(record);
        affectedCount++;
      }

      // Sync to JSON file after database operation
      await this.syncToJsonFile();

      logger.info(`Upserted ${affectedCount} sales_per_dept records`);
      
      return affectedCount;
    } catch (error) {
      logger.error(`Error upserting sales_per_dept records: ${error.message}`);
      throw error;
    }
  }

  /**
   * Delete records from database and sync to JSON
   * @param {Object} where - Where conditions
   * @returns {Promise<number>} Number of deleted records
   */
  async deleteRecords(where) {
    try {
      // Delete from database
      const deletedCount = await SalesPerDept.destroy({ where });

      // Sync to JSON file after database operation
      await this.syncToJsonFile();

      logger.info(`Deleted ${deletedCount} sales_per_dept records`);
      
      return deletedCount;
    } catch (error) {
      logger.error(`Error deleting sales_per_dept records: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get count of records (from JSON file)
   * @param {Object} filters - Filter options
   * @returns {Promise<number>} Count of records
   */
  async getCount(filters = {}) {
    try {
      // Ensure data is loaded from JSON file
      await this.ensureInitialized();

      // Filter data from JSON file
      const filteredData = this.salesData.filter(item => {
        // Filter by cab
        if (filters.cab && item.cab !== filters.cab) {
          return false;
        }

        // Filter by periode
        if (filters.periode && item.periode !== filters.periode) {
          return false;
        }

        // Filter by tipestore
        if (filters.tipestore && item.tipestore !== filters.tipestore) {
          return false;
        }

        // Filter by dep_kd
        if (filters.dep_kd && item.dep_kd !== filters.dep_kd) {
          return false;
        }

        return true;
      });

      return filteredData.length;
    } catch (error) {
      logger.error(`Error getting count from staging: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get top performing departments (from JSON file)
   * @param {Object} filters - Filter options
   * @param {number} limit - Number of top departments to return
   * @returns {Promise<Array>} Top departments by sales
   */
  async getTopDepartments(filters = {}, limit = 10) {
    try {
      // Ensure data is loaded from JSON file
      await this.ensureInitialized();

      // Filter data
      let filteredData = this.salesData.filter(item => {
        if (filters.cab && item.cab !== filters.cab) return false;
        if (filters.periode && item.periode !== filters.periode) return false;
        if (filters.tipestore && item.tipestore !== filters.tipestore) return false;
        return true;
      });

      // Group by department and sum sales
      const deptSales = {};
      filteredData.forEach(item => {
        const deptKey = `${item.dep_kd}-${item.dep_name}`;
        if (!deptSales[deptKey]) {
          deptSales[deptKey] = {
            dep_kd: item.dep_kd,
            dep_name: item.dep_name,
            total_sales: 0,
            total_hpp: 0,
            margin_rp: 0,
            qty_sales: 0
          };
        }
        deptSales[deptKey].total_sales += parseFloat(item.total_sales || 0);
        deptSales[deptKey].total_hpp += parseFloat(item.total_hpp || 0);
        deptSales[deptKey].margin_rp += parseFloat(item.margin_rp || 0);
        deptSales[deptKey].qty_sales += parseInt(item.qty_sales || 0);
      });

      // Convert to array and sort by total sales
      const topDepts = Object.values(deptSales)
        .sort((a, b) => b.total_sales - a.total_sales)
        .slice(0, limit);

      return topDepts;
    } catch (error) {
      logger.error(`Error getting top departments from staging: ${error.message}`);
      throw error;
    }
  }
}

export default new SalesPerDeptStagingService();