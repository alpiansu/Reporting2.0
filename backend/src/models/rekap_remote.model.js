import { DataTypes, Sequelize } from "sequelize";
import config from "../config/index.js";
import logger from "../config/logger.js";
const { resilientDb } = config;

let RekapRemote = null;
let _rekapRemoteSequelizeInstance = null;

const getRekapRemoteModel = async () => {
  try {
    const sequelize = await resilientDb.getDatabase();
    if (!sequelize) {
      throw new Error("Database connection not available");
    }

    if (!RekapRemote || _rekapRemoteSequelizeInstance !== sequelize) {
      _rekapRemoteSequelizeInstance = sequelize;
      RekapRemote = sequelize.define(
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
          message: {
            type: DataTypes.TEXT,
            allowNull: true,
            comment: "Pesan detail / error message",
          },
          updtime: {
            type: "TIMESTAMP",
            allowNull: false,
            defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
            onUpdate: Sequelize.literal("CURRENT_TIMESTAMP"),
            comment: "Waktu update terakhir",
          },
        },
        {
          tableName: "rekap_remote",
          timestamps: false,
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
        },
      );
    }
    return RekapRemote;
  } catch (error) {
    logger.error(`Error syncing RekapRemote model: ${error.message}`);
    throw error;
  }
};

const RekapRemoteWrapper = {
  async findAll(options) {
    const model = await getRekapRemoteModel();
    return model.findAll(options);
  },
  async findOne(options) {
    const model = await getRekapRemoteModel();
    return model.findOne(options);
  },
  async findByPk(pk, options) {
    const model = await getRekapRemoteModel();
    return model.findByPk(pk, options);
  },
  async create(data, options) {
    const model = await getRekapRemoteModel();
    return model.create(data, options);
  },
  async update(data, options) {
    const model = await getRekapRemoteModel();
    return model.update(data, options);
  },
  async destroy(options) {
    const model = await getRekapRemoteModel();
    return model.destroy(options);
  },
  async count(options) {
    const model = await getRekapRemoteModel();
    return model.count(options);
  },
  async bulkCreate(data, options) {
    const model = await getRekapRemoteModel();
    return model.bulkCreate(data, options);
  },
  async upsert(data, options) {
    const model = await getRekapRemoteModel();
    return model.upsert(data, options);
  },
  async findOrCreate(options) {
    const model = await getRekapRemoteModel();
    return model.findOrCreate(options);
  },
  getModel() {
    return getRekapRemoteModel();
  },
};

export default RekapRemoteWrapper;
