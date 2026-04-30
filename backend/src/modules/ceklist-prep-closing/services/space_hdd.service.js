/**
 * Space HDD Bulanan Service
 * CRUD for ceklist_space_hdd with computed fields calculated at read time
 */
import { Op } from "sequelize";
import logger from "../../../config/logger.js";
import { CeklistSpaceHddWrapper } from "../ceklist_prep_closing.model.js";
import storeService from "../../store/storeService.js";
import { findCaptureFile } from "../ceklist_capture.middleware.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Parse storage string like "37.1 GB", "1.81 TB", "476 GB" → float GB
 * Returns null if parsing fails
 */
export function parseGb(str) {
  if (!str || typeof str !== "string") return null;
  const match = str.trim().match(/^([\d.]+)\s*(GB|TB|MB)/i);
  if (!match) return null;
  const value = parseFloat(match[1]);
  const unit = match[2].toUpperCase();
  if (unit === "TB") return value * 1024;
  if (unit === "MB") return value / 1024;
  return value; // GB
}

/**
 * Get previous YYMM periode
 * "2410" → "2409", "2401" → "2312"
 */
export function getPreviousPeriode(yymm) {
  const yy = parseInt(yymm.substring(0, 2), 10);
  const mm = parseInt(yymm.substring(2, 4), 10);
  if (mm === 1) {
    // January → December of previous year
    const prevYY = yy === 0 ? 99 : yy - 1;
    return `${String(prevYY).padStart(2, "0")}12`;
  }
  return `${String(yy).padStart(2, "0")}${String(mm - 1).padStart(2, "0")}`;
}

/**
 * Attach computed fields (usageDiskSpace, predictedUsage) to a raw record using
 * the corresponding last-month record (if any).
 */
function attachComputedFields(record, prevRecord) {
  const raw = record.dataValues ?? record;
  const freeSpaceCurrent = parseGb(raw.FREE_SPACE);
  const freeSpaceLastMonth = prevRecord ? parseGb(prevRecord.FREE_SPACE ?? (prevRecord.dataValues?.FREE_SPACE)) : null;

  let usageDiskSpace = null;
  let predictedUsage = null;

  if (freeSpaceCurrent !== null && freeSpaceLastMonth !== null) {
    usageDiskSpace = parseFloat((freeSpaceCurrent - freeSpaceLastMonth).toFixed(2));
    predictedUsage = parseFloat((freeSpaceCurrent + usageDiskSpace).toFixed(2));
  }

  return {
    ...(raw),
    freeSpaceGb: freeSpaceCurrent,
    freeSpaceLastMonthGb: freeSpaceLastMonth,
    usageDiskSpace,   // negative = disk filling up
    predictedUsage,   // projection for next month
  };
}

// ─── Service ──────────────────────────────────────────────────────────────────

class SpaceHddService {
  /**
   * Get all records for a periode, with computed fields
   * @param {string} periode  YYMM
   * @param {string} [cabang] Filter by KDCAB; omit / 'All' for all
   */
  async getAll(periode, cabang = "All") {
    logger.info(`[space_hdd.service] getAll periode=${periode} cabang=${cabang}`);

    const where = { PERIODE: periode };
    if (cabang && cabang !== "All") where.KDCAB = cabang;

    const records = await CeklistSpaceHddWrapper.findAll({ where, order: [["KDCAB", "ASC"]] });

    // Fetch previous periode records for computed fields
    const prevPeriode = getPreviousPeriode(periode);
    const kdcabs = records.map(r => r.KDCAB);
    let prevRecordsMap = {};

    if (kdcabs.length > 0) {
      const prevRecords = await CeklistSpaceHddWrapper.findAll({
        where: { PERIODE: prevPeriode, KDCAB: { [Op.in]: kdcabs } },
      });
      prevRecords.forEach(r => { prevRecordsMap[r.KDCAB] = r; });
    }

    return records.map(r => {
      const raw = attachComputedFields(r, prevRecordsMap[r.KDCAB] || null);
      raw.CAPTURE_PATH = findCaptureFile("space-hdd", raw.KDCAB, periode);
      return raw;
    });
  }

