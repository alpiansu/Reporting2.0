import { DataTypes } from "sequelize";
import moment from "moment-timezone";
import config from "../config/index.js";
import logger from "../config/logger.js";
const { resilientDb } = config;

const getJakartaNow = () => moment().tz("Asia/Jakarta").toDate();

let RekonWtHarian = null;
let _rekonWtHarianSequelizeInstance = null;

const getRekonWtHarianModel = async () => {
  try {
    const sequelize = await resilientDb.getDatabase();
    if (!sequelize) {
      throw new Error("Database connection not available");
    }

    if (!RekonWtHarian || _rekonWtHarianSequelizeInstance !== sequelize) {
      _rekonWtHarianSequelizeInstance = sequelize;
      RekonWtHarian = sequelize.define(
        "rekon_wt_harian",
        {
          recid: {
            type: DataTypes.STRING(1),
            allowNull: false,
            defaultValue: "*",
            comment: "Setting recid data active for history tracking",
          },
          cab: {
            type: DataTypes.STRING(10),
            primaryKey: true,
            comment: "Kode cabang",
          },
          periode: {
            type: DataTypes.STRING(4),
            primaryKey: true,
            comment: "Periode dalam format YYMM",
          },
          tipe: {
            type: DataTypes.STRING(10),
            primaryKey: true,
            comment: "Tipe transaksi (NKL, BRK, PCAFE, dll)",
          },
          toko: {
            type: DataTypes.STRING(10),
            primaryKey: true,
            comment: "Kode toko",
          },
          shop: {
            type: DataTypes.STRING(10),
            primaryKey: true,
            comment: "Kode shop",
          },
          tgl1: {
            type: DataTypes.DATEONLY,
            primaryKey: true,
            comment: "Tanggal transaksi",
          },
          gross_wrc: {
            type: DataTypes.DECIMAL(25, 0),
            allowNull: true,
            defaultValue: 0,
            comment: "Nilai gross dari WRC",
          },
          ppn_wrc: {
            type: DataTypes.DECIMAL(25, 7),
            allowNull: true,
            defaultValue: 0,
            comment: "Nilai PPN dari WRC",
          },
          gross_idm_wrc: {
            type: DataTypes.DECIMAL(25, 3),
            allowNull: true,
            defaultValue: 0,
            comment: "Nilai gross IDM dari WRC",
          },
          ppn_idm_wrc: {
            type: DataTypes.DECIMAL(25, 3),
            allowNull: true,
            defaultValue: 0,
            comment: "Nilai PPN IDM dari WRC",
          },
          gross_store: {
            type: DataTypes.DECIMAL(25, 0),
            allowNull: true,
            defaultValue: 0,
            comment: "Nilai gross dari store",
          },
          ppn_store: {
            type: DataTypes.DECIMAL(25, 7),
            allowNull: true,
            defaultValue: 0,
            comment: "Nilai PPN dari store",
          },
          gross_idm_store: {
            type: DataTypes.DECIMAL(25, 3),
            allowNull: true,
            defaultValue: 0,
            comment: "Nilai gross IDM dari store",
          },
          ppn_idm_store: {
            type: DataTypes.DECIMAL(25, 3),
            allowNull: true,
            defaultValue: 0,
            comment: "Nilai PPN IDM dari store",
          },
          selisih_gross: {
            type: DataTypes.DECIMAL(25, 0),
            allowNull: true,
            defaultValue: 0,
            comment: "Selisih nilai gross",
          },
          selisih_ppn: {
            type: DataTypes.DECIMAL(25, 7),
            allowNull: true,
            defaultValue: 0,
            comment: "Selisih nilai PPN",
          },
          selisih_gross_idm: {
            type: DataTypes.DECIMAL(25, 3),
            allowNull: true,
            defaultValue: 0,
            comment: "Selisih nilai gross IDM",
          },
          selisih_ppn_idm: {
            type: DataTypes.DECIMAL(25, 3),
            allowNull: true,
            defaultValue: 0,
            comment: "Selisih nilai PPN IDM",
          },
          addtime: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
            comment: "Waktu penambahan data",
          },
          updtime: {
            type: DataTypes.DATE,
            comment: "Waktu update data",
            defaultValue: DataTypes.NOW,
          },
        },
        {
          tableName: "rekon_wt_harian",
          timestamps: false,
          hooks: {
            beforeCreate: (record, options) => {
              if (!record.addtime) {
                record.addtime = getJakartaNow();
              }
            },
            beforeUpdate: (record, options) => {
              if (!record.updtime) {
                record.updtime = getJakartaNow();
              }
            },
            beforeBulkUpdate: options => {
              if (!options.attributes) options.attributes = {};
              if (!options.attributes.updtime) {
                options.attributes.updtime = getJakartaNow();
              }
            },
            beforeUpsert: (values, options) => {
              if (!values.addtime) {
                values.addtime = getJakartaNow();
              }
              if (!values.updtime) {
                values.updtime = getJakartaNow();
              }
            },
            beforeBulkCreate: (records, options) => {
              const nowJakarta = getJakartaNow();
              records.forEach(record => {
                if (!record.addtime) {
                  record.addtime = nowJakarta;
                }
              });
            },
          },
          indexes: [
            {
              name: "idx_rekon_wt_harian_cab_periode",
              fields: ["cab", "periode"],
            },
            {
              name: "idx_rekon_wt_harian_toko_tgl",
              fields: ["shop", "tgl1"],
            },
          ],
        },
      );
    }
    return RekonWtHarian;
  } catch (error) {
    logger.error(`Error syncing RekonWtHarian model: ${error.message}`);
    throw error;
  }
};

const RekonWtHarianWrapper = {
  async findAll(options) {
    const model = await getRekonWtHarianModel();
    return model.findAll(options);
  },
  async findOne(options) {
    const model = await getRekonWtHarianModel();
    return model.findOne(options);
  },
  async findByPk(pk, options) {
    const model = await getRekonWtHarianModel();
    return model.findByPk(pk, options);
  },
  async create(data, options) {
    const model = await getRekonWtHarianModel();
    return model.create(data, options);
  },
  async update(data, options) {
    const model = await getRekonWtHarianModel();
    return model.update(data, options);
  },
  async destroy(options) {
    const model = await getRekonWtHarianModel();
    return model.destroy(options);
  },
  async count(options) {
    const model = await getRekonWtHarianModel();
    return model.count(options);
  },
  async bulkCreate(data, options) {
    const model = await getRekonWtHarianModel();
    return model.bulkCreate(data, options);
  },
  async upsert(data, options) {
    const model = await getRekonWtHarianModel();
    return model.upsert(data, options);
  },
  async findOrCreate(options) {
    const model = await getRekonWtHarianModel();
    return model.findOrCreate(options);
  },
  getModel() {
    return getRekonWtHarianModel();
  },
};

export default RekonWtHarianWrapper;
