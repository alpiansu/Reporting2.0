/**
 * Rekon Calculator - Handles reconciliation calculations
 * Modular, pure functions for rekon logic
 */
import logger from "../../../config/logger.js";
import config from "../rekon_sales.config.js";
import WrcDataHelper from "./wrc.data.helper.js";
import DetailRekonSales from "../models/detail_rekon_sales.model.js";

class RekonCalculator {
  /**
   * Calculate reconciliation vs GL
   * Main recon logic extracted from STOREgetData.js -> rekonVsGl
   *
   * @param {string} cab - Branch code
   * @param {string} kdtk - Store code
   * @param {string} strMonth - Month
   * @param {string} strYear - Year
   * @param {Array} mtranData - Store mtran data
   * @param {Array} dataGL - WRC GL data
   * @param {Object} storeConnection - Store DB connection
   * @returns {Promise<Array>} Array of reconciliation results
   */
  async calculateRekon(cab, kdtk, strMonth, strYear, mtranData, dataGL, storeConnection) {
    try {
      logger.info(`[RekonCalculator] Starting calculation for ${kdtk}`);

      // STEP 1: Aggregate data per date
      const aggregated = await this.aggregateByDate(cab, kdtk, mtranData, dataGL);

      // STEP 2: Calculate differences
      const withDifferences = this.calculateDifferences(aggregated);

      // STEP 3: Check kode pesanan issues
      const kodePesananIssues = await this.checkKodePesanan(cab, kdtk, mtranData, dataGL);

      // STEP 4: Reset detail records
      await this.resetDetailRecords(kdtk, Object.keys(aggregated));

      // STEP 5: Filter based on threshold
      const filtered = this.filterByThreshold(withDifferences, kodePesananIssues, config.tolerance);

      logger.info(`[RekonCalculator] Calculation complete: ${filtered.length} issues found`);
      return filtered;
    } catch (error) {
      logger.error(`[RekonCalculator] Error in calculateRekon: ${error.message}`);
      throw error;
    }
  }

  /**
   * Aggregate mtran data by date and match with GL
   */
  async aggregateByDate(cab, kdtk, mtranData, dataGL) {
    const aggregated = {};
    for (const item of mtranData) {
      const key = `${item.SHOP}-${item.TANGGAL}`;
      const glData = WrcDataHelper.findGLData(dataGL, item.SHOP, item.TANGGAL);
      if (!aggregated[key]) {
        aggregated[key] = {
          CAB: item.CAB,
          KDTK: item.SHOP,
          TGL: item.TANGGAL,
          NET_TOKO: 0,
          NET_GL: glData.length > 0 ? parseFloat(glData[0].NET_GL) : 0,
          NET_CLOSINGDETAIL: 0,
          SEL_NET_GL: 0,
          SEL_NET_CD: 0,
          PPN_TOKO: 0,
          PPN_GL: glData.length > 0 ? parseFloat(glData[0].PPN_GL) : 0,
          PPN_CD: 0,
          SEL_PPN_GL: 0,
          SEL_PPN_CD: 0,
          NET_RETUR_ECOM: glData.length > 0 ? parseFloat(glData[0].NET_RETUR_ECOM) : 0,
          PPN_RETUR_ECOM: glData.length > 0 ? parseFloat(glData[0].PPN_RETUR_ECOM) : 0,
          RETUR_PPNJP_ISTORE: 0,
        };
      }

      aggregated[key].NET_TOKO += parseFloat(item.NET_MTRAN);
      aggregated[key].NET_CLOSINGDETAIL += parseFloat(item.NET_ClosingDetail);
      aggregated[key].PPN_TOKO += parseFloat(item.PPN_MTRAN) - parseFloat(item.PPN_IO || 0);
      aggregated[key].PPN_CD += parseFloat(item.PPN_CD);
      aggregated[key].RETUR_PPNJP_ISTORE += parseFloat(item.RETUR_PPNJP_ISTORE || 0);
    }

    return aggregated;
  }

  /**
   * Calculate differences (SEL_NET_GL, SEL_NET_CD, etc.)
   */
  calculateDifferences(aggregated) {
    const results = [];

    for (const key in aggregated) {
      const item = aggregated[key];

      item.SEL_NET_GL = parseFloat(item.NET_TOKO) - parseFloat(item.NET_GL);
      item.SEL_NET_CD = parseFloat(item.NET_TOKO) - parseFloat(item.NET_CLOSINGDETAIL);
      item.SEL_PPN_GL = parseFloat(item.PPN_TOKO) - parseFloat(item.PPN_GL);
      item.SEL_PPN_CD = parseFloat(item.PPN_TOKO) - parseFloat(item.PPN_CD);

      results.push(item);
    }

    return results;
  }

