import { DataTypes } from "sequelize";
import config from "../config/index.js";
const { resilientDb } = config;

// Lazy model definition
let HistBuatRmb = null;

const getHistBuatRmbModel = async () => {
  if (!HistBuatRmb) {
    const sequelize = await resilientDb.getDatabase();
    if (!sequelize) {
      throw new Error("Database connection not available");
    }

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
      }
    );
  }

  return HistBuatRmb;
};

// Export wrapper object with common Sequelize model methods
const HistBuatRmbModel = {
  findAll: async (options = {}) => {
    const model = await getHistBuatRmbModel();
    return model.findAll(options);
  },
  create: async data => {
    const model = await getHistBuatRmbModel();
    return model.create(data);
  },
  bulkCreate: async (data, options = {}) => {
    const model = await getHistBuatRmbModel();
    return model.bulkCreate(data, options);
  },
  findOne: async (options = {}) => {
    const model = await getHistBuatRmbModel();
    return model.findOne(options);
  },
  count: async (options = {}) => {
    const model = await getHistBuatRmbModel();
    return model.count(options);
  },
  getModel: getHistBuatRmbModel,
};

export default HistBuatRmbModel;
