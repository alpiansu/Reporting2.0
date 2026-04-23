import buatRmbService from "./buat_rmb.service.js";
import histBuatRmbStagingService from "./hist_buat_rmb_staging.service.js";
import apiResponse from "../../utils/apiResponse.js";
import logger from "../../config/logger.js";
import fs from "fs";

class BuatRmbController {
  async uploadCsv(req, res) {
    try {
      if (!req.file) {
        return apiResponse.badRequest(res, "No CSV file uploaded");
      }

      const username = req.user?.username || "system";
      const result = await buatRmbService.processCsvBuatRmb(req.file.buffer, username);

      return apiResponse.success(res, "Buat RMB processing completed", result);
    } catch (error) {
      logger.error(`Error in uploadCsv (BuatRmb): ${error.message}`);
      return apiResponse.serverError(res, error.message || "Failed to process Buat RMB CSV");
    }
  }

  async getHistory(req, res) {
    try {
      const filters = {
        dateFrom: req.query.dateFrom,
        dateTo: req.query.dateTo,
        kdtk: req.query.kdtk,
        pic: req.query.pic,
        status: req.query.status,
        limit: req.query.limit ? parseInt(req.query.limit) : null,
      };

      const result = await histBuatRmbStagingService.searchHistory(filters);
      return apiResponse.success(res, "History retrieved successfully", result);
    } catch (error) {
      logger.error(`Error in getHistory: ${error.message}`);
      return apiResponse.serverError(res, "Failed to retrieve history data");
    }
  }

  async getFilters(req, res) {
    try {
      // Just a simple wrapper to pass available users for filtering
      const usersResponse = await histBuatRmbStagingService.userService?.getAllUsers() || [];
      const users = usersResponse.map(u => ({ id: u.username, name: u.fullName || u.username }));
      
      const filters = {
        pics: users 
      };
      
      return apiResponse.success(res, "Filters retrieved", filters);
    } catch (error) {
      logger.error(`Error in getFilters: ${error.message}`);
      return apiResponse.serverError(res, "Failed to retrieve filters");
    }
  }

  async exportHistory(req, res) {
    try {
      const filters = {
        dateFrom: req.query.dateFrom,
        dateTo: req.query.dateTo,
        kdtk: req.query.kdtk,
        pic: req.query.pic,
        status: req.query.status,
      };

      const result = await histBuatRmbStagingService.searchHistory(filters);
      const data = result.data || [];

      if (!data.length) {
        return apiResponse.badRequest(res, "No data to export");
      }

      // Convert to simple CSV
      const headers = ["KDTK", "TANGGAL", "PRDCD", "NOHP", "TRXID", "STATUS", "NOTE", "PIC", "WAKTU"];
      let csvContent = headers.join(",") + "\n";
      
      data.forEach(r => {
        const row = [
          r.kdtk, 
          r.tgl, 
          r.prdcd, 
          r.nohp, 
          r.trxid, 
          r.status, 
          `"${(r.note || '').replace(/"/g, '""')}"`,
          r.picFullName || r.pic,
          r.updtime
        ];
        csvContent += row.join(",") + "\n";
      });

      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename=hist_buat_rmb_${new Date().getTime()}.csv`);
      return res.status(200).send(csvContent);
    } catch (error) {
      logger.error(`Error in exportHistory: ${error.message}`);
      return apiResponse.serverError(res, "Failed to export history");
    }
  }

  async downloadTemplate(req, res) {
    try {
      const template = await buatRmbService.generateCsvTemplate();
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=template_buat_rmb.csv");
      return res.status(200).send(template);
    } catch (error) {
      logger.error(`Error in downloadTemplate: ${error.message}`);
      return apiResponse.serverError(res, "Failed to download template");
    }
  }
}

export default new BuatRmbController();
