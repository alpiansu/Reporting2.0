import { DataTypes } from 'sequelize';
import { getSequelizeConnection } from '../config/database.js';
import { BaseService } from '../services/base.service.js';
import salesPerDeptStagingService from '../modules/sales_per_dept/sales_per_dept_staging.service.js';

// Lazy model definition
let SalesPerDept = null;

const getSalesPerDeptModel = async () => {
  if (!SalesPerDept) {
    const sequelize = await getSequelizeConnection();
    SalesPerDept = sequelize.define(
  "SalesPerDept",
  {
    cab: {
      type: DataTypes.CHAR(4),
      allowNull: false,
      primaryKey: true,
    },
    periode: {
      type: DataTypes.CHAR(4),
      allowNull: false,
      primaryKey: true,
    },
    tipestore: {
      type: DataTypes.CHAR(3),
      allowNull: false,
      primaryKey: true,
    },
    dep_kd: {
      type: DataTypes.STRING(10),
      allowNull: false,
      primaryKey: true,
    },
    dep_name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    qty_sales: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    total_sales: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
    },
    total_hpp: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
    },
    margin_rp: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
    },
    margin_percent: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
    },
    harga_jual_per_pcs: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    hpp_per_pcs: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "sales_per_dept",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    underscored: true,
  }
);
  }
  return SalesPerDept;
};

// Export wrapper that handles lazy loading with fallback to staging
class SalesPerDeptWrapper extends BaseService {
  async findAll(options = {}) {
    return await this.executeWithFallback(
      async () => {
        const model = await getSalesPerDeptModel();
        return await model.findAll(options);
      },
      null,
      'sales_per_dept_findall'
    ).catch(async () => {
      // Fallback to staging service
      const filters = this.extractFilters(options);
      const result = await salesPerDeptStagingService.getSalesData(filters, options.limit, options.offset);
      return result.data;
    });
  }

  async findOne(options = {}) {
    return await this.executeWithFallback(
      async () => {
        const model = await getSalesPerDeptModel();
        return await model.findOne(options);
      },
      null,
      'sales_per_dept_findone'
    ).catch(async () => {
      // Fallback to staging service
      const filters = this.extractFilters(options);
      const result = await salesPerDeptStagingService.getSalesData(filters, 1, 0);
      return result.data[0] || null;
    });
  }

  async findByPk(id, options = {}) {
    return await this.executeWithFallback(
      async () => {
        const model = await getSalesPerDeptModel();
        return await model.findByPk(id, options);
      },
      null,
      `sales_per_dept_findpk_${id}`
    ).catch(() => {
      // For composite primary key, fallback is complex
      return null;
    });
  }

  async create(data) {
    const result = await this.executeWriteOperation(async () => {
      const model = await getSalesPerDeptModel();
      return await model.create(data);
    });
    
    // Sync to JSON file after database operation
    try {
      await salesPerDeptStagingService.syncToJsonFile();
    } catch (syncError) {
      console.warn('Failed to sync to JSON after create:', syncError.message);
    }
    
    return result;
  }

  async update(data, options) {
    const result = await this.executeWriteOperation(async () => {
      const model = await getSalesPerDeptModel();
      return await model.update(data, options);
    });
    
    // Sync to JSON file after database operation
    try {
      await salesPerDeptStagingService.syncToJsonFile();
    } catch (syncError) {
      console.warn('Failed to sync to JSON after update:', syncError.message);
    }
    
    return result;
  }

  async destroy(options) {
    const result = await this.executeWriteOperation(async () => {
      const model = await getSalesPerDeptModel();
      return await model.destroy(options);
    });
    
    // Sync to JSON file after database operation
    try {
      await salesPerDeptStagingService.syncToJsonFile();
    } catch (syncError) {
      console.warn('Failed to sync to JSON after destroy:', syncError.message);
    }
    
    return result;
  }

  async count(options = {}) {
    return await this.executeWithFallback(
      async () => {
        const model = await getSalesPerDeptModel();
        return await model.count(options);
      },
      0,
      'sales_per_dept_count'
    ).catch(async () => {
      // Fallback to staging service
      const filters = this.extractFilters(options);
      return await salesPerDeptStagingService.getCount(filters);
    });
  }

  async bulkCreate(data, options) {
    const result = await this.executeWriteOperation(async () => {
      const model = await getSalesPerDeptModel();
      return await model.bulkCreate(data, options);
    });
    
    // Sync to JSON file after database operation
    try {
      await salesPerDeptStagingService.syncToJsonFile();
    } catch (syncError) {
      console.warn('Failed to sync to JSON after bulkCreate:', syncError.message);
    }
    
    return result;
  }

  async upsert(data, options) {
    const result = await this.executeWriteOperation(async () => {
      const model = await getSalesPerDeptModel();
      return await model.upsert(data, options);
    });
    
    // Sync to JSON file after database operation
    try {
      await salesPerDeptStagingService.syncToJsonFile();
    } catch (syncError) {
      console.warn('Failed to sync to JSON after upsert:', syncError.message);
    }
    
    return result;
  }

  // Helper method to extract filters from Sequelize options
  extractFilters(options) {
    const filters = {};
    if (options.where) {
      if (options.where.cab) filters.cab = options.where.cab;
      if (options.where.periode) filters.periode = options.where.periode;
      if (options.where.tipestore) filters.tipestore = options.where.tipestore;
      if (options.where.dep_kd) filters.dep_kd = options.where.dep_kd;
    }
    return filters;
  }
}

const salesPerDeptWrapper = new SalesPerDeptWrapper();

export default salesPerDeptWrapper;
