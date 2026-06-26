import { DataTypes } from "sequelize";
import config from "../config/index.js";
import logger from "../config/logger.js";
const { resilientDb } = config;

let SalesPerDept = null;
let _salesPerDeptSequelizeInstance = null;

const getSalesPerDeptModel = async () => {
  try {
    const sequelize = await resilientDb.getDatabase();
    if (!sequelize) {
      throw new Error("Database connection not available");
    }

    if (!SalesPerDept || _salesPerDeptSequelizeInstance !== sequelize) {
      _salesPerDeptSequelizeInstance = sequelize;
      SalesPerDept = sequelize.define(
        "SalesPerDept",
        {
          cab: {
            type: DataTypes.CHAR(4),
            allowNull: false,
            primaryKey: true,
          },
          periode: {
            type: DataTypes.CHAR(4),
            allowNull: false,
            primaryKey: true,
          },
          tipestore: {
            type: DataTypes.CHAR(3),
            allowNull: false,
            primaryKey: true,
          },
          dep_kd: {
            type: DataTypes.STRING(10),
            allowNull: false,
            primaryKey: true,
          },
          dep_name: {
            type: DataTypes.STRING(255),
            allowNull: false,
          },
          qty_sales: {
            type: DataTypes.INTEGER,
            allowNull: false,
          },
          total_sales: {
            type: DataTypes.DECIMAL(15, 2),
            allowNull: false,
          },
          total_hpp: {
            type: DataTypes.DECIMAL(15, 2),
            allowNull: false,
          },
          margin_rp: {
            type: DataTypes.DECIMAL(15, 2),
            allowNull: false,
          },
          margin_percent: {
            type: DataTypes.DECIMAL(5, 2),
            allowNull: false,
          },
          harga_jual_per_pcs: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
          },
          hpp_per_pcs: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
          },
          created_at: {
            type: DataTypes.DATE,
            allowNull: true,
            defaultValue: DataTypes.NOW,
          },
          updated_at: {
            type: DataTypes.DATE,
            allowNull: true,
            defaultValue: DataTypes.NOW,
          },
        },
        {
          tableName: "sales_per_dept",
          timestamps: true,
          createdAt: "created_at",
          updatedAt: "updated_at",
          underscored: true,
        },
      );
    }
    return SalesPerDept;
  } catch (error) {
    logger.error(`Error syncing SalesPerDept model: ${error.message}`);
    throw error;
  }
};

const SalesPerDeptWrapper = {
  async findAll(options) {
    const model = await getSalesPerDeptModel();
    return model.findAll(options);
  },
  async findOne(options) {
    const model = await getSalesPerDeptModel();
    return model.findOne(options);
  },
  async findByPk(pk, options) {
    const model = await getSalesPerDeptModel();
    return model.findByPk(pk, options);
  },
  async create(data, options) {
    const model = await getSalesPerDeptModel();
    return model.create(data, options);
  },
  async update(data, options) {
    const model = await getSalesPerDeptModel();
    return model.update(data, options);
  },
  async destroy(options) {
    const model = await getSalesPerDeptModel();
    return model.destroy(options);
  },
  async count(options) {
    const model = await getSalesPerDeptModel();
    return model.count(options);
  },
  async bulkCreate(data, options) {
    const model = await getSalesPerDeptModel();
    return model.bulkCreate(data, options);
  },
  async upsert(data, options) {
    const model = await getSalesPerDeptModel();
    return model.upsert(data, options);
  },
  async findOrCreate(options) {
    const model = await getSalesPerDeptModel();
    return model.findOrCreate(options);
  },
  getModel() {
    return getSalesPerDeptModel();
  },
};

export default SalesPerDeptWrapper;
