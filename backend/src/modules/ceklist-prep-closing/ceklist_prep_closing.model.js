import { DataTypes } from "sequelize";
import config from "../../config/index.js";
import logger from "../../config/logger.js";
const { resilientDb } = config;

let CeklistSpaceHdd = null;
let _ceklistSpaceHddSequelizeInstance = null;

const getCeklistSpaceHddModel = async () => {
  try {
    const sequelize = await resilientDb.getDatabase();
    if (!sequelize) {
      throw new Error("Database connection not available");
    }

    if (!CeklistSpaceHdd || _ceklistSpaceHddSequelizeInstance !== sequelize) {
      _ceklistSpaceHddSequelizeInstance = sequelize;
      CeklistSpaceHdd = sequelize.define(
        "ceklist_space_hdd",
        {
          ID: {
            field: "ID",
            type: DataTypes.STRING(20),
            primaryKey: true,
            allowNull: false,
            comment: "Format: {KDCAB}{PERIODE}",
          },
          KDCAB: {
            field: "KDCAB",
            type: DataTypes.CHAR(4),
            allowNull: false,
          },
          IP: {
            field: "IP",
            type: DataTypes.STRING(20),
            allowNull: false,
          },
          PERIODE: {
            field: "PERIODE",
            type: DataTypes.CHAR(4),
            allowNull: false,
            comment: "Format YYMM",
          },
          FREE_SPACE: {
            field: "FREE_SPACE",
            type: DataTypes.STRING(30),
            allowNull: true,
            comment: "e.g. 37.1 GB - input manual",
          },
          TGL_CHECK: {
            field: "TGL_CHECK",
            type: DataTypes.DATEONLY,
            allowNull: true,
          },
          OS: {
            field: "OS",
            type: DataTypes.STRING(20),
            allowNull: true,
            comment: "WINDOWS / LINUX",
          },
          FU: {
            field: "FU",
            type: DataTypes.TEXT,
            allowNull: true,
            comment: "Follow-up action text",
          },
          FREE_AFTER: {
            field: "FREE_AFTER",
            type: DataTypes.STRING(30),
            allowNull: true,
            comment: "Free space after FU - input manual",
          },
          UPDTIME: {
            field: "UPDTIME",
            type: DataTypes.DATE,
            allowNull: true,
            defaultValue: DataTypes.NOW,
          },
        },
        {
          tableName: "ceklist_space_hdd",
          timestamps: false,
          freezeTableName: true,
        },
      );
    }
    return CeklistSpaceHdd;
  } catch (error) {
    logger.error(`[ceklist_prep_closing.model] CeklistSpaceHdd Error: ${error.message}`);
    throw error;
  }
};

export const CeklistSpaceHddWrapper = {
  async findAll(options) {
    const model = await getCeklistSpaceHddModel();
    return model.findAll(options);
  },
  async findOne(options) {
    const model = await getCeklistSpaceHddModel();
    return model.findOne(options);
  },
  async findByPk(pk, options) {
    const model = await getCeklistSpaceHddModel();
    return model.findByPk(pk, options);
  },
  async create(data, options) {
    const model = await getCeklistSpaceHddModel();
    return model.create(data, options);
  },
  async bulkCreate(data, options) {
    const model = await getCeklistSpaceHddModel();
    return model.bulkCreate(data, options);
  },
  async update(data, options) {
    const model = await getCeklistSpaceHddModel();
    return model.update(data, options);
  },
  async destroy(options) {
    const model = await getCeklistSpaceHddModel();
    return model.destroy(options);
  },
  async count(options) {
    const model = await getCeklistSpaceHddModel();
    return model.count(options);
  },
  async upsert(data, options) {
    const model = await getCeklistSpaceHddModel();
    return model.upsert(data, options);
  },
  async findOrCreate(options) {
    const model = await getCeklistSpaceHddModel();
    return model.findOrCreate(options);
  },
  getModel() {
    return getCeklistSpaceHddModel();
  },
};

let CeklistSpaceTampung = null;
let _ceklistSpaceTampungSequelizeInstance = null;

