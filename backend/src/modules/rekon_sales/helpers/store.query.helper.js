/**
 * Store Query Helper - Handles all store database queries
 * Extracted from original STORESalesVsCd.js logic
 */
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
  async fetchMtranVsCD(connection, strMonth, strYear) {
    try {
      const subBkpBebasPPN = config.subBkpBebasPPN;

      const query = `
        SELECT 
          (SELECT KIRIM FROM toko) AS CAB, 
          (SELECT KDTK FROM toko) as SHOP, 
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
            SHOP, 
            TANGGAL, 
            STATION, 
            SHIFT, 
            SUM(IF(rtype='J', IF(sub_bkp NOT IN ${subBkpBebasPPN}, gross-ppn, gross), (IF(sub_bkp NOT IN ${subBkpBebasPPN}, gross-ppn, gross))*-1)) AS NET_MTRAN,
            SUM(IF(rtype='J', hpp*qty, (hpp*qty)*-1)) AS HPP_MTRAN,
            SUM(IF(rtype='J', IF(sub_bkp NOT IN ${subBkpBebasPPN}, ppn, 0), (IF(sub_bkp NOT IN ${subBkpBebasPPN}, ppn, 0))*-1)) AS PPN_MTRAN,
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

      logger.info(`[StoreQueryHelper] fetchMtranVsCD: ${rows.length} records fetched`);
      return rows;
    } catch (error) {
      logger.error(`[StoreQueryHelper] Error in fetchMtranVsCD: ${error.message}`);
      throw error;
    }
  }

  /**
   * Check differences between mtran and closing detail
   * Gets detailed records where differences exceed tolerance
   *
   * @param {Object} connection - Store database connection
   * @param {string} strMonth - Month in MM format
   * @param {string} strYear - Year in YYYY format
   * @returns {Promise<Array>} Array of detailed differences
   */
  async cekSelisihMtranVsCD(connection, strMonth, strYear) {
    try {
      const subBkpBebasPPN = config.subBkpBebasPPN;
      const tolerance = config.tolerance;

      const query = `
        SELECT 
          (SELECT KIRIM FROM toko) AS CAB, 
          (SELECT toko FROM toko) as SHOP, 
          TANGGAL, 
          STATION, 
          SHIFT, 
          NET_MTRAN, 
          NET_ClosingDetail, 
          NET_MTRAN - NET_ClosingDetail AS SEL_NET, 
          PPN_MTRAN, 
          PPN_CD, 
          0 as PPN_IO, 
          (COALESCE(PPN_MTRAN,0) - COALESCE(PPN_CD,0)) AS SEL_PPN, 
          NOW() AS LASTTRY 
        FROM (
          SELECT 
            SHOP, 
            TANGGAL, 
            STATION, 
            SHIFT, 
            SUM(IF(rtype='J', IF(sub_bkp NOT IN ${subBkpBebasPPN}, gross-ppn, gross), (IF(sub_bkp NOT IN ${subBkpBebasPPN}, gross-ppn, gross))*-1)) AS NET_MTRAN,
            SUM(IF(rtype='J', hpp*qty, (hpp*qty)*-1)) AS HPP_MTRAN,
            SUM(IF(rtype='J', IF(sub_bkp NOT IN ${subBkpBebasPPN}, ppn, 0), (IF(sub_bkp NOT IN ${subBkpBebasPPN}, ppn, 0))*-1)) AS PPN_MTRAN,
            IFNULL(NET_ClosingDetail, 0) as NET_ClosingDetail,
            IFNULL(PPN_CD, 0) as PPN_CD
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
          WHERE MONTH(tanggal) = ? 
            AND YEAR(tanggal) = ? 
            AND (catcode NOT RLIKE '^55|^055' AND catcode NOT IN('54901','54902','54005','054901','054902','054005')) 
            AND plu NOT IN(00000000,0,'',' ') 
            AND TANGGAL < CURDATE()
            AND STATION != '99'
          GROUP BY TANGGAL, STATION, SHIFT
        ) AS X 
        HAVING (SEL_NET > ${tolerance} OR SEL_NET < -${tolerance} OR SEL_PPN > ${tolerance} OR SEL_PPN < -${tolerance})
      `;

      const [rows] = await connection.query(query, [
        strMonth,
        strYear, // CD
        strMonth,
        strYear, // PPN_CD
        strMonth,
        strYear, // Main query
      ]);

      logger.info(`[StoreQueryHelper] cekSelisihMtranVsCD: ${rows.length} differences found`);
      return rows;
    } catch (error) {
      logger.error(`[StoreQueryHelper] Error in cekSelisihMtranVsCD: ${error.message}`);
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
}

export default new StoreQueryHelper();
