import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const UserActivity = sequelize.define(
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

export default UserActivity;