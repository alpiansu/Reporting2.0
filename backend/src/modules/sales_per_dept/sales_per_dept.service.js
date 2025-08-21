/**
 * Service for sales per department data
 */
const SalesPerDept = require("../../models/sales_per_dept.model");
const logger = require("../../config/logger");
const ExternalDbService = require("./external-db.service");

class SalesPerDeptService {
  /**
   * Extract sales per department data from external database
   * @param {string} cab - Branch code
   * @param {string} periode - Period in YYMM format
   * @returns {Promise<Object>} Extraction results
   */
  async extractSalesPerDept(cab, periode) {
    logger.info(`Extracting sales per department data for cab: ${cab}, periode: ${periode}`);

    // Create instance of external DB service
    const externalDbService = new ExternalDbService();
    let connection = null;
    let hasErrors = false;
    let errorMessages = [];

    try {
      // Connect to store database
      connection = await externalDbService.connectCabang(cab);

      if (!connection) {
        return { success: false, message: `Failed to connect to store database for cabang ${cab}` };
      }

      // Extract data for different store types
      const storeTypes = ["REG", "FRC", "ALL"];
      let totalRecords = 0;

      for (const tipestore of storeTypes) {
        const query = this.buildSalesPerDeptQuery(cab, periode, tipestore);

        try {
          const [rows] = await connection.execute(query);

          // Process and save each row
          for (const row of rows) {
            await this.saveOrUpdateSalesPerDept(row);
          }

          totalRecords += rows.length;
          logger.info(`Extracted ${rows.length} records for cab: ${cab}, periode: ${periode}, tipestore: ${tipestore}`);
        } catch (error) {
          logger.error(`Error executing query for ${tipestore}: ${error.message}`);
          hasErrors = true;
          errorMessages.push(`Error executing query for ${tipestore}: ${error.message}`);
          // Continue with other store types even if one fails
        }
      }

      // Close connection
      if (connection) {
        try {
          await connection.end();
          logger.info(`Closed database connection for cab: ${cab}`);
        } catch (closeError) {
          logger.error(`Error closing connection: ${closeError.message}`);
        }
      }

      // If there were errors during extraction, return error response
      if (hasErrors) {
        return {
          success: false,
          message: errorMessages.join("; "),
          data: { totalRecords },
        };
      }

      return {
        success: true,
        message: `Extracted ${totalRecords} records for cab: ${cab}, periode: ${periode}`,
        data: { totalRecords },
      };
    } catch (error) {
      logger.error(`Error in extractSalesPerDept: ${error.message}`);

      // Ensure connection is closed even if there's an error
      if (connection) {
        try {
          await connection.end();
          logger.info(`Closed database connection for cab: ${cab} after error`);
        } catch (closeError) {
          logger.error(`Error closing connection after error: ${closeError.message}`);
        }
      }

      return { success: false, message: `Extraction error: ${error.message}` };
    }
  }

  /**
   * Build SQL query for sales per department data
   * @param {string} cab - Branch code
   * @param {string} periode - Period in YYMM format
   * @param {string} tipestore - Store type (REG, FRC, ALL)
   * @returns {string} SQL query
   */
  buildSalesPerDeptQuery(cab, periode, tipestore) {
    const tblFilet = `kodetoko_${periode}`;

    let whereClause = "WHERE recid not in ('P','T') AND `div` != '' AND (sales - retur) != 0";

    if (tipestore === "REG") {
      whereClause += " AND KODE_TOKO LIKE 'T%'";
    } else if (tipestore === "FRC") {
      whereClause += " AND KODE_TOKO NOT LIKE 'T%'";
    }

    return `
      SELECT 
        '${cab}' as cab, 
        '${periode}' as periode, 
        '${tipestore}' as tipestore, 
        \`div\` as dep_kd, 
        ' ' as dep_name, 
        SUM(sales - retur) AS qty_sales, 
        SUM(t_sales - t_retur - tppn) AS total_sales, 
        SUM(rp_sales - rp_retur) AS total_hpp 
      FROM ${tblFilet} 
      ${whereClause} 
      GROUP BY \`div\`;
    `;
  }

