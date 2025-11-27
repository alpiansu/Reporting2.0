import { DataTypes } from "sequelize";
import config from "../../../config/index.js";
import logger from "../../../config/logger.js";

const { resilientDb } = config;

let RekonSales = null;

const getRekonSalesModel = async () => {
  try {
    if (!RekonSales) {
      const sequelize = await resilientDb.getDatabase();
      if (!sequelize) {
        throw new Error("Database connection not available");
      }

      RekonSales = sequelize.define(
        "rekon_sales",
        {
          RECID: {
            field: "recid",
            type: DataTypes.CHAR(1),
            allowNull: false,
            defaultValue: "*",
            comment: "* = has issues, 1 = resolved",
          },
          CAB: {
            field: "cab",
            type: DataTypes.CHAR(4),
            allowNull: false,
          },
          KDTK: {
            field: "kdtk",
            type: DataTypes.CHAR(4),
            primaryKey: true,
            allowNull: false,
          },
          TGL: {
            field: "tgl",
            type: DataTypes.DATEONLY,
            primaryKey: true,
            allowNull: false,
          },
          NET_TOKO: {
            field: "net_toko",
            type: DataTypes.DECIMAL(20, 2),
            allowNull: true,
            defaultValue: 0,
          },
          NET_GL: {
            field: "NET_GL",
            type: DataTypes.DECIMAL(20, 2),
            allowNull: true,
            defaultValue: 0,
          },
          NET_CLOSINGDETAIL: {
            field: "NET_CLOSINGDETAIL",
            type: DataTypes.DECIMAL(20, 2),
            allowNull: true,
            defaultValue: 0,
          },
          SEL_NET_GL: {
            field: "SEL_NET_GL",
            type: DataTypes.DECIMAL(20, 2),
            allowNull: true,
            defaultValue: 0,
          },
          SEL_NET_CD: {
            field: "SEL_NET_CD",
            type: DataTypes.DECIMAL(20, 2),
            allowNull: true,
            defaultValue: 0,
          },
          PPN_MTRAN: {
            field: "PPN_MTRAN",
            type: DataTypes.DECIMAL(20, 2),
            allowNull: true,
            defaultValue: 0,
          },
          PPN_GL: {
            field: "PPN_GL",
            type: DataTypes.DECIMAL(20, 2),
            allowNull: true,
            defaultValue: 0,
          },
          PPN_CD: {
            field: "PPN_CD",
            type: DataTypes.DECIMAL(20, 2),
            allowNull: true,
            defaultValue: 0,
          },
          SEL_PPN_GL: {
            field: "SEL_PPN_GL",
            type: DataTypes.DECIMAL(20, 2),
            allowNull: true,
            defaultValue: 0,
          },
          SEL_PPN_CD: {
            field: "SEL_PPN_CD",
            type: DataTypes.DECIMAL(20, 2),
            allowNull: true,
            defaultValue: 0,
          },
          NET_RETUR_ECOM: {
            field: "NET_RETUR_ECOM",
            type: DataTypes.DECIMAL(20, 2),
            allowNull: true,
            defaultValue: 0,
          },
          PPN_RETUR_ECOM: {
            field: "PPN_RETUR_ECOM",
            type: DataTypes.DECIMAL(20, 2),
            allowNull: true,
            defaultValue: 0,
          },
          RETUR_PPNJP_ISTORE: {
            field: "RETUR_PPNJP_ISTORE",
            type: DataTypes.DECIMAL(20, 2),
            allowNull: true,
            defaultValue: 0,
          },
          UPDTIME: {
            field: "UPDTIME",
            type: DataTypes.DATE,
            allowNull: true,
            defaultValue: DataTypes.NOW,
          },
        },
        {
          tableName: "rekon_sales",
          timestamps: false,
          freezeTableName: true,
          indexes: [
            {
              name: "idx_rekon_sales_recid",
              fields: ["RECID"],
            },
            {
              name: "idx_rekon_sales_cab_date",
              fields: ["CAB", "TANGGAL"],
            },
            {
              name: "idx_rekon_sales_shop",
              fields: ["SHOP"],
            },
          ],
        }
      );
    }
    return RekonSales;
  } catch (error) {
    logger.error(`[rekon_sales.model] Error: ${error.message}`);
    throw error;
  }
};

// Wrapper with async methods
const RekonSalesWrapper = {
  async findAll(options) {
    const model = await getRekonSalesModel();
    return model.findAll(options);
  },
  async findOne(options) {
    const model = await getRekonSalesModel();
    return model.findOne(options);
  },
  async findByPk(pk, options) {
    const model = await getRekonSalesModel();
    return model.findByPk(pk, options);
  },
  async create(data, options) {
    const model = await getRekonSalesModel();
    return model.create(data, options);
  },
  async bulkCreate(data, options) {
    const model = await getRekonSalesModel();
    return model.bulkCreate(data, options);
  },
  async update(data, options) {
    const model = await getRekonSalesModel();
    return model.update(data, options);
  },
  async destroy(options) {
    const model = await getRekonSalesModel();
    return model.destroy(options);
  },
  async upsert(data, options) {
    const model = await getRekonSalesModel();
    return model.upsert(data, options);
  },
  getModel() {
    return getRekonSalesModel();
  },
};

export default RekonSalesWrapper;
