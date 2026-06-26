import { DataTypes } from "sequelize";
import config from "../../../config/index.js";
import logger from "../../../config/logger.js";
const { resilientDb } = config;

let MtranVsCd = null;
let _mtranVsCdSequelizeInstance = null;

const getMtranVsCdModel = async () => {
  try {
    const sequelize = await resilientDb.getDatabase();
    if (!sequelize) {
      throw new Error("Database connection not available");
    }

    if (!MtranVsCd || _mtranVsCdSequelizeInstance !== sequelize) {
      _mtranVsCdSequelizeInstance = sequelize;
      MtranVsCd = sequelize.define(
        "mtran_vs_cd",
        {
          CAB: {
            field: "CAB",
            type: DataTypes.CHAR(4),
            allowNull: false,
          },
          SHOP: {
            field: "SHOP",
            type: DataTypes.CHAR(4),
            primaryKey: true,
            allowNull: false,
          },
          TANGGAL: {
            field: "TANGGAL",
            type: DataTypes.DATEONLY,
            primaryKey: true,
            allowNull: false,
          },
          DOCNO: {
            field: "DOCNO",
            type: DataTypes.STRING(20),
            primaryKey: true,
            allowNull: false,
          },
          SEQNO: {
            field: "SEQNO",
            type: DataTypes.INTEGER,
            primaryKey: true,
            allowNull: false,
          },
          PLU: {
            field: "PLU",
            type: DataTypes.STRING(20),
            allowNull: true,
          },
          SINGKATAN: {
            field: "SINGKATAN",
            type: DataTypes.STRING(100),
            allowNull: true,
          },
          QTY: {
            field: "QTY",
            type: DataTypes.DECIMAL(20, 2),
            allowNull: true,
          },
          PRICE: {
            field: "PRICE",
            type: DataTypes.DECIMAL(20, 2),
            allowNull: true,
          },
          GROSS: {
            field: "GROSS",
            type: DataTypes.DECIMAL(20, 2),
            allowNull: true,
          },
          HPP: {
            field: "HPP",
            type: DataTypes.DECIMAL(20, 2),
            allowNull: true,
          },
          SELISIH: {
            field: "SELISIH",
            type: DataTypes.DECIMAL(20, 2),
            allowNull: true,
          },
          RTYPE: {
            field: "RTYPE",
            type: DataTypes.CHAR(1),
            allowNull: true,
          },
          ISPPN: {
            field: "ISPPN",
            type: DataTypes.CHAR(1),
            allowNull: true,
          },
          MONTH: {
            field: "MONTH",
            type: DataTypes.CHAR(2),
            allowNull: false,
          },
          YEAR: {
            field: "YEAR",
            type: DataTypes.CHAR(4),
            allowNull: false,
          },
        },
        {
          tableName: "mtran_vs_cd",
          timestamps: false,
          freezeTableName: true,
          indexes: [
            {
              name: "idx_mtran_vs_cd_shop_date",
              fields: ["SHOP", "TANGGAL"],
            },
            {
              name: "idx_mtran_vs_cd_month_year",
              fields: ["MONTH", "YEAR"],
            },
          ],
        },
      );
    }
    return MtranVsCd;
  } catch (error) {
    logger.error(`[mtran_vs_cd.model] Error: ${error.message}`);
    throw error;
  }
};

const MtranVsCdWrapper = {
  async findAll(options) {
    const model = await getMtranVsCdModel();
    return model.findAll(options);
  },
  async findOne(options) {
    const model = await getMtranVsCdModel();
    return model.findOne(options);
  },
  async findByPk(pk, options) {
    const model = await getMtranVsCdModel();
    return model.findByPk(pk, options);
  },
  async findAndCountAll(options) {
    const model = await getMtranVsCdModel();
    return model.findAndCountAll(options);
  },
  async create(data, options) {
    const model = await getMtranVsCdModel();
    return model.create(data, options);
  },
  async update(data, options) {
    const model = await getMtranVsCdModel();
    return model.update(data, options);
  },
  async bulkCreate(data, options) {
    const model = await getMtranVsCdModel();
    return model.bulkCreate(data, options);
  },
  async destroy(options) {
    const model = await getMtranVsCdModel();
    return model.destroy(options);
  },
  async count(options) {
    const model = await getMtranVsCdModel();
    return model.count(options);
  },
  async upsert(data, options) {
    const model = await getMtranVsCdModel();
    return model.upsert(data, options);
  },
  async findOrCreate(options) {
    const model = await getMtranVsCdModel();
    return model.findOrCreate(options);
  },
  getModel() {
    return getMtranVsCdModel();
  },
};

export default MtranVsCdWrapper;
