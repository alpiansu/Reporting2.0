import { DataTypes, Op } from "sequelize";
import crypto from "crypto"; // Untuk generate UUID
import config from "../../config/index.js";
import logger from "../../config/logger.js";

const { resilientDb } = config;

let SesuaiToko = null;
let SesuaiTokoStaging = null;

// ==========================================================
// MAIN TABLE ATTRIBUTES (Tetap sama)
// ==========================================================
const SESUAI_TOKO_ATTRIBUTES = {
  RECID: { type: DataTypes.CHAR(1), allowNull: false, defaultValue: "*", comment: "Tracking status" },
  CABANG: { type: DataTypes.CHAR(4), primaryKey: true, allowNull: false },
  PERIODE: { type: DataTypes.CHAR(4), primaryKey: true, allowNull: false },
  KDTK: { type: DataTypes.CHAR(4), primaryKey: true, allowNull: false },
  PRDCD: { type: DataTypes.STRING(8), primaryKey: true, allowNull: false },
  SINGKATAN: { type: DataTypes.STRING(85), allowNull: true },
  RECID_PRODMAST: { type: DataTypes.CHAR(1), allowNull: true },
  PTAG: { type: DataTypes.CHAR(1), allowNull: true },
  BEGBAL: { type: DataTypes.DECIMAL(20, 6), allowNull: true },
  TRFIN: { type: DataTypes.DECIMAL(20, 6), allowNull: true },
  TRFOUT: { type: DataTypes.DECIMAL(20, 6), allowNull: true },
  RP_SALES: { type: DataTypes.DECIMAL(20, 6), allowNull: true },
  RP_RETUR_SALES: { type: DataTypes.DECIMAL(20, 6), allowNull: true },
  ADJ: { type: DataTypes.DECIMAL(20, 6), allowNull: true },
  BA: { type: DataTypes.DECIMAL(20, 6), allowNull: true },
  BS: { type: DataTypes.DECIMAL(20, 6), allowNull: true },
  ACOST: { type: DataTypes.DECIMAL(20, 6), allowNull: true },
  LCOST: { type: DataTypes.DECIMAL(20, 6), allowNull: true },
  STOCK: { type: DataTypes.DECIMAL(20, 6), allowNull: true },
  RP_STOCK: { type: DataTypes.DECIMAL(20, 6), allowNull: true },
  SESUAI: { type: DataTypes.DECIMAL(20, 6), allowNull: true },
  UPDTIME: { type: DataTypes.DATE, allowNull: true, defaultValue: DataTypes.NOW },
};

// ==========================================================
// STAGING TABLE ATTRIBUTES (Dimodifikasi untuk Multi-Session)
// ==========================================================
const SESUAI_TOKO_STAGING_ATTRIBUTES = {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  SESSION_ID: { type: DataTypes.STRING(36), allowNull: false },

  // ✅ TAMBAHKAN INI — untuk mendeteksi orphaned data
  CREATED_AT: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },

  // ... (semua atribut lainnya tetap sama seperti sebelumnya)
  RECID: { type: DataTypes.CHAR(1), allowNull: true, defaultValue: "*" },
  CABANG: { type: DataTypes.CHAR(4), allowNull: false },
  PERIODE: { type: DataTypes.CHAR(4), allowNull: false },
  KDTK: { type: DataTypes.CHAR(4), allowNull: false },
  PRDCD: { type: DataTypes.STRING(8), allowNull: false },
  SINGKATAN: { type: DataTypes.STRING(85), allowNull: true },
  RECID_PRODMAST: { type: DataTypes.CHAR(1), allowNull: true },
  PTAG: { type: DataTypes.CHAR(1), allowNull: true },
  BEGBAL: { type: DataTypes.DECIMAL(20, 6), allowNull: true },
  TRFIN: { type: DataTypes.DECIMAL(20, 6), allowNull: true },
  TRFOUT: { type: DataTypes.DECIMAL(20, 6), allowNull: true },
  RP_SALES: { type: DataTypes.DECIMAL(20, 6), allowNull: true },
  RP_RETUR_SALES: { type: DataTypes.DECIMAL(20, 6), allowNull: true },
  ADJ: { type: DataTypes.DECIMAL(20, 6), allowNull: true },
  BA: { type: DataTypes.DECIMAL(20, 6), allowNull: true },
  BS: { type: DataTypes.DECIMAL(20, 6), allowNull: true },
  ACOST: { type: DataTypes.DECIMAL(20, 6), allowNull: true },
  LCOST: { type: DataTypes.DECIMAL(20, 6), allowNull: true },
  STOCK: { type: DataTypes.DECIMAL(20, 6), allowNull: true },
  RP_STOCK: { type: DataTypes.DECIMAL(20, 6), allowNull: true },
  SESUAI: { type: DataTypes.DECIMAL(20, 6), allowNull: true },
  UPDTIME: { type: DataTypes.DATE, allowNull: true, defaultValue: DataTypes.NOW },
};

