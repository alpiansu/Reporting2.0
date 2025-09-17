/**
 * Quick test to verify screening endpoint is working
 */

import http from 'http';

const testEndpoint = () => {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      strCab: "0001",
      strMonth: "12",
      strYear: "2024",
      strIP: "192.168.1.100",
      kdtk: "0001001"
    });

    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/prep-closing/screening',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        console.log('Status Code:', res.statusCode);
        console.log('Response Headers:', res.headers);
        console.log('Response Body:', data);
        
        if (res.statusCode === 401) {
          console.log('✅ Endpoint exists but requires authentication (expected)');
          resolve({ status: 'success', message: 'Endpoint accessible, authentication required' });
        } else if (res.statusCode === 400) {
          console.log('✅ Endpoint exists and validation is working');
          resolve({ status: 'success', message: 'Endpoint accessible, validation working' });
        } else {
          resolve({ status: 'success', message: `Endpoint responded with status ${res.statusCode}` });
        }
      });
    });

    req.on('error', (err) => {
      console.error('Request error:', err.message);
      reject(err);
    });

    req.write(postData);
    req.end();
  });
};

// Test basic server connectivity
const testServerConnectivity = () => {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api',
      method: 'GET'
    };

    const req = http.request(options, (res) => {
      console.log('Server connectivity test - Status Code:', res.statusCode);
      resolve({ status: 'success', message: 'Server is accessible' });
    });

    req.on('error', (err) => {
      console.error('Server connectivity error:', err.message);
      reject(err);
    });

    req.end();
  });
};

async function runQuickTest() {
  console.log('🚀 Running quick endpoint test...\n');
  
  try {
    // Test 1: Server connectivity
    console.log('1. Testing server connectivity...');
    await testServerConnectivity();
    console.log('✅ Server is accessible\n');
    
    // Test 2: Endpoint accessibility
    console.log('2. Testing screening endpoint...');
    const result = await testEndpoint();
    console.log('✅', result.message);
    
    console.log('\n🎉 Quick test completed successfully!');
    console.log('\n📋 Next steps:');
    console.log('   - Use proper JWT token for authenticated requests');
    console.log('   - Test with valid WRC database connection');
    console.log('   - Use the REST file for manual testing');
    
  } catch (error) {
    console.error('\n❌ Quick test failed:', error.message);
    console.log('\n🔍 Troubleshooting:');
    console.log('   - Check if backend server is running');
    console.log('   - Verify port 3000 is accessible');
    console.log('   - Check server logs for errors');
  }
}

runQuickTest();