/**
 * Test script for m_dept JSON implementation
 */
const MDeptService = require('./m_dept.service');
const MDept = require('../../models/m_dept.model');
const fs = require('fs');
const path = require('path');

async function testMDeptImplementation() {
  console.log('Starting m_dept JSON implementation test...');
  
  try {
    // 1. Test MDeptService initialization
    console.log('\n1. Testing MDeptService initialization...');
    const mDeptService = new MDeptService();
    await mDeptService.init();
    console.log('✓ MDeptService initialized successfully');
    
    // 2. Test file creation
    console.log('\n2. Testing JSON file creation...');
    const dataDir = path.join(process.cwd(), 'data');
    const jsonFilePath = path.join(dataDir, 'm_dept.json');
    
    if (fs.existsSync(jsonFilePath)) {
      console.log(`✓ JSON file exists at: ${jsonFilePath}`);
    } else {
      console.error(`✗ JSON file does not exist at: ${jsonFilePath}`);
      return;
    }
    
    // 3. Test getAllDepartments
    console.log('\n3. Testing getAllDepartments...');
    const allDepts = await mDeptService.getAllDepartments();
    console.log(`✓ Retrieved ${allDepts.length} departments`);
    
    // 4. Test createDepartment
    console.log('\n4. Testing createDepartment...');
    const newDept = {
      dep_kd: 'TEST01',
      dep_nm: 'Test Department',
      div_kd: 'DIV01',
      dep_mgr: 'Test Manager'
    };
    
    const createdDept = await mDeptService.createDepartment(newDept);
    console.log('✓ Created department:', createdDept);
    
    // 5. Test getDepartmentByCode
    console.log('\n5. Testing getDepartmentByCode...');
    const foundDept = await mDeptService.getDepartmentByCode('TEST01');
    if (foundDept && foundDept.dep_kd === 'TEST01') {
      console.log('✓ Found department by code:', foundDept);
    } else {
      console.error('✗ Failed to find department by code');
    }
    
    // 6. Test updateDepartment
    console.log('\n6. Testing updateDepartment...');
    const updatedData = {
      dep_nm: 'Updated Test Department',
      dep_mgr: 'Updated Manager'
    };
    
    const updatedDept = await mDeptService.updateDepartment('TEST01', updatedData);
    console.log('✓ Updated department:', updatedDept);
    
    // 7. Test MDept model methods
    console.log('\n7. Testing MDept model methods...');
    
    // 7.1 Test findAll
    const modelDepts = await MDept.findAll();
    console.log(`✓ MDept.findAll() returned ${modelDepts.length} departments`);
    
    // 7.2 Test findByPk
    const modelDept = await MDept.findByPk('TEST01');
    if (modelDept && modelDept.dep_kd === 'TEST01') {
      console.log('✓ MDept.findByPk() found department:', modelDept);
    } else {
      console.error('✗ MDept.findByPk() failed to find department');
    }
    
    // 8. Clean up test data
    console.log('\n8. Cleaning up test data...');
    // Read current data
    const jsonData = JSON.parse(fs.readFileSync(jsonFilePath, 'utf8'));
    // Filter out test department
    const filteredData = jsonData.filter(dept => dept.dep_kd !== 'TEST01');
    // Write back to file
    fs.writeFileSync(jsonFilePath, JSON.stringify(filteredData, null, 2));
    console.log('✓ Test data cleaned up');
    
    console.log('\nAll tests completed successfully!');
  } catch (error) {
    console.error('Test failed with error:', error);
  }
}

// Run the test
testMDeptImplementation();