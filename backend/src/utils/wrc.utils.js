/**
 * Utility functions for interacting with WRC (poscabang) database
 */
import fs from "fs/promises";
import path from "path";
import os from "os";
import mysql from "mysql2/promise";
import logger from "../config/logger.js";
import wrcService from "../services/wrc.service.js";
import MemoryUtils from "./memory.utils.js";

class WrcUtils {
  /**
   * Clean up memory by clearing array and removing reference
   * @param {Array} arrayRef - Array reference to cleanup
   * @param {boolean} logCleanup - Whether to log cleanup action (default: false)
   * @returns {null} Always returns null
   */
  cleanupMemory(arrayRef, logCleanup = false) {
    return MemoryUtils.cleanupMemory(arrayRef, logCleanup);
  }

  /**
   * Add shop filter to SQL query
   * @param {string} query - Original SQL query
   * @param {Array} shops - Array of shop codes
   * @param {string} tableType - Table type (wt, dt, pr)
   * @returns {string} Modified query with shop filter
   */
  addShopFilter(query, shops, tableType) {
    if (!shops || !Array.isArray(shops) || shops.length === 0) {
      return query;
    }

    // Determine column name based on table type
    const columnName = tableType === "pr" ? "toko" : "shop";

    // Create shop filter condition
    const shopList = shops.map(shop => `'${shop}'`).join(", ");
    const shopFilter = `${columnName} IN (${shopList})`;

    // Check if query already has WHERE clause
    const hasWhere = /\bWHERE\b/i.test(query);

    if (hasWhere) {
      // Add AND condition
      return query + ` AND ${shopFilter} `;
    } else {
      // Add WHERE condition
      return query + ` WHERE ${shopFilter} `;
    }
  }

  /**
   * Smart replace date and add shop filter in one operation
   * Places shop filter in the correct position (after FROM but before GROUP BY/ORDER BY/HAVING)
   * @param {string} query - Original SQL query with {date} placeholder
   * @param {string} tableDate - Table date to replace {date}
   * @param {Array} shops - Array of shop codes
   * @param {string} tableType - Table type (wt, dt, pr)
   * @returns {string} Modified query with date replaced and shop filter added
   */
  smartReplaceAndFilter(query, tableDate, shops, tableType) {
    let finalQuery = query.split("{date}").join(tableDate);

    // If no shops filter needed, return the query as is
    if (!shops || !Array.isArray(shops) || shops.length === 0) {
      return finalQuery;
    }

    const columnMap = {
      pr: "toko",
      kodetoko: "kode_toko",
      glslp: "kode_toko",
    };

    // Determine column name based on table type
    const columnName = columnMap[tableType] || "shop";

    // Create shop filter condition
    const shopList = shops.map(shop => `'${shop}'`).join(", ");
    const shopFilter = `${columnName} IN (${shopList})`;

    // Find the best position to insert the WHERE clause
    // Look for GROUP BY, ORDER BY, HAVING, LIMIT clauses (case insensitive)
    const clauseRegex = /\b(GROUP\s+BY|ORDER\s+BY|HAVING|LIMIT)\b/i;
    const clauseMatch = finalQuery.match(clauseRegex);

    if (clauseMatch) {
      // Found a clause, insert WHERE before it
      const clauseIndex = clauseMatch.index;
      const beforeClause = finalQuery.substring(0, clauseIndex).trim();
      const afterClause = finalQuery.substring(clauseIndex);

      // Check if WHERE exists at the main query level (not in subqueries)
      const hasMainWhere = this.hasMainQueryWhere(beforeClause);

      if (hasMainWhere) {
        // Add AND condition before the clause
        return `${beforeClause} AND ${shopFilter} ${afterClause}`;
      } else {
        // Add WHERE condition before the clause
        return `${beforeClause} WHERE ${shopFilter} ${afterClause}`;
      }
    } else {
      // No special clauses found, use the simple approach
      const hasMainWhere = this.hasMainQueryWhere(finalQuery);

      if (hasMainWhere) {
        return `${finalQuery} AND ${shopFilter}`;
      } else {
        return `${finalQuery} WHERE ${shopFilter}`;
      }
    }
  }

