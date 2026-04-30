/**
 * Controller for Ceklist Prep Closing module
 */
import logger from "../../config/logger.js";
import { apiResponse } from "../../utils/index.js";
import ceklistPrepClosingService from "./ceklist_prep_closing.service.js";

// ─── Space HDD Bulanan ────────────────────────────────────────────────────────

/**
 * GET /api/ceklist-prep-closing/space-hdd?periode=&cabang=
 */
export const getSpaceHdd = async (req, res) => {
  try {
    const { periode, cabang = "All" } = req.query;
    if (!periode) return apiResponse.badRequest(res, "periode wajib diisi");

    logger.info(`[ceklist_prep_closing.controller] getSpaceHdd periode=${periode} cabang=${cabang}`);
    const result = await ceklistPrepClosingService.getSpaceHdd({ periode, cabang });
    return apiResponse.success(res, { data: result, total: result.length });
  } catch (error) {
    logger.error(`[ceklist_prep_closing.controller] getSpaceHdd error: ${error.message}`);
    return apiResponse.error(res, error.message);
  }
};

/**
 * POST/PUT /api/ceklist-prep-closing/space-hdd
 * Body: { kdcab, ip, periode, freeSpace, tglCheck, os, fu, freeAfter }
 */
export const upsertSpaceHdd = async (req, res) => {
  try {
    const data = req.body;
    if (!data.kdcab || !data.periode) {
      return apiResponse.badRequest(res, "kdcab dan periode wajib diisi");
    }
    logger.info(`[ceklist_prep_closing.controller] upsertSpaceHdd kdcab=${data.kdcab} periode=${data.periode}`);
    const result = await ceklistPrepClosingService.upsertSpaceHdd(data);
    return apiResponse.success(res, result);
  } catch (error) {
    logger.error(`[ceklist_prep_closing.controller] upsertSpaceHdd error: ${error.message}`);
    return apiResponse.error(res, error.message);
  }
};

/**
 * DELETE /api/ceklist-prep-closing/space-hdd?kdcab=&periode=
 */
export const deleteSpaceHdd = async (req, res) => {
  try {
    const { kdcab, periode } = req.query;
    if (!kdcab || !periode) return apiResponse.badRequest(res, "kdcab dan periode wajib diisi");

    logger.info(`[ceklist_prep_closing.controller] deleteSpaceHdd kdcab=${kdcab} periode=${periode}`);
    const result = await ceklistPrepClosingService.deleteSpaceHdd(kdcab, periode);
    return apiResponse.success(res, result);
  } catch (error) {
    logger.error(`[ceklist_prep_closing.controller] deleteSpaceHdd error: ${error.message}`);
    return apiResponse.error(res, error.message);
  }
};

/**
 * POST /api/ceklist-prep-closing/space-hdd/init?periode=
 * Generate skeleton entries for all INDUK branches
 */
export const initSpaceHdd = async (req, res) => {
  try {
    const { periode } = req.query;
    if (!periode) return apiResponse.badRequest(res, "periode wajib diisi");

    logger.info(`[ceklist_prep_closing.controller] initSpaceHdd periode=${periode}`);
    const result = await ceklistPrepClosingService.initSpaceHdd(periode);
    return apiResponse.success(res, result);
  } catch (error) {
    logger.error(`[ceklist_prep_closing.controller] initSpaceHdd error: ${error.message}`);
    return apiResponse.error(res, error.message);
  }
};

/**
 * POST /api/ceklist-prep-closing/space-hdd/upload
 * Multipart form-data: kdcab, periode + file field "capture"
 */
export const uploadCaptureSpaceHdd = async (req, res) => {
  try {
    const { kdcab, periode } = req.query;
    if (!kdcab || !periode) return apiResponse.badRequest(res, "kdcab dan periode wajib diisi");
    if (!req.file) return apiResponse.badRequest(res, "File capture tidak ditemukan.");
    const captureUrl = `/uploads/ceklist-capture/space-hdd/${kdcab}/${req.file.filename}`;
    logger.info(`[ceklist_prep_closing.controller] uploadCaptureSpaceHdd kdcab=${kdcab} file=${req.file.filename}`);
    return apiResponse.success(res, { captureUrl });
  } catch (error) {
    logger.error(`[ceklist_prep_closing.controller] uploadCaptureSpaceHdd error: ${error.message}`);
    return apiResponse.error(res, error.message);
  }
};

// ─── Space HDD Tampung ────────────────────────────────────────────────────────

/**
 * GET /api/ceklist-prep-closing/space-tampung?periode=&cabang=
 */
export const getSpaceTampung = async (req, res) => {
  try {
    const { periode, cabang = "All" } = req.query;
    if (!periode) return apiResponse.badRequest(res, "periode wajib diisi");

    logger.info(`[ceklist_prep_closing.controller] getSpaceTampung periode=${periode} cabang=${cabang}`);
    const result = await ceklistPrepClosingService.getSpaceTampung({ periode, cabang });
    return apiResponse.success(res, { data: result, total: result.length });
  } catch (error) {
    logger.error(`[ceklist_prep_closing.controller] getSpaceTampung error: ${error.message}`);
    return apiResponse.error(res, error.message);
  }
};

