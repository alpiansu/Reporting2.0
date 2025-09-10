/**
 * Utility functions for interacting with WRC (poscabang) database
 */
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import mysql from 'mysql2/promise';
import logger from '../config/logger.js';
import wrcService from '../services/wrc.service.js';
import config from '../config/rekon_wt_harian.config.js';

class WrcUtils {
  /**
   * Get all dates in a month
   * @param {string} year - Year in YYYY format
   * @param {string} month - Month in MM format
   * @param {boolean} untilYesterday - If true, get dates until yesterday
   * @returns {Array} Array of dates in YYYY-MM-DD format
   */
  getAllDatesInMonth(year, month, untilYesterday = false) {
    const dates = [];
    const daysInMonth = new Date(year, month, 0).getDate();

    let lastDay = daysInMonth;
    if (untilYesterday) {
      const today = new Date();
      const currentYear = today.getFullYear();
      const currentMonth = today.getMonth() + 1;

      if (parseInt(year) === currentYear && parseInt(month) === currentMonth) {
        lastDay = today.getDate() - 1;
        if (lastDay <= 0) {
          return [];
        }
      }
    }

    for (let i = 1; i <= lastDay; i++) {
      const day = i.toString().padStart(2, "0");
      dates.push(`${year}-${month}-${day}`);
    }

    return dates;
  }

  /**
   * Get query for WRC data based on table type
   * @param {string} tableName - Table name
   * @param {string} tableType - Table type (wt, dt, pr)
   * @returns {string} SQL query
   */
  getWrcQuery(tableName, tableType = 'wt') {
    const tableDate = tableName.substring(3);
    
    switch (tableType.toLowerCase()) {
      case 'dt':
        return config.queries.dt ? config.queries.dt.replace("{date}", tableDate) : 
          "SELECT * FROM " + tableName;
      case 'pr':
        return config.queries.pr ? config.queries.pr.replace("{date}", tableDate) : 
          "SELECT * FROM " + tableName;
      case 'wt':
      default:
        return config.queries.wrc.replace("{date}", tableDate);
    }
  }

  /**
   * Get data from WRC for a specific period
   * @param {string} cab - Branch code
   * @param {string} period - Period in YYMM format
   * @param {string} tableType - Table type (wt, dt, pr)
   * @returns {Promise<Array>} Array of WRC data
   */
  async getWrcData(cab, period, tableType = 'wt') {
    const wrcInstance = new wrcService();
    const wrcConfig = await wrcInstance.getConnWRC(cab);
    const connection = await mysql.createConnection(wrcConfig);

    try {
      logger.info(`Getting ${tableType.toUpperCase()} data for cab: ${cab}, period: ${period} ...`);
      const year = "20" + period.substring(0, 2);
      const month = period.substring(2, 4);

      // Get all dates in the month
      const currentDate = new Date();
      const currentYear = currentDate.getFullYear();
      const currentMonth = currentDate.getMonth() + 1;
      const isCurrentMonth = parseInt(year) === currentYear && parseInt(month) === currentMonth;

      const dates = this.getAllDatesInMonth(year, month, isCurrentMonth);

      if (dates.length === 0) {
        return [];
      }

      // Create temporary file to store WRC data
      const tempDir = path.join(os.tmpdir());
      const tempFile = path.join(
        tempDir,
        `${tableType}_data_${cab}_${period}_${Date.now()}.json`
      );

      // Ensure temp directory exists
      try {
        await fs.mkdir(tempDir, { recursive: true });
      } catch (error) {
        if (error.code !== "EEXIST") {
          throw error;
        }
      }

      // Initialize empty array for all WRC data
      const allWrcData = [];

      // Query each table for each date
      for (const date of dates) {
        const dateParts = date.split("-");
        const tableDate = dateParts[0].substring(2) + dateParts[1] + dateParts[2];
        const tableName = `${tableType}_${tableDate}`;

        try {
          const query = this.getWrcQuery(tableName, tableType);
          const [rows] = await connection.execute(query);

          if (rows && rows.length > 0) {
            allWrcData.push(...rows);
          }
        } catch (error) {
          logger.error(`Error querying ${tableName}: ${error.message}`);
          // Continue with next date even if there's an error
        }
      }

      // Save data to temporary file
      await fs.writeFile(tempFile, JSON.stringify(allWrcData));

      return tempFile;
    } catch (error) {
      logger.error(`Error getting ${tableType.toUpperCase()} data: ${error.message}`);
      throw error;
    } finally {
      await connection.end();
    }
  }

  /**
   * Get query for store data
   * @param {string} period - Period in YYMM format
   * @returns {string} SQL query
   */
  getStoreQuery(period) {
    const year = "20" + period.substring(0, 2);
    const month = period.substring(2, 4);
    const periodStr = `${year}-${month}`;

    return config.queries.store.replace("{period}", periodStr);
  }
}

export default new WrcUtils();