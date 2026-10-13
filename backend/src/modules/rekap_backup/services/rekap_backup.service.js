import ExcelJS from "exceljs";
import fs from "fs/promises";
import path from "path";
import dayjs from "dayjs";
import mysql from "mysql2/promise";
import logger from "../../../config/logger.js";
import stagingService from "./rekap_backup_staging.service.js";
import config from "../../../config/index.js";
import WrcService from "../../../services/wrc.service.js";

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
      return await stagingService.getData('harian', cabang);
    } catch (error) {
      logger.error(`Error in getResumeHarian: ${error.message}`);
      throw error;
    }
  }

  async getResumeBulanan(cabang) {
    try {
      const data = await stagingService.getData('bulanan', cabang);
      // Filter jenis_file === 'IDT' as before if needed, 
      // although the query might return others depending on implementation.
      // The old code did: filtered = allData.filter(r => r.cabang === cabang && r.jenis_file === 'IDT');
      return data.filter(r => r.jenis_file === 'IDT');
    } catch (error) {
      logger.error(`Error in getResumeBulanan: ${error.message}`);
      throw error;
    }
  }

  async getDetailHarian(cabang, periode, page = 1, limit = 25, search = '', sortField = '', sortOrder = 1) {
    let sequelize = await resilientDb.getDatabase();
    if(!sequelize){
      sequelize = await resilientDb.forceReconnect();
    }

    if (!sequelize) throw new Error("Database not connected");

    const strYear = periode.substring(0, 4);
    const actualTable = `db_edp.backup_harian_${strYear}`;
    const offset = (page - 1) * limit;

    try {
      let whereClause = `WHERE TANGGAL LIKE :prd AND CABANG = :cab`;
      const replacements = { prd: `${periode}%`, cab: cabang };

      if (search) {
        whereClause += ` AND (kdtk LIKE :search OR ip LIKE :search OR path LIKE :search OR note LIKE :search OR stat LIKE :search)`;
        replacements.search = `%${search}%`;
      }

      // Validasi sort field untuk mencegah SQL injection
      const allowedSortFields = ['kdtk', 'tanggal', 'periode', 'stat', 'jml_isi', 'ip', 'path', 'updtime', 'note'];
      let orderClause = `ORDER BY tanggal ASC, kdtk ASC`;
      if (sortField && allowedSortFields.includes(sortField.toLowerCase())) {
        const order = Number(sortOrder) === -1 ? 'DESC' : 'ASC';
        let dbSortField = sortField;
        if (sortField === 'periode') dbSortField = 'tanggal';
        orderClause = `ORDER BY ${dbSortField} ${order}, kdtk ASC`;
      }

      // Total count
      const [[countRow]] = await sequelize.query(
        `SELECT COUNT(*) AS total FROM ${actualTable} ${whereClause}`,
        { replacements }
      );
      const total = Number(countRow.total) || 0;

      // Paginated data
      const [results] = await sequelize.query(
        `SELECT cabang, kdtk, tanggal AS periode, stat, path, jml_isi, ip, note, updtime
         FROM ${actualTable}
         ${whereClause}
         ${orderClause}
         LIMIT :limit OFFSET :offset`,
        { replacements: { ...replacements, limit, offset } }
      );

      return {
        data:       results,
        total,
        page:       Number(page),
        limit:      Number(limit),
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      logger.error(`Error in getDetailHarian: ${error.message}`);
      throw error;
    }
  }

  async getDetailBulanan(cabang, periode, page = 1, limit = 25, search = '', sortField = '', sortOrder = 1) {
    let sequelize = await resilientDb.getDatabase();
    if(!sequelize){
      sequelize = await resilientDb.forceReconnect();
    }
    
    if (!sequelize) throw new Error("Database not connected");

    const strYear = periode.substring(0, 4);
    const actualTable = `db_edp.backup_bulanan_${strYear}`;
    const offset = (page - 1) * limit;

    try {
      let whereClause = `WHERE periode LIKE :prd AND CABANG = :cab`;
      const replacements = { prd: `${periode}%`, cab: cabang };

      if (search) {
        whereClause += ` AND (kdtk LIKE :search OR ip LIKE :search OR path LIKE :search OR note LIKE :search OR stat LIKE :search)`;
        replacements.search = `%${search}%`;
      }

      // Validasi sort field untuk mencegah SQL injection
      const allowedSortFields = ['kdtk', 'periode', 'stat', 'jml_isi', 'ip', 'path', 'updtime', 'note'];
      let orderClause = `ORDER BY periode ASC, kdtk ASC`;
      if (sortField && allowedSortFields.includes(sortField.toLowerCase())) {
        const order = Number(sortOrder) === -1 ? 'DESC' : 'ASC';
        orderClause = `ORDER BY ${sortField} ${order}, kdtk ASC`;
      }

      // Total count
      const [[countRow]] = await sequelize.query(
        `SELECT COUNT(*) AS total FROM ${actualTable} ${whereClause}`,
        { replacements }
      );
      const total = Number(countRow.total) || 0;

      // Paginated data
      const [results] = await sequelize.query(
        `SELECT cabang, kdtk, periode, stat, path, jml_isi, ip, note, updtime
         FROM ${actualTable}
         ${whereClause}
         ${orderClause}
         LIMIT :limit OFFSET :offset`,
        { replacements: { ...replacements, limit, offset } }
      );

      return {
        data:       results,
        total,
        page:       Number(page),
        limit:      Number(limit),
        totalPages: Math.ceil(total / limit),
      };
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
      let harianData;
      let bulananData;

      if (cabang && cabang !== 'All' && cabang !== '') {
        harianData = await stagingService.getData('harian', cabang);
        bulananData = await stagingService.getData('bulanan', cabang);
      } else {
        harianData = await stagingService.getAllData('harian');
        bulananData = await stagingService.getAllData('bulanan');
      }

      if (startYear && startYear !== 'All') {
        const end = endYear || startYear;
        harianData = harianData.filter(r => r.periode && r.periode.substring(0, 4) >= startYear && r.periode.substring(0, 4) <= end);
        bulananData = bulananData.filter(r => r.periode && r.periode.substring(0, 4) >= startYear && r.periode.substring(0, 4) <= end);
      }

      const workbook = new ExcelJS.Workbook();

      // --- Styling header ---
      const headerStyle = {
        font:      { bold: true },
        alignment: { vertical: 'middle', horizontal: 'center', wrapText: true },
      };
      
      // --- Sheet 1: Rekap Harian ---
      const sheetHarian = workbook.addWorksheet('Rekap Harian');

      // Set column widths (tanpa header property)
      sheetHarian.columns = [
        { key: 'no',          width: 5  },
        { key: 'cabang',      width: 15 },
        { key: 'periode',     width: 15 },
        { key: 'toko_aktif',  width: 15 },
        ...Array.from({ length: 31 }, (_, i) => ({ key: `tg${i+1}`, width: 5 })),
        { key: 'total_hari',  width: 12 },
        { key: 'total_files', width: 12 },
        { key: 'path',        width: 55 },
      ];

      // --- Row 1 ---
      const row1 = sheetHarian.getRow(1);
      row1.getCell(1).value  = 'NO';
      row1.getCell(2).value  = 'CABANG';
      row1.getCell(3).value  = 'PERIODE';
      row1.getCell(4).value  = 'TOKO ACTIVE';
      row1.getCell(5).value  = 'TANGGAL';   // header group, akan di-colspan 31
      row1.getCell(36).value = 'TOTAL HARI';
      row1.getCell(37).value = 'TOTAL FILES';
      row1.getCell(38).value = 'LOKASI PENYIMPANAN';
      row1.commit();

      // --- Row 2 (angka tanggal 1-31) ---
      const row2 = sheetHarian.getRow(2);
      for (let i = 1; i <= 31; i++) {
        row2.getCell(4 + i).value = i;  // kolom E(5) sampai AI(35)
      }
      row2.commit();

      // --- Merge Cells ---
      sheetHarian.mergeCells('A1:A2');  // NO
      sheetHarian.mergeCells('B1:B2');  // CABANG
      sheetHarian.mergeCells('C1:C2');  // PERIODE
      sheetHarian.mergeCells('D1:D2');  // TOKO ACTIVE
      sheetHarian.mergeCells('E1:AI1'); // TANGGAL (kolom 5-35 = 31 kolom)
      sheetHarian.mergeCells('AJ1:AJ2'); // TOTAL HARI
      sheetHarian.mergeCells('AK1:AK2'); // TOTAL FILES
      sheetHarian.mergeCells('AL1:AL2'); // LOKASI PENYIMPANAN

      // Apply style ke row 1 & 2
      [1, 2].forEach(rowNum => {
        const row = sheetHarian.getRow(rowNum);
        row.height = 20;
        row.eachCell({ includeEmpty: true }, cell => {
          cell.style = headerStyle;
        });
      });

      // --- Data mulai row 3 (otomatis karena row 1 & 2 sudah terisi) ---
      harianData.forEach((row, idx) => {
        let totalHari = 0;
        const rowData = {
          no:          idx + 1,
          cabang:      row.cabang,
          periode:     row.periode,
          toko_aktif:  row.jml_toko_aktif,
          total_files: row.jml_cek,
          path:        row.path,
        };
        for (let i = 1; i <= 31; i++) {
          const val = row[`tg${i}`];
          rowData[`tg${i}`] = val;
          if (val) totalHari++;
        }
        rowData.total_hari = totalHari;

        const newRow = sheetHarian.addRow(rowData);
  
        // Center semua cell di row ini
        newRow.eachCell({ includeEmpty: true }, cell => {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        });
      });

      // --- Sheet 2: Rekap Bulanan ---
      const sheetBulanan = workbook.addWorksheet('Rekap Bulanan');

      // set column width
      sheetBulanan.columns = [
        { key: 'no', width: 5 },
        { key: 'cabang', width: 15 },
        { key: 'periode', width: 15 },
        { key: 'toko_aktif', width: 15 },
        { key: 'file_g', width: 10 },
        { key: 'file_idt', width: 10 },
        { key: 'file_tgab', width: 10 },
        { key: 'file_tfrc', width: 10 },
        { key: 'file_treg', width: 10 },
        { key: 'file_t', width: 10 },
        { key: 'file_it', width: 10 },
        { key: 'path', width: 55 }
      ];
      
      // --- Row 1 ---
      const row1Bulan = sheetBulanan.getRow(1);
      row1Bulan.getCell(1).value  = 'NO';
      row1Bulan.getCell(2).value  = 'CABANG';
      row1Bulan.getCell(3).value  = 'PERIODE';
      row1Bulan.getCell(4).value  = 'TOKO ACTIVE';
      row1Bulan.getCell(5).value  = 'FILE';
      row1Bulan.getCell(12).value = 'LOKASI PENYIMPANAN';
      row1Bulan.commit();

      // --- Row 2 (angka tanggal 1-31) ---
      const row2Bulan = sheetBulanan.getRow(2);
      row2Bulan.getCell(5).value  = 'FILE G';
      row2Bulan.getCell(6).value  = 'FILE IDT';
      row2Bulan.getCell(7).value  = 'FILE TGAB';
      row2Bulan.getCell(8).value  = 'FILE TFRC';
      row2Bulan.getCell(9).value  = 'FILE TREG';
      row2Bulan.getCell(10).value = 'FILE T';
      row2Bulan.getCell(11).value = 'FILE IT';
      row2Bulan.commit();

      // --- Merge Cells ---
      sheetBulanan.mergeCells('A1:A2');  // NO
      sheetBulanan.mergeCells('B1:B2');  // CABANG
      sheetBulanan.mergeCells('C1:C2');  // PERIODE
      sheetBulanan.mergeCells('D1:D2');  // TOKO ACTIVE
      sheetBulanan.mergeCells('E1:K1'); // FILE
      sheetBulanan.mergeCells('L1:L2'); // LOKASI PENYIMPANAN

      // Apply style ke row 1 & 2
      [1, 2].forEach(rowNum => {
        const row = sheetBulanan.getRow(rowNum);
        row.height = 20;
        row.eachCell({ includeEmpty: true }, cell => {
          cell.style = headerStyle;
        });
      });

      // We need to merge path_bulanan with rekap_backup_bulanan for export, but in JSON staging we might just use what's available
      bulananData.forEach((row, idx) => {
        // old code checked if file_g = '1' -> 'X'
        const boolToX = (val) => String(val) === '1' ? 'X' : '';
        const newRowBulanan = sheetBulanan.addRow({
          no: idx + 1,
          cabang: row.cabang,
          periode: row.periode,
          toko_aktif: row.jml_toko_aktif,
          file_g: boolToX(row.file_g),
          file_idt: row.jenis_file === 'IDT' ? row.jml_cek : 0, // This is an approximation of old right join
          file_tgab: boolToX(row.file_tgab),
          file_tfrc: boolToX(row.file_tfrc),
          file_treg: boolToX(row.file_treg),
          file_t: row.jml_cek > 0 ? 'X' : '',
          file_it: boolToX(row.file_it),
          path: row.path
        });

        // Center semua cell di row ini
        newRowBulanan.eachCell({ includeEmpty: true }, cell => {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        });
      });

      // [Health fix #11] Return workbook, bukan writeBuffer() — caller
      // men-stream langsung ke response (pola sama dengan ceklist-prep-closing).
      // writeBuffer membangun salinan penuh file xlsx di memori.
      return workbook;
    } catch (error) {
      logger.error(`Error in generateExcel: ${error.message}`);
      throw error;
    }
  }

  async updateNoteHarian(cabang, kdtk, periode, note) {
    const sequelize = await resilientDb.getDatabase();
    if (!sequelize) throw new Error("Database not connected");

    const strYear = periode.substring(0, 4);
    const tableName = `db_edp.backup_harian_${strYear}`;

    const [, meta] = await sequelize.query(
      `UPDATE ${tableName} SET note = :note, updtime = NOW()
       WHERE cabang = :cab AND kdtk = :kdtk AND tanggal LIKE :prd`,
      { replacements: { note, cab: cabang, kdtk, prd: `${periode}%` } }
    );
    return meta?.affectedRows ?? 0;
  }

  async updateNoteBulanan(cabang, kdtk, periode, note) {
    const sequelize = await resilientDb.getDatabase();
    if (!sequelize) throw new Error("Database not connected");

    const strYear = periode.substring(0, 4);
    const tableName = `db_edp.backup_bulanan_${strYear}`;

    const [, meta] = await sequelize.query(
      `UPDATE ${tableName} SET note = :note, updtime = NOW()
       WHERE cabang = :cab AND kdtk = :kdtk AND periode LIKE :prd`,
      { replacements: { note, cab: cabang, kdtk, prd: `${periode}%` } }
    );
    return meta?.affectedRows ?? 0;
  }

  async updateResumeNoteHarian(cabang, periode, note) {
    let sequelize = await resilientDb.getDatabase();
    if(!sequelize){
      sequelize = await resilientDb.forceReconnect();
    }
    if (!sequelize) throw new Error("Database not connected");

    const [, meta] = await sequelize.query(
      `UPDATE db_edp.rekap_backup_harian SET note = :note 
       WHERE cabang = :cab AND periode = :prd`,
      { replacements: { note, cab: cabang, prd: periode } }
    );
    
    // Sync staging so frontend sees the update
    await stagingService.syncToJson('harian', cabang);
    
    return meta?.affectedRows ?? 0;
  }

  async updateResumeNoteBulanan(cabang, periode, note) {
    let sequelize = await resilientDb.getDatabase();
    if(!sequelize){
      sequelize = await resilientDb.forceReconnect();
    }
    if (!sequelize) throw new Error("Database not connected");

    const [, meta] = await sequelize.query(
      `UPDATE db_edp.rekap_backup_bulanan SET note = :note 
       WHERE cabang = :cab AND periode = :prd`,
      { replacements: { note, cab: cabang, prd: periode } }
    );
    
    // Sync staging so frontend sees the update
    await stagingService.syncToJson('bulanan', cabang);

    return meta?.affectedRows ?? 0;
  }

  _parsePeriode(periode) {
    let strYear = "";
    let strMonth = "";
    let yymm = "";
    let formattedPeriode = "";

    const cleaned = String(periode || "").trim().replace(/[^\d-]/g, "");
    if (cleaned.length === 4) {
      // Format YYMM e.g. '2608'
      yymm = cleaned;
      strYear = `20${cleaned.substring(0, 2)}`;
      strMonth = cleaned.substring(2, 4);
      formattedPeriode = `${strYear}-${strMonth}`;
    } else if (cleaned.length >= 6) {
      // Format YYYY-MM or YYYY-MM-DD e.g. '2026-08' or '202608'
      const digitsOnly = cleaned.replace(/-/g, "");
      strYear = digitsOnly.substring(0, 4);
      strMonth = digitsOnly.substring(4, 6);
      yymm = `${strYear.substring(2, 4)}${strMonth}`;
      formattedPeriode = `${strYear}-${strMonth}`;
    } else {
      throw new Error(`Format periode tidak valid: ${periode}`);
    }

    return { strYear, strMonth, yymm, formattedPeriode };
  }

  getAuditCachePath(cabang, yymm, type = 'harian') {
    const cacheDir = path.join(process.cwd(), "data", "rekap_backup");
    return path.join(cacheDir, `rekap_backup_audit_${type}_${cabang}_${yymm}.json`);
  }

  async getAuditCache(cabang, periode, type = 'harian') {
    try {
      const { yymm } = this._parsePeriode(periode);
      const cachePath = this.getAuditCachePath(cabang, yymm, type);
      const exists = await fs.access(cachePath).then(() => true).catch(() => false);
      if (!exists) return null;

      const content = await fs.readFile(cachePath, "utf-8");
      return JSON.parse(content);
    } catch (error) {
      logger.warn(`[getAuditCache] Gagal membaca cache audit ${type}: ${error.message}`);
      return null;
    }
  }

  async auditCompleteness({ cabang, periode, type = 'harian', forceRefresh = false }) {
    if (!cabang) throw new Error("Cabang wajib diisi");
    if (!periode) throw new Error("Periode wajib diisi");

    if (type === 'bulanan') {
      return await this._auditBulanan({ cabang, periode, forceRefresh });
    }
    return await this._auditHarian({ cabang, periode, forceRefresh });
  }

  async _auditBulanan({ cabang, periode, forceRefresh = false }) {
    const { strYear, strMonth, yymm, formattedPeriode } = this._parsePeriode(periode);
    const cachePath = this.getAuditCachePath(cabang, yymm, 'bulanan');

    // Cek cache jika forceRefresh false
    if (!forceRefresh) {
      const cached = await this.getAuditCache(cabang, periode, 'bulanan');
      if (cached && cached.summary && Array.isArray(cached.stores)) {
        logger.info(`[auditCompleteness:bulanan] Menggunakan cache audit untuk ${cabang} - ${yymm}`);
        return cached;
      }
    }

    logger.info(`[auditCompleteness:bulanan] Memulai audit bulanan vs WRC untuk ${cabang} - ${formattedPeriode} (yymm: ${yymm})...`);

    // 1. Ambil daftar toko aktif dari WRC (cukup kodetoko_{yymm} & nama toko)
    let wrcPool = null;
    let storeCodesRows = [];
    let mstrTokoRows = [];

    try {
      const wrcConfig = await wrcService.getConnWRC(cabang);
      wrcPool = mysql.createPool({
        host: wrcConfig.host,
        user: wrcConfig.user,
        password: wrcConfig.password,
        database: wrcConfig.database,
        multipleStatements: false,
        connectTimeout: 10000,
        waitForConnections: true,
        connectionLimit: 4
      });

      // Pastikan tabel kodetoko_{yymm} ada di WRC
      const [tableCheck] = await wrcPool.query(`SHOW TABLES LIKE 'kodetoko_${yymm}'`);
      if (!tableCheck || tableCheck.length === 0) {
        throw new Error(`Tabel WRC kodetoko_${yymm} tidak ditemukan di database cabang ${cabang}. Data periode tersebut kemungkinan sudah diarsipkan/tidak tersedia.`);
      }

      // Ambil daftar toko aktif dari kodetoko_{yymm}
      const pStores = wrcPool.query(
        `SELECT DISTINCT KODE_TOKO FROM kodetoko_${yymm} WHERE KODE_TOKO IS NOT NULL AND TRIM(KODE_TOKO) != ''`
      ).then(([rows]) => rows).catch(err => {
        logger.error(`[auditCompleteness:bulanan] Gagal query kodetoko_${yymm}: ${err.message}`);
        throw err;
      });

      // Ambil nama toko dari poscabang.mstr_toko_all
      const pNames = wrcPool.query(
        `SELECT kode_toko, nama_toko FROM poscabang.mstr_toko_all`
      ).then(([rows]) => rows).catch(() => []);

      [storeCodesRows, mstrTokoRows] = await Promise.all([pStores, pNames]);
    } catch (wrcErr) {
      logger.error(`[auditCompleteness:bulanan] Error koneksi/query WRC: ${wrcErr.message}`);
      throw wrcErr;
    } finally {
      if (wrcPool) {
        await wrcPool.end().catch(() => {});
      }
    }

    // 2. Ambil data backup bulanan dari Central Database (db_edp.backup_bulanan_{strYear})
    let sequelize = await resilientDb.getDatabase();
    if (!sequelize) {
      sequelize = await resilientDb.forceReconnect();
    }
    if (!sequelize) throw new Error("Database Central EDP not connected");

    const backupBulananTable = `db_edp.backup_bulanan_${strYear}`;
    let backupRows = [];
    try {
      const [rows] = await sequelize.query(
        `SELECT cabang, kdtk, periode, stat, path, jml_isi, ip, note, updtime
         FROM ${backupBulananTable}
         WHERE cabang = :cab AND (periode LIKE :prd1 OR periode LIKE :prd2)`,
        { replacements: { cab: cabang, prd1: `${formattedPeriode}%`, prd2: `${yymm}%` } }
      );
      backupRows = rows;
    } catch (dbErr) {
      logger.warn(`[auditCompleteness:bulanan] Gagal query ${backupBulananTable}: ${dbErr.message}`);
      backupRows = [];
    }

    // 3. Olah Nama Toko
    const storeNameMap = new Map();
    for (const r of mstrTokoRows) {
      if (r.kode_toko) {
        storeNameMap.set(r.kode_toko.trim(), r.nama_toko ? r.nama_toko.trim() : "");
      }
    }

    // 4. Map backup bulanan per kdtk
    const backupMap = new Map();
    for (const r of backupRows) {
      if (!r.kdtk) continue;
      const kdtk = r.kdtk.trim();
      if (!backupMap.has(kdtk)) {
        backupMap.set(kdtk, r);
      } else {
        const existing = backupMap.get(kdtk);
        const existingOk = String(existing.stat).toLowerCase() === 'true' || String(existing.stat).toUpperCase() === 'OK';
        const currentOk = String(r.stat).toLowerCase() === 'true' || String(r.stat).toUpperCase() === 'OK';
        if (!existingOk && currentOk) {
          backupMap.set(kdtk, r);
        }
      }
    }

    // 5. Pencocokan Data
    const activeStoreCodes = storeCodesRows.map(r => String(r.KODE_TOKO).trim()).filter(Boolean);
    activeStoreCodes.sort((a, b) => a.localeCompare(b));

    const storeAuditList = [];
    let lengkapCount = 0;
    let dataNokCount = 0;
    let tidakAdaCount = 0;

    for (const storeCode of activeStoreCodes) {
      const namaToko = storeNameMap.get(storeCode) || storeCode;
      const bck = backupMap.get(storeCode);

      if (!bck) {
        tidakAdaCount++;
        storeAuditList.push({
          kdtk: storeCode,
          nama_toko: namaToko,
          status: 'TIDAK_ADA',
          stat: null,
          jml_isi: 0,
          path: '',
          ip: '',
          note: '',
          updtime: null,
          keterangan: 'Tidak ada file backup IDT bulanan di database central',
        });
      } else {
        const isStatOk = String(bck.stat).toLowerCase() === 'true' || String(bck.stat).toUpperCase() === 'OK';
        const isJmlIsiOk = Number(bck.jml_isi) > 0;

        if (isStatOk && isJmlIsiOk) {
          lengkapCount++;
          storeAuditList.push({
            kdtk: storeCode,
            nama_toko: namaToko,
            status: 'LENGKAP',
            stat: bck.stat,
            jml_isi: Number(bck.jml_isi) || 0,
            path: bck.path || '',
            ip: bck.ip || '',
            note: bck.note || '',
            updtime: bck.updtime || null,
            keterangan: 'Backup IDT bulanan valid dan lengkap',
          });
        } else {
          dataNokCount++;
          storeAuditList.push({
            kdtk: storeCode,
            nama_toko: namaToko,
            status: 'DATA_NOK',
            stat: bck.stat,
            jml_isi: Number(bck.jml_isi) || 0,
            path: bck.path || '',
            ip: bck.ip || '',
            note: bck.note || '',
            updtime: bck.updtime || null,
            keterangan: !isStatOk ? `Status di database: ${bck.stat}` : `Jml isi record: ${bck.jml_isi}`,
          });
        }
      }
    }

    const payload = {
      cabang,
      periode: formattedPeriode,
      yymm,
      type: 'bulanan',
      audited_at: dayjs().format("YYYY-MM-DD HH:mm:ss"),
      summary: {
        total_toko_wrc: activeStoreCodes.length,
        lengkap: lengkapCount,
        data_nok: dataNokCount,
        tidak_ada: tidakAdaCount,
      },
      stores: storeAuditList
    };

    // Simpan snapshot ke cache JSON
    try {
      await fs.mkdir(path.dirname(cachePath), { recursive: true });
      await fs.writeFile(cachePath, JSON.stringify(payload, null, 2), "utf-8");
      logger.info(`[auditCompleteness:bulanan] Cache audit berhasil disimpan ke ${path.basename(cachePath)}`);
    } catch (saveErr) {
      logger.warn(`[auditCompleteness:bulanan] Gagal menyimpan cache audit: ${saveErr.message}`);
    }

    return payload;
  }

  async _auditHarian({ cabang, periode, forceRefresh = false }) {
    const { strYear, strMonth, yymm, formattedPeriode } = this._parsePeriode(periode);
    const cachePath = this.getAuditCachePath(cabang, yymm, 'harian');

    // Cek cache jika forceRefresh false
    if (!forceRefresh) {
      const cached = await this.getAuditCache(cabang, periode, 'harian');
      if (cached && cached.summary && Array.isArray(cached.stores)) {
        logger.info(`[auditCompleteness:harian] Menggunakan cache audit untuk ${cabang} - ${yymm}`);
        return cached;
      }
    }

    logger.info(`[auditCompleteness:harian] Memulai audit kelengkapan data vs WRC untuk ${cabang} - ${formattedPeriode} (yymm: ${yymm})...`);

    // 1. Koneksi ke WRC Cabang
    let wrcPool = null;
    let storeCodesRows = [];
    let mstrTokoRows = [];
    let lpmRows = [];
    let mstranRows = [];

    try {
      const wrcConfig = await wrcService.getConnWRC(cabang);
      wrcPool = mysql.createPool({
        host: wrcConfig.host,
        user: wrcConfig.user,
        password: wrcConfig.password,
        database: wrcConfig.database,
        multipleStatements: false,
        connectTimeout: 10000,
        waitForConnections: true,
        connectionLimit: 4
      });

      // Pastikan tabel kodetoko_{yymm} ada di WRC
      const [tableCheck] = await wrcPool.query(`SHOW TABLES LIKE 'kodetoko_${yymm}'`);
      if (!tableCheck || tableCheck.length === 0) {
        throw new Error(`Tabel WRC kodetoko_${yymm} tidak ditemukan di database cabang ${cabang}. Data periode tersebut kemungkinan sudah diarsipkan/tidak tersedia.`);
      }

      // Ambil daftar toko aktif dari kodetoko_{yymm}
      const pStores = wrcPool.query(
        `SELECT DISTINCT KODE_TOKO FROM kodetoko_${yymm} WHERE KODE_TOKO IS NOT NULL AND TRIM(KODE_TOKO) != ''`
      ).then(([rows]) => rows).catch(err => {
        logger.error(`[auditCompleteness:harian] Gagal query kodetoko_${yymm}: ${err.message}`);
        throw err;
      });

      // Ambil nama toko dari poscabang.mstr_toko_all
      const pNames = wrcPool.query(
        `SELECT kode_toko, nama_toko FROM poscabang.mstr_toko_all`
      ).then(([rows]) => rows).catch(() => []);

      // Ambil tanggal transaksi dari lpm_{yymm}
      const pLpm = wrcPool.query(
        `SELECT DISTINCT TOKO, DATE_FORMAT(WDATE, '%Y-%m-%d') as tgl FROM lpm_${yymm} WHERE TOKO IS NOT NULL`
      ).then(([rows]) => rows).catch(err => {
        logger.warn(`[auditCompleteness:harian] Gagal/tidak ada lpm_${yymm}: ${err.message}`);
        return [];
      });

      // Eksekusi paralel kodetoko, mstr_toko, dan lpm
      [storeCodesRows, mstrTokoRows, lpmRows] = await Promise.all([
        pStores, pNames, pLpm
      ]);

      // Optimasi query mstran: Cari toko yang jumlah harinya < total hari bulan ini di LPM
      const daysInMonth = dayjs(`${strYear}-${strMonth}-01`).daysInMonth();
      const lpmStoreCounts = new Map();
      for (const r of lpmRows) {
        if (!r.TOKO || !r.tgl) continue;
        const code = r.TOKO.trim();
        if (!lpmStoreCounts.has(code)) lpmStoreCounts.set(code, new Set());
        lpmStoreCounts.get(code).add(r.tgl);
      }

      // Toko yang sudah memiliki tanggal penuh di LPM (misal 31 dari 31 hari) tidak perlu scan mstran
      const activeCodes = storeCodesRows.map(r => String(r.KODE_TOKO).trim()).filter(Boolean);
      const candidateStores = activeCodes.filter(k => {
        const dates = lpmStoreCounts.get(k);
        return !dates || dates.size < daysInMonth;
      });

      // Query mstran_{yymm} secara terarah untuk kandidat toko memanfaatkan index IDX_SHOP
      if (candidateStores.length > 0) {
        logger.info(`[auditCompleteness:harian] Memeriksa mstran_${yymm} untuk ${candidateStores.length} toko kandidat (memanfaatkan index)...`);
        const chunkSize = 150;
        for (let i = 0; i < candidateStores.length; i += chunkSize) {
          const chunk = candidateStores.slice(i, i + chunkSize);
          const inList = chunk.map(s => `'${s.replace(/'/g, "\\'")}'`).join(",");
          const [mstChunk] = await wrcPool.query(
            `SELECT DISTINCT SHOP as TOKO, DATE FROM mstran_${yymm} WHERE SHOP IN (${inList})`
          ).catch(err => {
            logger.warn(`[auditCompleteness:harian] Gagal query chunk mstran_${yymm}: ${err.message}`);
            return [[]];
          });
          if (Array.isArray(mstChunk)) {
            mstranRows.push(...mstChunk);
          }
        }
      }

    } catch (wrcErr) {
      logger.error(`[auditCompleteness:harian] Error koneksi/query WRC: ${wrcErr.message}`);
      throw wrcErr;
    } finally {
      if (wrcPool) {
        await wrcPool.end().catch(() => {});
      }
    }

    // 2. Query data backup harian di Central Database (db_edp)
    let sequelize = await resilientDb.getDatabase();
    if (!sequelize) {
      sequelize = await resilientDb.forceReconnect();
    }
    if (!sequelize) throw new Error("Database Central EDP not connected");

    const backupHarianTable = `db_edp.backup_harian_${strYear}`;
    let backupRows = [];
    try {
      const [rows] = await sequelize.query(
        `SELECT kdtk, DATE_FORMAT(tanggal, '%Y-%m-%d') as tanggal, stat, jml_isi, note, path
         FROM ${backupHarianTable}
         WHERE cabang = :cab AND tanggal LIKE :prd`,
        { replacements: { cab: cabang, prd: `${formattedPeriode}%` } }
      );
      backupRows = rows;
    } catch (dbErr) {
      logger.warn(`[auditCompleteness:harian] Gagal query ${backupHarianTable}: ${dbErr.message}`);
      backupRows = [];
    }

    // 3. Olah Ground Truth WRC
    const storeNameMap = new Map();
    for (const r of mstrTokoRows) {
      if (r.kode_toko) {
        storeNameMap.set(r.kode_toko.trim(), r.nama_toko ? r.nama_toko.trim() : "");
      }
    }

    // Tanggal WRC per toko = Union(LPM, MSTRAN)
    const wrcDatesMap = new Map();

    const ensureStoreDatesSet = (storeCode) => {
      if (!wrcDatesMap.has(storeCode)) {
        wrcDatesMap.set(storeCode, new Set());
      }
      return wrcDatesMap.get(storeCode);
    };

    // Dari LPM
    for (const r of lpmRows) {
      if (r.TOKO && r.tgl) {
        const store = r.TOKO.trim();
        ensureStoreDatesSet(store).add(r.tgl);
      }
    }

    // Dari MSTRAN (format DATE: '260810' -> '2026-08-10')
    for (const r of mstranRows) {
      if (r.TOKO && r.DATE && String(r.DATE).length === 6) {
        const dStr = String(r.DATE);
        const y = `20${dStr.substring(0, 2)}`;
        const m = dStr.substring(2, 4);
        const d = dStr.substring(4, 6);
        const tglIso = `${y}-${m}-${d}`;
        const store = r.TOKO.trim();
        ensureStoreDatesSet(store).add(tglIso);
      }
    }

    // 4. Olah Data Backup Central
    const backupMap = new Map(); // kdtk -> Map(tanggal -> backupRecord)
    for (const r of backupRows) {
      if (!r.kdtk || !r.tanggal) continue;
      const kdtk = r.kdtk.trim();
      if (!backupMap.has(kdtk)) {
        backupMap.set(kdtk, new Map());
      }
      backupMap.get(kdtk).set(r.tanggal, r);
    }

    // 5. Pencocokan Data per Toko yang terdaftar di kodetoko_{yymm}
    const activeStoreCodes = storeCodesRows.map(r => String(r.KODE_TOKO).trim()).filter(Boolean);
    activeStoreCodes.sort((a, b) => a.localeCompare(b));

    const storeAuditList = [];
    let lengkapCount = 0;
    let kurangTanggalCount = 0;
    let tidakAdaCount = 0;

    for (const storeCode of activeStoreCodes) {
      const namaToko = storeNameMap.get(storeCode) || storeCode;
      const expectedDatesSet = wrcDatesMap.get(storeCode) || new Set();
      const expectedDates = Array.from(expectedDatesSet).sort();
      const storeBackups = backupMap.get(storeCode) || new Map();

      const missingDates = [];
      const incompleteDates = [];
      const validDates = [];

      // Skenario 1: Toko tidak ada sama sekali di tabel backup
      if (storeBackups.size === 0) {
        tidakAdaCount++;
        storeAuditList.push({
          kdtk: storeCode,
          nama_toko: namaToko,
          status: 'TIDAK_ADA',
          total_hari_wrc: expectedDates.length,
          total_hari_backup: 0,
          selisih_hari: expectedDates.length,
          missing_dates: expectedDates.map(tgl => ({ tanggal: tgl, reason: 'Tidak ada record backup' })),
          incomplete_dates: [],
          valid_dates: [],
        });
        continue;
      }

      // Skenario 2 & 3: Toko ada di backup, periksa kelengkapan per tanggal WRC
      for (const expDate of expectedDates) {
        const bck = storeBackups.get(expDate);
        if (!bck) {
          missingDates.push({ tanggal: expDate, reason: 'Tanggal bolong (tidak ada file backup)' });
        } else {
          const isStatOk = String(bck.stat).toLowerCase() === 'true' || String(bck.stat).toUpperCase() === 'OK';
          const isJmlIsiOk = Number(bck.jml_isi) > 0;
          if (!isStatOk || !isJmlIsiOk) {
            incompleteDates.push({
              tanggal: expDate,
              stat: bck.stat,
              jml_isi: bck.jml_isi,
              note: bck.note || 'File korup atau ukuran 0',
              path: bck.path || ''
            });
          } else {
            validDates.push(expDate);
          }
        }
      }

      const totalDefects = missingDates.length + incompleteDates.length;
      if (totalDefects === 0 && expectedDates.length > 0) {
        lengkapCount++;
        storeAuditList.push({
          kdtk: storeCode,
          nama_toko: namaToko,
          status: 'LENGKAP',
          total_hari_wrc: expectedDates.length,
          total_hari_backup: validDates.length,
          selisih_hari: 0,
          missing_dates: [],
          incomplete_dates: [],
          valid_dates: validDates,
        });
      } else {
        kurangTanggalCount++;
        storeAuditList.push({
          kdtk: storeCode,
          nama_toko: namaToko,
          status: 'KURANG_TANGGAL',
          total_hari_wrc: expectedDates.length,
          total_hari_backup: validDates.length,
          selisih_hari: totalDefects,
          missing_dates: missingDates,
          incomplete_dates: incompleteDates,
          valid_dates: validDates,
        });
      }
    }

    const payload = {
      cabang,
      periode: formattedPeriode,
      yymm,
      type: 'harian',
      audited_at: dayjs().format("YYYY-MM-DD HH:mm:ss"),
      summary: {
        total_toko_wrc: activeStoreCodes.length,
        lengkap: lengkapCount,
        kurang_tanggal: kurangTanggalCount,
        tidak_ada: tidakAdaCount,
      },
      stores: storeAuditList
    };

    // Simpan snapshot ke cache JSON
    try {
      await fs.mkdir(path.dirname(cachePath), { recursive: true });
      await fs.writeFile(cachePath, JSON.stringify(payload, null, 2), "utf-8");
      logger.info(`[auditCompleteness:harian] Cache audit berhasil disimpan ke ${path.basename(cachePath)}`);
    } catch (saveErr) {
      logger.warn(`[auditCompleteness:harian] Gagal menyimpan cache audit: ${saveErr.message}`);
    }

    return payload;
  }

  async generateAuditExcel({ cabang, periode, type = 'harian' }) {
    const auditData = await this.auditCompleteness({ cabang, periode, type, forceRefresh: false });
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Reporting 2.0";
    workbook.created = new Date();

    if (type === 'bulanan') {
      const sheet = workbook.addWorksheet("Audit Backup Bulanan");
      sheet.columns = [
        { header: "No", key: "no", width: 6 },
        { header: "Kode Toko", key: "kdtk", width: 12 },
        { header: "Nama Toko", key: "nama_toko", width: 34 },
        { header: "Status", key: "status", width: 18 },
        { header: "Stat di DB", key: "stat", width: 14 },
        { header: "Jml Isi", key: "jml_isi", width: 14 },
        { header: "Path Backup", key: "path", width: 36 },
        { header: "Catatan (Note)", key: "note", width: 30 },
        { header: "Keterangan", key: "keterangan", width: 40 }
      ];

      sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
      sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A8A" } };
      sheet.getRow(1).alignment = { vertical: "middle", horizontal: "center" };

      auditData.stores.forEach((s, idx) => {
        const row = sheet.addRow({
          no: idx + 1,
          kdtk: s.kdtk,
          nama_toko: s.nama_toko,
          status: s.status === 'LENGKAP' ? 'LENGKAP' : (s.status === 'DATA_NOK' ? 'DATA NOK' : 'TIDAK TERDATA'),
          stat: s.stat || '-',
          jml_isi: s.jml_isi || 0,
          path: s.path || '-',
          note: s.note || '-',
          keterangan: s.keterangan || '-'
        });

        row.getCell("no").alignment = { horizontal: "center" };
        row.getCell("kdtk").alignment = { horizontal: "center" };
        row.getCell("status").alignment = { horizontal: "center" };
        row.getCell("stat").alignment = { horizontal: "center" };
        row.getCell("jml_isi").alignment = { horizontal: "right" };

        if (s.status === 'DATA_NOK') {
          row.getCell("status").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEF08A" } }; // Kuning
        } else if (s.status === 'TIDAK_ADA') {
          row.getCell("status").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFECACA" } }; // Merah muda
        } else {
          row.getCell("status").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFBBF7D0" } }; // Hijau muda
        }
      });

      return workbook;
    }

    // ── SHEET 1: RESUME AUDIT TOKO (HARIAN) ──
    const sheet1 = workbook.addWorksheet("Resume Toko");
    sheet1.columns = [
      { header: "No", key: "no", width: 6 },
      { header: "Kode Toko", key: "kdtk", width: 12 },
      { header: "Nama Toko", key: "nama_toko", width: 34 },
      { header: "Status", key: "status", width: 18 },
      { header: "Hari di WRC", key: "hari_wrc", width: 14 },
      { header: "Hari Backup", key: "hari_bck", width: 14 },
      { header: "Selisih Hari", key: "selisih", width: 14 },
      { header: "Keterangan", key: "keterangan", width: 35 }
    ];

    sheet1.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet1.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A8A" } };
    sheet1.getRow(1).alignment = { vertical: "middle", horizontal: "center" };

    auditData.stores.forEach((s, idx) => {
      const row = sheet1.addRow({
        no: idx + 1,
        kdtk: s.kdtk,
        nama_toko: s.nama_toko,
        status: s.status === 'LENGKAP' ? 'LENGKAP' : (s.status === 'KURANG_TANGGAL' ? 'KURANG TANGGAL' : 'TIDAK TERDATA'),
        hari_wrc: s.total_hari_wrc,
        hari_bck: s.total_hari_backup,
        selisih: s.selisih_hari,
        keterangan: s.status === 'LENGKAP'
          ? 'Data 100% lengkap'
          : (s.status === 'KURANG_TANGGAL'
              ? `${s.missing_dates?.length || 0} tgl bolong, ${s.incomplete_dates?.length || 0} tgl korup`
              : 'Tidak ada backup sama sekali')
      });

      row.getCell("no").alignment = { horizontal: "center" };
      row.getCell("kdtk").alignment = { horizontal: "center" };
      row.getCell("status").alignment = { horizontal: "center" };
      row.getCell("hari_wrc").alignment = { horizontal: "right" };
      row.getCell("hari_bck").alignment = { horizontal: "right" };
      row.getCell("selisih").alignment = { horizontal: "right" };

      if (s.status === 'KURANG_TANGGAL') {
        row.getCell("status").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEF08A" } }; // Kuning
      } else if (s.status === 'TIDAK_ADA') {
        row.getCell("status").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFECACA" } }; // Merah muda
      } else {
        row.getCell("status").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFBBF7D0" } }; // Hijau muda
      }
    });

    // ── SHEET 2: DETAIL TANGGAL BOLONG ──
    const sheet2 = workbook.addWorksheet("Detail Tanggal Bolong");
    sheet2.columns = [
      { header: "No", key: "no", width: 6 },
      { header: "Kode Toko", key: "kdtk", width: 12 },
      { header: "Nama Toko", key: "nama_toko", width: 34 },
      { header: "Tanggal", key: "tanggal", width: 14 },
      { header: "Tipe Anomali", key: "tipe", width: 22 },
      { header: "Keterangan / Status Backup", key: "keterangan", width: 45 }
    ];

    sheet2.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet2.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF991B1B" } };
    sheet2.getRow(1).alignment = { vertical: "middle", horizontal: "center" };

    let detailIdx = 1;
    auditData.stores.forEach(s => {
      // Tanggal yang bolong sama sekali
      (s.missing_dates || []).forEach(m => {
        const row = sheet2.addRow({
          no: detailIdx++,
          kdtk: s.kdtk,
          nama_toko: s.nama_toko,
          tanggal: m.tanggal,
          tipe: "TIDAK ADA BACKUP",
          keterangan: m.reason || "File backup tidak ditemukan di database central"
        });
        row.getCell("no").alignment = { horizontal: "center" };
        row.getCell("kdtk").alignment = { horizontal: "center" };
        row.getCell("tanggal").alignment = { horizontal: "center" };
      });

      // Tanggal yang ada tapi gagal / korup
      (s.incomplete_dates || []).forEach(inc => {
        const row = sheet2.addRow({
          no: detailIdx++,
          kdtk: s.kdtk,
          nama_toko: s.nama_toko,
          tanggal: inc.tanggal,
          tipe: "STATUS NOK / KORUP",
          keterangan: `Stat: ${inc.stat}, Jml Isi: ${inc.jml_isi}. Note: ${inc.note || '-'}`
        });
        row.getCell("no").alignment = { horizontal: "center" };
        row.getCell("kdtk").alignment = { horizontal: "center" };
        row.getCell("tanggal").alignment = { horizontal: "center" };
      });
    });

    return workbook;
  }
}

export default new RekapBackupService();
