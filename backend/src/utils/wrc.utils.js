/**
 * Utility functions for interacting with WRC (poscabang) database
 */
import fs from "fs/promises";
import path from "path";
import os from "os";
import mysql from "mysql2/promise";
import logger from "../config/logger.js";
import wrcService from "../services/wrc.service.js";
import config from "../config/rekon_wt_harian.config.js";

class WrcUtils {
  /**
   * Clean up memory by clearing array and removing reference
   * @param {Array} arrayRef - Array reference to cleanup
   * @param {boolean} logCleanup - Whether to log cleanup action (default: false)
   * @returns {null} Always returns null
   */
  cleanupMemory(arrayRef, logCleanup = false) {
    if (arrayRef && Array.isArray(arrayRef)) {
      const originalLength = arrayRef.length;
      arrayRef.length = 0; // Clear array contents immediately

      if (logCleanup && originalLength > 0) {
        logger.debug(`Memory cleanup: cleared array with ${originalLength} elements`);
      }
    }
    return null; // Return null to assign back to variable
  }

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
   * Get data from WRC for a specific period
   * @param {string} cab - Branch code
   * @param {string} period - Period in YYMM format
   * @param {string} tableType - Table type (wt, dt, pr, etc.) for file naming and logging
   * @param {string} strQuery - SQL query template to execute (with {date} placeholder)
   * @returns {Promise<string>} Path to temporary file containing WRC data
   */
  async getWrcData(cab, period, tableType = "wt", strQuery) {
    if (!strQuery) {
      throw new Error("Query parameter (strQuery) is required");
    }

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
        return null;
      }

      // Create temporary file to store WRC data
      const tempDir = path.join(os.tmpdir());
      const tempFile = path.join(tempDir, `${tableType}_data_${cab}_${period}_${Date.now()}.json`);

      // Ensure temp directory exists
      try {
        await fs.mkdir(tempDir, { recursive: true });
      } catch (error) {
        if (error.code !== "EEXIST") {
          throw error;
        }
      }

      // Build UNION ALL query for all dates
      const unionQueries = [];
      const validDates = [];

      for (const date of dates) {
        const dateParts = date.split("-");
        const tableDate = dateParts[0].substring(2) + dateParts[1] + dateParts[2];

        // Replace {date} placeholder in query with actual table date
        const finalQuery = strQuery.replace("{date}", tableDate);
        unionQueries.push(`(${finalQuery})`);
        validDates.push(tableDate);
      }

      // Combine all queries with UNION ALL
      const combinedQuery = unionQueries.join(" UNION ALL ");

      logger.info(
        `Executing combined query for ${validDates.length} tables: ${tableType}_${validDates[0]} to ${tableType}_${
          validDates[validDates.length - 1]
        }`
      );

      // Execute the combined query once
      let allWrcData = [];
      try {
        const [rows] = await connection.execute(combinedQuery);
        allWrcData = rows || [];
        logger.info(`Retrieved ${allWrcData.length} records from ${validDates.length} tables`);
      } catch (error) {
        logger.error(`Error executing combined query: ${error.message}`);
        // If combined query fails, fallback to individual queries for debugging
        logger.info("Falling back to individual queries for error diagnosis...");

        for (let i = 0; i < dates.length; i++) {
          const date = dates[i];
          const tableDate = validDates[i];

          try {
            const finalQuery = strQuery.replace("{date}", tableDate);
            const [rows] = await connection.execute(finalQuery);

            if (rows && rows.length > 0) {
              allWrcData.push(...rows);
            }
          } catch (individualError) {
            logger.error(`Error querying ${tableType}_${tableDate}: ${individualError.message}`);
            // Continue with next date even if there's an error
          }
        }
      }

      // Save data to temporary file
      await fs.writeFile(tempFile, JSON.stringify(allWrcData));

      // Explicit memory cleanup to prevent memory leaks
      allWrcData = this.cleanupMemory(allWrcData, true);

      logger.info(`Data saved to temporary file: ${tempFile}`);
      return tempFile;
    } catch (error) {
      logger.error(`Error getting ${tableType.toUpperCase()} data: ${error.message}`);

      // Cleanup memory in case of error
      if (typeof allWrcData !== "undefined" && allWrcData !== null) {
        allWrcData = this.cleanupMemory(allWrcData);
      }

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
