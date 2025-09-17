import { DataTypes } from 'sequelize';
import config from '../config/index.js';
const { resilientDb } = config;

// Lazy model definition
let UserActivity = null;

const getUserActivityModel = async () => {
  if (!UserActivity) {
    const sequelize = await resilientDb.getDatabase();
    if (!sequelize) {
      throw new Error('Database connection not available');
    }
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
        model: 'users',
        key: 'id'
      }
    },
    type: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'Type of activity: login, logout, profile, password, security, etc.'
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
      comment: 'Additional data related to the activity'
    },
    createdAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "user_activities",
    timestamps: true,
    updatedAt: false, // We only need createdAt for activities
    underscored: true,
  }
);
  }
  return UserActivity;
};

// Export wrapper that handles lazy loading
const UserActivityWrapper = {
  async findAll(options) {
    const model = await getUserActivityModel();
    return model.findAll(options);
  },
  async findOne(options) {
    const model = await getUserActivityModel();
    return model.findOne(options);
  },
  async findByPk(id, options) {
    const model = await getUserActivityModel();
    return model.findByPk(id, options);
  },
  async create(data) {
    const model = await getUserActivityModel();
    return model.create(data);
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
  }
};

export default UserActivityWrapper;