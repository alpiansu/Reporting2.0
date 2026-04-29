/**
 * Rekap Screening Service
 * READ-ONLY — queries existing screening_praclosing table from prep-closing module.
 * No CRUD, no new tables.
 */
import logger from "../../../config/logger.js";
import ScreeningPraClosingWrapper from "../../prep-closing/prep_closing.model.js";

class RekapScreeningService {
  /**
   * Get rekap screening data (stores with IS_READY = false)
   * Flattens ISSUES JSON into per-rule-key columns.
   * @param {string} periode   YYMM
   * @param {string} [cabang]  CAB filter; 'All' or omit for all
   */
  async getRekapScreening({ periode, cabang = "All" }) {
    logger.info(`[rekap_screening.service] getRekapScreening periode=${periode} cabang=${cabang}`);

    const where = {
      PRD_CLOSING: periode,
      IS_READY: false,
    };
    if (cabang && cabang !== "All") where.CAB = cabang;

    const records = await ScreeningPraClosingWrapper.findAll({
      where,
      attributes: [
        "ID", "RECID", "CAB", "KDTK", "PRD_CLOSING",
        "ISSUES", "CRITICAL_ISSUES", "FAILED_RULES",
        "TOTAL_RULES", "LAST_SCREENED",
      ],
      order: [["CAB", "ASC"], ["KDTK", "ASC"]],
    });

    // Collect all unique rule keys across records
    const allRuleKeys = new Set();
    const rawRows = records.map(r => {
      const row = r.dataValues ?? r;
      const issues = Array.isArray(row.ISSUES) ? row.ISSUES : [];
      issues.forEach(issue => {
        if (issue && issue.key) allRuleKeys.add(issue.key);
      });
      return { row, issues };
    });

    const sortedKeys = [...allRuleKeys].sort();

    // Transform: flatten ISSUES to boolean columns per rule key
    const result = rawRows.map(({ row, issues }) => {
      const issueMap = {};
      issues.forEach(issue => {
        if (issue && issue.key) {
          issueMap[issue.key] = issue.status ?? issue.value ?? true;
        }
      });

      const flat = {
        id: row.ID,
        recid: row.RECID,
        cab: row.CAB,
        kdtk: row.KDTK,
        prdClosing: row.PRD_CLOSING,
        totalRules: row.TOTAL_RULES,
        failedRules: row.FAILED_RULES,
        criticalIssues: row.CRITICAL_ISSUES,
        lastScreened: row.LAST_SCREENED,
      };

      // Add one boolean/value column per rule key
      sortedKeys.forEach(key => {
        flat[key] = issueMap[key] !== undefined ? issueMap[key] : null;
      });

      return flat;
    });

    return { data: result, ruleKeys: sortedKeys, total: result.length };
  }
}

export default new RekapScreeningService();
