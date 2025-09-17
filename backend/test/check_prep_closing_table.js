/**
 * Script sederhana untuk mengecek tabel prep_closing di database
 */

import config from '../src/config/index.js';
const { resilientDb } = config;

async function checkPrepClosingTable() {
  try {
    console.log('Checking prep_closing table...');
    
    const sequelize = await resilientDb.getDatabase();
    if (!sequelize) {
      console.log('❌ Database connection not available');
      return;
    }
    
    console.log('✅ Database connected');
    
    // Check if table exists
    const queryInterface = sequelize.getQueryInterface();
    const tables = await queryInterface.showAllTables();
    
    console.log('📋 Available tables:', tables);
    
    if (tables.includes('prep_closing')) {
      console.log('✅ prep_closing table exists');
      
      // Get table structure
      const tableInfo = await queryInterface.describeTable('prep_closing');
      console.log('📊 Table structure:');
      Object.keys(tableInfo).forEach(column => {
        const info = tableInfo[column];
        console.log(`  ${column}: ${info.type} ${info.allowNull ? 'NULL' : 'NOT NULL'} ${info.primaryKey ? 'PRIMARY KEY' : ''}`);
      });
      
      // Count records
      const [results] = await sequelize.query('SELECT COUNT(*) as count FROM prep_closing');
      console.log(`📊 Total records: ${results[0].count}`);
      
    } else {
      console.log('❌ prep_closing table does not exist');
      console.log('Creating table...');
      
      // Import and create model
      const PrepClosingStagingService = (await import('../src/modules/prep-closing/prep_closing_staging.service.js')).default;
      const service = new PrepClosingStagingService();
      const model = await service.getModel();
      await model.sync();
      
      console.log('✅ prep_closing table created');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkPrepClosingTable();