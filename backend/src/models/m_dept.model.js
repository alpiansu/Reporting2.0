const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const MDept = sequelize.define(
  "MDept",
  {
    dep_kd: {
      type: DataTypes.STRING(10),
      allowNull: false,
      primaryKey: true,
    },
    dep_nm: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    div_kd: {
      type: DataTypes.STRING(10),
      allowNull: false,
    },
    dep_mgr: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
  },
  {
    tableName: "m_dept",
    timestamps: false,
  }
);

module.exports = MDept;