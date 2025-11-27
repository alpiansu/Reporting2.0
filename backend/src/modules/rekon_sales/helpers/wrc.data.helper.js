/**
 * WRC Data Helper - New version using WrcUtils.getWrcData()
 */

import fs from "fs/promises";
import moment from "moment";
import logger from "../../../config/logger.js";
import WrcUtils from "../../../utils/wrc.utils.js";

class WrcDataHelper {
  /**
   * Get GL data from WRC for a specific period (new version)
   * Now using getWrcData() instead of manual UNION ALL + mysql connection
   *
   * @param {string} strCab - Branch code
   * @param {string} strShop - Store code or 'ALL'
   * @param {string} strMonth - Month in MM format
   * @param {string} strYear - Year in YYYY format
   * @returns {Promise<Object>} { data: Array, tempFile: string }
   */
  async openDataGLWrc(strCab, strShop, strMonth, strYear) {
    try {
      const period = `${strYear.substring(2)}${strMonth}`; // YYMM
      const shops = strShop === "ALL" ? [] : [strShop];

      const queryTemplate = `
        SELECT 
          '${strCab}' AS CAB, 
          UPPER(KODE_TOKO) AS KODE_TOKO,
          '{date}' AS TGL_GL,
          SUM(
            CASE WHEN KODE IN ('01','26') THEN
              IF(KODE='01', AMOUNT_CR+FEE_DPP_CR+FEE_CR_PPN, (AMOUNT_DR+FEE_DPP_DR+FEE_DR_PPN)*-1)
            ELSE 0 END
          ) AS NET_GL,
          SUM(
            CASE WHEN KODE IN ('02','51') OR REF_2 IN ('JOINT PROMO','TITIPAN SUPPLIER') THEN 
              CASE WHEN KODE = '02' THEN 
                AMOUNT_CR+FEE_DPP_CR+FEE_CR_PPN
              WHEN KODE = '51' THEN 
                (AMOUNT_DR+FEE_DPP_DR+FEE_DR_PPN)*-1
              ELSE
                IF(KODE='11', CAST(REF_1 AS DECIMAL(25,2)), CAST(REF_3 AS DECIMAL(25,2))*-1)
              END
            ELSE 0 END
          ) AS PPN_GL,
          SUM(
            IF(KODE='26' AND \`DESC\` != 'RETUR SALES Dry Non ECOMMERCE',
            AMOUNT_DR+FEE_DPP_DR+FEE_DR_PPN, 0)
          ) AS NET_RETUR_ECOM,
          SUM(
            IF(KODE='51' AND \`DESC\` != 'BEBAN PPN Dry Non ECOMMERCE',
            AMOUNT_DR+FEE_DPP_DR+FEE_DR_PPN, 0)
          ) AS PPN_RETUR_ECOM
        FROM glslp_{date}
        GROUP BY KODE_TOKO
      `;

      const tempFile = await WrcUtils.getWrcData(strCab, period, "gl", queryTemplate, shops);

      if (!tempFile) {
        logger.warn(`[rekon_sales.WrcDataHelper] No WRC data returned for cab: ${cab}, period: ${prdFilet}`);
        return [];
      }

      // Read JSON result file
      const raw = await fs.readFile(tempFile, "utf-8");
      const data = JSON.parse(raw);

      logger.info(`[rekon_sales.WrcDataHelper] openDataGLWrc: Loaded ${data.length} rows for ${strCab}/${strShop}`);

      await fs.unlink(tempFile).catch(err => {
        logger.warn(`[rekon_sales.WrcDataHelper] Failed to delete temp file ${tempFile}: ${err.message}`);
      });

      return { data, tempFile }; // keep same structure as old code
    } catch (err) {
      logger.error(`[rekon_sales.WrcDataHelper] openDataGLWrc failed: ${err.message}`);
      throw err;
    }
  }

  /**
   * Get kode pesanan (new version)
   * Now using getWrcData() instead of manual single-table query
   *
   * @param {string} strCab - Branch code
   * @param {string} strShop - Store code or 'ALL'
   * @param {string} strTgl - Date YYYY-MM-DD
   * @returns {Promise<string>} Comma-separated kode pesanan
   */
  async tarikKodePesanan(strCab, strShop, strTgl) {
    try {
      const dt = moment(strTgl).format("YYMMDD");
      const shops = strShop === "ALL" ? [] : [strShop];

      const queryTemplate = `
        SELECT 
          '${strCab}' AS CAB,
          KODE_TOKO,
          '{date}' AS TGL_GL,
          \`DESC\` AS KODEPESANAN
        FROM glslp_{date}
        WHERE LEFT(\`DESC\`, 1) = 'A'
        GROUP BY \`DESC\`
      `;

      // Use period in YYMM format
      const period = dt.substring(0, 4);

      const tempFile = await WrcUtils.getWrcData(strCab, period, "pesanan", queryTemplate, shops);
      if (!tempFile) {
        logger.warn(`[rekon_sales.WrcDataHelper] No WRC data returned for cab: ${cab}, period: ${prdFilet}`);
        return [];
      }

      const raw = await fs.readFile(tempFile, "utf-8");
      const rows = JSON.parse(raw);

      const kode = rows.map(r => r.KODEPESANAN).join(",");

      logger.info(`[rekon_sales.WrcDataHelper] tarikKodePesanan: ${kode.substring(0, 40)}...`);

      await fs.unlink(tempFile).catch(err => {
        logger.warn(`[rekon_sales.WrcDataHelper] Failed to delete temp file ${tempFile}: ${err.message}`);
      });

      return kode;
    } catch (err) {
      logger.error(`[rekon_sales.WrcDataHelper] tarikKodePesanan FAILED: ${err.message}`);
      return "";
    }
  }

  /**
   * Keep helper (same)
   */
  findGLData(dataGL, kodeToko, tglGL) {
    return dataGL.filter(item => item.KODE_TOKO === kodeToko && item.TGL_GL === tglGL);
  }
}

export default new WrcDataHelper();
