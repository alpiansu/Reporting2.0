/**
 * SQL Query Builder utility
 * Helps build and manage SQL queries for different screening types
 */

/**
 * Get SQL queries for a specific screening type
 * @param {string} screeningType - Type of screening (full, quick, custom)
 * @returns {object} - Object containing SQL queries for the screening type
 */
const getQueriesForScreeningType = (screeningType) => {
  const queries = {
    // Quick screening - basic checks
    quick: {
      databaseInfo: `
        SELECT @@version as version, 
               DB_NAME() as database_name, 
               SERVERPROPERTY('ServerName') as server_name
      `,
      tableCount: `
        SELECT COUNT(*) as table_count 
        FROM INFORMATION_SCHEMA.TABLES 
        WHERE TABLE_TYPE = 'BASE TABLE'
      `,
      databaseSize: `
        SELECT 
          DB_NAME() AS database_name,
          CAST(SUM(size * 8 / 1024.0) AS DECIMAL(18,2)) AS size_mb
        FROM sys.database_files
        WHERE type_desc = 'ROWS'
      `,
      recentTransactions: `
        SELECT TOP 10 
          t.TransactionID, 
          t.TransactionDate, 
          t.Amount, 
          t.TransactionType
        FROM Transactions t
        ORDER BY t.TransactionDate DESC
      `,
    },
    
    // Full screening - comprehensive checks
    full: {
      databaseInfo: `
        SELECT @@version as version, 
               DB_NAME() as database_name, 
               SERVERPROPERTY('ServerName') as server_name,
               SERVERPROPERTY('Edition') as edition,
               SERVERPROPERTY('ProductVersion') as product_version
      `,
      tableCount: `
        SELECT COUNT(*) as table_count 
        FROM INFORMATION_SCHEMA.TABLES 
        WHERE TABLE_TYPE = 'BASE TABLE'
      `,
      databaseSize: `
        SELECT 
          DB_NAME() AS database_name,
          CAST(SUM(size * 8 / 1024.0) AS DECIMAL(18,2)) AS size_mb
        FROM sys.database_files
        WHERE type_desc = 'ROWS'
      `,
      tableDetails: `
        SELECT 
          t.TABLE_SCHEMA as schema_name,
          t.TABLE_NAME as table_name,
          p.rows as row_count,
          CAST(SUM(a.total_pages) * 8 / 1024.0 AS DECIMAL(18,2)) as size_mb
        FROM 
          INFORMATION_SCHEMA.TABLES t
        INNER JOIN 
          sys.tables st ON t.TABLE_NAME = st.name
        INNER JOIN      
          sys.indexes i ON st.object_id = i.object_id
        INNER JOIN 
          sys.partitions p ON i.object_id = p.object_id AND i.index_id = p.index_id
        INNER JOIN 
          sys.allocation_units a ON p.partition_id = a.container_id
        WHERE 
          t.TABLE_TYPE = 'BASE TABLE'
        GROUP BY 
          t.TABLE_SCHEMA, t.TABLE_NAME, p.rows
        ORDER BY 
          size_mb DESC
      `,
      indexDetails: `
        SELECT 
          t.name as table_name,
          i.name as index_name,
          i.type_desc as index_type,
          CAST(SUM(s.used_page_count) * 8 / 1024.0 AS DECIMAL(18,2)) as size_mb
        FROM 
          sys.indexes i
        INNER JOIN 
          sys.tables t ON i.object_id = t.object_id
        INNER JOIN 
          sys.dm_db_partition_stats s ON i.object_id = s.object_id AND i.index_id = s.index_id
        GROUP BY 
          t.name, i.name, i.type_desc
        ORDER BY 
          size_mb DESC
      `,
      recentTransactions: `
        SELECT TOP 100 
          t.TransactionID, 
          t.TransactionDate, 
          t.Amount, 
          t.TransactionType,
          t.Status
        FROM Transactions t
        ORDER BY t.TransactionDate DESC
      `,
      userActivity: `
        SELECT TOP 100
          u.Username,
          a.ActivityDate,
          a.ActivityType,
          a.Description
        FROM 
          UserActivity a
        INNER JOIN 
          Users u ON a.UserID = u.UserID
        ORDER BY 
          a.ActivityDate DESC
      `,
      errorLogs: `
        SELECT TOP 100
          LogID,
          LogDate,
          LogLevel,
          Message,
          Source
        FROM 
          ErrorLogs
        WHERE 
          LogLevel IN ('ERROR', 'CRITICAL')
        ORDER BY 
          LogDate DESC
      `,
    },
    
    // Custom screening - placeholder for custom queries
    custom: {
      // These would be populated dynamically based on user input
      databaseInfo: `
        SELECT @@version as version, 
               DB_NAME() as database_name, 
               SERVERPROPERTY('ServerName') as server_name
      `,
    },
  };
  
  return queries[screeningType] || {};
};

/**
 * Add a custom query to the custom screening type
 * @param {string} queryName - Name of the query
 * @param {string} querySQL - SQL statement
 * @returns {object} - Updated custom queries object
 */
const addCustomQuery = (queryName, querySQL) => {
  // In a real implementation, this might store to a database
  // For now, we'll just return the new query object
  return {
    [queryName]: querySQL
  };
};

module.exports = {
  getQueriesForScreeningType,
  addCustomQuery,
};