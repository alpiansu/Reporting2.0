/**
 * Import IDT Service
 * Simple CRUD + bulk skeleton generation for a new periode
 */
import { Op } from "sequelize";
import logger from "../../../config/logger.js";
import { CeklistImportIdtWrapper } from "../ceklist_prep_closing.model.js";
import storeService from "../../store/storeService.js";

class ImportIdtService {
  /**
   * Get all records for a periode
   * @param {string} periode  YYMM
   * @param {string} [cabang] Filter by KDCAB; omit / 'All' for all
   */
  async getAll(periode, cabang = "All") {
    logger.info(`[import_idt.service] getAll periode=${periode} cabang=${cabang}`);

    const where = { PERIODE: periode };
    if (cabang && cabang !== "All") where.KDCAB = cabang;

    const records = await CeklistImportIdtWrapper.findAll({
      where,
      order: [["KDCAB", "ASC"]],
    });

    return records.map(r => r.dataValues ?? r);
  }

  /**
   * Get one record
   */
  async getOne(kdcab, periode) {
    logger.info(`[import_idt.service] getOne kdcab=${kdcab} periode=${periode}`);
    const record = await CeklistImportIdtWrapper.findByPk(`${kdcab}${periode}`);
    return record ? (record.dataValues ?? record) : null;
  }

  /**
   * Create or update a record
   */
  async upsert(data) {
    const { kdcab, periode, capture } = data;

    if (!kdcab || !periode) throw new Error("kdcab dan periode wajib diisi");

    const id = `${kdcab}${periode}`;
    logger.info(`[import_idt.service] upsert id=${id}`);

    await CeklistImportIdtWrapper.upsert({
      ID: id,
      KDCAB: kdcab,
      PERIODE: periode,
      CAPTURE: capture ?? null,
    });

    return this.getOne(kdcab, periode);
  }

  /**
   * Delete a record
   */
  async delete(kdcab, periode) {
    logger.info(`[import_idt.service] delete kdcab=${kdcab} periode=${periode}`);
    const deleted = await CeklistImportIdtWrapper.destroy({
      where: { KDCAB: kdcab, PERIODE: periode },
    });
    return { deleted };
  }

  /**
   * Generate skeleton records for all INDUK branches that don't yet have a
   * record in the given periode. Useful for initialising a new periode.
   * @param {string} periode  YYMM
   * @returns {Object} { created, existing, total }
   */
  async getBulkTemplate(periode) {
    logger.info(`[import_idt.service] getBulkTemplate periode=${periode}`);

    await storeService.ensureInitialized();

    // Get unique branch codes from INDUK stores
    const indukStores = storeService.stores.filter(s => s.notes === "INDUK");
    const kdcabSet = new Set(indukStores.map(s => s.branch || s.storeCode?.substring(0, 4)));
    const allKdcabs = [...kdcabSet].filter(Boolean);

    if (allKdcabs.length === 0) {
      return { created: 0, existing: 0, total: 0 };
    }

    // Find which ones already exist
    const existing = await CeklistImportIdtWrapper.findAll({
      where: { PERIODE: periode, KDCAB: { [Op.in]: allKdcabs } },
      attributes: ["KDCAB"],
    });
    const existingKdcabs = new Set(existing.map(r => r.KDCAB));

    const toCreate = allKdcabs
      .filter(k => !existingKdcabs.has(k))
      .map(k => ({ ID: `${k}${periode}`, KDCAB: k, PERIODE: periode, CAPTURE: null }));

    if (toCreate.length > 0) {
      await CeklistImportIdtWrapper.bulkCreate(toCreate, { ignoreDuplicates: true });
    }

    logger.info(`[import_idt.service] getBulkTemplate: created=${toCreate.length} existing=${existingKdcabs.size}`);
    return {
      created: toCreate.length,
      existing: existingKdcabs.size,
      total: allKdcabs.length,
    };
  }
  /**
   * Save uploaded capture image filename to DB.
   * Called after multer has written the file to disk.
   * @param {string} kdcab
   * @param {string} periode
   * @param {string} captureUrl  Public URL path, e.g. /uploads/ceklist-capture/G033/G033_2410_xxx.jpg
   * @returns {Object} updated record
   */
  async uploadCapture(kdcab, periode, captureUrl) {
    if (!kdcab || !periode) throw new Error("kdcab dan periode wajib diisi");
    if (!captureUrl) throw new Error("captureUrl tidak boleh kosong");

    logger.info(`[import_idt.service] uploadCapture kdcab=${kdcab} periode=${periode} url=${captureUrl}`);

    const id = `${kdcab}${periode}`;
    await CeklistImportIdtWrapper.upsert({
      ID: id,
      KDCAB: kdcab,
      PERIODE: periode,
      CAPTURE: captureUrl,
    });

    return this.getOne(kdcab, periode);
  }
}

export default new ImportIdtService();

