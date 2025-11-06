import { DataTypes } from "sequelize";
import config from "../../config/index.js";
import logger from "../../config/logger.js";
const { resilientDb } = config;

let SesuaiToko = null;

// Create a wrapper with async model getter
const getSesuaiTokoModel = async () => {
  try {
    if (!SesuaiToko) {
      const sequelize = await resilientDb.getDatabase();
      if (!sequelize) {
        throw new Error("Database connection not available");
      }

      SesuaiToko = sequelize.define(
        "sesuaitoko",
        {
          RECID: {
            type: DataTypes.CHAR(1),
            allowNull: false,
            defaultValue: "*",
            comment: "Tracking status: * = unresolved, 1 = resolved",
          },
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
          PRDCD: {
            type: DataTypes.STRING(8),
            primaryKey: true,
            allowNull: false,
          },
          SINGKATAN: {
            type: DataTypes.STRING(85),
            allowNull: true,
          },
          RECID_PRODMAST: {
            type: DataTypes.CHAR(1),
            allowNull: true,
            comment: "RECID from prodmast table in store",
          },
          PTAG: {
            type: DataTypes.CHAR(1),
            allowNull: true,
          },
          BEGBAL: {
            type: DataTypes.DECIMAL(20, 6),
            allowNull: true,
          },
          TRFIN: {
            type: DataTypes.DECIMAL(20, 6),
            allowNull: true,
          },
          TRFOUT: {
            type: DataTypes.DECIMAL(20, 6),
            allowNull: true,
          },
          RP_SALES: {
            type: DataTypes.DECIMAL(20, 6),
            allowNull: true,
          },
          RP_RETUR_SALES: {
            type: DataTypes.DECIMAL(20, 6),
            allowNull: true,
          },
          ADJ: {
            type: DataTypes.DECIMAL(20, 6),
            allowNull: true,
          },
          BA: {
            type: DataTypes.DECIMAL(20, 6),
            allowNull: true,
          },
          BS: {
            type: DataTypes.DECIMAL(20, 6),
            allowNull: true,
          },
          ACOST: {
            type: DataTypes.DECIMAL(20, 6),
            allowNull: true,
          },
          LCOST: {
            type: DataTypes.DECIMAL(20, 6),
            allowNull: true,
          },
          STOCK: {
            type: DataTypes.DECIMAL(20, 6),
            allowNull: true,
          },
          RP_STOCK: {
            type: DataTypes.DECIMAL(20, 6),
            allowNull: true,
          },
          SESUAI: {
            type: DataTypes.DECIMAL(20, 6),
            allowNull: true,
          },
          UPDTIME: {
            type: DataTypes.DATE,
            allowNull: true,
            defaultValue: DataTypes.NOW,
          },
        },
        {
          tableName: "sesuai_toko",
          timestamps: false,
          freezeTableName: true,
          underscored: false,
          indexes: [
            {
              name: "idx_sesuaitoko_recid",
              fields: ["RECID"],
            },
            {
              name: "idx_sesuaitoko_cabang_periode",
              fields: ["CABANG", "PERIODE"],
            },
            {
              name: "idx_sesuaitoko_kdtk_prdcd",
              fields: ["KDTK", "PRDCD"],
            },
          ],
        }
      );
    }
    return SesuaiToko;
  } catch (error) {
    logger.error(`Error syncing SesuaiToko model: ${error.message}`);
    throw error;
  }
};

// Create a wrapper object with async methods
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
  // Add getModel method for registry compatibility
  getModel() {
    return getSesuaiTokoModel();
  },
};

export default SesuaiTokoWrapper;
