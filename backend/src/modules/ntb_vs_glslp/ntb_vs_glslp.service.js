import resilientDb from "../../config/resilient-database.js";
import logger from "../../config/logger.js";
import { CONFIG } from "./ntb_vs_glslp.config.js";

const ALLOWED_SORT_COLUMNS = new Set([
  "KODE_PROMO",
  "KODE_GUDANG",
  "JENIS_TOKO",
  "KODE_TOKO",
  "TGL_TRANSAKSI",
  "RP_NTB_LHDR",
  "RP_GLSLP_LHDR",
  "SELISIH_RP_LHDR",
  "RP_NTB_EDP",
  "RP_GLSLP_EDP",
  "SELISIH_RP_EDP",
  "HASIL_CEK",
  "RECID",
  "TGL_CEK",
  "IP_CEK",
]);

class NtbVsGlslpService {
  getTableName(periode) {
    return `db_edp.rekon_glslp_vs_ntb_${periode}`;
  }

  klasifikasiCase() {
    return `
      CASE
        WHEN SELISIH_RP_EDP = 0 THEN 'SESUAI'
        WHEN ABS(SELISIH_RP_EDP) <= ${CONFIG.TOLERANCE} THEN 'TOLERANSI'
        ELSE 'SELISIH'
      END AS KLASIFIKASI
    `;
  }

  async getDb() {
    const sequelize = await resilientDb.getDatabase();
    if (!sequelize) throw new Error("Database tidak tersedia");
    return sequelize;
  }

  buildWhereClause({ cabang, periode, recidFilter, searchQuery }) {
    const table = this.getTableName(periode);
    const conditions = [];
    const replacements = {};

    if (cabang && cabang !== "All") {
      conditions.push(`${table}.KODE_GUDANG = :cabang`);
      replacements.cabang = cabang;
    }

    // recidFilter: '1' = hanya masalah (RECID != '1'), '0' = semua
    if (recidFilter === "1") {
      conditions.push(`${table}.RECID != '1'`);
    }

    if (searchQuery) {
      const q = `%${searchQuery}%`;
      conditions.push(
        `(${table}.KODE_PROMO LIKE :search OR ${table}.KODE_TOKO LIKE :search OR ${table}.JENIS_TOKO LIKE :search OR ${table}.NAMA_FILE LIKE :search OR ${table}.HASIL_CEK LIKE :search)`,
      );
      replacements.search = q;
    }

    return { conditions, replacements };
  }

  async getRecords({ page, limit, cabang, periode, recidFilter, searchQuery, sortColumn, sortOrder }) {
    const sequelize = await this.getDb();
    const table = this.getTableName(periode);

    const { conditions, replacements } = this.buildWhereClause({ cabang, periode, recidFilter, searchQuery });
    const whereSQL = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const safeSort = ALLOWED_SORT_COLUMNS.has(sortColumn) ? sortColumn : "TGL_TRANSAKSI";
    const safeOrder = sortOrder === "ASC" ? "ASC" : "DESC";

    const offset = (page - 1) * limit;

    const countSQL = `SELECT COUNT(*) AS total FROM ${table} ${whereSQL}`;
    const [countResult] = await sequelize.query(countSQL, { replacements });
    const total = countResult[0]?.total || 0;

    const dataSQL = `
      SELECT ${table}.*, ${this.klasifikasiCase()}
      FROM ${table}
      ${whereSQL}
      ORDER BY ${safeSort} ${safeOrder}
      LIMIT :limit OFFSET :offset
    `;

    const [rows] = await sequelize.query(dataSQL, {
      replacements: { ...replacements, limit, offset },
    });

    return {
      data: rows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getAllRecords({ cabang, periode, recidFilter, searchQuery }) {
    const sequelize = await this.getDb();
    const table = this.getTableName(periode);

    const { conditions, replacements } = this.buildWhereClause({ cabang, periode, recidFilter, searchQuery });
    const whereSQL = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const sql = `
      SELECT ${table}.*, ${this.klasifikasiCase()}
      FROM ${table}
      ${whereSQL}
      ORDER BY TGL_TRANSAKSI DESC, KODE_PROMO ASC
    `;

    const [rows] = await sequelize.query(sql, { replacements });
    return rows;
  }

  async getSummary({ cabang, periode, recidFilter }) {
    const sequelize = await this.getDb();
    const table = this.getTableName(periode);

    const { conditions, replacements } = this.buildWhereClause({ cabang, periode, recidFilter });
    const whereSQL = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const sql = `
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN SELISIH_RP_EDP = 0 THEN 1 ELSE 0 END) AS sesui,
        SUM(CASE WHEN ABS(SELISIH_RP_EDP) > 0 AND ABS(SELISIH_RP_EDP) <= ${CONFIG.TOLERANCE} THEN 1 ELSE 0 END) AS toleransi,
        SUM(CASE WHEN ABS(SELISIH_RP_EDP) > ${CONFIG.TOLERANCE} THEN 1 ELSE 0 END) AS selisih,
        COALESCE(SUM(ABS(SELISIH_RP_EDP)), 0) AS total_abs_selisih
      FROM ${table}
      ${whereSQL}
    `;

    const [rows] = await sequelize.query(sql, { replacements });
    return rows[0] || { total: 0, sesui: 0, toleransi: 0, selisih: 0, total_abs_selisih: 0 };
  }

  async getBranches(periode) {
    const sequelize = await this.getDb();
    const table = this.getTableName(periode);

    const sql = `SELECT DISTINCT KODE_GUDANG FROM ${table} ORDER BY KODE_GUDANG`;
    const [rows] = await sequelize.query(sql);
    return rows.map(r => r.KODE_GUDANG);
  }

  async getCabangChart({ periode, cabang }) {
    const sequelize = await this.getDb();
    const table = this.getTableName(periode);

    const conditions = [];
    const replacements = {};

    if (cabang && cabang !== "All") {
      conditions.push(`${table}.KODE_GUDANG = :cabang`);
      replacements.cabang = cabang;
    }

    const whereSQL = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const sql = `
      SELECT
        KODE_GUDANG,
        COUNT(*) AS total,
        SUM(CASE WHEN HASIL_CEK LIKE '%File HR Tidak ada%' THEN 1 ELSE 0 END) AS file_hr_tidak_ada,
        SUM(CASE WHEN (HASIL_CEK NOT LIKE '%File HR Tidak ada%')
                   AND RECID = '1' THEN 1 ELSE 0 END) AS ok,
        SUM(CASE WHEN (HASIL_CEK NOT LIKE '%File HR Tidak ada%')
                   AND RECID != '1' THEN 1 ELSE 0 END) AS data_perlu_dicek
      FROM ${table}
      ${whereSQL}
      GROUP BY KODE_GUDANG
      ORDER BY KODE_GUDANG
    `;

    const [rows] = await sequelize.query(sql, { replacements });
    return rows;
  }

  async exportExcel({ cabang, periode, recidFilter, searchQuery, res }) {
    const sequelize = await this.getDb();
    const table = this.getTableName(periode);

    const { conditions, replacements } = this.buildWhereClause({ cabang, periode, recidFilter, searchQuery });
    const whereSQL = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const sql = `
      SELECT ${table}.*, ${this.klasifikasiCase()}
      FROM ${table}
      ${whereSQL}
      ORDER BY TGL_TRANSAKSI DESC, KODE_PROMO ASC
    `;

    const [rows] = await sequelize.query(sql, { replacements });

    // Generate Excel workbook using ExcelJS
    const ExcelJS = (await import("exceljs")).default;
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Reporting2.0 — ntb-vs-glslp";
    workbook.created = new Date();
    workbook.modified = new Date();

    const sheet = workbook.addWorksheet("NTB vs GLSLP");

    // Title
    sheet.addRow([]);
    const titleRow = sheet.addRow([`Rekonsiliasi NTB vs GLSLP — ${periode}`]);
    titleRow.font = { bold: true, size: 14, color: { argb: "FF1A237E" } };
    sheet.addRow([]);

    // Headers
    const headers = [
      "Status",
      "Kode Promo",
      "Gudang",
      "Jenis Toko",
      "Toko",
      "Tanggal",
      "Rp NTB LHDR",
      "Rp GLSLP LHDR",
      "Selisih LHDR",
      "Rp NTB EDP",
      "Rp GLSLP EDP",
      "Selisih EDP",
      "Klasifikasi",
      "Nama File",
      "Hasil Cek",
      "Tgl Cek",
      "IP Cek",
    ];

    const headerRow = sheet.addRow(headers);
    headerRow.eachCell(cell => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1A237E" } };
      cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
      cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    });
    headerRow.height = 28;

    // Data rows
    rows.forEach((r, idx) => {
      const recidStatus = r.RECID === "1" ? "OK" : "?";
      const dataRow = sheet.addRow([
        recidStatus,
        r.KODE_PROMO,
        r.KODE_GUDANG,
        r.JENIS_TOKO || "",
        r.KODE_TOKO,
        r.TGL_TRANSAKSI,
        r.RP_NTB_LHDR,
        r.RP_GLSLP_LHDR,
        r.SELISIH_RP_LHDR,
        r.RP_NTB_EDP,
        r.RP_GLSLP_EDP,
        r.SELISIH_RP_EDP,
        r.KLASIFIKASI || "",
        r.NAMA_FILE || "",
        r.HASIL_CEK || "",
        r.TGL_CEK || "",
        r.IP_CEK || "",
      ]);

      dataRow.eachCell({ includeEmpty: true }, cell => {
        if (idx % 2 === 1) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF5F5FF" } };
        }
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };
        cell.font = { size: 9 };
        cell.alignment = { vertical: "middle" };
      });

      // Style numeric columns
      [7, 8, 9, 10, 11, 12].forEach(idx => {
        const cell = dataRow.getCell(idx);
        cell.numFmt = "#,##0";
        cell.alignment = { horizontal: "right", vertical: "middle" };
      });
    });

    // Auto-width
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17].forEach(idx => {
      const col = sheet.getColumn(idx);
      let maxLen = 10;
      col.eachCell({ includeEmpty: false }, cell => {
        const len = cell.value ? String(cell.value).length : 0;
        if (len > maxLen) maxLen = len;
      });
      col.width = Math.min(maxLen + 3, 45);
    });

    // Freeze pane
    sheet.views = [{ state: "frozen", ySplit: 4 }]; // after title + spacer + header

    // Stream to response
    const filename = `ntb_vs_glslp_${periode}_${cabang}_${Date.now()}.xlsx`;
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(filename)}"`);

    await workbook.xlsx.write(res);
    res.end();
  }

  async updateRecord({ kodePromo, kodeToko, kodeGudang, tglTransaksi, hasilCek, periode, ipCek }) {
    const sequelize = await this.getDb();
    const table = this.getTableName(periode);

    const sql = `
      UPDATE ${table}
      SET HASIL_CEK = :hasilCek,
          RECID = '1',
          TGL_CEK = CURDATE(),
          IP_CEK = :ipCek
      WHERE KODE_PROMO = :kodePromo
        AND KODE_TOKO = :kodeToko
        AND KODE_GUDANG = :kodeGudang
        AND TGL_TRANSAKSI = :tglTransaksi
    `;

    const [result] = await sequelize.query(sql, {
      replacements: { kodePromo, kodeToko, kodeGudang, tglTransaksi, hasilCek: hasilCek || "", ipCek: ipCek || "" },
    });

    return result.affectedRows > 0;
  }
}

export default NtbVsGlslpService;