const getCeklistSpaceTampungModel = async () => {
  try {
    const sequelize = await resilientDb.getDatabase();
    if (!sequelize) {
      throw new Error("Database connection not available");
    }

    if (!CeklistSpaceTampung || _ceklistSpaceTampungSequelizeInstance !== sequelize) {
      _ceklistSpaceTampungSequelizeInstance = sequelize;
      CeklistSpaceTampung = sequelize.define(
        "ceklist_space_tampung",
        {
          ID: {
            field: "ID",
            type: DataTypes.STRING(20),
            primaryKey: true,
            allowNull: false,
            comment: "Format: {CAB}{PERIODE}",
          },
          CAB: {
            field: "CAB",
            type: DataTypes.CHAR(4),
            allowNull: false,
          },
          PERIODE: {
            field: "PERIODE",
            type: DataTypes.CHAR(4),
            allowNull: false,
          },
          PATH: {
            field: "PATH",
            type: DataTypes.STRING(255),
            allowNull: true,
          },
          CAPACITY: {
            field: "CAPACITY",
            type: DataTypes.STRING(30),
            allowNull: true,
          },
          FREE_SPACE: {
            field: "FREE_SPACE",
            type: DataTypes.STRING(30),
            allowNull: true,
          },
          TGL_CHECK: {
            field: "TGL_CHECK",
            type: DataTypes.DATEONLY,
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
          tableName: "ceklist_space_tampung",
          timestamps: false,
          freezeTableName: true,
        },
      );
    }
    return CeklistSpaceTampung;
  } catch (error) {
    logger.error(`[ceklist_prep_closing.model] CeklistSpaceTampung Error: ${error.message}`);
    throw error;
  }
};

export const CeklistSpaceTampungWrapper = {
  async findAll(options) {
    const model = await getCeklistSpaceTampungModel();
    return model.findAll(options);
  },
  async findOne(options) {
    const model = await getCeklistSpaceTampungModel();
    return model.findOne(options);
  },
  async findByPk(pk, options) {
    const model = await getCeklistSpaceTampungModel();
    return model.findByPk(pk, options);
  },
  async create(data, options) {
    const model = await getCeklistSpaceTampungModel();
    return model.create(data, options);
  },
  async bulkCreate(data, options) {
    const model = await getCeklistSpaceTampungModel();
    return model.bulkCreate(data, options);
  },
  async update(data, options) {
    const model = await getCeklistSpaceTampungModel();
    return model.update(data, options);
  },
  async destroy(options) {
    const model = await getCeklistSpaceTampungModel();
    return model.destroy(options);
  },
  async count(options) {
    const model = await getCeklistSpaceTampungModel();
    return model.count(options);
  },
  async upsert(data, options) {
    const model = await getCeklistSpaceTampungModel();
    return model.upsert(data, options);
  },
  async findOrCreate(options) {
    const model = await getCeklistSpaceTampungModel();
    return model.findOrCreate(options);
  },
  getModel() {
    return getCeklistSpaceTampungModel();
  },
};

let CeklistImportIdt = null;
let _ceklistImportIdtSequelizeInstance = null;

const getCeklistImportIdtModel = async () => {
  try {
    const sequelize = await resilientDb.getDatabase();
    if (!sequelize) {
      throw new Error("Database connection not available");
    }

    if (!CeklistImportIdt || _ceklistImportIdtSequelizeInstance !== sequelize) {
      _ceklistImportIdtSequelizeInstance = sequelize;
      CeklistImportIdt = sequelize.define(
        "ceklist_import_idt",
        {
          ID: {
            field: "ID",
            type: DataTypes.STRING(20),
            primaryKey: true,
            allowNull: false,
            comment: "Format: {KDCAB}{PERIODE}",
          },
          KDCAB: {
            field: "KDCAB",
            type: DataTypes.CHAR(4),
            allowNull: false,
          },
          PERIODE: {
            field: "PERIODE",
            type: DataTypes.CHAR(4),
            allowNull: false,
          },
          CAPTURE: {
            field: "CAPTURE",
            type: DataTypes.STRING(255),
            allowNull: true,
            comment: "Status/keterangan capture - input manual",
          },
          UPDTIME: {
            field: "UPDTIME",
            type: DataTypes.DATE,
            allowNull: true,
            defaultValue: DataTypes.NOW,
          },
        },
        {
          tableName: "ceklist_import_idt",
          timestamps: false,
          freezeTableName: true,
        },
      );
    }
    return CeklistImportIdt;
  } catch (error) {
    logger.error(`[ceklist_prep_closing.model] CeklistImportIdt Error: ${error.message}`);
    throw error;
  }
};

export const CeklistImportIdtWrapper = {
  async findAll(options) {
    const model = await getCeklistImportIdtModel();
    return model.findAll(options);
  },
  async findOne(options) {
    const model = await getCeklistImportIdtModel();
    return model.findOne(options);
  },
  async findByPk(pk, options) {
    const model = await getCeklistImportIdtModel();
    return model.findByPk(pk, options);
  },
  async create(data, options) {
    const model = await getCeklistImportIdtModel();
    return model.create(data, options);
  },
  async bulkCreate(data, options) {
    const model = await getCeklistImportIdtModel();
    return model.bulkCreate(data, options);
  },
  async update(data, options) {
    const model = await getCeklistImportIdtModel();
    return model.update(data, options);
  },
  async destroy(options) {
    const model = await getCeklistImportIdtModel();
    return model.destroy(options);
  },
  async count(options) {
    const model = await getCeklistImportIdtModel();
    return model.count(options);
  },
  async upsert(data, options) {
    const model = await getCeklistImportIdtModel();
    return model.upsert(data, options);
  },
  async findOrCreate(options) {
    const model = await getCeklistImportIdtModel();
    return model.findOrCreate(options);
  },
  getModel() {
    return getCeklistImportIdtModel();
  },
};
