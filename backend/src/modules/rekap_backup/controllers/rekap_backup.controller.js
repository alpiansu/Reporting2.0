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
      res.status(500).json({ success: false, message: "Terjadi kesalahan server" });
    }
  }

  async getResumeHarian(req, res) {
    try {
      const { cabang } = req.params;
      const data = await rekapBackupService.getResumeHarian(cabang);
      res.status(200).json(data);
    } catch (error) {
      logger.error(`Error getResumeHarian: ${error.message}`);
      res.status(500).json({ success: false, message: "Terjadi kesalahan server" });
    }
  }

  async getResumeBulanan(req, res) {
    try {
      const { cabang } = req.params;
      const data = await rekapBackupService.getResumeBulanan(cabang);
      res.status(200).json(data);
    } catch (error) {
      logger.error(`Error getResumeBulanan: ${error.message}`);
      res.status(500).json({ success: false, message: "Terjadi kesalahan server" });
    }
  }

  async getDetailHarian(req, res) {
    try {
      const { cabang, periode, kriteria } = req.params;
      const data = await rekapBackupService.getDetailHarian(cabang, periode, kriteria);
      res.status(200).json(data);
    } catch (error) {
      logger.error(`Error getDetailHarian: ${error.message}`);
      res.status(500).json({ success: false, message: "Terjadi kesalahan server" });
    }
  }

  async getDetailBulanan(req, res) {
    try {
      const { cabang, periode, kriteria } = req.params;
      const data = await rekapBackupService.getDetailBulanan(cabang, periode, kriteria);
      res.status(200).json(data);
    } catch (error) {
      logger.error(`Error getDetailBulanan: ${error.message}`);
      res.status(500).json({ success: false, message: "Terjadi kesalahan server" });
    }
  }

  async getYears(req, res) {
    try {
      const data = await rekapBackupService.getYears();
      res.status(200).json([data]); // Maintain compatibility with old frontend expected format [ { oldest_year, newest_year } ]
    } catch (error) {
      logger.error(`Error getYears: ${error.message}`);
      res.status(500).json({ success: false, message: "Terjadi kesalahan server" });
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
      res.send(buffer);
    } catch (error) {
      logger.error(`Error exportExcel: ${error.message}`);
      res.status(500).json({ success: false, message: "Terjadi kesalahan server" });
    }
  }

  async syncWrc(req, res) {
    try {
      const { cabang, periode } = req.body;
      const result = await rekapBackupService.syncTokoAktifWrc(cabang, periode);
      res.status(200).json(result);
    } catch (error) {
      logger.error(`Error syncWrc: ${error.message}`);
      res.status(500).json({ success: false, message: "Gagal sinkronisasi WRC" });
    }
  }

  // Admin endpoint to trigger json staging manually
  async triggerStagingSync(req, res) {
    try {
      const result = await stagingService.syncAllFromDatabase();
      res.status(200).json(result);
    } catch (error) {
      logger.error(`Error triggerStagingSync: ${error.message}`);
      res.status(500).json({ success: false, message: "Gagal memproses JSON Staging" });
    }
  }
}

export default new RekapBackupController();