/**
 * POST/PUT /api/ceklist-prep-closing/space-tampung
 * Body: { cab, periode, path, capacity, freeSpace, tglCheck }
 */
export const upsertSpaceTampung = async (req, res) => {
  try {
    const data = req.body;
    if (!data.cab || !data.periode) {
      return apiResponse.badRequest(res, "cab dan periode wajib diisi");
    }
    logger.info(`[ceklist_prep_closing.controller] upsertSpaceTampung cab=${data.cab} periode=${data.periode}`);
    const result = await ceklistPrepClosingService.upsertSpaceTampung(data);
    return apiResponse.success(res, result);
  } catch (error) {
    logger.error(`[ceklist_prep_closing.controller] upsertSpaceTampung error: ${error.message}`);
    return apiResponse.error(res, error.message);
  }
};

/**
 * DELETE /api/ceklist-prep-closing/space-tampung?cab=&periode=
 */
export const deleteSpaceTampung = async (req, res) => {
  try {
    const { cab, periode } = req.query;
    if (!cab || !periode) return apiResponse.badRequest(res, "cab dan periode wajib diisi");

    logger.info(`[ceklist_prep_closing.controller] deleteSpaceTampung cab=${cab} periode=${periode}`);
    const result = await ceklistPrepClosingService.deleteSpaceTampung(cab, periode);
    return apiResponse.success(res, result);
  } catch (error) {
    logger.error(`[ceklist_prep_closing.controller] deleteSpaceTampung error: ${error.message}`);
    return apiResponse.error(res, error.message);
  }
};

/**
 * POST /api/ceklist-prep-closing/space-tampung/init?periode=
 * Generate skeleton entries for all INDUK branches
 */
export const initSpaceTampung = async (req, res) => {
  try {
    const { periode } = req.query;
    if (!periode) return apiResponse.badRequest(res, "periode wajib diisi");

    logger.info(`[ceklist_prep_closing.controller] initSpaceTampung periode=${periode}`);
    const result = await ceklistPrepClosingService.initSpaceTampung(periode);
    return apiResponse.success(res, result);
  } catch (error) {
    logger.error(`[ceklist_prep_closing.controller] initSpaceTampung error: ${error.message}`);
    return apiResponse.error(res, error.message);
  }
};

/**
 * POST /api/ceklist-prep-closing/space-tampung/upload
 * Multipart form-data: kdcab, periode + file field "capture"
 */
export const uploadCaptureSpaceTampung = async (req, res) => {
  try {
    const { kdcab, periode } = req.query;
    if (!kdcab || !periode) return apiResponse.badRequest(res, "kdcab dan periode wajib diisi");
    if (!req.file) return apiResponse.badRequest(res, "File capture tidak ditemukan.");
    const captureUrl = `/uploads/ceklist-capture/space-tampung/${kdcab}/${req.file.filename}`;
    logger.info(`[ceklist_prep_closing.controller] uploadCaptureSpaceTampung kdcab=${kdcab} file=${req.file.filename}`);
    return apiResponse.success(res, { captureUrl });
  } catch (error) {
    logger.error(`[ceklist_prep_closing.controller] uploadCaptureSpaceTampung error: ${error.message}`);
    return apiResponse.error(res, error.message);
  }
};

// ─── Import IDT ───────────────────────────────────────────────────────────────

/**
 * GET /api/ceklist-prep-closing/import-idt?periode=&cabang=
 */
export const getImportIdt = async (req, res) => {
  try {
    const { periode, cabang = "All" } = req.query;
    if (!periode) return apiResponse.badRequest(res, "periode wajib diisi");

    logger.info(`[ceklist_prep_closing.controller] getImportIdt periode=${periode} cabang=${cabang}`);
    const result = await ceklistPrepClosingService.getImportIdt({ periode, cabang });
    return apiResponse.success(res, { data: result, total: result.length });
  } catch (error) {
    logger.error(`[ceklist_prep_closing.controller] getImportIdt error: ${error.message}`);
    return apiResponse.error(res, error.message);
  }
};

/**
 * POST/PUT /api/ceklist-prep-closing/import-idt
 * Body: { kdcab, periode, capture }
 */
export const upsertImportIdt = async (req, res) => {
  try {
    const data = req.body;
    if (!data.kdcab || !data.periode) {
      return apiResponse.badRequest(res, "kdcab dan periode wajib diisi");
    }
    logger.info(`[ceklist_prep_closing.controller] upsertImportIdt kdcab=${data.kdcab} periode=${data.periode}`);
    const result = await ceklistPrepClosingService.upsertImportIdt(data);
    return apiResponse.success(res, result);
  } catch (error) {
    logger.error(`[ceklist_prep_closing.controller] upsertImportIdt error: ${error.message}`);
    return apiResponse.error(res, error.message);
  }
};

/**
 * DELETE /api/ceklist-prep-closing/import-idt?kdcab=&periode=
 */
