import buatRmbService from "./buat_rmb.service.js";
import histBuatRmbStagingService from "./hist_buat_rmb_staging.service.js";
import { apiResponse } from "../../utils/index.js";
import logger from "../../config/logger.js";
import dayjs from "dayjs";

class BuatRmbController {
  async uploadCsv(req, res) {
    try {
      if (!req.file) {
        return apiResponse.badRequest(res, "No CSV file uploaded");
      }

      const username = req.user?.username || "system";
      const results = await buatRmbService.processCsvBuatRmb(req.file.buffer, username);

      if (results.failedStores && results.failedStores.length > 0) {
        return apiResponse.success(res, {
          message: "Process completed with some failures",
          data: results,
        }, 207);
      }

      return apiResponse.success(res, {
        message: "CSV processed successfully",
        data: results,
      });
    } catch (error) {
      logger.error(`Error in uploadCsv (BuatRmb): ${error.message}`);
      return apiResponse.error(res, error.message || "Failed to process Buat RMB CSV", 500);
    }
  }

  async getHistory(req, res) {
    try {
      const { kdtk, pic, status, month, limit = 100, offset = 0 } = req.query;

      let computedDateFrom;
      let computedDateTo;

      if (month) {
        const [y, m] = month.split("-");
        const year = parseInt(y);
        const monthIndex = parseInt(m) - 1;
        const start = new Date(year, monthIndex, 1, 0, 0, 0, 0);
        const end = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);
        computedDateFrom = start.toISOString();
        computedDateTo = end.toISOString();
      }

      const filters = {
        kdtk,
        pic,
        status,
        dateFrom: computedDateFrom,
        dateTo: computedDateTo,
        limit: parseInt(limit),
        offset: parseInt(offset),
      };

      const result = await histBuatRmbStagingService.searchHistory(filters);

      return apiResponse.success(res, {
        message: "History retrieved successfully",
        data: result.data,
        totalCount: result.totalCount,
        limit: parseInt(limit),
        offset: parseInt(offset),
      });
    } catch (error) {
      logger.error(`Error in getHistory: ${error.message}`);
      return apiResponse.error(res, error.message, 500);
    }
  }

  async getFilters(req, res) {
    try {
      // getAllUsers() mungkin return array langsung atau object {data: [...]}
      const usersRaw = await histBuatRmbStagingService.userService?.getAllUsers();

      // Handle berbagai bentuk response
      const usersArray = Array.isArray(usersRaw)
        ? usersRaw
        : Array.isArray(usersRaw?.data)
          ? usersRaw.data
          : [];

      const users = usersArray.map(u => ({
        id: u.username,
        name: u.fullName || u.username
      }));

      return apiResponse.success(res, {
        message: "Filters retrieved successfully",
        data: { pics: users },
      });
    } catch (error) {
      logger.error(`Error in getFilters: ${error.message}`);
      return apiResponse.error(res, "Failed to retrieve filters", 500);
    }
  }

  async exportHistory(req, res) {
    try {
      const kdtk = req.query["kdtk[]"] || req.query.kdtk;
      const { pic, status, month } = req.query;

      let computedDateFrom;
      let computedDateTo;
      if (month) {
        const [y, m] = month.split("-");
        const year = parseInt(y);
        const monthIndex = parseInt(m) - 1;
        const start = new Date(year, monthIndex, 1, 0, 0, 0, 0);
        const end = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);
        computedDateFrom = start.toISOString();
        computedDateTo = end.toISOString();
      }

      const filters = {
        kdtk,
        pic,
        status,
        dateFrom: computedDateFrom,
        dateTo: computedDateTo,
      };

      const result = await histBuatRmbStagingService.searchHistory(filters);
      const rows = result.data || [];

      if (!rows.length) {
        return apiResponse.badRequest(res, "No data to export");
      }

      const headers = ["kdtk", "tgl", "prdcd", "trxid", "note", "pic", "updtime", "status"];

      const escape = value => {
        const v = value == null ? "" : String(value);
        if (v.includes(",") || v.includes("\n") || v.includes('"')) {
          return `"${v.replace(/\"/g, '""')}"`;
        }
        return v;
      };

      const csvLines = [headers.join(",")];
      for (const r of rows) {
        const line = [
          escape(r.kdtk),
          escape(r.tgl),
          escape(r.prdcd),
          escape(r.trxid),
          escape(r.note),
          escape(r.picFullName || r.pic),
          escape(r.updtime),
          escape(r.status),
        ].join(",");
        csvLines.push(line);
      }

      const csvContent = csvLines.join("\n");
      const timestamp = dayjs().format("YYYYMMDD_HHmmss");
      const filename = `buat_rmb_history_${month || "all"}_${timestamp}.csv`;

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
      res.setHeader("Access-Control-Expose-Headers", "Content-Disposition");

      return res.send(csvContent);
    } catch (error) {
      logger.error(`Error in exportHistory: ${error.message}`);
      return apiResponse.error(res, "Failed to export history", 500);
    }
  }

  async downloadTemplate(req, res) {
    try {
      const template = await buatRmbService.generateCsvTemplate();
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", 'attachment; filename="template_buat_rmb.csv"');
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
      res.setHeader("Access-Control-Expose-Headers", "Content-Disposition");
      return res.send(template);
    } catch (error) {
      logger.error(`Error in downloadTemplate: ${error.message}`);
      return apiResponse.error(res, "Failed to download template", 500);
    }
  }
}

export default new BuatRmbController();