  /**
   * Connect to WRC server cabang
   * @param {string} cab - kode cabang
   * @returns {Promise<Object>} MySQL connection
   */
  async connectToWRC(cab) {
    try {
      const externalDbService = new dbService();
      const connection = await externalDbService.connectCabang(cab);
      logger.info(`Connected to WRC server cabang ${cab}`);
      return connection;
    } catch (error) {
      logger.error(`Failed to connect to WRC server cabang ${cab}: ${error.message}`);
      return null;
    }
  }

  /**
   * Save or update sales per department data
   * @param {Object} data - Sales per department data
   * @returns {Promise<Object>} Created or updated record
   */
  async saveOrUpdateSalesPerDept(data) {
    try {
      // Calculate margin and other derived fields
      const marginRp = data.total_sales - data.total_hpp;
      const marginPercent = data.total_sales > 0 ? (marginRp / data.total_sales) * 100 : 0;
      const hargaJualPerPcs = data.qty_sales > 0 ? data.total_sales / data.qty_sales : 0;
      const hppPerPcs = data.qty_sales > 0 ? data.total_hpp / data.qty_sales : 0;

      // Prepare data for upsert
      const salesPerDeptData = {
        cab: data.cab,
        periode: data.periode,
        tipestore: data.tipestore,
        dep_kd: data.dep_kd,
        dep_name: data.dep_name || `Department ${data.dep_kd}`,
        qty_sales: data.qty_sales,
        total_sales: data.total_sales,
        total_hpp: data.total_hpp,
        margin_rp: marginRp,
        margin_percent: marginPercent,
        harga_jual_per_pcs: hargaJualPerPcs,
        hpp_per_pcs: hppPerPcs,
        updated_at: new Date(),
      };

      // Check if record exists
      const existingRecord = await SalesPerDept.findOne({
        where: {
          cab: data.cab,
          periode: data.periode,
          tipestore: data.tipestore,
          dep_kd: data.dep_kd,
        },
      });

      let result;
      if (existingRecord) {
        // Update existing record
        await existingRecord.update(salesPerDeptData);
        result = existingRecord;
      } else {
        // Create new record
        salesPerDeptData.created_at = new Date();
        result = await SalesPerDept.create(salesPerDeptData);
      }

      // Update department name from m_dept table
      await this.updateDepartmentName(data.dep_kd);

      return result;
    } catch (error) {
      logger.error(`Error in saveOrUpdateSalesPerDept: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update department name from m_dept table
   * @param {string} dep_kd - Department code
   * @returns {Promise<void>}
   */
  async updateDepartmentName(dep_kd) {
    try {
      // Import MDept model here to avoid circular dependency
      const MDept = require("../../models/m_dept.model");
      
      // Find department in m_dept table (now JSON-based)
      const department = await MDept.findByPk(dep_kd);

      if (department) {
        // Update dep_name in sales_per_dept table
        await SalesPerDept.update({ dep_name: department.dep_nm }, { where: { dep_kd } });
        // logger.info(`Updated department name for dep_kd: ${dep_kd} to ${department.dep_nm}`);
      } else {
        logger.warn(`Department with code ${dep_kd} not found in m_dept table`);
      }
    } catch (error) {
      logger.error(`Error updating department name: ${error.message}`);
      // Don't throw the error to prevent disrupting the main flow
    }
  }

  /**
   * Get sales per department data
   * @param {Object} filters - Filters for query
   * @returns {Promise<Array>} Sales per department data
   */
  async getSalesPerDept(filters) {
    try {
      const { cab, periode, tipestore } = filters;

      const whereClause = {
        cab,
        periode,
        tipestore,
      };

      const data = await SalesPerDept.findAll({
        where: whereClause,
        order: [["dep_kd", "ASC"]],
      });

      return data;
    } catch (error) {
      logger.error(`Error in getSalesPerDept: ${error.message}`);
      throw error;
    }
  }

  /**
   * Compare sales per department data between two periods
   * @param {Object} filters - Filters for query
   * @returns {Promise<Array>} Comparison data
   */
  async compareSalesPerDept(filters) {
    try {
      const { cab, periode1, periode2, tipestore } = filters;

      // Get data for first period
      const data1 = await SalesPerDept.findAll({
        where: {
          cab,
          periode: periode1,
          tipestore,
        },
        order: [["dep_kd", "ASC"]],
      });

      // Get data for second period
      const data2 = await SalesPerDept.findAll({
        where: {
          cab,
          periode: periode2,
          tipestore,
        },
        order: [["dep_kd", "ASC"]],
      });

      // Create a map of department codes to data for quick lookup
      const depMap1 = new Map();
      const depMap2 = new Map();

      data1.forEach(item => depMap1.set(item.dep_kd, item));
      data2.forEach(item => depMap2.set(item.dep_kd, item));

      // Get all unique department codes
      const allDepCodes = new Set([...depMap1.keys(), ...depMap2.keys()]);

      // Create comparison data
      const comparisonData = [];

      allDepCodes.forEach(depKd => {
        const item1 = depMap1.get(depKd);
        const item2 = depMap2.get(depKd);

        // Skip if department doesn't exist in both periods
        if (!item1 && !item2) return;

        const comparison = {
          dep_kd: depKd,
          dep_name: (item1 ? item1.dep_name : item2.dep_name) || `Department ${depKd}`,
          periode1: {
            periode: periode1,
            qty_sales: item1 ? item1.qty_sales : 0,
            total_sales: item1 ? item1.total_sales : 0,
            total_hpp: item1 ? item1.total_hpp : 0,
            margin_rp: item1 ? item1.margin_rp : 0,
            margin_percent: item1 ? item1.margin_percent : 0,
            harga_jual_per_pcs: item1 ? item1.harga_jual_per_pcs : 0,
            hpp_per_pcs: item1 ? item1.hpp_per_pcs : 0,
          },
          periode2: {
            periode: periode2,
            qty_sales: item2 ? item2.qty_sales : 0,
            total_sales: item2 ? item2.total_sales : 0,
            total_hpp: item2 ? item2.total_hpp : 0,
            margin_rp: item2 ? item2.margin_rp : 0,
            margin_percent: item2 ? item2.margin_percent : 0,
            harga_jual_per_pcs: item2 ? item2.harga_jual_per_pcs : 0,
            hpp_per_pcs: item2 ? item2.hpp_per_pcs : 0,
          },
          diff: {
            qty_sales: (item2 ? item2.qty_sales : 0) - (item1 ? item1.qty_sales : 0),
            total_sales: (item2 ? item2.total_sales : 0) - (item1 ? item1.total_sales : 0),
            total_hpp: (item2 ? item2.total_hpp : 0) - (item1 ? item1.total_hpp : 0),
            margin_rp: (item2 ? item2.margin_rp : 0) - (item1 ? item1.margin_rp : 0),
            margin_percent: (item2 ? item2.margin_percent : 0) - (item1 ? item1.margin_percent : 0),
            harga_jual_per_pcs: (item2 ? item2.harga_jual_per_pcs : 0) - (item1 ? item1.harga_jual_per_pcs : 0),
            hpp_per_pcs: (item2 ? item2.hpp_per_pcs : 0) - (item1 ? item1.hpp_per_pcs : 0),
          },
        };

        comparisonData.push(comparison);
      });

      return comparisonData;
    } catch (error) {
      logger.error(`Error in compareSalesPerDept: ${error.message}`);
      throw error;
    }
  }
}

module.exports = SalesPerDeptService;
