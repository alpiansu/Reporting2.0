import { DataTypes } from "sequelize";
import config from "../../../config/index.js";
import logger from "../../../config/logger.js";
const { resilientDb } = config;

let RekonSalesShopCheck = null;
let _shopCheckSequelizeInstance = null;

/**
 * Model: rekon_sales_shop_check
 * Store-level monthly summary of mtran.SHOP integrity check (SHOP harus = KDTK).
 * Satu baris per toko per periode. Dibuat otomatis via sequelize.sync() saat app start.
 */
const getRekonSalesShopCheckModel = async () => {
  try {
    const sequelize = await resilientDb.getDatabase();
    if (!sequelize) {
      throw new Error("Database connection not available");
    }

    if (!RekonSalesShopCheck || _shopCheckSequelizeInstance !== sequelize) {
      _shopCheckSequelizeInstance = sequelize;
      RekonSalesShopCheck = sequelize.define(
        "rekon_sales_shop_check",
        {
          CAB: {
            field: "CAB",
            type: DataTypes.CHAR(4),
            allowNull: false,
          },
          KDTK: {
            field: "KDTK",
            type: DataTypes.CHAR(4),
            primaryKey: true,
            allowNull: false,
          },
          MONTH: {
            field: "MONTH",
            type: DataTypes.CHAR(2),
            primaryKey: true,
            allowNull: false,
          },
          YEAR: {
            field: "YEAR",
            type: DataTypes.CHAR(4),
            primaryKey: true,
            allowNull: false,
          },
          STATUS: {
            field: "STATUS",
            type: DataTypes.CHAR(2),
            allowNull: false,
            defaultValue: "B",
            comment: "Hanya toko bermasalah yang disimpan: B = ada SHOP beda/kosong (OK tidak disimpan)",
          },
          JUMLAH_TRX_BEDA: {
            field: "JUMLAH_TRX_BEDA",
            type: DataTypes.INTEGER,
            allowNull: true,
          },
          JUMLAH_SHOP_ASING: {
            field: "JUMLAH_SHOP_ASING",
            type: DataTypes.INTEGER,
            allowNull: true,
          },
          LIST_SHOP: {
            field: "LIST_SHOP",
            type: DataTypes.TEXT,
            allowNull: true,
            comment: "JSON array: [{SHOP, JUMLAH_TRX, JUMLAH_TGL, TGL_AWAL, TGL_AKHIR}]",
          },
          UPDTIME: {
            field: "UPDTIME",
            type: DataTypes.DATE,
            allowNull: true,
          },
        },
        {
          tableName: "rekon_sales_shop_check",
          timestamps: false,
          freezeTableName: true,
          indexes: [
            {
              name: "idx_shop_check_period",
              fields: ["CAB", "MONTH", "YEAR"],
            },
            {
              name: "idx_shop_check_status",
              fields: ["STATUS", "MONTH", "YEAR"],
            },
          ],
        },
      );
    }
    return RekonSalesShopCheck;
  } catch (error) {
    logger.error(`[rekon_sales_shop_check.model] Error: ${error.message}`);
    throw error;
  }
};

const RekonSalesShopCheckWrapper = {
  async findAll(options) {
    const model = await getRekonSalesShopCheckModel();
    return model.findAll(options);
  },
  async findOne(options) {
    const model = await getRekonSalesShopCheckModel();
    return model.findOne(options);
  },
  async findByPk(pk, options) {
    const model = await getRekonSalesShopCheckModel();
    return model.findByPk(pk, options);
  },
  async findAndCountAll(options) {
    const model = await getRekonSalesShopCheckModel();
    return model.findAndCountAll(options);
  },
  async create(data, options) {
    const model = await getRekonSalesShopCheckModel();
    return model.create(data, options);
  },
  async update(data, options) {
    const model = await getRekonSalesShopCheckModel();
    return model.update(data, options);
  },
  async bulkCreate(data, options) {
    const model = await getRekonSalesShopCheckModel();
    return model.bulkCreate(data, options);
  },
  async destroy(options) {
    const model = await getRekonSalesShopCheckModel();
    return model.destroy(options);
  },
  async count(options) {
    const model = await getRekonSalesShopCheckModel();
    return model.count(options);
  },
  async upsert(data, options) {
    const model = await getRekonSalesShopCheckModel();
    return model.upsert(data, options);
  },
  async findOrCreate(options) {
    const model = await getRekonSalesShopCheckModel();
    return model.findOrCreate(options);
  },
  getModel() {
    return getRekonSalesShopCheckModel();
  },
};

export default RekonSalesShopCheckWrapper;
