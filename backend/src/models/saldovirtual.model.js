import { DataTypes } from "sequelize";
import config from "../config/index.js";
import logger from "../config/logger.js";
const { resilientDb } = config;

let SaldoVirtual = null;

// Create a wrapper with async model getter
const getSaldoVirtualModel = async () => {
  try {
    if (!SaldoVirtual) {
      const sequelize = await resilientDb.getDatabase();
      if (!sequelize) {
        throw new Error("Database connection not available");
      }

      SaldoVirtual = sequelize.define(
        "saldovirtual",
        {
          RECID: {
            type: DataTypes.STRING(1),
            primaryKey: false,
            allowNull: false,
            defaultValue: "*",
          },
          CABANG: {
            type: DataTypes.STRING(4),
            primaryKey: true,
            allowNull: false,
          },
          SHOP: {
            type: DataTypes.STRING(4),
            primaryKey: true,
            allowNull: false,
          },
          TANGGAL: {
            type: DataTypes.DATEONLY,
            primaryKey: true,
            allowNull: false,
          },
          PRDCD: {
            type: DataTypes.STRING(8),
            primaryKey: true,
            allowNull: false,
          },
          SINGKATAN: {
            type: DataTypes.STRING(75),
            allowNull: true,
          },
          ACOST: {
            type: DataTypes.DECIMAL(15, 6),
            allowNull: true,
          },
          PRICE: {
            type: DataTypes.DECIMAL(15, 6),
            allowNull: true,
          },
          QTY_MSTRAN: {
            type: DataTypes.DECIMAL(9, 0),
            allowNull: true,
          },
          QTY_MTRAN: {
            type: DataTypes.DECIMAL(9, 0),
            allowNull: true,
          },
          SEL: {
            type: DataTypes.DECIMAL(9, 0),
            allowNull: true,
          },
          LASTCATCH: {
            type: DataTypes.DATE,
            allowNull: true,
          },
        },
        {
          tableName: "saldo_virtual",
          timestamps: false,
          freezeTableName: true,
          underscored: false,
          indexes: [
            {
              name: "idx_saldovirtual_cabang_tanggal",
              fields: ["CABANG", "TANGGAL"],
            },
            {
              name: "idx_saldovirtual_shop_prdcd",
              fields: ["SHOP", "PRDCD"],
            },
          ],
        }
      );
    }
    return SaldoVirtual;
  } catch (error) {
    logger.error(`Error syncing SaldoVirtual model: ${error.message}`);
    throw error;
  }
};

// Create a wrapper object with async methods
const SaldoVirtualWrapper = {
  async findAll(options) {
    const model = await getSaldoVirtualModel();
    return model.findAll(options);
  },
  async findOne(options) {
    const model = await getSaldoVirtualModel();
    return model.findOne(options);
  },
  async findByPk(pk, options) {
    const model = await getSaldoVirtualModel();
    return model.findByPk(pk, options);
  },
  async create(data, options) {
    const model = await getSaldoVirtualModel();
    return model.create(data, options);
  },
  async update(data, options) {
    const model = await getSaldoVirtualModel();
    return model.update(data, options);
  },
  async destroy(options) {
    const model = await getSaldoVirtualModel();
    return model.destroy(options);
  },
  async count(options) {
    const model = await getSaldoVirtualModel();
    return model.count(options);
  },
  async bulkCreate(data, options) {
    const model = await getSaldoVirtualModel();
    return model.bulkCreate(data, options);
  },
  async upsert(data, options) {
    const model = await getSaldoVirtualModel();
    return model.upsert(data, options);
  },
  async findOrCreate(options) {
    const model = await getSaldoVirtualModel();
    return model.findOrCreate(options);
  },
  // Add getModel method for registry compatibility
  getModel() {
    return getSaldoVirtualModel();
  },
};

export default SaldoVirtualWrapper;
