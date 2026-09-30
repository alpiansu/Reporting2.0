/**
 * Space HDD Tampung Service
 * Simple CRUD — no computed fields, full manual input
 */
import { Op } from "sequelize";
import logger from "../../../config/logger.js";
import { CeklistSpaceTampungWrapper } from "../ceklist_prep_closing.model.js";
import ceklistPanduanService from "../../ceklist_panduan/ceklist_panduan.service.js";
import { findCaptureFile } from "../ceklist_capture.middleware.js";
import { getIndukKdcabs } from "../ceklist_kdcabs.helper.js";

class SpaceTampungService {
  /**
   * Get all records for a periode
   * @param {string} periode  YYMM
   * @param {string} [cabang] Filter by CAB; omit / 'All' for all
   */
  async getAll(periode, cabang = "All") {
    logger.info(`[space_tampung.service] getAll periode=${periode} cabang=${cabang}`);

    const where = { PERIODE: periode };
    if (cabang && cabang !== "All") where.CAB = cabang;

    const records = await CeklistSpaceTampungWrapper.findAll({
      where,
      order: [["CAB", "ASC"]],
    });

    return records.map(r => {
      const raw = r.dataValues ?? r;
      raw.CAPTURE_PATH = findCaptureFile("space-tampung", raw.CAB, periode);
      return raw;
    });
  }

  /**
   * Get one record
   */
  async getOne(cab, periode) {
    logger.info(`[space_tampung.service] getOne cab=${cab} periode=${periode}`);
    const record = await CeklistSpaceTampungWrapper.findByPk(`${cab}${periode}`);
    return record ? (record.dataValues ?? record) : null;
  }

  /**
   * Create or update a record
   */
  async upsert(data) {
    const { cab, periode, path, capacity, freeSpace, tglCheck } = data;

    if (!cab || !periode) throw new Error("cab dan periode wajib diisi");

    const id = `${cab}${periode}`;
    logger.info(`[space_tampung.service] upsert id=${id}`);

    await CeklistSpaceTampungWrapper.upsert({
      ID: id,
      CAB: cab,
      PERIODE: periode,
      PATH: path ?? null,
      CAPACITY: capacity ?? null,
      FREE_SPACE: freeSpace ?? null,
      TGL_CHECK: tglCheck ?? null,
    });

    return this.getOne(cab, periode);
  }

  /**
   * Delete a record
   */
  async delete(cab, periode) {
    logger.info(`[space_tampung.service] delete cab=${cab} periode=${periode}`);
    const deleted = await CeklistSpaceTampungWrapper.destroy({
      where: { CAB: cab, PERIODE: periode },
    });
    return { deleted };
  }
  /**
   * Generate + backfill skeleton records untuk semua INDUK branches.
   * PATH otomatis diisi dari panduan saat cabang belum punya PATH.
   * @param {string} periode  YYMM
   */
  async getBulkTemplate(periode) {
    logger.info(`[space_tampung.service] getBulkTemplate periode=${periode}`);

    const allCabs = await getIndukKdcabs();
    if (allCabs.length === 0) return { created: 0, existing: 0, total: 0 };

    const panduanMap = await ceklistPanduanService.getPanduanMap();

    const existing = await CeklistSpaceTampungWrapper.findAll({
      where: { PERIODE: periode, CAB: { [Op.in]: allCabs } },
    });
    const existingSet = new Set(existing.map(r => r.CAB));

    let backfilled = 0;
    for (const rec of existing) {
      const raw = rec.dataValues ?? rec;
      const p = panduanMap[raw.CAB] || null;
      if (!p || !p.PATH_TAMPUNG) continue;
      if (!raw.PATH) {
        await CeklistSpaceTampungWrapper.update({ PATH: p.PATH_TAMPUNG }, { where: { ID: raw.ID } });
        backfilled += 1;
      }
    }

    const toCreate = allCabs
      .filter(c => !existingSet.has(c))
      .map(c => ({
        ID: `${c}${periode}`,
        CAB: c,
        PERIODE: periode,
        PATH: panduanMap[c]?.PATH_TAMPUNG || null,
      }));

    if (toCreate.length > 0) {
      await CeklistSpaceTampungWrapper.bulkCreate(toCreate, { ignoreDuplicates: true });
    }

    logger.info(`[space_tampung.service] getBulkTemplate: created=${toCreate.length} existing=${existingSet.size} backfilled=${backfilled}`);
    return { created: toCreate.length, existing: existingSet.size, total: allCabs.length };
  }
}

export default new SpaceTampungService();
