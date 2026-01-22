/**
 * Controller for Cetak BPB module
 */
import logger from "../../config/logger.js";
import { apiResponse } from "../../utils/index.js";
import cetakBpbService from "./cetak_bpb.service.js";

/**
 * Process BPB printing
 * POST /api/cetak-bpb/process
 */
export const processCetakBpb = async (req, res) => {
  try {
    const { cabang, stores, bukti_no } = req.body;
    const username = req.user?.username || "system";

    if (!bukti_no) {
      return apiResponse.badRequest(res, "Bukti No is required");
    }

    if (!cabang && (!stores || stores.length === 0)) {
        return apiResponse.badRequest(res, "Either cabang or stores selection is required");
    }

    logger.info(`Starting BPB print process: bukti_no=${bukti_no}, cabang=${cabang || "Custom Selection"}, user=${username}`);

    // Call service (asynchronous, progress tracked via floating widget)
    const result = await cetakBpbService.processCetakBpb({ 
      cabang, 
      stores, 
      bukti_no, 
      username 
    });

    return apiResponse.success(res, result);
  } catch (error) {
    logger.error(`Error in processCetakBpb: ${error.message}`);
    return apiResponse.error(res, error.message);
  }
};
