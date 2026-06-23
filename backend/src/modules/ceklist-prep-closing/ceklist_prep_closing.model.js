import { DataTypes } from "sequelize";
import config from "../../config/index.js";
import logger from "../../config/logger.js";

const { resilientDb } = config;

// ─── ceklist_space_hdd ───────────────────────────────────────────────────────

let CeklistSpaceHdd = null;
let CeklistSpaceHddGeneration = -1;

const getCeklistSpaceHddModel = async () => {
  try {
    const dbGeneration = resilientDb.getGeneration();
    if (!CeklistSpaceHdd || CeklistSpaceHddGeneration !== dbGeneration) {
      const sequelize = await resilientDb.getDatabase();
      if (!sequelize) throw new Error("Database connection not available");

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
        }
      );
      CeklistSpaceHddGeneration = dbGeneration;
    }
    return CeklistSpaceHdd;
  } catch (error) {
    logger.error(`[ceklist_prep_closing.model] CeklistSpaceHdd Error: ${error.message}`);
    throw error;
  }
};

export const CeklistSpaceHddWrapper = {
  async findAll(options) { const m = await getCeklistSpaceHddModel(); return m.findAll(options); },
  async findOne(options) { const m = await getCeklistSpaceHddModel(); return m.findOne(options); },
  async findByPk(pk, options) { const m = await getCeklistSpaceHddModel(); return m.findByPk(pk, options); },
  async create(data, options) { const m = await getCeklistSpaceHddModel(); return m.create(data, options); },
  async bulkCreate(data, options) { const m = await getCeklistSpaceHddModel(); return m.bulkCreate(data, options); },
  async update(data, options) { const m = await getCeklistSpaceHddModel(); return m.update(data, options); },
  async destroy(options) { const m = await getCeklistSpaceHddModel(); return m.destroy(options); },
  async upsert(data, options) { const m = await getCeklistSpaceHddModel(); return m.upsert(data, options); },
  getModel() { return getCeklistSpaceHddModel(); },
};

// ─── ceklist_space_tampung ────────────────────────────────────────────────────

let CeklistSpaceTampung = null;
let CeklistSpaceTampungGeneration = -1;

const getCeklistSpaceTampungModel = async () => {
  try {
    const dbGeneration = resilientDb.getGeneration();
    if (!CeklistSpaceTampung || CeklistSpaceTampungGeneration !== dbGeneration) {
      const sequelize = await resilientDb.getDatabase();
      if (!sequelize) throw new Error("Database connection not available");

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
        }
      );
      CeklistSpaceTampungGeneration = dbGeneration;
    }
    return CeklistSpaceTampung;
  } catch (error) {
    logger.error(`[ceklist_prep_closing.model] CeklistSpaceTampung Error: ${error.message}`);
    throw error;
  }
};

export const CeklistSpaceTampungWrapper = {
  async findAll(options) { const m = await getCeklistSpaceTampungModel(); return m.findAll(options); },
  async findOne(options) { const m = await getCeklistSpaceTampungModel(); return m.findOne(options); },
  async findByPk(pk, options) { const m = await getCeklistSpaceTampungModel(); return m.findByPk(pk, options); },
  async create(data, options) { const m = await getCeklistSpaceTampungModel(); return m.create(data, options); },
  async bulkCreate(data, options) { const m = await getCeklistSpaceTampungModel(); return m.bulkCreate(data, options); },
  async update(data, options) { const m = await getCeklistSpaceTampungModel(); return m.update(data, options); },
  async destroy(options) { const m = await getCeklistSpaceTampungModel(); return m.destroy(options); },
  async upsert(data, options) { const m = await getCeklistSpaceTampungModel(); return m.upsert(data, options); },
  getModel() { return getCeklistSpaceTampungModel(); },
};

// ─── ceklist_import_idt ───────────────────────────────────────────────────────

let CeklistImportIdt = null;
let CeklistImportIdtGeneration = -1;

const getCeklistImportIdtModel = async () => {
  try {
    const dbGeneration = resilientDb.getGeneration();
    if (!CeklistImportIdt || CeklistImportIdtGeneration !== dbGeneration) {
      const sequelize = await resilientDb.getDatabase();
      if (!sequelize) throw new Error("Database connection not available");

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
        }
      );
      CeklistImportIdtGeneration = dbGeneration;
    }
    return CeklistImportIdt;
  } catch (error) {
    logger.error(`[ceklist_prep_closing.model] CeklistImportIdt Error: ${error.message}`);
    throw error;
  }
};

export const CeklistImportIdtWrapper = {
  async findAll(options) { const m = await getCeklistImportIdtModel(); return m.findAll(options); },
  async findOne(options) { const m = await getCeklistImportIdtModel(); return m.findOne(options); },
  async findByPk(pk, options) { const m = await getCeklistImportIdtModel(); return m.findByPk(pk, options); },
  async create(data, options) { const m = await getCeklistImportIdtModel(); return m.create(data, options); },
  async bulkCreate(data, options) { const m = await getCeklistImportIdtModel(); return m.bulkCreate(data, options); },
  async update(data, options) { const m = await getCeklistImportIdtModel(); return m.update(data, options); },
  async destroy(options) { const m = await getCeklistImportIdtModel(); return m.destroy(options); },
  async upsert(data, options) { const m = await getCeklistImportIdtModel(); return m.upsert(data, options); },
  getModel() { return getCeklistImportIdtModel(); },
};