const STAGING_OPTIONS = {
  tableName: "sesuai_toko_staging",
  timestamps: false,
  freezeTableName: true,
  underscored: false,
  indexes: [{ fields: ["SESSION_ID", "KDTK"] }], // Index untuk mempercepat merge
};

// ==========================================================
// MODEL GETTERS
// ==========================================================
const getSesuaiTokoModel = async () => {
  if (!SesuaiToko) {
    const sequelize = await resilientDb.getDatabase();
    // ✅ VALIDASI: Jika database offline, throw error yang jelas
    if (!sequelize) {
      throw new Error(
        "Database connection not available. Please check your database connection or wait for automatic reconnection.",
      );
    }
    SesuaiToko = sequelize.define("sesuaitoko", SESUAI_TOKO_ATTRIBUTES, {
      tableName: "sesuai_toko",
      timestamps: false,
      freezeTableName: true,
      underscored: false,
    });
  }
  return SesuaiToko;
};

const getSesuaiTokoStagingModel = async () => {
  if (!SesuaiTokoStaging) {
    const sequelize = await resilientDb.getDatabase();
    // ✅ VALIDASI: Jika database offline, throw error yang jelas
    if (!sequelize) {
      throw new Error(
        "Database connection not available. Please check your database connection or wait for automatic reconnection.",
      );
    }
    SesuaiTokoStaging = sequelize.define("sesuaitoko_staging", SESUAI_TOKO_STAGING_ATTRIBUTES, STAGING_OPTIONS);
    // Sync sekali saat aplikasi start (atau bisa dipindah ke migration script)
    await SesuaiTokoStaging.sync();
  }
  return SesuaiTokoStaging;
};

