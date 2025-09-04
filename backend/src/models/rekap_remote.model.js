/**
 * Model for storing remote connection recap data
 *
 * @swagger
 * components:
 *   schemas:
 *     RekapRemote:
 *       type: object
 *       required:
 *         - cab
 *         - kdtk
 *         - module_name
 *       properties:
 *         cab:
 *           type: string
 *           maxLength: 4
 *           description: Branch code (4 characters)
 *         kdtk:
 *           type: string
 *           maxLength: 4
 *           description: Store code (4 characters)
 *         module_name:
 *           type: string
 *           maxLength: 50
 *           description: Module name that performed the remote connection
 *         status:
 *           type: string
 *           description: Connection status (success, timeout, error, etc.)
 *         updtime:
 *           type: string
 *           format: date-time
 *           description: Last update timestamp
 */

const { DataTypes } = require("sequelize");
const moment = require("moment-timezone");
const { sequelize } = require("../config/database");

const RekapRemote = sequelize.define(
  "rekap_remote",
  {
    cab: {
      type: DataTypes.CHAR(4),
      primaryKey: true,
      allowNull: false,
      comment: "Kode cabang (4 karakter)",
    },
    kdtk: {
      type: DataTypes.CHAR(4),
      primaryKey: true,
      allowNull: false,
      comment: "Kode toko (4 karakter)",
    },
    module_name: {
      type: DataTypes.STRING(50),
      primaryKey: true,
      allowNull: false,
      comment: "Nama module yang melakukan koneksi remote",
    },
    status: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Status koneksi (success, timeout, error, dll)",
    },
  },
  {
    tableName: "rekap_remote",
    timestamps: true, // We handle timestamps manually with updtime
    indexes: [
      {
        name: "idx_rekap_remote_kdtk",
        fields: ["kdtk"],
      },
      {
        name: "idx_rekap_remote_module",
        fields: ["module_name"],
      },
      {
        name: "idx_rekap_remote_updtime",
        fields: ["updtime"],
      },
    ],
  }
);

module.exports = RekapRemote;
