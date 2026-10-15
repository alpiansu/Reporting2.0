/**
 * Rekap Screening Service
 * READ-ONLY — queries existing screening_praclosing table from prep-closing module.
 * No CRUD, no new tables.
 */
import logger from "../../../config/logger.js";
import ScreeningPraClosingWrapper from "../../prep-closing/prep_closing.model.js";

class RekapScreeningService {
  /**
   * Fast count for summary chips without loading heavy JSON blobs
   * @param {string} periode   YYMM
   * @param {string} [cabang]  CAB filter; 'All' or omit for all
   */
  async getRekapSummary({ periode, cabang = "All" }) {
    logger.info(`[rekap_screening.service] getRekapSummary periode=${periode} cabang=${cabang}`);
    const where = {
      PRD_CLOSING: periode,
      IS_READY: false,
    };
    if (cabang && cabang !== "All") where.CAB = cabang;

    const total = await ScreeningPraClosingWrapper.count({ where });
    return { total, ruleKeys: [] };
  }

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
      raw: true,
    });

    // Collect all unique rule keys across records
    const allRuleKeys = new Set();
    const rawRows = records.map(row => {
      const r = row?.dataValues ?? row;
      let issues = r?.ISSUES;
      if (typeof issues === "string") {
        try {
          issues = JSON.parse(issues);
        } catch {
          issues = [];
        }
      }
      if (!Array.isArray(issues)) issues = [];

      issues.forEach(issue => {
        if (issue && issue.key) allRuleKeys.add(issue.key);
      });
      return { r, issues };
    });

    const sortedKeys = [...allRuleKeys].sort();

    // Transform: flatten ISSUES to boolean columns per rule key
    const result = rawRows.map(({ r, issues }) => {
      const issueMap = {};
      issues.forEach(issue => {
        if (issue && issue.key) {
          issueMap[issue.key] = issue.status ?? issue.value ?? true;
        }
      });

      const flat = {
        id: r.ID,
        recid: r.RECID,
        cab: r.CAB,
        kdtk: r.KDTK,
        prdClosing: r.PRD_CLOSING,
        totalRules: r.TOTAL_RULES,
        failedRules: r.FAILED_RULES,
        criticalIssues: r.CRITICAL_ISSUES,
        lastScreened: r.LAST_SCREENED,
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
