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
const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const RekonWtHarian = sequelize.define(
  "rekon_wt_harian",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
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
      allowNull: true,
      comment: "Waktu update data",
    },
  },
  {
    tableName: "rekon_wt_harian",
    timestamps: false, // We handle timestamps manually with addtime/updtime
    hooks: {
      // Hook untuk mengisi addtime saat create (jika belum diisi)
      beforeCreate: (record, options) => {
        if (!record.addtime) {
          record.addtime = new Date();
        }
        // Tidak set updtime saat create pertama kali
        record.updtime = null;
      },
      // Hook untuk mengisi updtime saat update
      beforeUpdate: (record, options) => {
        record.updtime = new Date();
      },
      // Hook untuk bulk update dan upsert
      beforeBulkUpdate: (options) => {
        // Add updtime for bulk updates
        if (options.attributes) {
          options.attributes.updtime = new Date();
        } else {
          options.attributes = { updtime: new Date() };
        }
      },
      
      // Hook untuk upsert operations
      beforeUpsert: (values, options) => {
        // For upsert, set updtime only if this is an update (not create)
        // The upsert will handle addtime automatically for new records
        if (!values.addtime) {
          values.addtime = new Date(); // For new records
        }
        // Always set updtime for upsert as it could be an update
        values.updtime = new Date();
      },
      // Hook untuk bulk create - pastikan addtime diisi
      beforeBulkCreate: (records, options) => {
        const now = new Date();
        records.forEach(record => {
          if (!record.addtime) {
            record.addtime = now;
          }
          // Tidak set updtime untuk bulk create (data baru)
          record.updtime = null;
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
      {
        name: "idx_rekon_wt_harian_addtime",
        fields: ["addtime"],
      },
      {
        name: "idx_rekon_wt_harian_updtime",
        fields: ["updtime"],
      },
    ],
  }
);

module.exports = RekonWtHarian;
