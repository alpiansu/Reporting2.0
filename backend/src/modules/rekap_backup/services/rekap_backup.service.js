import ExcelJS from "exceljs";
import logger from "../../../config/logger.js";
import stagingService from "./rekap_backup_staging.service.js";
import config from "../../../config/index.js";

const { resilientDb } = config;

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
          file_t: boolToX(row.file_t),
          file_it: boolToX(row.file_it),
          path: row.path
        });

        // Center semua cell di row ini
        newRowBulanan.eachCell({ includeEmpty: true }, cell => {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        });
      });

      return await workbook.xlsx.writeBuffer();
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
}

export default new RekapBackupService();
