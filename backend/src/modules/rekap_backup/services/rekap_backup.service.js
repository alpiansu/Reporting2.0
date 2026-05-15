import ExcelJS from "exceljs";
import logger from "../../../config/logger.js";
import stagingService from "./rekap_backup_staging.service.js";
import WrcService from "../../../services/wrc.service.js";
import mysql from "mysql2/promise";
import config from "../../../config/index.js";

const { resilientDb } = config;
const wrcService = new WrcService();

class RekapBackupService {
  async getSummary() {
    try {
      return await stagingService.getSummaryData();
    } catch (error) {
      logger.error(`Error in getSummary: ${error.message}`);
      throw error;
    }
  }

  async getResumeHarian(cabang) {
    try {
      const allData = await stagingService.getAllData('harian');
      const filtered = allData.filter(r => r.cabang === cabang);
      filtered.sort((a, b) => b.periode.localeCompare(a.periode)); // DESC
      return filtered;
    } catch (error) {
      logger.error(`Error in getResumeHarian: ${error.message}`);
      throw error;
    }
  }

  async getResumeBulanan(cabang) {
    try {
      const allData = await stagingService.getAllData('bulanan');
      const filtered = allData.filter(r => r.cabang === cabang && r.jenis_file === 'IDT');
      filtered.sort((a, b) => b.periode.localeCompare(a.periode)); // DESC
      return filtered;
    } catch (error) {
      logger.error(`Error in getResumeBulanan: ${error.message}`);
      throw error;
    }
  }

  async getDetailHarian(cabang, periode, kriteria) {
    const sequelize = await resilientDb.getDatabase();
    if (!sequelize) throw new Error("Database not connected");

    const strYear = periode.substring(0, 4);
    const strTable = `db_edp.rekap_backup_harian_${strYear}`; // assuming tables exist
    
    try {
      // Need to adjust table name to match actual backup history tables if they differ
      // The old project used 'backup_harian_YYYY'
      const actualTable = `db_edp.backup_harian_${strYear}`;
      const query = `
        SELECT cabang, kdtk, tanggal as periode, stat, path, jml_isi, ip, note, updtime 
        FROM ${actualTable} 
        WHERE TANGGAL LIKE :prd AND CABANG = :cab AND stat = :krt
      `;
      const [results] = await sequelize.query(query, {
        replacements: { prd: `${periode}%`, cab: cabang, krt: kriteria }
      });
      return results;
    } catch (error) {
      logger.error(`Error in getDetailHarian: ${error.message}`);
      throw error;
    }
  }

  async getDetailBulanan(cabang, periode, kriteria) {
    const sequelize = await resilientDb.getDatabase();
    if (!sequelize) throw new Error("Database not connected");

    const strYear = periode.substring(0, 4);
    const actualTable = `db_edp.backup_bulanan_${strYear}`;
    
    try {
      const query = `
        SELECT cabang, kdtk, periode, stat, path, jml_isi, ip, note, updtime 
        FROM ${actualTable} 
        WHERE periode LIKE :prd AND CABANG = :cab AND stat = :krt
      `;
      const [results] = await sequelize.query(query, {
        replacements: { prd: `${periode}%`, cab: cabang, krt: kriteria }
      });
      return results;
    } catch (error) {
      logger.error(`Error in getDetailBulanan: ${error.message}`);
      throw error;
    }
  }

  async getYears() {
    try {
      const summaryData = await stagingService.getSummaryData();
      const years = new Set();
      
      for (const row of summaryData) {
        if (row.oldest_harian) years.add(row.oldest_harian.substring(0, 4));
        if (row.newest_harian) years.add(row.newest_harian.substring(0, 4));
        if (row.oldest_bln) years.add(row.oldest_bln.substring(0, 4));
        if (row.newest_bln) years.add(row.newest_bln.substring(0, 4));
      }
      
      const yearsArr = Array.from(years).sort();
      if (yearsArr.length === 0) return { oldest_year: null, newest_year: null };
      
      return { oldest_year: yearsArr[0], newest_year: yearsArr[yearsArr.length - 1] };
    } catch (error) {
      logger.error(`Error in getYears: ${error.message}`);
      throw error;
    }
  }

