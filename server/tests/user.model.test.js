
require('dotenv').config();

const mongoose = require('mongoose');
const User = require('../models/User');

async function testUserModel() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB connected for testing.');

    // Test 1: Valid user
    const validUser = new User({
      firebaseUid: 'test-firebase-uid-123',
      name: ' Rahul Sharma ',
      email: 'RAHUL@EXAMPLE.COM'
    });

    await validUser.validate();

    console.log('PASS: Valid user accepted.');
    console.log('Trimmed name:', validUser.name);
    console.log('Normalized email:', validUser.email);

    // Test 2: Missing Firebase UID
    const missingUidUser = new User({
      name: 'Rahul Sharma',
      email: 'rahul@example.com'
    });

    try {
      await missingUidUser.validate();
      console.log('FAIL: Missing Firebase UID was accepted.');
    } catch (error) {
      console.log('PASS: Missing Firebase UID rejected.');
    }

    // Test 3: Name too short
    const shortNameUser = new User({
      firebaseUid: 'test-firebase-uid-456',
      name: 'R',
      email: 'short@example.com'
    });

    try {
      await shortNameUser.validate();
      console.log('FAIL: Short name was accepted.');
    } catch (error) {
      console.log('PASS: Short name rejected.');
    }

    // Test 4: Missing email
    const missingEmailUser = new User({
      firebaseUid: 'test-firebase-uid-789',
      name: 'Rahul Sharma'
    });

    try {
      await missingEmailUser.validate();
      console.log('FAIL: Missing email was accepted.');
    } catch (error) {
      console.log('PASS: Missing email rejected.');
    }
  } catch (error) {
    console.error('Test setup failed:', error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

testUserModel();