  /**
   * Get one record with computed fields
   */
  async getOne(kdcab, periode) {
    logger.info(`[space_hdd.service] getOne kdcab=${kdcab} periode=${periode}`);
    const record = await CeklistSpaceHddWrapper.findByPk(`${kdcab}${periode}`);
    if (!record) return null;

    const prevPeriode = getPreviousPeriode(periode);
    const prevRecord = await CeklistSpaceHddWrapper.findByPk(`${kdcab}${prevPeriode}`);
    return attachComputedFields(record, prevRecord);
  }

  /**
   * Create or update a record
   */
  async upsert(data) {
    const { kdcab, ip, periode, freeSpace, tglCheck, os, fu, freeAfter } = data;

    if (!kdcab || !periode) throw new Error("kdcab dan periode wajib diisi");
    // ip is optional — allows editing init-skeleton records without forcing IP entry

    const id = `${kdcab}${periode}`;
    logger.info(`[space_hdd.service] upsert id=${id}`);

    await CeklistSpaceHddWrapper.upsert({
      ID: id,
      KDCAB: kdcab,
      IP: ip,
      PERIODE: periode,
      FREE_SPACE: freeSpace ?? null,
      TGL_CHECK: tglCheck ?? null,
      OS: os ?? null,
      FU: fu ?? null,
      FREE_AFTER: freeAfter ?? null,
    });

    return this.getOne(kdcab, periode);
  }

  /**
   * Delete a record
   */
  async delete(kdcab, periode) {
    logger.info(`[space_hdd.service] delete kdcab=${kdcab} periode=${periode}`);
    const deleted = await CeklistSpaceHddWrapper.destroy({
      where: { KDCAB: kdcab, PERIODE: periode },
    });
    return { deleted };
  }

  /**
   * Get history for a single branch across all periods
   */
  async getHistory(kdcab) {
    logger.info(`[space_hdd.service] getHistory kdcab=${kdcab}`);
    const records = await CeklistSpaceHddWrapper.findAll({
      where: { KDCAB: kdcab },
      order: [["PERIODE", "DESC"]],
    });
    return records.map(r => r.dataValues ?? r);
  }
  /**
   * Generate skeleton records for all INDUK branches missing in the given periode.
   * IP is pre-filled with placeholder so user knows to fill it.
   * @param {string} periode  YYMM
   * @returns {{ created: number, existing: number, total: number }}
   */
  async getBulkTemplate(periode) {
    logger.info(`[space_hdd.service] getBulkTemplate periode=${periode}`);

    await storeService.ensureInitialized();

    const indukStores = storeService.stores.filter(s => s.notes === "INDUK");
    const kdcabSet = new Set(indukStores.map(s => s.branch || s.storeCode?.substring(0, 4)));
    const allKdcabs = [...kdcabSet].filter(Boolean);

    if (allKdcabs.length === 0) return { created: 0, existing: 0, total: 0 };

    const existing = await CeklistSpaceHddWrapper.findAll({
      where: { PERIODE: periode, KDCAB: { [Op.in]: allKdcabs } },
      attributes: ["KDCAB"],
    });
    const existingSet = new Set(existing.map(r => r.KDCAB));

    const toCreate = allKdcabs
      .filter(k => !existingSet.has(k))
      .map(k => ({ ID: `${k}${periode}`, KDCAB: k, IP: "(isi IP)", PERIODE: periode }));

    if (toCreate.length > 0) {
      await CeklistSpaceHddWrapper.bulkCreate(toCreate, { ignoreDuplicates: true });
    }

    logger.info(`[space_hdd.service] getBulkTemplate: created=${toCreate.length} existing=${existingSet.size}`);
    return { created: toCreate.length, existing: existingSet.size, total: allKdcabs.length };
  }
}

export default new SpaceHddService();
