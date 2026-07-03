import { DataTypes } from "sequelize";
import config from "../../config/index.js";
import logger from "../../config/logger.js";
const { resilientDb } = config;

let DthrFtpLog = null;
let _dthrFtpLogSequelize = null;

const getDthrFtpLogModel = async () => {
  try {
    const sequelize = await resilientDb.getDatabase();
    if (!sequelize) {
      throw new Error("Database connection not available");
    }

    if (!DthrFtpLog || _dthrFtpLogSequelize !== sequelize) {
      _dthrFtpLogSequelize = sequelize;
      DthrFtpLog = sequelize.define(
        "dthr_ftp_log",
        {
          id: {
            field: "id",
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
            allowNull: false,
          },
          kdtk: {
            field: "kdtk",
            type: DataTypes.STRING(10),
            allowNull: false,
          },
          kode_cab: {
            field: "kode_cab",
            type: DataTypes.STRING(10),
            allowNull: false,
          },
          tgl_transaksi: {
            field: "tgl_transaksi",
            type: DataTypes.DATEONLY,
            allowNull: false,
          },
          nama_file: {
            field: "nama_file",
            type: DataTypes.STRING(50),
            allowNull: false,
          },
          status: {
            field: "status",
            type: DataTypes.ENUM("pending", "success", "failed"),
            allowNull: false,
            defaultValue: "pending",
          },
          error_message: {
            field: "error_message",
            type: DataTypes.TEXT,
            allowNull: true,
          },
          sent_by: {
            field: "sent_by",
            type: DataTypes.STRING(50),
            allowNull: false,
          },
          sent_at: {
            field: "sent_at",
            type: DataTypes.DATE,
            allowNull: true,
          },
        },
        {
          tableName: "dthr_ftp_log",
          timestamps: true,
          underscored: true,
          freezeTableName: true,
          indexes: [
            {
              name: "idx_dthr_ftp_kdtk_tgl",
              fields: ["kdtk", "tgl_transaksi"],
            },
            {
              name: "idx_dthr_ftp_status",
              fields: ["status"],
            },
            {
              name: "idx_dthr_ftp_sent_by",
              fields: ["sent_by"],
            },
          ],
        },
      );
    }
    return DthrFtpLog;
  } catch (error) {
    logger.error(`[dthr_ftp.model] Error: ${error.message}`);
    throw error;
  }
};

const DthrFtpLogWrapper = {
  async findAll(options) {
    const model = await getDthrFtpLogModel();
    return model.findAll(options);
  },
  async findOne(options) {
    const model = await getDthrFtpLogModel();
    return model.findOne(options);
  },
  async findByPk(pk, options) {
    const model = await getDthrFtpLogModel();
    return model.findByPk(pk, options);
  },
  async create(data, options) {
    const model = await getDthrFtpLogModel();
    return model.create(data, options);
  },
  async bulkCreate(data, options) {
    const model = await getDthrFtpLogModel();
    return model.bulkCreate(data, options);
  },
  async update(data, options) {
    const model = await getDthrFtpLogModel();
    return model.update(data, options);
  },
  async destroy(options) {
    const model = await getDthrFtpLogModel();
    return model.destroy(options);
  },
  async count(options) {
    const model = await getDthrFtpLogModel();
    return model.count(options);
  },
  async upsert(data, options) {
    const model = await getDthrFtpLogModel();
    return model.upsert(data, options);
  },
  async findOrCreate(options) {
    const model = await getDthrFtpLogModel();
    return model.findOrCreate(options);
  },
  getModel() {
    return getDthrFtpLogModel();
  },
};

export default DthrFtpLogWrapper;