// ==========================================================
// WRAPPER
// ==========================================================
const SesuaiTokoWrapper = {
  // --- Standard CRUD (Tetap sama, backward compatible) ---
  async findAll(options) {
    return (await getSesuaiTokoModel()).findAll(options);
  },
  async findOne(options) {
    return (await getSesuaiTokoModel()).findOne(options);
  },
  async findByPk(pk, options) {
    return (await getSesuaiTokoModel()).findByPk(pk, options);
  },
  async create(data, options) {
    return (await getSesuaiTokoModel()).create(data, options);
  },
  async update(data, options) {
    return (await getSesuaiTokoModel()).update(data, options);
  },
  async destroy(options) {
    return (await getSesuaiTokoModel()).destroy(options);
  },
  async count(options) {
    return (await getSesuaiTokoModel()).count(options);
  },
  async bulkCreate(data, options) {
    return (await getSesuaiTokoModel()).bulkCreate(data, options);
  },
  async upsert(data, options) {
    return (await getSesuaiTokoModel()).upsert(data, options);
  },
  async findOrCreate(options) {
    return (await getSesuaiTokoModel()).findOrCreate(options);
  },
  getModel() {
    return getSesuaiTokoModel();
  },

  // --- MULTI-SESSION STAGING METHODS ---

  /**
   * 1. Mulai sesi screening. Mengembalikan SESSION_ID unik.
   * TIDAK ADA proses Create/Drop table di sini.
   */
  async startScreeningSession() {
    await getSesuaiTokoStagingModel(); // Ensure table exists
    const sessionId = crypto.randomUUID();
    logger.info(`Started screening session: ${sessionId}`);
    return sessionId;
  },

  /**
   * 2. Bulk insert ke staging table dengan SESSION_ID
   */
  async bulkCreateStaging(sessionId, data, options = {}) {
    const model = await getSesuaiTokoStagingModel();
    // Inject SESSION_ID ke setiap row
    const dataWithSession = data.map(row => ({ ...row, SESSION_ID: sessionId }));
    return model.bulkCreate(dataWithSession, { ...options, logging: false });
  },

  /**
   * 3. Merge data dari staging ke main table berdasarkan SESSION_ID
   */
  async mergeStagingToMain(sessionId, periode) {
    const sequelize = await resilientDb.getDatabase();
    if (!sequelize) throw new Error("Database connection not available");
    const mainTable = "sesuai_toko";
    const stagingTable = "sesuai_toko_staging";

    logger.info(`Merging session ${sessionId} to main table for periode ${periode}...`);

    const transaction = await sequelize.transaction();
    try {
      // Step A: Hapus data di main table yang KDTK-nya ada di staging session ini
      await sequelize.query(
        `DELETE FROM ${mainTable} 
         WHERE PERIODE = :periode 
         AND KDTK IN (SELECT DISTINCT KDTK FROM ${stagingTable} WHERE SESSION_ID = :sessionId)`,
        { replacements: { periode, sessionId }, transaction },
      );

      // Step B: Insert data dari staging ke main table (hanya untuk session ini)
      // Kita sebutkan kolom secara eksplisit agar aman dari perbedaan urutan kolom
      const columns = Object.keys(SESUAI_TOKO_ATTRIBUTES).join(", ");
      await sequelize.query(
        `INSERT INTO ${mainTable} (${columns}) 
         SELECT ${columns} FROM ${stagingTable} 
         WHERE SESSION_ID = :sessionId`,
        { replacements: { sessionId }, transaction },
      );

      await transaction.commit();
      logger.info(`Merge session ${sessionId} completed successfully.`);
    } catch (error) {
      await transaction.rollback();
      logger.error(`Error merging session ${sessionId}: ${error.message}`);
      throw error;
    }
  },

  /**
   * 4. Cleanup data staging untuk session tertentu (Bukan drop table)
   */
  async cleanupScreeningSession(sessionId) {
    const model = await getSesuaiTokoStagingModel();
    await model.destroy({ where: { SESSION_ID: sessionId } });
    logger.info(`Cleaned up staging data for session: ${sessionId}`);
  },

  /**
   * Membersihkan data staging yang sudah orphaned (tidak pernah di-cleanup).
   *
   * Kapan dipanggil?
   * - Cron job (misal: setiap jam 2 pagi)
   * - Atau di awal proses screening sebagai "pre-cleanup"
   *
   * @param {number} maxAgeHours - Data yang lebih tua dari ini akan dihapus (default: 24 jam)
   * @returns {object} - Ringkasan jumlah data yang dihapus
   */
  async cleanupOrphanedStagingData(maxAgeHours = 24) {
    const model = await getSesuaiTokoStagingModel();
    const cutoffDate = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);

    try {
      // Step 1: Hitung dulu berapa yang akan dihapus (untuk logging)
      const orphanedCount = await model.count({
        where: {
          CREATED_AT: {
            [Op.lt]: cutoffDate,
          },
        },
      });

      if (orphanedCount === 0) {
        logger.info("No orphaned staging data found. Cleanup skipped.");
        return { deletedCount: 0, cutoffDate };
      }

      // Step 2: Hapus data orphaned
      const deletedCount = await model.destroy({
        where: {
          CREATED_AT: {
            [Op.lt]: cutoffDate,
          },
        },
      });

      logger.info(
        `Cleaned up ${deletedCount} orphaned staging rows older than ${maxAgeHours} hours (cutoff: ${cutoffDate.toISOString()})`,
      );

      return { deletedCount, cutoffDate };
    } catch (error) {
      logger.error(`Error cleaning orphaned staging data: ${error.message}`);
      throw error;
    }
  },

  // ... (kode sebelumnya tetap sama)

  /**
   * Merge staging ke main table + cleanup resolved stores dalam SATU transaction
   * Ini lebih efisien dan aman secara atomik
   *
   * @param {string} sessionId - UUID sesi screening
   * @param {string} periode - Periode yang di-screen
   * @param {Array<string>} resolvedStores - Store yang di-screen dan ternyata bersih (opsional)
   */
  async mergeStagingAndCleanup(sessionId, periode, resolvedStores = []) {
    const sequelize = await resilientDb.getDatabase();
    const mainTable = "sesuai_toko";
    const stagingTable = "sesuai_toko_staging";
    const summaryTable = "sesuai_toko_summary";

    logger.info(
      `Merging session ${sessionId} to main table for periode ${periode}, ` +
        `cleaning up ${resolvedStores.length} resolved stores...`,
    );

    const transaction = await sequelize.transaction();
    try {
      // ── STEP 1: Cleanup resolved stores (hapus detail + update summary) ──
      if (resolvedStores.length > 0) {
        // Batch delete detail (chunk per 500 untuk menghindari lock)
        const BATCH_SIZE = 500;
        for (let i = 0; i < resolvedStores.length; i += BATCH_SIZE) {
          const chunk = resolvedStores.slice(i, i + BATCH_SIZE);

          await sequelize.query(
            `DELETE FROM \`${mainTable}\` 
           WHERE PERIODE = :periode 
           AND KDTK IN (:chunk)`,
            { replacements: { periode, chunk }, transaction },
          );

          await sequelize.query(
            `UPDATE \`${summaryTable}\` 
           SET RECID = '1' 
           WHERE PERIODE = :periode 
           AND KDTK IN (:chunk)`,
            { replacements: { periode, chunk }, transaction },
          );
        }

        logger.info(`Cleaned up ${resolvedStores.length} resolved stores`);
      }

      // // ── STEP 2: Merge staging ke main table ──
      // // 2a. Hapus data lama yang KDTK-nya ada di staging
      // await sequelize.query(
      //   `DELETE FROM \`${mainTable}\`
      //  WHERE PERIODE = :periode
      //  AND KDTK IN (SELECT DISTINCT KDTK FROM \`${stagingTable}\` WHERE SESSION_ID = :sessionId)`,
      //   { replacements: { periode, sessionId }, transaction },
      // );

      // 2b. Insert data baru dari staging
      const columns = Object.keys(SESUAI_TOKO_ATTRIBUTES).join(", ");
      await sequelize.query(
        `INSERT IGNORE INTO \`${mainTable}\` (${columns}) 
       SELECT ${columns} FROM \`${stagingTable}\` 
       WHERE SESSION_ID = :sessionId ON duplicate KEY UPDATE recid=VALUES(recid), updtime=VALUES(updtime), 
       begbal=VALUES(begbal), trfin=VALUES(trfin), trfout=VALUES(trfout), rp_sales=VALUES(rp_sales), rp_retur_sales=VALUES(rp_retur_sales), adj=VALUES(adj), ba=VALUES(ba), bs=VALUES(bs), acost=VALUES(acost), lcost=VALUES(lcost), stock=VALUES(stock), rp_stock=VALUES(rp_stock), sesuai=VALUES(sesuai);`,
        { replacements: { sessionId }, transaction },
      );

      await transaction.commit();
      logger.info(`Merge & cleanup completed for session ${sessionId}`);
    } catch (error) {
      await transaction.rollback();
      logger.error(`Error in mergeStagingAndCleanup: ${error.message}`);
      throw error;
    }
  },
};

export default SesuaiTokoWrapper;