  async generateExcel(cabang, startYear, endYear) {
    try {
      const allHarian = await stagingService.getAllData('harian');
      const allBulanan = await stagingService.getAllData('bulanan');

      let harianData = allHarian;
      let bulananData = allBulanan;

      if (startYear && startYear !== 'All') {
        const end = endYear || startYear;
        harianData = harianData.filter(r => r.periode && r.periode.substring(0, 4) >= startYear && r.periode.substring(0, 4) <= end);
        bulananData = bulananData.filter(r => r.periode && r.periode.substring(0, 4) >= startYear && r.periode.substring(0, 4) <= end);
      }

      if (cabang && cabang !== 'All' && cabang !== '') {
        harianData = harianData.filter(r => r.cabang === cabang);
        bulananData = bulananData.filter(r => r.cabang === cabang);
      }

      const workbook = new ExcelJS.Workbook();
      
      // --- Sheet 1: Rekap Harian ---
      const sheetHarian = workbook.addWorksheet('Rekap Harian');
      sheetHarian.columns = [
        { header: 'NO', key: 'no', width: 5 },
        { header: 'CABANG', key: 'cabang', width: 15 },
        { header: 'PERIODE', key: 'periode', width: 15 },
        { header: 'TOKO ACTIVE', key: 'toko_aktif', width: 15 },
        // Dates 1-31
        ...Array.from({ length: 31 }, (_, i) => ({ header: `${i+1}`, key: `tg${i+1}`, width: 5 })),
        { header: 'TOTAL HARI', key: 'total_hari', width: 12 },
        { header: 'TOTAL FILES', key: 'total_files', width: 12 },
        { header: 'LOKASI PENYIMPANAN', key: 'path', width: 55 }
      ];

      // Format Header Rows
      const headerRow = sheetHarian.getRow(1);
      headerRow.font = { bold: true };
      headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

      harianData.forEach((row, idx) => {
        let totalHari = 0;
        const rowData = {
          no: idx + 1,
          cabang: row.cabang,
          periode: row.periode,
          toko_aktif: row.jml_toko_aktif,
          total_files: row.jml_cek, // Actually the old project mapped jml_cek to jml_files? Let's use what we have.
          path: row.path
        };
        for(let i=1; i<=31; i++) {
          const val = row[`tg${i}`];
          rowData[`tg${i}`] = val;
          if (val) totalHari++;
        }
        rowData.total_hari = totalHari;
        sheetHarian.addRow(rowData);
      });

      // --- Sheet 2: Rekap Bulanan ---
      const sheetBulanan = workbook.addWorksheet('Rekap Bulanan');
      sheetBulanan.columns = [
        { header: 'NO', key: 'no', width: 5 },
        { header: 'CABANG', key: 'cabang', width: 15 },
        { header: 'PERIODE', key: 'periode', width: 15 },
        { header: 'TOKO ACTIVE', key: 'toko_aktif', width: 15 },
        { header: 'FILE G', key: 'file_g', width: 10 },
        { header: 'IDT', key: 'file_idt', width: 10 },
        { header: 'TGAB', key: 'file_tgab', width: 10 },
        { header: 'TFRC', key: 'file_tfrc', width: 10 },
        { header: 'TREG', key: 'file_treg', width: 10 },
        { header: 'FILE T', key: 'file_t', width: 10 },
        { header: 'FILE IT', key: 'file_it', width: 10 },
        { header: 'LOKASI PENYIMPANAN', key: 'path', width: 55 }
      ];

      const headerRowBln = sheetBulanan.getRow(1);
      headerRowBln.font = { bold: true };
      headerRowBln.alignment = { vertical: 'middle', horizontal: 'center' };

      // We need to merge path_bulanan with rekap_backup_bulanan for export, but in JSON staging we might just use what's available
      bulananData.forEach((row, idx) => {
        // old code checked if file_g = '1' -> 'X'
        const boolToX = (val) => String(val) === '1' ? 'X' : '';
        sheetBulanan.addRow({
          no: idx + 1,
          cabang: row.cabang,
          periode: row.periode,
          toko_aktif: row.jml_toko_aktif,
          file_g: boolToX(row.file_g),
          file_idt: row.jenis_file === 'IDT' ? row.jml_cek : 0, // This is an approximation of old right join
          file_tgab: boolToX(row.file_tgab),
          file_tfrc: boolToX(row.file_tfrc),
          file_treg: boolToX(row.file_treg),
          file_t: boolToX(row.file_t),
          file_it: boolToX(row.file_it),
          path: row.path
        });
      });

      return await workbook.xlsx.writeBuffer();
    } catch (error) {
      logger.error(`Error in generateExcel: ${error.message}`);
      throw error;
    }
  }

  async syncTokoAktifWrc(cabang, periode) {
    if (!cabang || !periode) throw new Error("Cabang and Periode are required");
    
    logger.info(`Starting syncTokoAktifWrc for ${cabang} - ${periode}`);
    try {
      const wrcConfig = await wrcService.getConnWRC(cabang);
      const pool = mysql.createPool({
        host: wrcConfig.host,
        user: wrcConfig.user,
        password: wrcConfig.password,
        database: wrcConfig.database,
      });

      // Format date for WRC query. If periode is "202401", format to "2024-01-01"
      let formattedPeriode = periode;
      if (periode.length === 6) {
        formattedPeriode = `${periode.substring(0,4)}-${periode.substring(4,6)}-01`;
      }

      const strCountStore = `
        SELECT count(*) as stores FROM poscabang.mstr_toko_all 
        WHERE (tok_tgl_tutup = '0000-00-00' OR (MONTH(tok_tgl_tutup) >= MONTH(date('${formattedPeriode}')) AND YEAR(tok_tgl_tutup) >= YEAR(date('${formattedPeriode}')))) 
        AND DATE(tgl_buka) <= LAST_DAY(date('${formattedPeriode}'))
      `;

      const [rows] = await pool.query(strCountStore);
      const countStores = rows[0]?.stores || 0;
      await pool.end();

      // Update local db
      const sequelize = await resilientDb.getDatabase();
      if (!sequelize) throw new Error("Database not connected");

      await sequelize.query(`UPDATE rekap_backup_harian SET jml_toko_aktif = :count WHERE cabang = :cab AND periode = :prd`, {
        replacements: { count: countStores, cab: cabang, prd: periode }
      });
      await sequelize.query(`UPDATE rekap_backup_bulanan SET jml_toko_aktif = :count WHERE cabang = :cab AND periode = :prd`, {
        replacements: { count: countStores, cab: cabang, prd: periode }
      });

      // trigger json sync
      await stagingService.syncToJson('harian', periode);
      await stagingService.syncToJson('bulanan', periode);

      return { success: true, count: countStores };
    } catch (error) {
      logger.error(`Error syncing Toko Aktif WRC: ${error.message}`);
      throw error;
    }
  }
}

export default new RekapBackupService();
