import fs from "fs";
import { pipeline } from "stream/promises";
import logger from "../../config/logger.js";
import { apiResponse } from "../../utils/index.js";
import LogMaintenanceService from "./log-maintenance.service.js";

const logMaintenanceService = new LogMaintenanceService();

const handleError = (res, error, context) => {
  logger.error(`[log-maintenance] ${context}: ${error.message}`);
  return apiResponse.error(res, error.message, error.statusCode || 500);
};

export const listFiles = async (req, res) => {
  try {
    const result = await logMaintenanceService.listFiles();
    return apiResponse.success(res, result);
  } catch (error) {
    return handleError(res, error, "listFiles");
  }
};

export const getFileContent = async (req, res) => {
  try {
    const result = await logMaintenanceService.getChunk(req.params.filename, {
      cursor: req.query.cursor,
      maxBytes: req.query.maxBytes,
      startOffset: req.query.startOffset,
      endOffset: req.query.endOffset,
    });

    return apiResponse.success(res, result);
  } catch (error) {
    if (error.statusCode === 415) {
      logger.warn(`[log-maintenance] Preview ditolak untuk ${req.params.filename}`);
    }
    return handleError(res, error, "getFileContent");
  }
};

export const getFileHours = async (req, res) => {
  try {
    const result = await logMaintenanceService.getHours(req.params.filename);
    return apiResponse.success(res, result);
  } catch (error) {
    return handleError(res, error, "getFileHours");
  }
};

export const searchFile = async (req, res) => {
  try {
    const result = await logMaintenanceService.search(req.params.filename, {
      q: req.query.q,
      cursor: req.query.cursor,
      limit: req.query.limit,
      maxScanBytes: req.query.maxScanBytes,
    });

    return apiResponse.success(res, result);
  } catch (error) {
    return handleError(res, error, "searchFile");
  }
};

export const createDownloadTicket = async (req, res) => {
  try {
    const result = await logMaintenanceService.createDownloadTicket(
      req.params.filename,
      req.user,
    );

    const downloadUrl = `${req.protocol}://${req.get("host")}${req.baseUrl}/download?ticket=${encodeURIComponent(result.ticket)}`;

    return apiResponse.success(res, { ...result, downloadUrl });
  } catch (error) {
    return handleError(res, error, "createDownloadTicket");
  }
};

export const downloadByTicket = async (req, res) => {
  let target;

  try {
    target = await logMaintenanceService.getDownloadTarget(req.query.ticket);
  } catch (error) {
    logger.warn(`[log-maintenance] Download ticket rejected: ${error.message}`);
    return apiResponse.error(res, error.message, error.statusCode || 401);
  }

  const contentType = target.filename.endsWith(".gz")
    ? "application/gzip"
    : "text/plain; charset=utf-8";

  res.setHeader("Content-Type", contentType);
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${target.filename}"; filename*=UTF-8''${encodeURIComponent(target.filename)}`,
  );
  res.setHeader("Content-Length", target.size);
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Content-Type-Options", "nosniff");

  if (target.size === 0) {
    return res.end();
  }

  try {
    await pipeline(
      fs.createReadStream(target.filePath, { end: target.size - 1 }),
      res,
    );
  } catch (error) {
    if (error.code === "ERR_STREAM_PREMATURE_CLOSE") {
      logger.warn(`[log-maintenance] Download ${target.filename} dibatalkan oleh client`);
      return;
    }

    logger.error(`[log-maintenance] downloadByTicket ${target.filename}: ${error.message}`);

    if (!res.headersSent) {
      return apiResponse.error(res, "Gagal mengunduh file log", 500);
    }

    res.destroy(error);
  }
};

export const deleteFile = async (req, res) => {
  try {
    const result = await logMaintenanceService.deleteFile(req.params.filename, req.user, {
      ip: req.ip,
    });
    return apiResponse.success(res, result);
  } catch (error) {
    return handleError(res, error, "deleteFile");
  }
};

export const bulkDeleteFiles = async (req, res) => {
  try {
    const result = await logMaintenanceService.bulkDelete(req.body?.filenames, req.user, {
      ip: req.ip,
    });
    return apiResponse.success(res, result);
  } catch (error) {
    return handleError(res, error, "bulkDeleteFiles");
  }
};
