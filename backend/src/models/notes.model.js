import { DataTypes } from "sequelize";
import config from "../config/index.js";
import logger from "../config/logger.js";
const { resilientDb } = config;

let NotesEdp = null;

// Create a wrapper with async model getter
const getNotesEdpModel = async () => {
  try {
    if (!NotesEdp) {
      const sequelize = await resilientDb.getDatabase();
      if (!sequelize) {
        throw new Error("Database connection not available");
      }

      NotesEdp = sequelize.define(
        "NotesEdp",
        {
          Cabang: {
            type: DataTypes.STRING(4),
            allowNull: false,
            field: "cabang",
          },
          tableName: {
            type: DataTypes.STRING(50),
            allowNull: false,
            field: "table_name",
            primaryKey: true,
          },
          unixKey: {
            type: DataTypes.STRING(125),
            allowNull: false,
            primaryKey: true,
            field: "unix_key",
          },
          noteText: {
            type: DataTypes.TEXT,
            allowNull: false,
            field: "note_text",
          },
          pic: {
            type: DataTypes.STRING(50),
            allowNull: false,
          },
          categoryId: {
            type: DataTypes.INTEGER,
            allowNull: true,
            field: "category_id",
          },
        },
        {
          tableName: "notes_edp",
          timestamps: true,
          freezeTableName: true,
          underscored: false,
          createdAt: "created_at",
          updatedAt: "updated_at",
          indexes: [
            {
              name: "idx_saldovirtual_key",
              fields: ["cabang", "unix_key"],
            },
            {
              name: "idx_saldovirtual_table_name",
              fields: ["table_name"],
            },
          ],
        }
      );
    }
    return NotesEdp;
  } catch (error) {
    logger.error(`Error syncing NotesEdp model: ${error.message}`);
    throw error;
  }
};

// Create a wrapper object with async methods
const NotesEdpWrapper = {
  async findAll(options) {
    const model = await getNotesEdpModel();
    return model.findAll(options);
  },
  async findOne(options) {
    const model = await getNotesEdpModel();
    return model.findOne(options);
  },
  async findByPk(pk, options) {
    const model = await getNotesEdpModel();
    return model.findByPk(pk, options);
  },
  async create(data, options) {
    const model = await getNotesEdpModel();
    return model.create(data, options);
  },
  async update(data, options) {
    const model = await getNotesEdpModel();
    return model.update(data, options);
  },
  async destroy(options) {
    const model = await getNotesEdpModel();
    return model.destroy(options);
  },
  async count(options) {
    const model = await getNotesEdpModel();
    return model.count(options);
  },
  async bulkCreate(data, options) {
    const model = await getNotesEdpModel();
    return model.bulkCreate(data, options);
  },
  async upsert(data, options) {
    const model = await getNotesEdpModel();
    return model.upsert(data, options);
  },
  async findOrCreate(options) {
    const model = await getNotesEdpModel();
    return model.findOrCreate(options);
  },
  // Add getModel method for registry compatibility
  getModel() {
    return getNotesEdpModel();
  },
};

export default NotesEdpWrapper;
