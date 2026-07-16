import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import logger from "../../config/logger.js";
import { apiResponse } from "../../utils/index.js";
import cetakNrbService from "./cetak_nrb.service.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const processCetakNrb = async (req, res) => {
  try {
    const { cabang, store, bukti_no, source, tanggal } = req.body;
    const username = req.user?.username || "system";

    if (!bukti_no) return apiResponse.badRequest(res, "Bukti No is required");
    if (!store) return apiResponse.badRequest(res, "Store selection is required");
    if (!cabang) return apiResponse.badRequest(res, "Cabang is required");
    if (!source || !["wrc", "store"].includes(source)) {
      return apiResponse.badRequest(res, "Source must be 'wrc' or 'store'");
    }
    if (source === "wrc" && !tanggal) {
      return apiResponse.badRequest(res, "Tanggal is required for WRC source");
    }

    logger.info(`[cetak_nrb] Request: bukti_no=${bukti_no}, store=${store}, source=${source}, user=${username}`);

    const result = await cetakNrbService.processCetakNrb({
      cabang,
      store,
      bukti_no,
      source,
      tanggal,
      username,
    });

    if (result.success && result.filePath) {
      return res.download(result.filePath, result.fileName, (err) => {
        if (err) {
          logger.error(`[cetak_nrb] Download error: ${err.message}`);
          if (!res.headersSent) {
            return apiResponse.error(res, "Error downloading generated file");
          }
        }
      });
    } else {
      return apiResponse.error(res, result.message || "Failed to generate NRB document");
    }
  } catch (error) {
    logger.error(`[cetak_nrb] Error: ${error.message}`);
    return apiResponse.error(res, error.message);
  }
};

export const downloadFile = async (req, res) => {
  try {
    const { fileName } = req.params;
    const filePath = path.join(__dirname, "../../output/nrb", fileName);
    if (!fs.existsSync(filePath)) {
      return apiResponse.notFound(res, "File not found");
    }
    return res.download(filePath, fileName);
  } catch (error) {
    logger.error(`[cetak_nrb] Download error: ${error.message}`);
    return apiResponse.error(res, error.message);
  }
};
