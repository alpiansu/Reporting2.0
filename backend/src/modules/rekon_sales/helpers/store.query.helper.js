import logger from "../../../config/logger.js";
import config from "../rekon_sales.config.js";

class StoreQueryHelper {
  /**
   * Fetch mtran vs closing detail
   * Aggregates sales data per date with comparisons to GL and Closing Detail
   *
   * @param {Object} connection - Store database connection
   * @param {string} strMonth - Month in MM format
   * @param {string} strYear - Year in YYYY format
   * @returns {Promise<Array>} Array of aggregated sales data
   */
  async fetchMtranVsCD(connection, strMonth, strYear, storeCode, cab) {
    try {
      const query = `
        SELECT 
          TANGGAL, 
          STATION, 
          SHIFT, 
          NET_MTRAN, 
          NET_ClosingDetail, 
          (NET_MTRAN - NET_ClosingDetail) AS SEL_NET, 
          PPN_MTRAN, 
          PPN_CD, 
          0 AS PPN_IO, 
          (COALESCE(PPN_MTRAN,0) - COALESCE(PPN_CD,0)) AS SEL_PPN, 
          RETUR_PPNJP_ISTORE, 
          KODEPESANAN 
        FROM (
          SELECT 
            TANGGAL, 
            STATION, 
            SHIFT, 
            SUM(IF(rtype='J', IF(BKP='Y' AND SUB_BKP='Y', gross-ppn, gross), (IF(BKP='Y' AND SUB_BKP='Y', gross-ppn, gross))*-1)) AS NET_MTRAN,
            SUM(IF(rtype='J', hpp*qty, (hpp*qty)*-1)) AS HPP_MTRAN,
            SUM(IF(rtype='J', IF(BKP='Y' AND SUB_BKP='Y', ppn, 0), (IF(BKP='Y' AND SUB_BKP='Y', ppn, 0))*-1)) AS PPN_MTRAN,
            IFNULL(NET_ClosingDetail, 0) as NET_ClosingDetail,
            IFNULL(PPN_CD, 0) as PPN_CD,
            IFNULL(RETUR_PPNJP_ISTORE, 0) AS RETUR_PPNJP_ISTORE,
            GROUP_CONCAT(DISTINCT 
              CASE 
                WHEN LEFT(CUSTOMER,1) != '*' 
                  AND CUSTOMER NOT IN (
                    SELECT DISTINCT kode 
                    FROM idelivery_pembayaran 
                    WHERE nominal - nominal_pengurang = 0 
                      AND LEFT(kode,1)='A'
                  ) 
                THEN IF(LEFT(CUSTOMER,1) = 'A', CUSTOMER, NULL)
                ELSE NULL
              END
            ) AS KODEPESANAN
          FROM mtran 
          LEFT JOIN (
            SELECT 
              TANGGAL, 
              STATION, 
              SHIFT, 
              SUM(IF(RKEY="SALES", TOTAL, (TOTAL)*-1)) AS NET_ClosingDetail 
            FROM closing_detail 
            WHERE rkey IN ('sales', 'retur') 
              AND MONTH(TANGGAL) = ? 
              AND YEAR(tanggal) = ? 
            GROUP BY tanggal, station, shift
          ) AS CD USING (TANGGAL, STATION, SHIFT) 
          LEFT JOIN (
            SELECT 
              TANGGAL, 
              STATION, 
              SHIFT, 
              SUM(TOTAL) AS PPN_CD 
            FROM closing_detail 
            WHERE rkey IN ('PPN') 
              AND MONTH(TANGGAL) = ? 
              AND YEAR(tanggal) = ? 
            GROUP BY tanggal, station, shift
          ) AS PPN_CD USING (TANGGAL, STATION, SHIFT) 
          LEFT JOIN (
            SELECT 
              TANGGAL, 
              STATION, 
              SHIFT, 
              SUM(PPN) AS RETUR_PPNJP_ISTORE 
            FROM BAYAR 
            WHERE STATION=99 AND SHIFT=9 
            GROUP BY TANGGAL, STATION, SHIFT
          ) AS RETUR_PPNJP_ISTORE USING (TANGGAL,STATION,SHIFT)
          WHERE MONTH(tanggal) = ? 
            AND YEAR(tanggal) = ? 
            AND (catcode NOT RLIKE '^55|^055' AND catcode NOT IN('54901','54902','54005','054901','054902','054005')) 
            AND plu NOT IN(00000000,0,'',' ') 
            AND TANGGAL < CURDATE()
          GROUP BY TANGGAL, STATION, SHIFT
        ) AS X
      `;

      const [rows] = await connection.query(query, [
        strMonth,
        strYear, // CD
        strMonth,
        strYear, // PPN_CD
        strMonth,
        strYear, // Main query
      ]);

      const mapped = rows.map(r => ({
        CAB: cab,
        SHOP: storeCode,
        TANGGAL: r.TANGGAL,
        STATION: r.STATION,
        SHIFT: r.SHIFT,
        NET_MTRAN: r.NET_MTRAN,
        NET_ClosingDetail: r.NET_ClosingDetail,
        SEL_NET: r.SEL_NET,
        PPN_MTRAN: r.PPN_MTRAN,
        PPN_CD: r.PPN_CD,
        PPN_IO: r.PPN_IO,
        SEL_PPN: r.SEL_PPN,
        RETUR_PPNJP_ISTORE: r.RETUR_PPNJP_ISTORE,
        KODEPESANAN: r.KODEPESANAN,
      }));

      logger.info(`[StoreQueryHelper] fetchMtranVsCD: ${mapped.length} records fetched`);
      return mapped;
    } catch (error) {
      logger.error(`[StoreQueryHelper] Error in fetchMtranVsCD: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get per-shift differences between mtran and closing detail
   * Replaces cekSelisihMtranVsCD + old getItemLevelDifferences
   * Returns aggregated per-TANGGAL/STATION/SHIFT summary with HAVING filter
   *
   * @param {Object} connection - Store database connection
   * @param {string} strMonth - Month in MM format
   * @param {string} strYear - Year in YYYY format
   * @returns {Promise<Array>} Array of per-shift difference records
   */
  async getShiftDifferences(connection, strMonth, strYear, storeCode, cab) {
    try {
      const tolerance = config.tolerance;

      const query = `
        SELECT TANGGAL, STATION, SHIFT, 
          IFNULL(NET_MTRAN,0) AS NET_MTRAN, 
          IFNULL(NET_ClosingDetail,0) AS NET_ClosingDetail, 
          IFNULL(NET_MTRAN,0) - IFNULL(NET_ClosingDetail,0) AS SEL 
        FROM (
          SELECT 
            TANGGAL, 
            STATION, 
            SHIFT, 
            SUM(IF(rtype='J', IF(BKP='Y' AND SUB_BKP = 'Y', gross-ppn, gross), (IF(BKP='Y' AND SUB_BKP = 'Y', gross-ppn, gross))*-1)) AS NET_MTRAN,
            SUM(IF(rtype='J', hpp*qty, (hpp*qty)*-1)) AS HPP_MTRAN,
            SUM(IF(rtype='J', IF(BKP='Y' AND SUB_BKP = 'Y', ppn, 0), (IF(BKP='Y' AND SUB_BKP = 'Y', ppn, 0))*-1)) AS PPN_MTRAN,
            IFNULL(NET_ClosingDetail, 0) AS NET_ClosingDetail
          FROM mtran 
          LEFT JOIN (
            SELECT TANGGAL, STATION, SHIFT, SUM(IF(RKEY="SALES", TOTAL, (TOTAL)*-1)) AS NET_ClosingDetail 
            FROM closing_detail 
            WHERE rkey IN ('sales', 'retur') 
              AND MONTH(TANGGAL)=? AND YEAR(tanggal)=? 
            GROUP BY tanggal, station, shift
          ) AS CD USING (TANGGAL, STATION, SHIFT)
          WHERE month(tanggal)=? AND year(tanggal)=? 
            AND (catcode NOT RLIKE '^55|^055' AND catcode NOT IN('54901','54902','54005','054901','054902','054005')) 
            AND plu NOT IN(00000000,0,'',' ') AND TANGGAL < CURDATE()
          GROUP BY TANGGAL, STATION, SHIFT
        ) AS X 
        HAVING SEL > ? OR SEL < -?
      `;

      const [rows] = await connection.query(query, [
        strMonth,
        strYear, // CD subquery
        strMonth,
        strYear, // Main WHERE
        tolerance,
        tolerance,
      ]);

      const mapped = rows.map(r => ({
        CAB: cab,
        SHOP: storeCode,
        TANGGAL: r.TANGGAL,
        STATION: r.STATION,
        SHIFT: r.SHIFT,
        NET_MTRAN: r.NET_MTRAN,
        NET_ClosingDetail: r.NET_ClosingDetail,
        SEL: r.SEL,
        MONTH: strMonth,
        YEAR: strYear,
      }));

      logger.info(`[StoreQueryHelper] getShiftDifferences: ${mapped.length} shifts with differences found`);
      return mapped;
    } catch (error) {
      logger.error(`[StoreQueryHelper] Error in getShiftDifferences: ${error.message}`);
      throw error;
    }
  }

  /**
   * Live check: fetch item-level mtran data for specific shifts, joined with prodmast
   * Used when user clicks the "Selisih Mtran & Closing Detail" tab
   *
   * @param {Object} connection - Store database connection
   * @param {Array} shifts - Array of { TANGGAL, STATION, SHIFT } objects
   * @returns {Promise<Array>} Array of item-level records with validations
   */
  async getLiveCheckItems(connection, shifts) {
    try {
      if (!shifts || shifts.length === 0) {
        return [];
      }

      const shiftKeys = shifts.map(s => `${s.TANGGAL}|${s.STATION}|${s.SHIFT}`);
      const placeholders = shiftKeys.map(() => "?").join(", ");

      const query = `
        SELECT
          m.TANGGAL, m.STATION, m.SHIFT, m.DOCNO, m.RTYPE, m.PLU,
          p.SINGKATAN,
          m.QTY, m.PRICE, m.GROSS, m.BKP, m.SUB_BKP, m.PPN,
          m.GROSS_DPP, m.ADDTIME,
          CASE WHEN IFNULL(m.SUB_BKP,'N') = 'Y' THEN m.GROSS - IFNULL(m.PPN,0) ELSE m.GROSS END AS HIT_GROSS_DPP,
          m.PPN_RATE,
          p.BKP AS PRODMAST_BKP, p.SUB_BKP AS PRODMAST_SUB_BKP, p.FLAGPROD,
          CASE 
            WHEN IFNULL(m.BKP,'') != IFNULL(p.BKP,'') OR IFNULL(m.SUB_BKP,'') != IFNULL(p.SUB_BKP,'') THEN 'SELISIH'
            ELSE 'OK'
          END AS BKP_VALIDATION,
          CASE
            WHEN m.BKP = 'Y' AND (p.FLAGPROD IS NOT NULL AND p.FLAGPROD LIKE '%PJR=Y%') AND IFNULL(m.PPN_RATE,0) != 10 THEN 'SELISIH-PJR'
            WHEN m.BKP = 'Y' AND (p.FLAGPROD IS NULL OR p.FLAGPROD NOT LIKE '%PJR=Y%') AND IFNULL(m.PPN_RATE,0) != 11 THEN 'SELISIH-PPN'
            WHEN IFNULL(m.BKP,'N') != 'Y' AND IFNULL(m.PPN_RATE,0) != 0 THEN 'SELISIH-PPN'
            ELSE 'OK'
          END AS PPN_RATE_VALIDATION
        FROM mtran m
        LEFT JOIN prodmast p ON m.PLU = p.prdcd
        WHERE CONCAT(m.TANGGAL, '|', m.STATION, '|', m.SHIFT) IN (${placeholders})
          AND (m.catcode NOT RLIKE '^55|^055' AND m.catcode NOT IN('54901','54902','54005','054901','054902','054005'))
          AND m.plu NOT IN(00000000,0,'',' ')
          AND m.TANGGAL < CURDATE()
        ORDER BY m.TANGGAL, m.STATION, m.SHIFT, m.DOCNO, m.SEQNO
      `;

      const [rows] = await connection.query(query, shiftKeys);

      logger.info(`[StoreQueryHelper] getLiveCheckItems: ${rows.length} item-level records fetched`);
      return rows;
    } catch (error) {
      logger.error(`[StoreQueryHelper] Error in getLiveCheckItems: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get available dates for a specific month/year in store
   * Used for validation and date range queries
   *
   * @param {Object} connection - Store database connection
   * @param {string} strMonth - Month in MM format
   * @param {string} strYear - Year in YYYY format
   * @returns {Promise<Array>} Array of available dates
   */
  async getAvailableDates(connection, strMonth, strYear) {
    try {
      const query = `
        SELECT DISTINCT DATE(tanggal) as tanggal
        FROM mtran
        WHERE MONTH(tanggal) = ?
          AND YEAR(tanggal) = ?
          AND tanggal < CURDATE()
        ORDER BY tanggal
      `;

      const [rows] = await connection.query(query, [strMonth, strYear]);

      return rows.map(r => r.tanggal);
    } catch (error) {
      logger.error(`[StoreQueryHelper] Error in getAvailableDates: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get initial/opening info per shift from table `initial`
   * Used for live check to detect late sales upload ("sales telat naik")
   *
   * Logic:
   * - TRN_END is stored as char(8) time "HH:MM:SS"
   * - If TRN_START < TRN_END: same date
   * - If TRN_START > TRN_END: TRN_END belongs to H+1
   * - ADDTIME is full datetime; if ADDTIME > TRN_END dateTime, sales is late
   *
   * @param {Object} connection - Store database connection
   * @param {Array} shifts - Array of { TANGGAL, STATION, SHIFT } objects
   * @returns {Promise<Object>} Map key "TANGGAL|STATION|SHIFT" -> { addtime, trnStart, trnEnd, isTelatNaik }
   */
  async getLiveCheckShiftInfo(connection, shifts) {
    try {
      if (!shifts || shifts.length === 0) {
        return {};
      }

      const shiftKeys = shifts.map(s => `${s.TANGGAL}|${s.STATION}|${s.SHIFT}`);
      const placeholders = shiftKeys.map(() => "?").join(", ");

      const query = `
        SELECT
          i.TANGGAL,
          i.STATION,
          i.SHIFT,
          i.TRN_START,
          i.TRN_END,
          i.ADDTIME
        FROM initial i
        WHERE CONCAT(i.TANGGAL, '|', i.STATION, '|', i.SHIFT) IN (${placeholders})
      `;

      const [rows] = await connection.query(query, shiftKeys);
      const resultMap = {};

      for (const r of rows) {
        const key = `${r.TANGGAL}|${r.STATION}|${r.SHIFT}`;
        const trnStart = r.TRN_START || "00:00:00";
        const trnEnd = r.TRN_END || "23:59:59";

        let trnEndDate;
        if (trnStart < trnEnd) {
          trnEndDate = `${r.TANGGAL} ${trnEnd}`;
        } else {
          const nextDay = new Date(r.TANGGAL);
          nextDay.setDate(nextDay.getDate() + 1);
          const nextDayStr = nextDay.toISOString().slice(0, 10);
          trnEndDate = `${nextDayStr} ${trnEnd}`;
        }

        let isTelatNaik = false;
        if (r.ADDTIME) {
          const addtime = typeof r.ADDTIME === "string"
            ? r.ADDTIME.replace("T", " ").replace(/\.\d+Z$/, "")
            : new Date(r.ADDTIME).toISOString().slice(0, 19).replace("T", " ");
          isTelatNaik = addtime > trnEndDate;
        }

        resultMap[key] = {
          addtime: r.ADDTIME ? (typeof r.ADDTIME === "string" ? r.ADDTIME.replace("T", " ").replace(/\.\d+Z$/, "") : new Date(r.ADDTIME).toISOString().slice(0, 19).replace("T", " ")) : null,
          trnStart: trnStart,
          trnEnd: trnEnd,
          trnEndDate: trnEndDate,
          isTelatNaik: isTelatNaik,
        };
      }

      logger.info(`[StoreQueryHelper] getLiveCheckShiftInfo: ${Object.keys(resultMap).length} shift records fetched from initial`);
      return resultMap;
    } catch (error) {
      logger.error(`[StoreQueryHelper] Error in getLiveCheckShiftInfo: ${error.message}`);
      return {};
    }
  }
}

export default new StoreQueryHelper();
