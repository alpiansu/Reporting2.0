import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const SalesPerDept = sequelize.define(
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
  }
);

export default SalesPerDept;
