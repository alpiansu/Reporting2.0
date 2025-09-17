/**
 * Test file for Screening Pra Closing functionality
 * Tests the getSaldoWrc function and screeningPraClosing endpoint
 */

import axios from 'axios';

// Configuration
const BASE_URL = 'http://localhost:3000';
const API_ENDPOINT = '/api/prep-closing/screening';

// Test data
const testData = {
  strCab: '0001',
  strMonth: '12',
  strYear: '2024',
  strIP: '192.168.1.100',
  kdtk: '0001001'
};

// Authentication token (replace with actual token)
const AUTH_TOKEN = 'your_jwt_token_here';

/**
 * Test the screening pra closing endpoint
 */
async function testScreeningPraClosing() {
  try {
    console.log('🧪 Testing Screening Pra Closing...');
    console.log('📊 Test Data:', testData);
    console.log('🔗 Endpoint:', `${BASE_URL}${API_ENDPOINT}`);
    
    const response = await axios.post(`${BASE_URL}${API_ENDPOINT}`, testData, {
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ Response Status:', response.status);
    console.log('📋 Response Data:', JSON.stringify(response.data, null, 2));
    
    // Validate response structure
    if (response.data.success) {
      const { data } = response.data;
      console.log('📈 Summary:');
      console.log(`   - Total Stores: ${data.summary.total_stores}`);
      console.log(`   - Stores OK: ${data.summary.stores_ok}`);
      console.log(`   - Stores Warning: ${data.summary.stores_warning}`);
      
      if (data.stores && data.stores.length > 0) {
        console.log('🏪 Sample Store Data:');
        console.log(`   - Kode Toko: ${data.stores[0].kode_toko}`);
        console.log(`   - Saldo Akhir: ${data.stores[0].saldo_akh_bln}`);
        console.log(`   - Status: ${data.stores[0].status}`);
      }
    }
    
    return response.data;
    
  } catch (error) {
    console.error('❌ Test Failed:', error.message);
    
    if (error.response) {
      console.error('📄 Error Response:', error.response.status);
      console.error('📝 Error Data:', JSON.stringify(error.response.data, null, 2));
    }
    
    throw error;
  }
}

/**
 * Test with different branch codes
 */
async function testMultipleBranches() {
  const branches = ['0001', '0002', '0003'];
  
  console.log('\n🔄 Testing Multiple Branches...');
  
  for (const cab of branches) {
    try {
      console.log(`\n📍 Testing Branch: ${cab}`);
      
      const testDataForBranch = {
        ...testData,
        strCab: cab
      };
      
      const response = await axios.post(`${BASE_URL}${API_ENDPOINT}`, testDataForBranch, {
        headers: {
          'Authorization': `Bearer ${AUTH_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.data.success) {
        console.log(`✅ Branch ${cab}: ${response.data.data.summary.total_stores} stores found`);
      } else {
        console.log(`⚠️ Branch ${cab}: ${response.data.message}`);
      }
      
    } catch (error) {
      console.error(`❌ Branch ${cab} failed:`, error.response?.data?.message || error.message);
    }
  }
}

/**
 * Test validation errors
 */
async function testValidation() {
  console.log('\n🔍 Testing Validation...');
  
  const invalidTestCases = [
    { data: { strMonth: '12', strYear: '2024' }, description: 'Missing strCab' },
    { data: { strCab: '0001', strYear: '2024' }, description: 'Missing strMonth' },
    { data: { strCab: '0001', strMonth: '12' }, description: 'Missing strYear' },
    { data: {}, description: 'Empty data' }
  ];
  
  for (const testCase of invalidTestCases) {
    try {
      console.log(`\n🧪 Testing: ${testCase.description}`);
      
      const response = await axios.post(`${BASE_URL}${API_ENDPOINT}`, testCase.data, {
        headers: {
          'Authorization': `Bearer ${AUTH_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log(`⚠️ Unexpected success for ${testCase.description}`);
      
    } catch (error) {
      if (error.response && error.response.status === 400) {
        console.log(`✅ Validation working: ${error.response.data.message}`);
      } else {
        console.error(`❌ Unexpected error: ${error.message}`);
      }
    }
  }
}

/**
 * Main test runner
 */
async function runTests() {
  console.log('🚀 Starting Screening Pra Closing Tests\n');
  
  try {
    // Test 1: Basic functionality
    await testScreeningPraClosing();
    
    // Test 2: Multiple branches
    await testMultipleBranches();
    
    // Test 3: Validation
    await testValidation();
    
    console.log('\n🎉 All tests completed!');
    
  } catch (error) {
    console.error('\n💥 Test suite failed:', error.message);
    process.exit(1);
  }
}

// Instructions for running the test
console.log(`
📋 Instructions for running this test:

1. Make sure the backend server is running on ${BASE_URL}
2. Replace 'your_jwt_token_here' with a valid JWT token
3. Update test data (strCab, strMonth, strYear) as needed
4. Run: node test_screening_pra_closing.js

⚠️ Note: This test requires:
   - Valid WRC database connection
   - Proper authentication token
   - Backend server running
`);

// Uncomment the line below to run tests automatically
// runTests();

export { testScreeningPraClosing, testMultipleBranches, testValidation, runTests };