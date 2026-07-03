import logger from "../../config/logger.js";
import { apiResponse } from "../../utils/index.js";
import dthrFtpService from "./dthr_ftp.service.js";

export const dispatch = async (req, res) => {
  try {
    const { items, force = false } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return apiResponse.badRequest(res, "Body harus berisi array items dengan { kodeToko, tglTransaksi }");
    }

    for (const item of items) {
      if (!item.kodeToko || !item.tglTransaksi) {
        return apiResponse.badRequest(res, "Setiap item wajib memiliki kodeToko dan tglTransaksi");
      }
    }

    const { username, fullName } = req.user || {};
    if (!username) {
      return apiResponse.error(res, "User tidak terautentikasi", 401);
    }

    const normalized = items.map((i) => ({
      kdtk: i.kodeToko,
      tglTransaksi: i.tglTransaksi,
    }));

    logger.info(`[dthr_ftp.controller] Dispatch ${normalized.length} items by ${username}, force=${force}`);

    const result = await dthrFtpService.dispatchBatch(normalized, username, fullName, force);

    return apiResponse.success(res, { taskId: `dthrFtpTask_${username}`, ...result });
  } catch (error) {
    logger.error(`[dthr_ftp.controller] Dispatch error: ${error.message}`);
    return apiResponse.error(res, error.message);
  }
};

export const getLogs = async (req, res) => {
  try {
    const { cabang, periode, status, page = 1, limit = 20 } = req.query;

    const result = await dthrFtpService.getLogs({
      cabang,
      periode,
      status,
      page: parseInt(page, 10),
      limit: Math.min(parseInt(limit, 10), 100),
    });

    return apiResponse.success(res, result);
  } catch (error) {
    logger.error(`[dthr_ftp.controller] GetLogs error: ${error.message}`);
    return apiResponse.error(res, error.message);
  }
};

export const batchStatus = async (req, res) => {
  try {
    const { items } = req.body;
    if (!items || !Array.isArray(items)) {
      return apiResponse.badRequest(res, "Body harus berisi array items");
    }

    const result = await dthrFtpService.checkBatchStatus(items);
    return apiResponse.success(res, result);
  } catch (error) {
    logger.error(`[dthr_ftp.controller] batchStatus error: ${error.message}`);
    return apiResponse.error(res, error.message);
  }
};

export const dispatchSummary = async (req, res) => {
  try {
    const { cabang, periode } = req.query;

    if (!periode) {
      return apiResponse.badRequest(res, "Parameter periode (YYMM) wajib diisi");
    }

    const result = await dthrFtpService.getDispatchSummary({ cabang: cabang || "All", periode });
    return apiResponse.success(res, result);
  } catch (error) {
    logger.error(`[dthr_ftp.controller] dispatchSummary error: ${error.message}`);
    return apiResponse.error(res, error.message);
  }
};

export const dispatchUnsent = async (req, res) => {
  try {
    const { cabang, periode, force = false } = req.body;

    if (!cabang) {
      return apiResponse.badRequest(res, "Parameter cabang wajib diisi");
    }
    if (!periode) {
      return apiResponse.badRequest(res, "Parameter periode (YYMM) wajib diisi");
    }

    const { username, fullName } = req.user || {};
    if (!username) {
      return apiResponse.error(res, "User tidak terautentikasi", 401);
    }

    const items = await dthrFtpService.getUnsentItems({ cabang, periode, force });

    if (!items || items.length === 0) {
      return apiResponse.success(res, {
        taskId: `dthrFtpTask_${username}`,
        success: 0,
        skipped: 0,
        failed: 0,
        total: 0,
        note: "Tidak ada item yang perlu dikirim",
      });
    }

    logger.info(`[dthr_ftp.controller] dispatchUnsent ${items.length} items for cabang ${cabang}, force=${force} by ${username}`);

    const result = await dthrFtpService.dispatchBatch(items, username, fullName, force);
    return apiResponse.success(res, { taskId: `dthrFtpTask_${username}`, ...result });
  } catch (error) {
    logger.error(`[dthr_ftp.controller] dispatchUnsent error: ${error.message}`);
    return apiResponse.error(res, error.message);
  }
};
