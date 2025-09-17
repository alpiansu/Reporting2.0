/**
 * Script untuk memastikan tabel prep_closing dibuat di database MySQL
 * Script ini akan:
 * 1. Koneksi ke database
 * 2. Memicu pembuatan tabel prep_closing melalui model Sequelize
 * 3. Verifikasi struktur tabel
 * 4. Insert sample data untuk testing
 */

import config from '../src/config/index.js';
const { resilientDb } = config;
import logger from '../src/config/logger.js';
import PrepClosingStagingService from '../src/modules/prep-closing/prep_closing_staging.service.js';

async function setupPrepClosingTable() {
  try {
    console.log('🚀 Starting prep_closing table setup...');
    
    // 1. Koneksi ke database
    const sequelize = await resilientDb.getDatabase();
    if (!sequelize) {
      throw new Error('Database connection not available');
    }
    console.log('✅ Database connection established');

    // 2. Inisialisasi service dan model
    const prepClosingStagingService = new PrepClosingStagingService();
    const model = await prepClosingStagingService.getModel();
    console.log('✅ PrepClosing model initialized');

    // 3. Sync model untuk membuat tabel
    await model.sync({ force: false }); // force: false = hanya buat jika belum ada
    console.log('✅ prep_closing table created/verified');

    // 4. Verifikasi struktur tabel
    const tableInfo = await sequelize.getQueryInterface().describeTable('prep_closing');
    console.log('📋 Table structure:');
    console.table(tableInfo);

    // 5. Test insert sample data
    console.log('🧪 Testing sample data insertion...');
    
    const sampleData = [
      {
        cab: '0001',
        kdtk: '0001',
        key: 'test_key_1',
        nilai: 'test_value_1',
        valid: true
      },
      {
        cab: '0001',
        kdtk: '0002',
        key: 'test_key_2',
        nilai: 'test_value_2',
        valid: true
      },
      {
        cab: '0002',
        kdtk: '0001',
        key: 'test_key_3',
        nilai: 'test_value_3',
        valid: false
      }
    ];

    // Insert sample data
    for (const data of sampleData) {
      try {
        const result = await prepClosingStagingService.createPrepClosing(data);
        console.log(`✅ Inserted: ${data.cab}-${data.kdtk}-${data.key}`);
      } catch (error) {
        if (error.message.includes('Validation error')) {
          console.log(`⚠️  Record already exists: ${data.cab}-${data.kdtk}-${data.key}`);
        } else {
          console.error(`❌ Error inserting ${data.cab}-${data.kdtk}-${data.key}:`, error.message);
        }
      }
    }

    // 6. Test query data
    console.log('🔍 Testing data retrieval...');
    const allData = await prepClosingStagingService.getPrepClosingData();
    console.log(`📊 Total records in database: ${allData.total}`);
    console.log('Sample records:');
    console.table(allData.data.slice(0, 5)); // Show first 5 records

    // 7. Test filters
    console.log('🔍 Testing filtered queries...');
    const filteredData = await prepClosingStagingService.getPrepClosingData({ cab: '0001' });
    console.log(`📊 Records for cab '0001': ${filteredData.total}`);

    console.log('🎉 prep_closing table setup completed successfully!');
    
    return {
      success: true,
      tableStructure: tableInfo,
      totalRecords: allData.total,
      sampleRecords: allData.data.slice(0, 3)
    };

  } catch (error) {
    console.error('❌ Error setting up prep_closing table:', error);
    throw error;
  }
}

// Jalankan setup jika file ini dijalankan langsung
if (import.meta.url === `file://${process.argv[1]}`) {
  setupPrepClosingTable()
    .then((result) => {
      console.log('✅ Setup completed:', result);
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Setup failed:', error);
      process.exit(1);
    });
}

export default setupPrepClosingTable;