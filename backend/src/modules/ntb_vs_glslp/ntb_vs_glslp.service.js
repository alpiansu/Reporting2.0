import resilientDb from "../../config/resilient-database.js";
import logger from "../../config/logger.js";
import { CONFIG } from "./ntb_vs_glslp.config.js";

const ALLOWED_SORT_COLUMNS = new Set([
  "KODE_PROMO",
  "KODE_GUDANG",
  "KODE_TOKO",
  "TGL_TRANSAKSI",
  "RP_NTB",
  "RP_GLSLP",
  "SELISIH_RP",
  "HASIL_CEK",
  "RECID",
  "TGL_CEK",
]);

class NtbVsGlslpService {
  getTableName(periode) {
    return `db_edp.rekon_glslp_vs_ntb_${periode}`;
  }

  klasifikasiCase() {
    return `
      CASE
        WHEN SELISIH_RP = 0 THEN 'SESUAI'
        WHEN ABS(SELISIH_RP) <= ${CONFIG.TOLERANCE} THEN 'TOLERANSI'
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
        `(${table}.KODE_PROMO LIKE :search OR ${table}.KODE_TOKO LIKE :search OR ${table}.NAMA_FILE LIKE :search OR ${table}.HASIL_CEK LIKE :search)`,
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
        SUM(CASE WHEN SELISIH_RP = 0 THEN 1 ELSE 0 END) AS sesui,
        SUM(CASE WHEN ABS(SELISIH_RP) > 0 AND ABS(SELISIH_RP) <= ${CONFIG.TOLERANCE} THEN 1 ELSE 0 END) AS toleransi,
        SUM(CASE WHEN ABS(SELISIH_RP) > ${CONFIG.TOLERANCE} THEN 1 ELSE 0 END) AS selisih,
        COALESCE(SUM(ABS(SELISIH_RP)), 0) AS total_abs_selisih
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
