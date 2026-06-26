import { DataTypes } from "sequelize";
import config from "../../config/index.js";
import logger from "../../config/logger.js";
const { resilientDb } = config;

let NoteCategories = null;
let _noteCategoriesSequelizeInstance = null;

const getNotesCategoriesModel = async () => {
  try {
    const sequelize = await resilientDb.getDatabase();
    if (!sequelize) {
      throw new Error("Database connection not available");
    }

    if (!NoteCategories || _noteCategoriesSequelizeInstance !== sequelize) {
      _noteCategoriesSequelizeInstance = sequelize;
      NoteCategories = sequelize.define(
        "NoteCategories",
        {
          id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
          },
          name: {
            type: DataTypes.STRING(50),
            allowNull: false,
            field: "name",
          },
          description: {
            type: DataTypes.STRING(255),
            allowNull: true,
            field: "description",
          },
          moduleName: {
            type: DataTypes.STRING(75),
            allowNull: false,
            field: "module_name",
          },
        },
        {
          tableName: "note_categories",
          timestamps: true,
          freezeTableName: true,
          underscored: false,
          createdAt: "created_at",
          updatedAt: "updated_at",
          indexes: [
            {
              name: "idx_note_categories_name",
              fields: ["name"],
              unique: true,
            },
          ],
        },
      );
    }
    return NoteCategories;
  } catch (error) {
    logger.error(`Error syncing NoteCategories model: ${error.message}`);
    throw error;
  }
};

const NoteCategoriesWrapper = {
  async findAll(options) {
    const model = await getNotesCategoriesModel();
    return model.findAll(options);
  },
  async findOne(options) {
    const model = await getNotesCategoriesModel();
    return model.findOne(options);
  },
  async findByPk(pk, options) {
    const model = await getNotesCategoriesModel();
    return model.findByPk(pk, options);
  },
  async create(data, options) {
    const model = await getNotesCategoriesModel();
    return model.create(data, options);
  },
  async update(data, options) {
    const model = await getNotesCategoriesModel();
    return model.update(data, options);
  },
  async destroy(options) {
    const model = await getNotesCategoriesModel();
    return model.destroy(options);
  },
  async count(options) {
    const model = await getNotesCategoriesModel();
    return model.count(options);
  },
  async bulkCreate(data, options) {
    const model = await getNotesCategoriesModel();
    return model.bulkCreate(data, options);
  },
  async upsert(data, options) {
    const model = await getNotesCategoriesModel();
    return model.upsert(data, options);
  },
  async findOrCreate(options) {
    const model = await getNotesCategoriesModel();
    return model.findOrCreate(options);
  },
  getModel() {
    return getNotesCategoriesModel();
  },
};

export default NoteCategoriesWrapper;
