import { DataTypes } from "sequelize";
import config from "../../config/index.js";
import logger from "../../config/logger.js";

const { resilientDb } = config;

let ScreeningPraClosing = null;

const getScreeningPraClosingModel = async () => {
  try {
    if (!ScreeningPraClosing) {
      const sequelize = await resilientDb.getDatabase();
      if (!sequelize) {
        throw new Error("Database connection not available");
      }

      ScreeningPraClosing = sequelize.define(
        "screening_praclosing",
        {
          ID: {
            field: "ID",
            type: DataTypes.STRING(20),
            primaryKey: true,
            allowNull: false,
            comment: "Format: {CAB}{KDTK}{PERIODE}",
          },
          RECID: {
            field: "RECID",
            type: DataTypes.CHAR(1),
            allowNull: false,
            defaultValue: "*",
            comment: "* = has issues, 1 = resolved",
          },
          CAB: {
            field: "CAB",
            type: DataTypes.CHAR(4),
            allowNull: false,
          },
          KDTK: {
            field: "KDTK",
            type: DataTypes.CHAR(4),
            allowNull: false,
          },
          PRD_CLOSING: {
            field: "PRD_CLOSING",
            type: DataTypes.CHAR(4),
            allowNull: false,
            comment: "Format: YYMM",
          },

          // 🔴 Issues Data (JSON format)
          ISSUES: {
            field: "ISSUES",
            type: DataTypes.JSON,
            allowNull: true,
            comment: "Array of failed rule keys with details",
          },

          // 📊 Summary Statistics
          TOTAL_RULES: {
            field: "TOTAL_RULES",
            type: DataTypes.INTEGER,
            allowNull: true,
            defaultValue: 0,
          },
          PASSED_RULES: {
            field: "PASSED_RULES",
            type: DataTypes.INTEGER,
            allowNull: true,
            defaultValue: 0,
          },
          FAILED_RULES: {
            field: "FAILED_RULES",
            type: DataTypes.INTEGER,
            allowNull: true,
            defaultValue: 0,
          },
          CRITICAL_ISSUES: {
            field: "CRITICAL_ISSUES",
            type: DataTypes.INTEGER,
            allowNull: true,
            defaultValue: 0,
          },

          // 🎯 Status Fields
          IS_READY: {
            field: "IS_READY",
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
            comment: "true if all critical rules passed",
          },

          LAST_SCREENED: {
            field: "LAST_SCREENED",
            type: DataTypes.DATE,
            allowNull: true,
          },

          UPDTIME: {
            field: "UPDTIME",
            type: DataTypes.DATE,
            allowNull: true,
            defaultValue: DataTypes.NOW,
          },
        },
        {
          tableName: "screening_praclosing",
          timestamps: false,
          freezeTableName: true,
          indexes: [
            {
              name: "idx_screening_recid",
              fields: ["RECID"],
            },
            {
              name: "idx_screening_cab_prd",
              fields: ["CAB", "PRD_CLOSING"],
            },
            {
              name: "idx_screening_kdtk",
              fields: ["KDTK"],
            },
            {
              name: "idx_screening_ready",
              fields: ["IS_READY"],
            },
          ],
        }
      );
    }
    return ScreeningPraClosing;
  } catch (error) {
    logger.error(`[prep_closing.model] Error: ${error.message}`);
    throw error;
  }
};

// Wrapper with async methods
const ScreeningPraClosingWrapper = {
  async findAll(options) {
    const model = await getScreeningPraClosingModel();
    return model.findAll(options);
  },
  async findOne(options) {
    const model = await getScreeningPraClosingModel();
    return model.findOne(options);
  },
  async findByPk(pk, options) {
    const model = await getScreeningPraClosingModel();
    return model.findByPk(pk, options);
  },
  async create(data, options) {
    const model = await getScreeningPraClosingModel();
    return model.create(data, options);
  },
  async bulkCreate(data, options) {
    const model = await getScreeningPraClosingModel();
    return model.bulkCreate(data, options);
  },
  async update(data, options) {
    const model = await getScreeningPraClosingModel();
    return model.update(data, options);
  },
  async destroy(options) {
    const model = await getScreeningPraClosingModel();
    return model.destroy(options);
  },
  async upsert(data, options) {
    const model = await getScreeningPraClosingModel();
    return model.upsert(data, options);
  },
  getModel() {
    return getScreeningPraClosingModel();
  },
};

export default ScreeningPraClosingWrapper;
