import { DataTypes } from "sequelize";
import config from "../../config/index.js";
import logger from "../../config/logger.js";
const { resilientDb } = config;

let SesuaiTokoSummary = null;

const getSesuaiTokoSummaryModel = async () => {
  try {
    if (!SesuaiTokoSummary) {
      const sequelize = await resilientDb.getDatabase();
      if (!sequelize) {
        throw new Error("Database connection not available");
      }

      SesuaiTokoSummary = sequelize.define(
        "sesuaitokosummary",
        {
          CABANG: {
            type: DataTypes.CHAR(4),
            primaryKey: true,
            allowNull: false,
          },
          PERIODE: {
            type: DataTypes.CHAR(4),
            primaryKey: true,
            allowNull: false,
          },
          KDTK: {
            type: DataTypes.CHAR(4),
            primaryKey: true,
            allowNull: false,
          },
          SESUAI: {
            type: DataTypes.DECIMAL(20, 6),
            allowNull: false,
            defaultValue: 0,
          },
          UPDTIME: {
            type: DataTypes.DATE,
            allowNull: true,
            defaultValue: DataTypes.NOW,
          },
          RECID: {
            type: DataTypes.CHAR(1),
            allowNull: false,
            defaultValue: "*",
            comment: "Tracking status: * = unresolved, 1 = resolved",
          },
        },
        {
          tableName: "sesuai_toko_summary",
          timestamps: false,
          freezeTableName: true,
          underscored: false,
          indexes: [
            {
              name: "idx_sesuaitoko_summary_periode",
              fields: ["PERIODE"],
            },
            {
              name: "idx_sesuaitoko_summary_recid",
              fields: ["RECID"],
            },
          ],
        }
      );
    }
    return SesuaiTokoSummary;
  } catch (error) {
    logger.error(`Error syncing SesuaiTokoSummary model: ${error.message}`);
    throw error;
  }
};

const SesuaiTokoSummaryWrapper = {
  async findAll(options) {
    const model = await getSesuaiTokoSummaryModel();
    return model.findAll(options);
  },
  async findOne(options) {
    const model = await getSesuaiTokoSummaryModel();
    return model.findOne(options);
  },
  async create(data, options) {
    const model = await getSesuaiTokoSummaryModel();
    return model.create(data, options);
  },
  async update(data, options) {
    const model = await getSesuaiTokoSummaryModel();
    return model.update(data, options);
  },
  async destroy(options) {
    const model = await getSesuaiTokoSummaryModel();
    return model.destroy(options);
  },
  async upsert(data, options) {
    const model = await getSesuaiTokoSummaryModel();
    return model.upsert(data, options);
  },
  getModel() {
    return getSesuaiTokoSummaryModel();
  },
};

export default SesuaiTokoSummaryWrapper;
