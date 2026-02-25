import { DataTypes } from "sequelize";
import config from "../config/index.js";
import logger from "../config/logger.js";
const { resilientDb } = config;

let SaldoRekonPersediaan = null;

const getSaldoRekonPersediaanModel = async () => {
  try {
    if (!SaldoRekonPersediaan) {
      const sequelize = await resilientDb.getDatabase();
      if (!sequelize) {
        throw new Error("Database connection not available");
      }

      SaldoRekonPersediaan = sequelize.define(
        "saldorekonpersediaan",
        {
          RECID: {
            type: DataTypes.STRING(1),
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
          // Store Values
          HPP_DRY_STORE: {
            type: DataTypes.DECIMAL(18, 2),
            allowNull: true,
          },
          HPP_ISTORE_STORE: {
            type: DataTypes.DECIMAL(18, 2),
            allowNull: true,
          },
          HPP_RESTO_STORE: {
            type: DataTypes.DECIMAL(18, 2),
            allowNull: true,
          },
          HPP_VIRTUAL_STORE: {
            type: DataTypes.DECIMAL(18, 2),
            allowNull: true,
          },
          HPP_SPC_STORE_STORE: {
            type: DataTypes.DECIMAL(18, 2),
            allowNull: true,
          },
          // WRC Values
          HPP_DRY_WRC: {
            type: DataTypes.DECIMAL(18, 2),
            allowNull: true,
          },
          HPP_ISTORE_WRC: {
            type: DataTypes.DECIMAL(18, 2),
            allowNull: true,
          },
          HPP_RESTO_WRC: {
            type: DataTypes.DECIMAL(18, 2),
            allowNull: true,
          },
          HPP_VIRTUAL_WRC: {
            type: DataTypes.DECIMAL(18, 2),
            allowNull: true,
          },
          HPP_SPC_STORE_WRC: {
            type: DataTypes.DECIMAL(18, 2),
            allowNull: true,
          },
          // Differences
          SELISIH_DRY: {
            type: DataTypes.DECIMAL(18, 2),
            allowNull: true,
          },
          SELISIH_ISTORE: {
            type: DataTypes.DECIMAL(18, 2),
            allowNull: true,
          },
          SELISIH_RESTO: {
            type: DataTypes.DECIMAL(18, 2),
            allowNull: true,
          },
          SELISIH_VIRTUAL: {
            type: DataTypes.DECIMAL(18, 2),
            allowNull: true,
          },
          SELISIH_SPC: {
            type: DataTypes.DECIMAL(18, 2),
            allowNull: true,
          },
          LASTCATCH: {
            type: DataTypes.DATE,
            allowNull: true,
            defaultValue: DataTypes.NOW,
          },
        },
        {
          tableName: "saldo_rekon_persediaan",
          timestamps: false,
          freezeTableName: true,
          underscored: false,
          indexes: [
            {
              name: "idx_saldorekonpersediaan_cabang_tanggal",
              fields: ["CABANG", "TANGGAL"],
            },
            {
              name: "idx_saldorekonpersediaan_shop",
              fields: ["SHOP"],
            },
          ],
        }
      );
    }
    return SaldoRekonPersediaan;
  } catch (error) {
    logger.error(`Error syncing SaldoRekonPersediaan model: ${error.message}`);
    throw error;
  }
};

const SaldoRekonPersediaanWrapper = {
  async findAll(options) {
    const model = await getSaldoRekonPersediaanModel();
    return model.findAll(options);
  },
  async findOne(options) {
    const model = await getSaldoRekonPersediaanModel();
    return model.findOne(options);
  },
  async count(options) {
    const model = await getSaldoRekonPersediaanModel();
    return model.count(options);
  },
  async bulkCreate(data, options) {
    const model = await getSaldoRekonPersediaanModel();
    return model.bulkCreate(data, options);
  },
  async destroy(options) {
    const model = await getSaldoRekonPersediaanModel();
    return model.destroy(options);
  },
  getModel() {
    return getSaldoRekonPersediaanModel();
  },
};

export default SaldoRekonPersediaanWrapper;
