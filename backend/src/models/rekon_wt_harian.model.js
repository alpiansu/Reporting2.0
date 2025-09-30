/**
 * Model for storing WT reconciliation data
 *
 * @swagger
 * components:
 *   schemas:
 *     RekonWtHarian:
 *       type: object
 *       required:
 *         - cab
 *         - periode
 *         - tipe
 *         - toko
 *         - shop
 *         - tgl1
 *       properties:
 *         id:
 *           type: integer
 *           description: The auto-generated ID of the record
 *         cab:
 *           type: string
 *           description: Branch code
 *         periode:
 *           type: string
 *           description: Period in YYMM format
 *         tipe:
 *           type: string
 *           description: Transaction type (NKL, BRK, PCAFE, etc.)
 *         toko:
 *           type: string
 *           description: Store code
 *         shop:
 *           type: string
 *           description: Shop code
 *         tgl1:
 *           type: string
 *           format: date
 *           description: Transaction date
 *         gross_wrc:
 *           type: number
 *           description: Gross value from WRC
 *         ppn_wrc:
 *           type: number
 *           description: PPN value from WRC
 *         gross_idm_wrc:
 *           type: number
 *           description: Gross IDM value from WRC
 *         ppn_idm_wrc:
 *           type: number
 *           description: PPN IDM value from WRC
 *         gross_store:
 *           type: number
 *           description: Gross value from store
 *         ppn_store:
 *           type: number
 *           description: PPN value from store
 *         gross_idm_store:
 *           type: number
 *           description: Gross IDM value from store
 *         ppn_idm_store:
 *           type: number
 *           description: PPN IDM value from store
 *         selisih_gross:
 *           type: number
 *           description: Difference in gross value
 *         selisih_ppn:
 *           type: number
 *           description: Difference in PPN value
 *         selisih_gross_idm:
 *           type: number
 *           description: Difference in gross IDM value
 *         selisih_ppn_idm:
 *           type: number
 *           description: Difference in PPN IDM value
 *         addtime:
 *           type: string
 *           format: date-time
 *           description: Record creation time
 *         updtime:
 *           type: string
 *           format: date-time
 *           description: Record update time
 */
import { DataTypes, Sequelize } from "sequelize";
import moment from "moment-timezone";
const getJakartaNow = () => moment().tz("Asia/Jakarta").toDate();
import config from "../config/index.js";
const { resilientDb } = config;

// Lazy model definition
let RekonWtHarian = null;

const getRekonWtHarianModel = async () => {
  if (!RekonWtHarian) {
    const sequelize = await resilientDb.getDatabase();
    if (!sequelize) {
      throw new Error("Database connection not available");
    }
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
          defaultValue: Sequelize.NOW,
        },
      },
      {
        tableName: "rekon_wt_harian",
        timestamps: false, // We handle timestamps manually with addtime/updtime
        hooks: {
          // Only touch addtime when it is not provided; leave updtime as-is if already set
          beforeCreate: (record, options) => {
            if (!record.addtime) {
              record.addtime = getJakartaNow();
            }
            // updtime stays null (or whatever value was supplied)
          },
          beforeUpdate: (record, options) => {
            // update updtime only when the caller did not already provide one
            if (!record.updtime) {
              record.updtime = getJakartaNow();
            }
          },
          beforeBulkUpdate: options => {
            // set updtime only when attributes object exists and updtime is absent
            if (!options.attributes) options.attributes = {};
            if (!options.attributes.updtime) {
              options.attributes.updtime = getJakartaNow();
            }
          },
          beforeUpsert: (values, options) => {
            if (!values.addtime) {
              values.addtime = getJakartaNow();
            }
            // touch updtime only when caller did not supply it
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
              // updtime left untouched (null or caller-supplied value)
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
      }
    );
  }
  return RekonWtHarian;
};

// Export wrapper that handles lazy loading
const RekonWtHarianWrapper = {
  async findAll(options) {
    const model = await getRekonWtHarianModel();
    return model.findAll(options);
  },
  async findOne(options) {
    const model = await getRekonWtHarianModel();
    return model.findOne(options);
  },
  async findByPk(id, options) {
    const model = await getRekonWtHarianModel();
    return model.findByPk(id, options);
  },
  async create(data) {
    const model = await getRekonWtHarianModel();
    return model.create(data);
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
};

export default RekonWtHarianWrapper;
