import { DataTypes } from "sequelize";
import config from "../../config/index.js";
import logger from "../../config/logger.js";

const { resilientDb } = config;

let CeklistPanduan = null;
let _ceklistPanduanSequelizeInstance = null;

const getCeklistPanduanModel = async () => {
  try {
    const sequelize = await resilientDb.getDatabase();
    if (!sequelize) {
      throw new Error("Database connection not available");
    }

    if (!CeklistPanduan || _ceklistPanduanSequelizeInstance !== sequelize) {
      _ceklistPanduanSequelizeInstance = sequelize;
      CeklistPanduan = sequelize.define(
        "ceklist_panduan",
        {
          KDCAB: {
            field: "KDCAB",
            type: DataTypes.CHAR(4),
            primaryKey: true,
            allowNull: false,
          },
          NAMACAB: {
            field: "NAMACAB",
            type: DataTypes.STRING(50),
            allowNull: true,
          },
          OS: {
            field: "OS",
            type: DataTypes.STRING(10),
            allowNull: true,
            comment: "WINDOWS / LINUX",
          },
          IP_BULANAN: {
            field: "IP_BULANAN",
            type: DataTypes.STRING(45),
            allowNull: true,
          },
          USER_BULANAN: {
            field: "USER_BULANAN",
            type: DataTypes.STRING(50),
            allowNull: true,
          },
          PASS_BULANAN: {
            field: "PASS_BULANAN",
            type: DataTypes.STRING(100),
            allowNull: true,
          },
          PORT_BULANAN: {
            field: "PORT_BULANAN",
            type: DataTypes.STRING(20),
            allowNull: true,
          },
          REMOTE_BULANAN: {
            field: "REMOTE_BULANAN",
            type: DataTypes.STRING(20),
            allowNull: true,
            comment: "Metode remote server bulanan: SSH / RDP / VNC",
          },
          DB_USER: {
            field: "DB_USER",
            type: DataTypes.STRING(50),
            allowNull: true,
          },
          DB_PASS: {
            field: "DB_PASS",
            type: DataTypes.STRING(100),
            allowNull: true,
          },
          DB_PORT: {
            field: "DB_PORT",
            type: DataTypes.STRING(20),
            allowNull: true,
          },
          HDD_CHECK: {
            field: "HDD_CHECK",
            type: DataTypes.STRING(255),
            allowNull: true,
          },
          IP_TAMPUNG: {
            field: "IP_TAMPUNG",
            type: DataTypes.STRING(45),
            allowNull: true,
          },
          USER_TAMPUNG: {
            field: "USER_TAMPUNG",
            type: DataTypes.STRING(50),
            allowNull: true,
          },
          PASS_TAMPUNG: {
            field: "PASS_TAMPUNG",
            type: DataTypes.STRING(100),
            allowNull: true,
          },
          REMOTE_TAMPUNG: {
            field: "REMOTE_TAMPUNG",
            type: DataTypes.STRING(20),
            allowNull: true,
            comment: "Metode remote server tampung: RDP / RDP+VNC / VNC",
          },
          VNC_PASS_TAMPUNG: {
            field: "VNC_PASS_TAMPUNG",
            type: DataTypes.STRING(100),
            allowNull: true,
            comment: "Pass VNC server tampung (jika ada)",
          },
          PATH_TAMPUNG: {
            field: "PATH_TAMPUNG",
            type: DataTypes.STRING(255),
            allowNull: true,
          },
          CATATAN: {
            field: "CATATAN",
            type: DataTypes.TEXT,
            allowNull: true,
          },
          UPDTIME: {
            field: "UPDTIME",
            type: DataTypes.DATE,
            allowNull: true,
            defaultValue: DataTypes.NOW,
          },
        },
        {
          tableName: "ceklist_panduan",
          timestamps: false,
          freezeTableName: true,
        },
      );
    }
    return CeklistPanduan;
  } catch (error) {
    logger.error(`[ceklist_panduan.model] CeklistPanduan Error: ${error.message}`);
    throw error;
  }
};

export const CeklistPanduanWrapper = {
  async findAll(options) {
    const model = await getCeklistPanduanModel();
    return model.findAll(options);
  },
  async findOne(options) {
    const model = await getCeklistPanduanModel();
    return model.findOne(options);
  },
  async findByPk(pk, options) {
    const model = await getCeklistPanduanModel();
    return model.findByPk(pk, options);
  },
  async create(data, options) {
    const model = await getCeklistPanduanModel();
    return model.create(data, options);
  },
  async bulkCreate(data, options) {
    const model = await getCeklistPanduanModel();
    return model.bulkCreate(data, options);
  },
  async update(data, options) {
    const model = await getCeklistPanduanModel();
    return model.update(data, options);
  },
  async destroy(options) {
    const model = await getCeklistPanduanModel();
    return model.destroy(options);
  },
  async count(options) {
    const model = await getCeklistPanduanModel();
    return model.count(options);
  },
  async upsert(data, options) {
    const model = await getCeklistPanduanModel();
    return model.upsert(data, options);
  },
  async findOrCreate(options) {
    const model = await getCeklistPanduanModel();
    return model.findOrCreate(options);
  },
  getModel() {
    return getCeklistPanduanModel();
  },
};

export default CeklistPanduanWrapper;