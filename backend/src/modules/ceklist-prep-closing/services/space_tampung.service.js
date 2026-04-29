/**
 * Space HDD Tampung Service
 * Simple CRUD — no computed fields, full manual input
 */
import { Op } from "sequelize";
import logger from "../../../config/logger.js";
import { CeklistSpaceTampungWrapper } from "../ceklist_prep_closing.model.js";
import storeService from "../../store/storeService.js";

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

    return records.map(r => r.dataValues ?? r);
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
   * Generate skeleton records for all INDUK branches missing in the given periode.
   * @param {string} periode  YYMM
   */
  async getBulkTemplate(periode) {
    logger.info(`[space_tampung.service] getBulkTemplate periode=${periode}`);

    await storeService.ensureInitialized();

    const indukStores = storeService.stores.filter(s => s.notes === "INDUK");
    const cabSet = new Set(indukStores.map(s => s.branch || s.storeCode?.substring(0, 4)));
    const allCabs = [...cabSet].filter(Boolean);

    if (allCabs.length === 0) return { created: 0, existing: 0, total: 0 };

    const existing = await CeklistSpaceTampungWrapper.findAll({
      where: { PERIODE: periode, CAB: { [Op.in]: allCabs } },
      attributes: ["CAB"],
    });
    const existingSet = new Set(existing.map(r => r.CAB));

    const toCreate = allCabs
      .filter(c => !existingSet.has(c))
      .map(c => ({ ID: `${c}${periode}`, CAB: c, PERIODE: periode }));

    if (toCreate.length > 0) {
      await CeklistSpaceTampungWrapper.bulkCreate(toCreate, { ignoreDuplicates: true });
    }

    logger.info(`[space_tampung.service] getBulkTemplate: created=${toCreate.length} existing=${existingSet.size}`);
    return { created: toCreate.length, existing: existingSet.size, total: allCabs.length };
  }
}

export default new SpaceTampungService();
