import { DataTypes } from "sequelize";
import config from "../../../config/index.js";
import logger from "../../../config/logger.js";

const { resilientDb } = config;

let DetailRekonSales = null;

const getDetailRekonSalesModel = async () => {
  try {
    if (!DetailRekonSales) {
      const sequelize = await resilientDb.getDatabase();
      if (!sequelize) {
        throw new Error("Database connection not available");
      }

      DetailRekonSales = sequelize.define(
        "detail_rekon_sales",
        {
          RECID: {
            field: "RECID",
            type: DataTypes.CHAR(1),
            allowNull: false,
            defaultValue: "*",
            comment: "* = has issues, 1 = resolved",
          },
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
          TGL: {
            field: "TGL",
            type: DataTypes.DATEONLY,
            primaryKey: true,
            allowNull: false,
          },
          SUBKEY: {
            field: "SUBKEY",
            type: DataTypes.STRING(50),
            primaryKey: true,
            allowNull: false,
            comment: "SEL_KODEPESANAN, etc.",
          },
          VALSUBKEY: {
            field: "VALSUBKEY",
            type: DataTypes.STRING(100),
            allowNull: true,
            comment: "Value of the issue (e.g., missing kode pesanan)",
          },
        },
        {
          tableName: "detail_rekon_sales",
          timestamps: false,
          freezeTableName: true,
          indexes: [
            {
              name: "idx_detail_rekon_recid",
              fields: ["RECID"],
            },
            {
              name: "idx_detail_rekon_kdtk_tgl",
              fields: ["KDTK", "TGL"],
            },
          ],
        }
      );
    }
    return DetailRekonSales;
  } catch (error) {
    logger.error(`[detail_rekon_sales.model] Error: ${error.message}`);
    throw error;
  }
};

// Wrapper with async methods
const DetailRekonSalesWrapper = {
  async findAll(options) {
    const model = await getDetailRekonSalesModel();
    return model.findAll(options);
  },
  async findOne(options) {
    const model = await getDetailRekonSalesModel();
    return model.findOne(options);
  },
  async create(data, options) {
    const model = await getDetailRekonSalesModel();
    return model.create(data, options);
  },
  async bulkCreate(data, options) {
    const model = await getDetailRekonSalesModel();
    return model.bulkCreate(data, options);
  },
  async update(data, options) {
    const model = await getDetailRekonSalesModel();
    return model.update(data, options);
  },
  async destroy(options) {
    const model = await getDetailRekonSalesModel();
    return model.destroy(options);
  },
  getModel() {
    return getDetailRekonSalesModel();
  },
};

export default DetailRekonSalesWrapper;
