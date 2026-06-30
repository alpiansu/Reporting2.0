import logger from "../../config/logger.js";
import { apiResponse } from "../../utils/index.js";
import NtbVsGlslpService from "./ntb_vs_glslp.service.js";

const service = new NtbVsGlslpService();

export const getRecords = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      cabang = "All",
      periode,
      recidFilter = "1",
      searchQuery,
      sortColumn = "TGL_TRANSAKSI",
      sortOrder = "DESC",
    } = req.query;

    if (!periode) return apiResponse.badRequest(res, "Periode wajib diisi");

    const result = await service.getRecords({
      page: parseInt(page),
      limit: Math.min(parseInt(limit), 100),
      cabang,
      periode,
      recidFilter,
      searchQuery,
      sortColumn,
      sortOrder,
    });

    return apiResponse.success(res, result);
  } catch (error) {
    logger.error(`[ntb_vs_glslp.controller] Error getRecords: ${error.message}`);
    return apiResponse.error(res, error.message);
  }
};

export const getAllRecords = async (req, res) => {
  try {
    const { cabang = "All", periode, recidFilter = "1", searchQuery } = req.query;

    if (!periode) return apiResponse.badRequest(res, "Periode wajib diisi");

    const data = await service.getAllRecords({ cabang, periode, recidFilter, searchQuery });
    return apiResponse.success(res, data);
  } catch (error) {
    logger.error(`[ntb_vs_glslp.controller] Error getAllRecords: ${error.message}`);
    return apiResponse.error(res, error.message);
  }
};

export const getSummary = async (req, res) => {
  try {
    const { cabang = "All", periode, recidFilter = "1" } = req.query;

    if (!periode) return apiResponse.badRequest(res, "Periode wajib diisi");

    const result = await service.getSummary({ cabang, periode, recidFilter });
    return apiResponse.success(res, result);
  } catch (error) {
    logger.error(`[ntb_vs_glslp.controller] Error getSummary: ${error.message}`);
    return apiResponse.error(res, error.message);
  }
};

export const getBranches = async (req, res) => {
  try {
    const { periode } = req.query;
    if (!periode) return apiResponse.badRequest(res, "Periode wajib diisi");

    const branches = await service.getBranches(periode);
    return apiResponse.success(res, branches);
  } catch (error) {
    logger.error(`[ntb_vs_glslp.controller] Error getBranches: ${error.message}`);
    return apiResponse.error(res, error.message);
  }
};

export const updateRecord = async (req, res) => {
  try {
    const { kodePromo, kodeToko, kodeGudang, tglTransaksi, hasilCek, periode } = req.body;

    if (!kodePromo || !kodeToko || !kodeGudang || !tglTransaksi || !periode) {
      return apiResponse.badRequest(res, "Field PK (kodePromo, kodeToko, kodeGudang, tglTransaksi, periode) wajib diisi");
    }

    const result = await service.updateRecord({
      kodePromo, kodeToko, kodeGudang, tglTransaksi, hasilCek, periode, ipCek: req.ip,
    });

    if (!result) return apiResponse.notFound(res, "Record tidak ditemukan");
    return apiResponse.success(res, { message: "Record berhasil diupdate" });
  } catch (error) {
    logger.error(`[ntb_vs_glslp.controller] Error updateRecord: ${error.message}`);
    return apiResponse.error(res, error.message);
  }
};
