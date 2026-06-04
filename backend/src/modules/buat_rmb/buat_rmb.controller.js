import buatRmbService from "./buat_rmb.service.js";
import histBuatRmbStagingService from "./hist_buat_rmb_staging.service.js";
import config from "./buat_rmb.config.js";
import { apiResponse } from "../../utils/index.js";
import logger from "../../config/logger.js";
import dayjs from "dayjs";
import storeService from "../store/storeService.js";
import dbStore from "../../config/db_store.js";
import { checkStoreConnection } from "../../utils/storeConnection.utils.js";

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

  /**
   * Cek koneksi ke database toko.
   * Menerima kdtk, resolve ke dbHost, lalu panggil utility checkStoreConnection.
   * Error asli (code + message) dikembalikan ke frontend untuk transparansi.
   */
  async checkConnection(req, res) {
    try {
      const { kdtk } = req.query;
      if (!kdtk) return apiResponse.badRequest(res, "kdtk wajib diisi");

      const storeInfo = await storeService.getStoreIPHost(kdtk);
      if (!storeInfo) {
        return apiResponse.error(res, `Toko dengan kode ${kdtk} tidak ditemukan`, 404);
      }

      const result = await checkStoreConnection(storeInfo.dbHost);

      return apiResponse.success(res, {
        message: result.connected ? "Koneksi berhasil" : "Koneksi gagal",
        data: {
          connected: result.connected,
          storeName: storeInfo.storeName,
          host: storeInfo.dbHost,
          // Sertakan error asli agar FE bisa tampilkan pesan teknis yang informatif
          error: result.error || null,
          errorCode: result.errorCode || null,
        },
      });
    } catch (error) {
      logger.error(`Error in checkConnection: ${error.message}`);
      return apiResponse.error(res, error.message, 500);
    }
  }

  /**
   * Autocomplete produk dari prodmast toko.
   * Aktif setelah minimal 3 karakter diketik. Prefix search: LIKE 'q%'.
   * Response include field `merk` agar FE bisa tentukan apakah NOHP perlu ditampilkan.
   */
  async searchStoreProducts(req, res) {
    try {
      const { kdtk, q } = req.query;
      if (!kdtk) return apiResponse.badRequest(res, "kdtk wajib diisi");
      if (!q || String(q).trim().length < 3) {
        return apiResponse.badRequest(res, "Query pencarian minimal 3 karakter");
      }

      const storeInfo = await storeService.getStoreIPHost(kdtk);
      if (!storeInfo) {
        return apiResponse.error(res, `Toko dengan kode ${kdtk} tidak ditemukan`, 404);
      }

      let pool;
      try {
        pool = await dbStore.createDbStore(storeInfo.dbHost, 1);
      } catch (connError) {
        return apiResponse.error(res, `Gagal koneksi ke toko: ${connError.message}`, 503);
      }

      const catCodes = config.rmbEligibleCatCodes;
      const searchPattern = `${String(q).trim()}%`;

      const [products] = await pool.query(
        config.productSearchQuery,
        [catCodes, searchPattern]
      );

      await pool.end().catch(() => {});

      return apiResponse.success(res, {
        message: `Ditemukan ${products.length} produk`,
        data: products,
      });
    } catch (error) {
      logger.error(`Error in searchStoreProducts: ${error.message}`);
      return apiResponse.error(res, error.message, 500);
    }
  }

  /**
   * Insert RMB manual dari form dialog.
   * Menerima body JSON, transform ke format records (QTY = 1), lalu proses.
   */
  async insertManual(req, res) {
    try {
      const { kdtk, tanggal, items } = req.body;
      const username = req.user?.username || "system";

      if (!kdtk || !tanggal || !Array.isArray(items) || items.length === 0) {
        return apiResponse.badRequest(res, "kdtk, tanggal, dan minimal 1 item wajib diisi");
      }

      // Transform ke format yang dipakai processStoreWithHistory, QTY = 1
      const records = items.map(item => ({
        KDTK: String(kdtk).trim().toUpperCase(),
        TANGGAL: String(tanggal).trim(),
        PRDCD: String(item.prdcd).trim(),
        NOHP: item.nohp ? String(item.nohp).trim() : "",
        TRXID: item.trxid ? String(item.trxid).trim() : "",
        QTY: "1",
      }));

      const results = await buatRmbService.processManualBuatRmb(records, username);

      if (results.failedStores && results.failedStores.length > 0) {
        return apiResponse.success(res, {
          message: "Process selesai dengan beberapa kegagalan",
          data: results,
        }, 207);
      }

      return apiResponse.success(res, {
        message: "Manual RMB berhasil diproses",
        data: results,
      });
    } catch (error) {
      logger.error(`Error in insertManual (BuatRmb): ${error.message}`);
      return apiResponse.error(res, error.message || "Gagal memproses RMB manual", 500);
    }
  }
}

export default new BuatRmbController();
