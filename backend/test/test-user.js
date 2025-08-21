/**
 * Test script for User JSON implementation
 */
const path = require('path');
const fs = require('fs');
const User = require('../src/models/user.model');
const UserService = require('../src/modules/user/user.service');

// Create a new instance of UserService for testing
const userService = new UserService();

// Test file path
const testFilePath = path.join(process.cwd(), 'data/m_users.json');

// Main test function
async function testUserImplementation() {
  console.log('\n===== TESTING USER JSON IMPLEMENTATION =====\n');

  try {
    // Test 1: Initialize UserService
    console.log('Test 1: Initializing UserService...');
    await userService.init();
    console.log('✅ UserService initialized successfully');

    // Test 2: Check if m_users.json file exists
    console.log('\nTest 2: Checking if m_users.json file exists...');
    if (fs.existsSync(testFilePath)) {
      console.log(`✅ m_users.json file found at ${testFilePath}`);
    } else {
      console.error(`❌ m_users.json file not found at ${testFilePath}`);
      return;
    }

    // Test 3: Get all users
    console.log('\nTest 3: Getting all users...');
    const allUsers = await User.findAll();
    console.log(`✅ Found ${allUsers.length} users`);
    console.log('First user:', allUsers[0]);

    // Test 4: Create a new user
    console.log('\nTest 4: Creating a new user...');
    // Use timestamp to create unique username and email
    const timestamp = Date.now();
    const newUserData = {
      username: `testuser_${timestamp}`,
      email: `testuser_${timestamp}@example.com`,
      password: 'password123',
      fullName: 'Test User',
      role: 'user'
    };

    const newUser = await User.create(newUserData);
    console.log('✅ Created new user:', newUser);

    // Test 5: Get user by ID
    console.log('\nTest 5: Getting user by ID...');
    const foundUser = await User.findByPk(newUser.id);
    if (foundUser) {
      console.log(`✅ Found user with ID ${newUser.id}:`, foundUser);
    } else {
      console.error(`❌ User with ID ${newUser.id} not found`);
    }

    // Test 6: Find user by credentials
    console.log('\nTest 6: Finding user by credentials...');
    const userByCredentials = await User.findByCredentials('testuser');
    if (userByCredentials) {
      console.log('✅ Found user by credentials:', userByCredentials.username);
    } else {
      console.error('❌ User not found by credentials');
    }

    // Test 7: Update user
    console.log('\nTest 7: Updating user...');
    const updateResult = await User.update(
      { fullName: 'Updated Test User' },
      { where: { id: newUser.id } }
    );
    console.log('Update result:', updateResult);

    // Get the updated user to verify changes and get the latest user object
    const updatedUser = await User.findByPk(newUser.id);
    if (updatedUser && updatedUser.fullName === 'Updated Test User') {
      console.log('✅ User updated successfully:', updatedUser);
      
      // Test 8: Clean up - Delete test user
      console.log('\nTest 8: Cleaning up - Deleting test user...');
      // We don't have a direct delete method in the User model, so use the service
      // Get all users first to see what's available
      const allUsers = await User.findAll();
      console.log('All user IDs before deletion:', allUsers.map(u => u.id));
      
      // Use the ID from the updatedUser object which should be the most current
      console.log(`Attempting to delete user with ID: ${updatedUser.id} (type: ${typeof updatedUser.id})`);
      // Ensure we're passing a number
      const userId = Number(updatedUser.id);
      const deleteResult = await userService.deleteUser(userId);
      if (deleteResult) {
        console.log(`✅ Test user with ID ${userId} deleted successfully`);
      } else {
        console.error(`❌ Failed to delete test user with ID ${userId}`);
      }
    } else {
      console.error('❌ User update failed');
    }

    console.log('\n===== USER JSON IMPLEMENTATION TESTS COMPLETED =====\n');
  } catch (error) {
    console.error('Error during testing:', error);
  }
}

// Run the tests
testUserImplementation();