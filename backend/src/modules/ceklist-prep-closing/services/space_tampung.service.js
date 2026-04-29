/**
 * Space HDD Tampung Service
 * Simple CRUD — no computed fields, full manual input
 */
import logger from "../../../config/logger.js";
import { CeklistSpaceTampungWrapper } from "../ceklist_prep_closing.model.js";

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
}

export default new SpaceTampungService();
