/**
 * Test script for Prep Closing API endpoints
 * Tests all CRUD operations for prep-closing module
 */

import axios from 'axios';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const API_URL = `${BASE_URL}/api`;

// Test configuration
const testConfig = {
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
};

// Test data
const testPrepClosingData = {
  cab: 'T001',
  kdtk: 'S001',
  key: 'TEST_KEY_001',
  nilai: 1000.50,
  valid: 1
};

let authToken = null;
let createdRecordId = null;

/**
 * Helper function to make authenticated requests
 */
async function makeRequest(method, url, data = null) {
  const config = {
    method,
    url: `${API_URL}${url}`,
    ...testConfig
  };

  if (authToken) {
    config.headers.Authorization = `Bearer ${authToken}`;
  }

  if (data) {
    config.data = data;
  }

  return axios(config);
}

/**
 * Test login functionality
 */
async function testLogin() {
  console.log('\n=== Testing Login ===');
  try {
    const response = await makeRequest('post', '/auth/login', {
      username: 'admin',
      password: 'admin123'
    });

    if (response.data && response.data.token) {
      authToken = response.data.token;
      console.log('✅ Login successful');
      console.log('User:', response.data.user.username);
      return true;
    } else {
      console.log('❌ Login failed - no token received');
      console.log('Response:', response.data);
      return false;
    }
  } catch (error) {
    console.log('❌ Login failed:', error.response?.data?.message || error.message);
    return false;
  }
}

/**
 * Test GET all prep closing records
 */
async function testGetAllPrepClosing() {
  console.log('\n=== Testing GET All Prep Closing ===');
  try {
    const response = await makeRequest('get', '/prep-closing?limit=10');
    
    console.log('Response status:', response.status);
    console.log('Response data type:', typeof response.data);
    
    if (response.data && response.data.success) {
      const data = response.data.data;
      console.log('Data type:', typeof data);
      console.log('Is array:', Array.isArray(data));
      
      if (Array.isArray(data)) {
        console.log(`✅ GET All successful - Found ${data.length} records`);
        console.log('Sample record:', data[0] || 'No records found');
      } else {
        console.log('✅ GET All successful - Data structure:', data);
      }
      return true;
    } else {
      console.log('❌ GET All failed - unexpected response structure');
      console.log('Response:', response.data);
      return false;
    }
  } catch (error) {
    console.log('❌ GET All failed:', error.response?.data?.message || error.message);
    return false;
  }
}

/**
 * Test CREATE prep closing record
 */
async function testCreatePrepClosing() {
  console.log('\n=== Testing CREATE Prep Closing ===');
  try {
    const response = await makeRequest('post', '/prep-closing', testPrepClosingData);
    
    if (response.data.success && response.data.data) {
      createdRecordId = response.data.data.id;
      console.log('✅ CREATE successful');
      console.log('Created record ID:', createdRecordId);
      console.log('Created record:', response.data.data);
      return true;
    } else {
      console.log('❌ CREATE failed - no data returned');
      console.log('Response:', response.data);
      return false;
    }
  } catch (error) {
    console.log('❌ CREATE failed:', error.response?.data?.message || error.message);
    if (error.response?.data?.error) {
      console.log('Error details:', error.response.data.error);
    }
    return false;
  }
}

/**
 * Test GET prep closing by ID
 */
async function testGetPrepClosingById() {
  console.log('\n=== Testing GET Prep Closing by ID ===');
  
  if (!createdRecordId) {
    console.log('⏭️ Skipping GET by ID - no record created');
    return false;
  }

  try {
    const response = await makeRequest('get', `/prep-closing/${createdRecordId}`);
    
    if (response.data.success && response.data.data) {
      console.log('✅ GET by ID successful');
      console.log('Retrieved record:', response.data.data);
      return true;
    } else {
      console.log('❌ GET by ID failed - no data returned');
      return false;
    }
  } catch (error) {
    console.log('❌ GET by ID failed:', error.response?.data?.message || error.message);
    return false;
  }
}

/**
 * Test UPDATE prep closing record
 */