export const deleteImportIdt = async (req, res) => {
  try {
    const { kdcab, periode } = req.query;
    if (!kdcab || !periode) return apiResponse.badRequest(res, "kdcab dan periode wajib diisi");

    logger.info(`[ceklist_prep_closing.controller] deleteImportIdt kdcab=${kdcab} periode=${periode}`);
    const result = await ceklistPrepClosingService.deleteImportIdt(kdcab, periode);
    return apiResponse.success(res, result);
  } catch (error) {
    logger.error(`[ceklist_prep_closing.controller] deleteImportIdt error: ${error.message}`);
    return apiResponse.error(res, error.message);
  }
};

/**
 * POST /api/ceklist-prep-closing/import-idt/upload
 * Multipart form-data: fields kdcab, periode + file field "capture"
 * Multer middleware writes file to disk before this handler runs.
 * Stores the public URL path in DB CAPTURE field.
 */
export const uploadCaptureIdt = async (req, res) => {
  try {
    const { kdcab, periode } = req.body;
    if (!kdcab || !periode) return apiResponse.badRequest(res, "kdcab dan periode wajib diisi");
    if (!req.file) return apiResponse.badRequest(res, "File capture tidak ditemukan. Pastikan field name = 'capture'");

    // Build relative URL path  e.g. /uploads/ceklist-capture/G033/G033_2410_xxx.jpg
    const captureUrl = `/uploads/ceklist-capture/${kdcab}/${req.file.filename}`;

    logger.info(`[ceklist_prep_closing.controller] uploadCaptureIdt kdcab=${kdcab} periode=${periode} file=${req.file.filename}`);
    const result = await ceklistPrepClosingService.uploadCaptureIdt(kdcab, periode, captureUrl);
    return apiResponse.success(res, { ...result, captureUrl });
  } catch (error) {
    logger.error(`[ceklist_prep_closing.controller] uploadCaptureIdt error: ${error.message}`);
    return apiResponse.error(res, error.message);
  }
};



/**
 * POST /api/ceklist-prep-closing/import-idt/init?periode=
 * Generate skeleton entries for all INDUK branches in this periode
 */
export const initImportIdt = async (req, res) => {
  try {
    const { periode } = req.query;
    if (!periode) return apiResponse.badRequest(res, "periode wajib diisi");

    logger.info(`[ceklist_prep_closing.controller] initImportIdt periode=${periode}`);
    const result = await ceklistPrepClosingService.initImportIdt(periode);
    return apiResponse.success(res, result);
  } catch (error) {
    logger.error(`[ceklist_prep_closing.controller] initImportIdt error: ${error.message}`);
    return apiResponse.error(res, error.message);
  }
};

// ─── Rekap Screening (read-only) ──────────────────────────────────────────────

/**
 * GET /api/ceklist-prep-closing/rekap-screening?periode=&cabang=
 */
export const getRekapScreening = async (req, res) => {
  try {
    const { periode, cabang = "All" } = req.query;
    if (!periode) return apiResponse.badRequest(res, "periode wajib diisi");

    logger.info(`[ceklist_prep_closing.controller] getRekapScreening periode=${periode} cabang=${cabang}`);
    const result = await ceklistPrepClosingService.getRekapScreening({ periode, cabang });
    return apiResponse.success(res, result);
  } catch (error) {
    logger.error(`[ceklist_prep_closing.controller] getRekapScreening error: ${error.message}`);
    return apiResponse.error(res, error.message);
  }
};

// ─── Export Excel ─────────────────────────────────────────────────────────────

/**
 * GET /api/ceklist-prep-closing/export-excel?periode=&cabang=
 * Returns file download (xlsx)
 */
export const exportExcel = async (req, res) => {
  try {
    const { periode, cabang = "All" } = req.query;
    if (!periode) return apiResponse.badRequest(res, "periode wajib diisi");

    logger.info(`[ceklist_prep_closing.controller] exportExcel periode=${periode} cabang=${cabang}`);
    // exportToResponse writes directly to res; do not call apiResponse after
    await ceklistPrepClosingService.exportExcel({ periode, cabang, res });
  } catch (error) {
    logger.error(`[ceklist_prep_closing.controller] exportExcel error: ${error.message}`);
    // Only send error if headers haven't been sent yet
    if (!res.headersSent) {
      return apiResponse.error(res, error.message);
    }
  }
};

// ─── Summary ──────────────────────────────────────────────────────────────────

/**
 * GET /api/ceklist-prep-closing/summary?periode=&cabang=
 */
export const getSummary = async (req, res) => {
  try {
    const { periode, cabang = "All" } = req.query;
    if (!periode) return apiResponse.badRequest(res, "periode wajib diisi");

    logger.info(`[ceklist_prep_closing.controller] getSummary periode=${periode} cabang=${cabang}`);
    const result = await ceklistPrepClosingService.getSummary({ periode, cabang });
    return apiResponse.success(res, result);
  } catch (error) {
    logger.error(`[ceklist_prep_closing.controller] getSummary error: ${error.message}`);
    return apiResponse.error(res, error.message);
  }
};
