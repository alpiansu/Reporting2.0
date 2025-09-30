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

import { DataTypes, Sequelize } from 'sequelize';
import moment from 'moment-timezone';
import config from '../config/index.js';
const { resilientDb } = config;
import { BaseService } from '../services/base.service.js';
import rekapRemoteStagingService from '../modules/rekap_remote/rekap_remote_staging.service.js';

// Lazy model definition
let RekapRemote = null;

const getRekapRemoteModel = async () => {
  if (!RekapRemote) {
    const sequelize = await resilientDb.getDatabase();
    if (!sequelize) {
      throw new Error('Database connection not available');
    }
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
    updtime: {
      type: "TIMESTAMP",
      allowNull: false,
      defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      onUpdate: Sequelize.literal("CURRENT_TIMESTAMP"), // untuk dialect mysql >= 8
      comment: "Waktu update terakhir",
    },
  },
  {
    tableName: "rekap_remote",
    timestamps: false, // We handle timestamps manually with updtime
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
  }
  return RekapRemote;
};

// Export wrapper that handles lazy loading with fallback to staging
class RekapRemoteWrapper extends BaseService {
  async findAll(options = {}) {
    return await this.executeWithFallback(
      async () => {
        const model = await getRekapRemoteModel();
        return await model.findAll(options);
      },
      null,
      'rekap_remote_findall'
    ).catch(async () => {
      // Fallback to staging service
      const filters = this.extractFilters(options);
      const result = await rekapRemoteStagingService.getRekapData(filters, options.limit, options.offset);
      return result.data;
    });
  }

  async findOne(options = {}) {
    return await this.executeWithFallback(
      async () => {
        const model = await getRekapRemoteModel();
        return await model.findOne(options);
      },
      null,
      'rekap_remote_findone'
    ).catch(async () => {
      // Fallback to staging service
      const filters = this.extractFilters(options);
      const result = await rekapRemoteStagingService.getRekapData(filters, 1, 0);
      return result.data[0] || null;
    });
  }

  async findByPk(id, options = {}) {
    return await this.executeWithFallback(
      async () => {
        const model = await getRekapRemoteModel();
        return await model.findByPk(id, options);
      },
      null,
      `rekap_remote_findpk_${id}`
    ).catch(() => {
      // For composite primary key, fallback is complex
      return null;
    });
  }

  async create(data) {
    const result = await this.executeWriteOperation(async () => {
      const model = await getRekapRemoteModel();
      return await model.create(data);
    });
    
    // Sync to JSON file after database operation
    try {
      await rekapRemoteStagingService.syncToJsonFile();
    } catch (syncError) {
      console.warn('Failed to sync to JSON after create:', syncError.message);
    }
    
    return result;
  }

  async update(data, options) {
    const result = await this.executeWriteOperation(async () => {
      const model = await getRekapRemoteModel();
      return await model.update(data, options);
    });
    
    // Sync to JSON file after database operation
    try {
      await rekapRemoteStagingService.syncToJsonFile();
    } catch (syncError) {
      console.warn('Failed to sync to JSON after update:', syncError.message);
    }
    
    return result;
  }

  async destroy(options) {
    const result = await this.executeWriteOperation(async () => {
      const model = await getRekapRemoteModel();
      return await model.destroy(options);
    });
    
    // Sync to JSON file after database operation
    try {
      await rekapRemoteStagingService.syncToJsonFile();
    } catch (syncError) {
      console.warn('Failed to sync to JSON after destroy:', syncError.message);
    }
    
    return result;
  }

  async count(options = {}) {
    return await this.executeWithFallback(
      async () => {
        const model = await getRekapRemoteModel();
        return await model.count(options);
      },
      0,
      'rekap_remote_count'
    ).catch(async () => {
      // Fallback to staging service
      const filters = this.extractFilters(options);
      return await rekapRemoteStagingService.getCount(filters);
    });
  }

  async upsert(data, options) {
    const result = await this.executeWriteOperation(async () => {
      const model = await getRekapRemoteModel();
      return await model.upsert(data, options);
    });
    
    // Sync to JSON file after database operation
    try {
      await rekapRemoteStagingService.syncToJsonFile();
    } catch (syncError) {
      console.warn('Failed to sync to JSON after upsert:', syncError.message);
    }
    
    return result;
  }

  async findOrCreate(options) {
    const result = await this.executeWriteOperation(async () => {
      const model = await getRekapRemoteModel();
      return await model.findOrCreate(options);
    });
    
    // Sync to JSON file after database operation
    try {
      await rekapRemoteStagingService.syncToJsonFile();
    } catch (syncError) {
      console.warn('Failed to sync to JSON after findOrCreate:', syncError.message);
    }
    
    return result;
  }

  async bulkCreate(data, options = {}) {
    const result = await this.executeWriteOperation(async () => {
      const model = await getRekapRemoteModel();
      return await model.bulkCreate(data, options);
    });
    
    // Sync to JSON file after database operation
    try {
      await rekapRemoteStagingService.syncToJsonFile();
    } catch (syncError) {
      console.warn('Failed to sync to JSON after bulkCreate:', syncError.message);
    }
    
    return result;
  }

  // Helper method to extract filters from Sequelize options
  extractFilters(options) {
    const filters = {};
    if (options.where) {
      if (options.where.cab) filters.cab = options.where.cab;
      if (options.where.kdtk) filters.kdtk = options.where.kdtk;
      if (options.where.module_name) filters.moduleName = options.where.module_name;
    }
    return filters;
  }
}

const rekapRemoteWrapper = new RekapRemoteWrapper();

export default rekapRemoteWrapper;
