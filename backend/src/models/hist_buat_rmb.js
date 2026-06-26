import { DataTypes } from "sequelize";
import config from "../config/index.js";
import logger from "../config/logger.js";
const { resilientDb } = config;

let HistBuatRmb = null;
let _histBuatRmbSequelizeInstance = null;

const getHistBuatRmbModel = async () => {
  try {
    const sequelize = await resilientDb.getDatabase();
    if (!sequelize) {
      throw new Error("Database connection not available");
    }

    if (!HistBuatRmb || _histBuatRmbSequelizeInstance !== sequelize) {
      _histBuatRmbSequelizeInstance = sequelize;
      HistBuatRmb = sequelize.define(
        "hist_buat_rmb",
        {
          id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
          },
          kdtk: {
            type: DataTypes.CHAR(4),
            allowNull: true,
          },
          tgl: {
            type: DataTypes.DATEONLY,
            allowNull: true,
          },
          prdcd: {
            type: DataTypes.CHAR(8),
            allowNull: true,
          },
          trxid: {
            type: DataTypes.STRING(15),
            allowNull: true,
          },
          keter: {
            type: DataTypes.TEXT,
            allowNull: true,
          },
          note: {
            type: DataTypes.TEXT,
            allowNull: true,
          },
          pic: {
            type: DataTypes.STRING(20),
            allowNull: true,
          },
          updtime: {
            type: DataTypes.DATE,
            allowNull: true,
          },
          status: {
            type: DataTypes.ENUM("SUCCESS", "FAILED"),
            allowNull: true,
          },
        },
        {
          tableName: "hist_buat_rmb",
          timestamps: false,
        },
      );
    }
    return HistBuatRmb;
  } catch (error) {
    logger.error(`Error syncing HistBuatRmb model: ${error.message}`);
    throw error;
  }
};

const HistBuatRmbWrapper = {
  async findAll(options) {
    const model = await getHistBuatRmbModel();
    return model.findAll(options);
  },
  async findOne(options) {
    const model = await getHistBuatRmbModel();
    return model.findOne(options);
  },
  async findByPk(pk, options) {
    const model = await getHistBuatRmbModel();
    return model.findByPk(pk, options);
  },
  async create(data, options) {
    const model = await getHistBuatRmbModel();
    return model.create(data, options);
  },
  async update(data, options) {
    const model = await getHistBuatRmbModel();
    return model.update(data, options);
  },
  async destroy(options) {
    const model = await getHistBuatRmbModel();
    return model.destroy(options);
  },
  async count(options) {
    const model = await getHistBuatRmbModel();
    return model.count(options);
  },
  async bulkCreate(data, options) {
    const model = await getHistBuatRmbModel();
    return model.bulkCreate(data, options);
  },
  async upsert(data, options) {
    const model = await getHistBuatRmbModel();
    return model.upsert(data, options);
  },
  async findOrCreate(options) {
    const model = await getHistBuatRmbModel();
    return model.findOrCreate(options);
  },
  getModel() {
    return getHistBuatRmbModel();
  },
};

export default HistBuatRmbWrapper;