async function testUpdatePrepClosing() {
  console.log('\n=== Testing UPDATE Prep Closing ===');
  
  if (!createdRecordId) {
    console.log('⏭️ Skipping UPDATE - no record created');
    return false;
  }

  try {
    const updateData = {
      nilai: 2000.75,
      valid: 1
    };

    const response = await makeRequest('put', `/prep-closing/${createdRecordId}`, updateData);
    
    if (response.data.success) {
      console.log('✅ UPDATE successful');
      console.log('Updated record:', response.data.data);
      return true;
    } else {
      console.log('❌ UPDATE failed');
      console.log('Response:', response.data);
      return false;
    }
  } catch (error) {
    console.log('❌ UPDATE failed:', error.response?.data?.message || error.message);
    return false;
  }
}

/**
 * Test DELETE prep closing record
 */
async function testDeletePrepClosing() {
  console.log('\n=== Testing DELETE Prep Closing ===');
  
  if (!createdRecordId) {
    console.log('⏭️ Skipping DELETE - no record created');
    return false;
  }

  try {
    const response = await makeRequest('delete', `/prep-closing/${createdRecordId}`);
    
    if (response.data.success) {
      console.log('✅ DELETE successful');
      console.log('Deleted record:', response.data.data);
      return true;
    } else {
      console.log('❌ DELETE failed');
      console.log('Response:', response.data);
      return false;
    }
  } catch (error) {
    console.log('❌ DELETE failed:', error.response?.data?.message || error.message);
    return false;
  }
}

/**
 * Test GET with filters
 */
async function testGetWithFilters() {
  console.log('\n=== Testing GET with Filters ===');
  try {
    const response = await makeRequest('get', `/prep-closing?cab=${testPrepClosingData.cab}&limit=5`);
    
    if (response.data.success) {
      const data = response.data.data;
      console.log('✅ GET with Filters successful');
      console.log(`Found ${Array.isArray(data) ? data.length : 'unknown'} records with filter`);
      return true;
    } else {
      console.log('❌ GET with Filters failed');
      return false;
    }
  } catch (error) {
    console.log('❌ GET with Filters failed:', error.response?.data?.message || error.message);
    return false;
  }
}

/**
 * Test GET statistics
 */
async function testGetStats() {
  console.log('\n=== Testing GET Statistics ===');
  try {
    const response = await makeRequest('get', '/prep-closing/stats');
    
    if (response.data.success && response.data.data) {
      console.log('✅ GET Stats successful');
      console.log('Statistics:', response.data.data);
      return true;
    } else {
      console.log('❌ GET Stats failed');
      return false;
    }
  } catch (error) {
    console.log('❌ GET Stats failed:', error.response?.data?.message || error.message);
    return false;
  }
}

/**
 * Run all tests
 */
async function runAllTests() {
  console.log('🚀 Starting Prep Closing API Tests...');
  console.log('Base URL:', BASE_URL);
  
  const tests = [
    { name: 'Login', fn: testLogin },
    { name: 'GET All', fn: testGetAllPrepClosing },
    { name: 'CREATE', fn: testCreatePrepClosing },
    { name: 'GET by ID', fn: testGetPrepClosingById },
    { name: 'UPDATE', fn: testUpdatePrepClosing },
    { name: 'GET with Filters', fn: testGetWithFilters },
    { name: 'GET Statistics', fn: testGetStats },
    { name: 'DELETE', fn: testDeletePrepClosing }
  ];

  let passed = 0;
  let total = tests.length;

  for (const test of tests) {
    const result = await test.fn();
    if (result) passed++;
    
    // Add delay between tests
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('\n' + '='.repeat(50));
  console.log(`📊 Test Results: ${passed}/${total} tests passed`);
  console.log(`Success Rate: ${((passed/total) * 100).toFixed(1)}%`);
  console.log('='.repeat(50));

  process.exit(passed === total ? 0 : 1);
}

// Run tests
runAllTests().catch(error => {
  console.error('❌ Test runner failed:', error);
  process.exit(1);
});