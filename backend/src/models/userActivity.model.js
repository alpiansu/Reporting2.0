import { DataTypes } from "sequelize";
import config from "../config/index.js";
import logger from "../config/logger.js";
const { resilientDb } = config;

let UserActivity = null;
let _userActivitySequelizeInstance = null;

const getUserActivityModel = async () => {
  try {
    const sequelize = await resilientDb.getDatabase();
    if (!sequelize) {
      throw new Error("Database connection not available");
    }

    if (!UserActivity || _userActivitySequelizeInstance !== sequelize) {
      _userActivitySequelizeInstance = sequelize;
      UserActivity = sequelize.define(
        "UserActivity",
        {
          id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
          },
          userId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
              model: "users",
              key: "id",
            },
          },
          type: {
            type: DataTypes.STRING,
            allowNull: false,
            comment: "Type of activity: login, logout, profile, password, security, etc.",
          },
          description: {
            type: DataTypes.STRING,
            allowNull: false,
          },
          ipAddress: {
            type: DataTypes.STRING,
            allowNull: true,
          },
          userAgent: {
            type: DataTypes.STRING,
            allowNull: true,
          },
          location: {
            type: DataTypes.STRING,
            allowNull: true,
          },
          metadata: {
            type: DataTypes.JSON,
            allowNull: true,
            comment: "Additional data related to the activity",
          },
          createdAt: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW,
          },
        },
        {
          tableName: "user_activities",
          timestamps: true,
          updatedAt: false,
          underscored: true,
        },
      );
    }
    return UserActivity;
  } catch (error) {
    logger.error(`Error syncing UserActivity model: ${error.message}`);
    throw error;
  }
};

const UserActivityWrapper = {
  async findAll(options) {
    const model = await getUserActivityModel();
    return model.findAll(options);
  },
  async findOne(options) {
    const model = await getUserActivityModel();
    return model.findOne(options);
  },
  async findByPk(pk, options) {
    const model = await getUserActivityModel();
    return model.findByPk(pk, options);
  },
  async create(data, options) {
    const model = await getUserActivityModel();
    return model.create(data, options);
  },
  async update(data, options) {
    const model = await getUserActivityModel();
    return model.update(data, options);
  },
  async destroy(options) {
    const model = await getUserActivityModel();
    return model.destroy(options);
  },
  async count(options) {
    const model = await getUserActivityModel();
    return model.count(options);
  },
  async bulkCreate(data, options) {
    const model = await getUserActivityModel();
    return model.bulkCreate(data, options);
  },
  async upsert(data, options) {
    const model = await getUserActivityModel();
    return model.upsert(data, options);
  },
  async findOrCreate(options) {
    const model = await getUserActivityModel();
    return model.findOrCreate(options);
  },
  getModel() {
    return getUserActivityModel();
  },
};

export default UserActivityWrapper;
