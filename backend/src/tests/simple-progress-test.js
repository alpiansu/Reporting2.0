// Simple test to verify progress system prevents multiple processes
import dotenv from 'dotenv';
import ProgressHelper from '../services/progress/ProgressHelper.js';

dotenv.config();

async function testMultipleProcessPrevention() {
  console.log('\n=== Testing Multiple Process Prevention ===');
  
  try {
    // Start first process
    console.log('1. Starting first process...');
    const process1 = ProgressHelper.start({
      cab: 'TEST001',
      period: '2024-01',
      message: 'Starting test process 1',
      details: {
        totalStores: 10,
        processType: 'test_process_1'
      }
    });
    console.log('✓ First process started:', process1);
    
    // Try to start second process of different type
    console.log('2. Trying to start second process (different type)...');
    try {
      const process2 = ProgressHelper.start({
        cab: 'TEST002',
        period: '2024-02',
        message: 'Starting test process 2',
        details: {
          totalStores: 5,
          processType: 'test_process_2'
        }
      });
      console.log('✗ Second process should have been blocked but started:', process2);
    } catch (error) {
      console.log('✓ Second process correctly blocked:', error.message);
    }
    
    // Check active processes
    console.log('3. Checking active processes...');
    const hasActive = ProgressHelper.hasAnyActiveProcess();
    console.log('Has any active process:', hasActive);
    
    const allActive = ProgressHelper.getAllActiveProcesses();
    console.log('All active processes:', allActive.length);
    
    // Complete first process
    console.log('4. Completing first process...');
    ProgressHelper.complete(process1, 'Process completed successfully', { success: true });
    console.log('✓ First process completed');
    
    // Verify no active processes
    const hasActiveAfter = ProgressHelper.hasAnyActiveProcess();
    console.log('Has any active process after completion:', hasActiveAfter);
    
    console.log('\n✓ Test completed successfully!');
    
  } catch (error) {
    console.error('✗ Test failed:', error.message);
    console.error(error.stack);
  }
}

// Run the test
testMultipleProcessPrevention()
  .then(() => {
    console.log('\nTest execution finished.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Test execution failed:', error);
    process.exit(1);
  });

export { testMultipleProcessPrevention };