import { DataTypes } from "sequelize";
import config from "../config/index.js";
const { resilientDb } = config;

// Lazy model definition
let HistAdjust = null;

/**
 * Get HistAdjust model instance
 * Uses lazy loading pattern similar to other models in the project
 */
const getHistAdjustModel = async () => {
  if (!HistAdjust) {
    const sequelize = await resilientDb.getDatabase();
    if (!sequelize) {
      throw new Error("Database connection not available");
    }

    HistAdjust = sequelize.define(
      "hist_adjust",
      {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true,
          comment: "Auto-increment primary key",
        },
        kdtk: {
          type: DataTypes.STRING(10),
          allowNull: false,
          comment: "Store code",
        },
        prdcd: {
          type: DataTypes.STRING(20),
          allowNull: false,
          comment: "Product code (barcode)",
        },
        qty_adj: {
          type: DataTypes.INTEGER,
          allowNull: false,
          comment: "Adjustment quantity (positive/negative)",
        },
        keter: {
          type: DataTypes.TEXT,
          allowNull: true,
          comment: "Adjustment description/reason",
        },
        note: {
          type: DataTypes.TEXT,
          allowNull: true,
          comment: "Result note - success/failure message",
        },
        pic: {
          type: DataTypes.STRING(50),
          allowNull: false,
          comment: "Username of the user who performed the adjustment",
        },
        updtime: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW,
          comment: "Execution timestamp",
        },
        status: {
          type: DataTypes.ENUM("SUCCESS", "FAILED"),
          allowNull: false,
          comment: "Adjustment attempt status",
        },
      },
      {
        tableName: "hist_adjust",
        timestamps: false,
        indexes: [
          {
            fields: ["kdtk"],
          },
          {
            fields: ["pic"],
          },
          {
            fields: ["updtime"],
          },
          {
            fields: ["status"],
          },
          {
            fields: ["kdtk", "updtime"],
          },
        ],
        comment: "History log for store adjustment attempts",
      }
    );
  }

  return HistAdjust;
};

// Export wrapper object with common Sequelize model methods
const HistAdjustModel = {
  /**
   * Find all records with options
   */
  findAll: async (options = {}) => {
    const model = await getHistAdjustModel();
    return model.findAll(options);
  },

  /**
   * Create a new record
   */
  create: async data => {
    const model = await getHistAdjustModel();
    return model.create(data);
  },

  /**
   * Bulk create records
   */
  bulkCreate: async (data, options = {}) => {
    const model = await getHistAdjustModel();
    return model.bulkCreate(data, options);
  },

  /**
   * Find one record
   */
  findOne: async (options = {}) => {
    const model = await getHistAdjustModel();
    return model.findOne(options);
  },

  /**
   * Count records
   */
  count: async (options = {}) => {
    const model = await getHistAdjustModel();
    return model.count(options);
  },

  /**
   * Get the actual Sequelize model instance
   */
  getModel: getHistAdjustModel,
};

export default HistAdjustModel;
