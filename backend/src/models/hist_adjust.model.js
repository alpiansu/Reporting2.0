import { DataTypes } from "sequelize";
import config from "../config/index.js";
import logger from "../config/logger.js";
const { resilientDb } = config;

let HistAdjust = null;
let _histAdjustSequelizeInstance = null;

const getHistAdjustModel = async () => {
  try {
    const sequelize = await resilientDb.getDatabase();
    if (!sequelize) {
      throw new Error("Database connection not available");
    }

    if (!HistAdjust || _histAdjustSequelizeInstance !== sequelize) {
      _histAdjustSequelizeInstance = sequelize;
      HistAdjust = sequelize.define(
        "hist_adjust",
        {
          id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
            comment: "Auto-increment primary key",
          },
          kdtk: {
            type: DataTypes.STRING(10),
            allowNull: false,
            comment: "Store code",
          },
          prdcd: {
            type: DataTypes.STRING(20),
            allowNull: false,
            comment: "Product code (barcode)",
          },
          qty_adj: {
            type: DataTypes.INTEGER,
            allowNull: false,
            comment: "Adjustment quantity (positive/negative)",
          },
          keter: {
            type: DataTypes.TEXT,
            allowNull: true,
            comment: "Adjustment description/reason",
          },
          note: {
            type: DataTypes.TEXT,
            allowNull: true,
            comment: "Result note - success/failure message",
          },
          pic: {
            type: DataTypes.STRING(50),
            allowNull: false,
            comment: "Username of the user who performed the adjustment",
          },
          updtime: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
            comment: "Execution timestamp",
          },
          status: {
            type: DataTypes.ENUM("SUCCESS", "FAILED"),
            allowNull: false,
            comment: "Adjustment attempt status",
          },
        },
        {
          tableName: "hist_adjust",
          timestamps: false,
          indexes: [
            {
              fields: ["kdtk"],
            },
            {
              fields: ["pic"],
            },
            {
              fields: ["updtime"],
            },
            {
              fields: ["status"],
            },
            {
              fields: ["kdtk", "updtime"],
            },
          ],
          comment: "History log for store adjustment attempts",
        },
      );
    }
    return HistAdjust;
  } catch (error) {
    logger.error(`Error syncing HistAdjust model: ${error.message}`);
    throw error;
  }
};

const HistAdjustWrapper = {
  async findAll(options) {
    const model = await getHistAdjustModel();
    return model.findAll(options);
  },
  async findOne(options) {
    const model = await getHistAdjustModel();
    return model.findOne(options);
  },
  async findByPk(pk, options) {
    const model = await getHistAdjustModel();
    return model.findByPk(pk, options);
  },
  async create(data, options) {
    const model = await getHistAdjustModel();
    return model.create(data, options);
  },
  async update(data, options) {
    const model = await getHistAdjustModel();
    return model.update(data, options);
  },
  async destroy(options) {
    const model = await getHistAdjustModel();
    return model.destroy(options);
  },
  async count(options) {
    const model = await getHistAdjustModel();
    return model.count(options);
  },
  async bulkCreate(data, options) {
    const model = await getHistAdjustModel();
    return model.bulkCreate(data, options);
  },
  async upsert(data, options) {
    const model = await getHistAdjustModel();
    return model.upsert(data, options);
  },
  async findOrCreate(options) {
    const model = await getHistAdjustModel();
    return model.findOrCreate(options);
  },
  getModel() {
    return getHistAdjustModel();
  },
};

export default HistAdjustWrapper;
