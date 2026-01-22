/**
 * Controller for Cetak BPB module
 */
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import logger from "../../config/logger.js";
import { apiResponse } from "../../utils/index.js";
import cetakBpbService from "./cetak_bpb.service.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Process BPB printing and return file download
 * POST /api/cetak-bpb/process
 */
export const processCetakBpb = async (req, res) => {
  try {
    const { store, bukti_no } = req.body;
    const username = req.user?.username || "system";

    if (!bukti_no) {
      return apiResponse.badRequest(res, "Bukti No is required");
    }

    if (!store) {
        return apiResponse.badRequest(res, "Store selection is required");
    }

    logger.info(`Starting BPB print process: bukti_no=${bukti_no}, store=${store}, user=${username}`);

    // Call service and wait for completion to send file directly
    const result = await cetakBpbService.processCetakBpb({ 
      store, 
      bukti_no, 
      username 
    });

    if (result.success && result.filePath) {
        // Send file for download
        return res.download(result.filePath, result.fileName, (err) => {
            if (err) {
                logger.error(`Error downloading file ${result.fileName}: ${err.message}`);
                // Only send error if headers haven't been sent
                if (!res.headersSent) {
                    return apiResponse.error(res, "Error downloading generated file");
                }
            }
            // Optional: delete file after download to keep server clean
            // fs.unlinkSync(result.filePath); 
        });
    } else {
        return apiResponse.error(res, result.message || "No BPB documents found for the given criteria");
    }
  } catch (error) {
    logger.error(`Error in processCetakBpb: ${error.message}`);
    return apiResponse.error(res, error.message);
  }
};

/**
 * Download a previously generated file by name
 * GET /api/cetak-bpb/download/:fileName
 */
export const downloadFile = async (req, res) => {
    try {
        const { fileName } = req.params;
        const filePath = path.join(__dirname, "../../output/bpb", fileName);

        if (!fs.existsSync(filePath)) {
            return apiResponse.notFound(res, "File not found");
        }

        return res.download(filePath, fileName);
    } catch (error) {
        logger.error(`Error in downloadFile: ${error.message}`);
        return apiResponse.error(res, error.message);
    }
};