  // Helper function to check if WHERE exists at main query level
  hasMainQueryWhere(queryPart) {
    // Remove all subqueries (content within parentheses) to avoid false detection
    let cleaned = queryPart;
    let depth = 0;
    let result = "";

    for (let i = 0; i < cleaned.length; i++) {
      if (cleaned[i] === "(") {
        depth++;
      } else if (cleaned[i] === ")") {
        depth--;
      } else if (depth === 0) {
        result += cleaned[i];
      }
    }

    // Now check for WHERE in the cleaned query (without subqueries)
    return /\bWHERE\b/i.test(result);
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
  async getWrcData(cab, period, tableType, strQuery, shops) {
    if (!strQuery) {
      throw new Error("Query parameter (strQuery) is required");
    }

    const wrcInstance = new wrcService();
    const wrcConfig = await wrcInstance.getConnWRC(cab);
    const connection = await mysql.createConnection(wrcConfig);

    let allWrcData = [];

    try {
      logger.info(`Getting ${tableType.toUpperCase()} data for cab: ${cab}, period: ${period} ...`);

      // Cek apakah pakai {date} untuk UNION ALL
      const hasDatePlaceholder = strQuery.includes("{date}");

      // Jika query TIDAK pakai {date} -> eksekusi langsung tanpa loop
      if (!hasDatePlaceholder) {
        logger.info(`Direct table mode: executing single query for ${tableType}_${period}`);

        const finalQuery = this.smartReplaceAndFilter(strQuery, period, shops, tableType);

        const [rows] = await connection.execute(finalQuery);
        allWrcData = rows || [];
      } else {
        // ORIGINAL MODE (UNION ALL berdasarkan tanggal)
        const year = "20" + period.substring(0, 2);
        const month = period.substring(2, 4);

        const currentDate = new Date();
        const currentYear = currentDate.getFullYear();
        const currentMonth = currentDate.getMonth() + 1;
        const isCurrentMonth = parseInt(year) === currentYear && parseInt(month) === currentMonth;

        const dates = this.getAllDatesInMonth(year, month, isCurrentMonth);
        if (dates.length === 0) return null;

        const unionQueries = [];
        const validDates = [];

        for (const date of dates) {
          const dateParts = date.split("-");
          const tableDate = dateParts[0].substring(2) + dateParts[1] + dateParts[2];

          const finalQuery = this.smartReplaceAndFilter(strQuery, tableDate, shops, tableType);
          unionQueries.push(`(${finalQuery})`);
          validDates.push(tableDate);
        }

        const combinedQuery = unionQueries.join(" UNION ALL ");
        logger.info(`Executing combined query for ${validDates.length} tables ...`);

        const [rows] = await connection.execute(combinedQuery);
        allWrcData = rows || [];
      }

      // SAVE FILE
      const tempDir = path.join(os.tmpdir());
      const shopSuffix = shops && shops.length > 0 ? `_shops_${shops.join("_")}` : "";
      const tempFile = path.join(tempDir, `${tableType}_data_${cab}_${period}${shopSuffix}_${Date.now()}.json`);

      await fs.mkdir(tempDir, { recursive: true }).catch(() => {});
      await fs.writeFile(tempFile, JSON.stringify(allWrcData));

      allWrcData = this.cleanupMemory(allWrcData, true);

      logger.info(`WRC data saved to file: ${tempFile}`);
      return tempFile;
    } catch (error) {
      logger.error(`Error getting ${tableType.toUpperCase()} data: ${error.message}`);
      throw error;
    } finally {
      await connection.end();
    }
  }
}

export default new WrcUtils();
