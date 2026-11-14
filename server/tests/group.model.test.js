
require('dotenv').config();

const mongoose = require('mongoose');
const Group = require('../models/Group');

async function testGroupModel() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB connected for testing.');

    const user1 = new mongoose.Types.ObjectId();
    const user2 = new mongoose.Types.ObjectId();

    // Test 1: Valid group
    const validGroup = new Group({
      name: 'Goa Trip',
      createdBy: user1,
      members: [user1, user2]
    });

    await validGroup.validate();
    console.log('PASS: Valid group accepted.');

    // Test 2: Missing group name
    const missingNameGroup = new Group({
      createdBy: user1,
      members: [user1]
    });

    try {
      await missingNameGroup.validate();
      console.log('FAIL: Missing group name was accepted.');
    } catch (error) {
      console.log('PASS: Missing group name rejected.');
    }

    // Test 3: Name too short
    const shortNameGroup = new Group({
      name: 'G',
      createdBy: user1,
      members: [user1]
    });

    try {
      await shortNameGroup.validate();
      console.log('FAIL: Short group name was accepted.');
    } catch (error) {
      console.log('PASS: Short group name rejected.');
    }

    // Test 4: Duplicate members
    const duplicateMemberGroup = new Group({
      name: 'College Trip',
      createdBy: user1,
      members: [user1, user2, user1]
    });

    try {
      await duplicateMemberGroup.validate();
      console.log('FAIL: Duplicate members were accepted.');
    } catch (error) {
      console.log('PASS: Duplicate members rejected.');
    }

    // Test 5: Missing creator
    const missingCreatorGroup = new Group({
      name: 'Weekend Trip',
      members: [user1]
    });

    try {
      await missingCreatorGroup.validate();
      console.log('FAIL: Missing creator was accepted.');
    } catch (error) {
      console.log('PASS: Missing creator rejected.');
    }
  } catch (error) {
    console.error('Test setup failed:', error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

testGroupModel();