  /**
   * Check kode pesanan differences
   * Extracted from STOREgetData.js -> rekonKodePesanan
   */
  async checkKodePesanan(cab, kdtk, mtranData, dataGL) {
    try {
      logger.info(`[RekonCalculator] Checking kode pesanan for ${kdtk}`);

      const aggregated = {};

      for (const item of mtranData) {
        const key = `${item.SHOP}-${item.TANGGAL}`;

        if (!aggregated[key]) {
          // Get kode pesanan from GL
          const kodePesananGL = await WrcDataHelper.tarikKodePesanan(
            cab,
            item.SHOP,
            item.TANGGAL,
            {} // Will use connection from context
          );

          aggregated[key] = {
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
          aggregated[key].KODEPESANANTOKO += `,${item.KODEPESANAN}`;
        }
      }

      // Find differences
      const issues = [];

      for (const key in aggregated) {
        const item = aggregated[key];
        const kodePesananToko = item.KODEPESANANTOKO;
        const kodePesananGL = item.KODEPSANANGL;

        if (kodePesananGL && kodePesananToko) {
          if (kodePesananToko !== "" || kodePesananGL !== "") {
            const missingValues = this.findMissingValues(kodePesananToko, kodePesananGL);

            if (missingValues && missingValues.length > 0) {
              missingValues.forEach(value => {
                if (value !== "") {
                  issues.push({
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
      if (issues.length > 0) {
        await this.saveKodePesananIssues(issues);
      }

      logger.info(`[RekonCalculator] Kode pesanan check: ${issues.length} issues found`);
      return issues;
    } catch (error) {
      logger.error(`[RekonCalculator] Error in checkKodePesanan: ${error.message}`);
      return [];
    }
  }

  /**
   * Find missing values between two comma-separated strings
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
   * Filter results based on threshold and kode pesanan issues
   */
  filterByThreshold(data, kodePesananIssues, tolerance) {
    const filtered = [];

    for (const item of data) {
      const [kdtk, tgl] = this.extractKeys(`${item.KDTK}-${item.TGL}`);

      const hasKodePesananIssue = kodePesananIssues.some(issue => issue.SHOP === kdtk && issue.TANGGAL === tgl);

      if (
        Math.abs(item.SEL_NET_GL) > tolerance ||
        Math.abs(item.SEL_NET_CD) > tolerance ||
        Math.abs(item.SEL_PPN_GL) > tolerance ||
        Math.abs(item.SEL_PPN_CD) > tolerance ||
        hasKodePesananIssue
      ) {
        // Additional filter: skip if closing detail is zero and GL differences are within tolerance
        if (this.shouldIncludeRecord(item, tolerance)) {
          filtered.push(item);
        }
      }
    }

    return filtered;
  }

  /**
   * Determine if record should be included
   * Skip if CD is zero and GL differences are within tolerance
   */
  shouldIncludeRecord(item, tolerance) {
    const selGLNet = item.SEL_NET_GL;
    const selGLPpn = item.SEL_PPN_GL;
    const netCD = item.NET_CLOSINGDETAIL;
    const ppnCD = item.PPN_CD;

    // Include if:
    // - GL differences exceed tolerance OR
    // - CD is not zero OR
    // - PPN CD is not zero
    return Math.abs(selGLNet) > tolerance || Math.abs(selGLPpn) > tolerance || netCD !== 0 || ppnCD !== 0;
  }

  /**
   * Extract kdtk and tanggal from combined key
   */
  extractKeys(key) {
    const parts = key.split("-");
    const kdtk = parts[0];
    const tanggal = parts.slice(1).join("-");
    return [kdtk, tanggal];
  }

  /**
   * Reset detail records RECID to '1'
   */
  async resetDetailRecords(kdtk, dates) {
    try {
      for (const date of dates) {
        const [, tgl] = this.extractKeys(date);
        await this.resetSingleDetailRecord(kdtk, tgl);
      }
    } catch (error) {
      logger.error(`[RekonCalculator] Error resetting detail records: ${error.message}`);
    }
  }

  /**
   * Reset single detail record
   */
  async resetSingleDetailRecord(kdtk, tgl) {
    try {
      const model = await DetailRekonSales.getModel();
      await model.update(
        { RECID: "1" },
        {
          where: {
            KDTK: kdtk,
            TGL: tgl,
          },
        }
      );
    } catch (error) {
      logger.error(`[RekonCalculator] Error resetting single detail: ${error.message}`);
    }
  }

  /**
   * Save kode pesanan issues to detail table
   */
  async saveKodePesananIssues(issues) {
    try {
      const detailData = issues.map(issue => ({
        RECID: "*",
        CAB: issue.CAB,
        KDTK: issue.SHOP,
        TGL: issue.TANGGAL,
        SUBKEY: issue.SUBKEY,
        VALSUBKEY: issue.SELKODE,
      }));

      await DetailRekonSales.bulkCreate(detailData, {
        updateOnDuplicate: ["VALSUBKEY", "RECID"],
      });

      logger.info(`[RekonCalculator] Saved ${detailData.length} kode pesanan issues`);
    } catch (error) {
      logger.error(`[RekonCalculator] Error saving kode pesanan issues: ${error.message}`);
    }
  }
}

export default new RekonCalculator();
