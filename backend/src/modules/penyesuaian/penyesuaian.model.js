import { DataTypes, Op } from "sequelize";
import crypto from "crypto";
import config from "../../config/index.js";
import logger from "../../config/logger.js";
const { resilientDb } = config;

let SesuaiToko = null;
let _sesuaiTokoSequelizeInstance = null;
let SesuaiTokoStaging = null;
let _sesuaiTokoStagingSequelizeInstance = null;

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

const SESUAI_TOKO_STAGING_ATTRIBUTES = {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  SESSION_ID: { type: DataTypes.STRING(36), allowNull: false },
  CREATED_AT: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
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
  indexes: [{ fields: ["SESSION_ID", "KDTK"] }],
};

const getSesuaiTokoModel = async () => {
  try {
    const sequelize = await resilientDb.getDatabase();
    if (!sequelize) {
      throw new Error(
        "Database connection not available. Please check your database connection or wait for automatic reconnection.",
      );
    }

    if (!SesuaiToko || _sesuaiTokoSequelizeInstance !== sequelize) {
      _sesuaiTokoSequelizeInstance = sequelize;
      SesuaiToko = sequelize.define("sesuaitoko", SESUAI_TOKO_ATTRIBUTES, {
        tableName: "sesuai_toko",
        timestamps: false,
        freezeTableName: true,
        underscored: false,
      });
    }
    return SesuaiToko;
  } catch (error) {
    logger.error(`Error syncing SesuaiToko model: ${error.message}`);
    throw error;
  }
};

const getSesuaiTokoStagingModel = async () => {
  try {
    const sequelize = await resilientDb.getDatabase();
    if (!sequelize) {
      throw new Error(
        "Database connection not available. Please check your database connection or wait for automatic reconnection.",
      );
    }

    if (!SesuaiTokoStaging || _sesuaiTokoStagingSequelizeInstance !== sequelize) {
      _sesuaiTokoStagingSequelizeInstance = sequelize;
      SesuaiTokoStaging = sequelize.define("sesuaitoko_staging", SESUAI_TOKO_STAGING_ATTRIBUTES, STAGING_OPTIONS);
      await SesuaiTokoStaging.sync();
    }
    return SesuaiTokoStaging;
  } catch (error) {
    logger.error(`Error syncing SesuaiTokoStaging model: ${error.message}`);
    throw error;
  }
};

const SesuaiTokoWrapper = {
  async findAll(options) {
    const model = await getSesuaiTokoModel();
    return model.findAll(options);
  },
  async findOne(options) {
    const model = await getSesuaiTokoModel();
    return model.findOne(options);
  },
  async findByPk(pk, options) {
    const model = await getSesuaiTokoModel();
    return model.findByPk(pk, options);
  },
  async create(data, options) {
    const model = await getSesuaiTokoModel();
    return model.create(data, options);
  },
  async update(data, options) {
    const model = await getSesuaiTokoModel();
    return model.update(data, options);
  },
  async destroy(options) {
    const model = await getSesuaiTokoModel();
    return model.destroy(options);
  },
  async count(options) {
    const model = await getSesuaiTokoModel();
    return model.count(options);
  },
  async bulkCreate(data, options) {
    const model = await getSesuaiTokoModel();
    return model.bulkCreate(data, options);
  },
  async upsert(data, options) {
    const model = await getSesuaiTokoModel();
    return model.upsert(data, options);
  },
  async findOrCreate(options) {
    const model = await getSesuaiTokoModel();
    return model.findOrCreate(options);
  },
  getModel() {
    return getSesuaiTokoModel();
  },

  async startScreeningSession() {
    await getSesuaiTokoStagingModel();
    const sessionId = crypto.randomUUID();
    logger.info(`Started screening session: ${sessionId}`);
    return sessionId;
  },

  async bulkCreateStaging(sessionId, data, options = {}) {
    const model = await getSesuaiTokoStagingModel();
    const dataWithSession = data.map(row => ({ ...row, SESSION_ID: sessionId }));
    return model.bulkCreate(dataWithSession, { ...options, logging: false });
  },

  async mergeStagingToMain(sessionId, periode) {
    const sequelize = await resilientDb.getDatabase();
    if (!sequelize) throw new Error("Database connection not available");
    const mainTable = "sesuai_toko";
    const stagingTable = "sesuai_toko_staging";

    logger.info(`Merging session ${sessionId} to main table for periode ${periode}...`);

    const transaction = await sequelize.transaction();
    try {
      await sequelize.query(
        `DELETE FROM ${mainTable} 
         WHERE PERIODE = :periode 
         AND KDTK IN (SELECT DISTINCT KDTK FROM ${stagingTable} WHERE SESSION_ID = :sessionId)`,
        { replacements: { periode, sessionId }, transaction },
      );

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

  async cleanupScreeningSession(sessionId) {
    const model = await getSesuaiTokoStagingModel();
    await model.destroy({ where: { SESSION_ID: sessionId } });
    logger.info(`Cleaned up staging data for session: ${sessionId}`);
  },

  async cleanupOrphanedStagingData(maxAgeHours = 24) {
    const model = await getSesuaiTokoStagingModel();
    const cutoffDate = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);

    try {
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
      if (resolvedStores.length > 0) {
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
