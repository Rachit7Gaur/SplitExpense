require('dotenv').config();

const mongoose = require('mongoose');
const Expense = require('../models/Expense');

async function testExpenseModel() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    console.log('MongoDB connected for testing.');

    const validExpense = new Expense({
      description: 'Dinner',
      amount: 50000,
      paidBy: new mongoose.Types.ObjectId(),
      groupId: new mongoose.Types.ObjectId()
    });

    await validExpense.validate();
    console.log('PASS: Valid expense accepted.');

    const invalidExpense = new Expense({
      description: 'Dinner',
      amount: -500,
      paidBy: new mongoose.Types.ObjectId(),
      groupId: new mongoose.Types.ObjectId()
    });

    try {
      await invalidExpense.validate();
      console.log('FAIL: Negative amount was accepted.');
    } catch (error) {
      console.log('PASS: Negative amount rejected.');
    }

    const decimalExpense = new Expense({
      description: 'Lunch',
      amount: 100.5,
      paidBy: new mongoose.Types.ObjectId(),
      groupId: new mongoose.Types.ObjectId()
    });

    try {
      await decimalExpense.validate();
      console.log('FAIL: Decimal amount was accepted.');
    } catch (error) {
      console.log('PASS: Decimal amount rejected.');
    }
  } catch (error) {
    console.error('Test setup failed:', error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

testExpenseModel();
