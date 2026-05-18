import rekapBackupService from "../services/rekap_backup.service.js";
import stagingService from "../services/rekap_backup_staging.service.js";
import logger from "../../../config/logger.js";

class RekapBackupController {
  async getSummary(req, res) {
    try {
      const data = await rekapBackupService.getSummary();
      res.status(200).json(data);
    } catch (error) {
      logger.error(`Error getSummary: ${error.message}`);
      res.status(500).json({ success: false, message: "Terjadi kesalahan server : " + error.message });
    }
  }

  async getResumeHarian(req, res) {
    try {
      const { cabang } = req.params;
      const data = await rekapBackupService.getResumeHarian(cabang);
      res.status(200).json(data);
    } catch (error) {
      logger.error(`Error getResumeHarian: ${error.message}`);
      res.status(500).json({ success: false, message: "Terjadi kesalahan server : " + error.message });
    }
  }

  async getResumeBulanan(req, res) {
    try {
      const { cabang } = req.params;
      const data = await rekapBackupService.getResumeBulanan(cabang);
      res.status(200).json(data);
    } catch (error) {
      logger.error(`Error getResumeBulanan: ${error.message}`);
      res.status(500).json({ success: false, message: "Terjadi kesalahan server : " + error.message });
    }
  }

  async getDetailHarian(req, res) {
    try {
      const { cabang, periode } = req.params;
      const page      = parseInt(req.query.page  ?? 1,  10);
      const limit     = parseInt(req.query.limit ?? 25, 10);
      const search    = req.query.search || '';
      const sortField = req.query.sortField || '';
      const sortOrder = parseInt(req.query.sortOrder ?? 1, 10);
      
      const data = await rekapBackupService.getDetailHarian(cabang, periode, page, limit, search, sortField, sortOrder);
      res.status(200).json(data);
    } catch (error) {
      logger.error(`Error getDetailHarian: ${error.message}`);
      res.status(500).json({ success: false, message: "Terjadi kesalahan server : " + error.message });
    }
  }

  async getDetailBulanan(req, res) {
    try {
      const { cabang, periode } = req.params;
      const page      = parseInt(req.query.page  ?? 1,  10);
      const limit     = parseInt(req.query.limit ?? 25, 10);
      const search    = req.query.search || '';
      const sortField = req.query.sortField || '';
      const sortOrder = parseInt(req.query.sortOrder ?? 1, 10);
      
      const data = await rekapBackupService.getDetailBulanan(cabang, periode, page, limit, search, sortField, sortOrder);
      res.status(200).json(data);
    } catch (error) {
      logger.error(`Error getDetailBulanan: ${error.message}`);
      res.status(500).json({ success: false, message: "Terjadi kesalahan server : " + error.message });
    }
  }

  async getYears(req, res) {
    try {
      const data = await rekapBackupService.getYears();
      res.status(200).json([data]); // Maintain compatibility with old frontend expected format [ { oldest_year, newest_year } ]
    } catch (error) {
      logger.error(`Error getYears: ${error.message}`);
      res.status(500).json({ success: false, message: "Terjadi kesalahan server : " + error.message });
    }
  }

  async exportExcel(req, res) {
    try {
      const { cabang, startYear, endYear } = req.query;
      const buffer = await rekapBackupService.generateExcel(cabang, startYear, endYear);

      let filename = "FORMAT DATA BULANAN & HARIAN";
      if (startYear && startYear !== 'All') {
        if (endYear && endYear !== startYear) {
          filename += ` ( ${startYear} s.d ${endYear} )`;
        } else {
          filename += ` ( ${startYear} )`;
        }
      }
      if (cabang && cabang !== 'All') {
        filename += ` ${cabang}`;
      }
      filename += ".xlsx";

      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.setHeader("Access-Control-Expose-Headers", "Content-Disposition");
      res.send(buffer);
    } catch (error) {
      logger.error(`Error exportExcel: ${error.message}`);
      res.status(500).json({ success: false, message: "Terjadi kesalahan server : " + error.message });
    }
  }

  // Admin endpoint to trigger json staging manually
  async triggerStagingSync(req, res) {
    try {
      const result = await stagingService.syncAllFromDatabase();
      res.status(200).json(result);
    } catch (error) {
      logger.error(`Error triggerStagingSync: ${error.message}`);
      res.status(500).json({ success: false, message: "Gagal memproses JSON Staging : " + error.message });
    }
  }

  async updateNoteHarian(req, res) {
    try {
      const { cabang, kdtk, periode, note } = req.body;
      if (!cabang || !kdtk || !periode) {
        return res.status(400).json({ success: false, message: "cabang, kdtk, dan periode wajib diisi" });
      }
      const result = await rekapBackupService.updateNoteHarian(cabang, kdtk, periode, note ?? '');
      res.status(200).json({ success: true, updated: result, message: "Note berhasil diperbarui" });
    } catch (error) {
      logger.error(`Error updateNoteHarian: ${error.message}`);
      res.status(500).json({ success: false, message: "Gagal memperbarui note : " + error.message });
    }
  }

  async updateNoteBulanan(req, res) {
    try {
      const { cabang, kdtk, periode, note } = req.body;
      if (!cabang || !kdtk || !periode) {
        return res.status(400).json({ success: false, message: "cabang, kdtk, dan periode wajib diisi" });
      }
      const result = await rekapBackupService.updateNoteBulanan(cabang, kdtk, periode, note ?? '');
      res.status(200).json({ success: true, updated: result, message: "Note berhasil diperbarui" });
    } catch (error) {
      logger.error(`Error updateNoteBulanan: ${error.message}`);
      res.status(500).json({ success: false, message: "Gagal memperbarui note : " + error.message });
    }
  }

  async updateResumeNoteHarian(req, res) {
    try {
      const { cabang, periode, note } = req.body;
      if (!cabang || !periode) {
        return res.status(400).json({ success: false, message: "cabang dan periode wajib diisi" });
      }
      const result = await rekapBackupService.updateResumeNoteHarian(cabang, periode, note ?? '');
      res.status(200).json({ success: true, updated: result, message: "Note resume berhasil diperbarui" });
    } catch (error) {
      logger.error(`Error updateResumeNoteHarian: ${error.message}`);
      res.status(500).json({ success: false, message: "Gagal memperbarui note resume : " + error.message });
    }
  }

  async updateResumeNoteBulanan(req, res) {
    try {
      const { cabang, periode, note } = req.body;
      if (!cabang || !periode) {
        return res.status(400).json({ success: false, message: "cabang dan periode wajib diisi" });
      }
      const result = await rekapBackupService.updateResumeNoteBulanan(cabang, periode, note ?? '');
      res.status(200).json({ success: true, updated: result, message: "Note resume berhasil diperbarui" });
    } catch (error) {
      logger.error(`Error updateResumeNoteBulanan: ${error.message}`);
      res.status(500).json({ success: false, message: "Gagal memperbarui note resume : " + error.message });
    }
  }
}

export default new RekapBackupController();
