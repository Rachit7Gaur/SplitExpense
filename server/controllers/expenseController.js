
const mongoose = require('mongoose');
const Expense = require('../models/Expense');
const Group = require('../models/Group');
const User = require('../models/User');
const calculateSettlements = require('../utils/settlementCalculator');

// Create a new expense
async function createExpense(req, res) {
  try {
    const { groupId } = req.params;
    const { description, amount, paidBy, splitBetween } = req.body;

    // Validate group ID
    if (!mongoose.isValidObjectId(groupId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid group ID.'
      });
    }

    // Validate description
    if (
      typeof description !== 'string' ||
      !description.trim() ||
      description.trim().length > 150
    ) {
      return res.status(400).json({
        success: false,
        message: 'Enter a valid expense description.'
      });
    }

    // Validate amount (received in rupees)
    if (
      typeof amount !== 'number' ||
      !Number.isFinite(amount) ||
      amount <= 0 ||
      !Number.isSafeInteger(amount * 100)
    ) {
      return res.status(400).json({
        success: false,
        message: 'Enter a valid amount with up to two decimal places.'
      });
    }

    // Find logged-in user
    const user = await User.findOne({
      firebaseUid: req.user.uid
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User profile not found.'
      });
    }

    // Find group and verify membership
    const group = await Group.findOne({
      _id: groupId,
      members: user._id
    });

    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Group not found or you are not a member.'
      });
    }

    // Validate payer
    if (!paidBy || !group.members.some(
      (memberId) => memberId.toString() === paidBy
    )) {
      return res.status(400).json({
        success: false,
        message: 'Payer must be a member of this group.'
      });
    }

    // Validate split members
    const selectedMembers = splitBetween || group.members.map(
      (id) => id.toString()
    );

    if (
      !Array.isArray(selectedMembers) ||
      selectedMembers.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: 'Select at least one member for the split.'
      });
    }

    const uniqueMembers = [...new Set(selectedMembers)];

    if (uniqueMembers.length !== selectedMembers.length) {
      return res.status(400).json({
        success: false,
        message: 'Duplicate members are not allowed in a split.'
      });
    }

    const validMemberIds = group.members.map(
      (id) => id.toString()
    );

    const allMembersValid = uniqueMembers.every(
      (id) => validMemberIds.includes(id)
    );

    if (!allMembersValid) {
      return res.status(400).json({
        success: false,
        message: 'All split members must belong to this group.'
      });
    }

    // Convert rupees to paise
    const amountInPaise = Math.round(amount * 100);

    // Calculate equal split without losing paise
    const baseShare = Math.floor(
      amountInPaise / uniqueMembers.length
    );

    const remainder =
      amountInPaise % uniqueMembers.length;

    const splits = uniqueMembers.map((memberId, index) => ({
      user: memberId,
      amount: baseShare + (index < remainder ? 1 : 0)
    }));

    const expense = await Expense.create({
      description: description.trim(),
      amount: amountInPaise,
      paidBy,
      groupId,
      splits
    });

    await expense.populate('paidBy', 'name email');
    await expense.populate('splits.user', 'name email');

    return res.status(201).json({
      success: true,
      message: 'Expense created successfully.',
      data: { expense }
    });

  } catch (error) {
    console.error('Create expense error:', error);

    return res.status(500).json({
      success: false,
      message: 'Unable to create expense.'
    });
  }
}

// Get all expenses of a group
async function getGroupExpenses(req, res) {
  try {
    const { groupId } = req.params;

    if (!mongoose.isValidObjectId(groupId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid group ID.'
      });
    }

    const user = await User.findOne({
      firebaseUid: req.user.uid
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User profile not found.'
      });
    }

    const group = await Group.findOne({
      _id: groupId,
      members: user._id
    });

    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Group not found or you are not a member.'
      });
    }

    const expenses = await Expense.find({ groupId })
      .sort({ createdAt: -1 })
      .populate('paidBy', 'name email')
      .populate('splits.user', 'name email');

    return res.status(200).json({
      success: true,
      count: expenses.length,
      data: { expenses }
    });

  } catch (error) {
    console.error('Get expenses error:', error);

    return res.status(500).json({
      success: false,
      message: 'Unable to fetch expenses.'
    });
  }
}

async function getGroupBalances(req, res) {
  try {
    const { groupId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(groupId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid group ID.'
      });
    }

    const user = await User.findOne({
      firebaseUid: req.user.uid
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User profile not found.'
      });
    }

    const group = await Group.findOne({
      _id: groupId,
      members: user._id
    }).populate('members', 'name email');

    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Group not found or access denied.'
      });
    }

    const expenses = await Expense.find({
      groupId: group._id
    });

    // Initialize every member's balance.
    const balances = new Map();

    group.members.forEach((member) => {
      balances.set(member._id.toString(), {
        userId: member._id,
        name: member.name,
        totalPaid: 0,
        totalShare: 0,
        netBalance: 0
      });
    });

    // Calculate paid amounts and individual shares.
    expenses.forEach((expense) => {
      const payerId = expense.paidBy.toString();

      if (balances.has(payerId)) {
        balances.get(payerId).totalPaid += expense.amount;
      }

      expense.splits.forEach((split) => {
        const memberId = split.user.toString();

        if (balances.has(memberId)) {
          balances.get(memberId).totalShare += split.amount;
        }
      });
    });

    // Calculate net balance for every member.
    const result = Array.from(balances.values()).map((member) => ({
      ...member,
      netBalance: member.totalPaid - member.totalShare
    }));

    return res.status(200).json({
      success: true,
      data: {
        balances: result
      }
    });

  } catch (error) {
    console.error('Get group balances error:', error);

    return res.status(500).json({
      success: false,
      message: 'Unable to calculate group balances.'
    });
  }
}


async function getGroupSettlements(req, res) {
  try {
    const { groupId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(groupId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid group ID.'
      });
    }

    const user = await User.findOne({
      firebaseUid: req.user.uid
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User profile not found.'
      });
    }

    const group = await Group.findOne({
      _id: groupId,
      members: user._id
    }).populate('members', 'name email');

    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Group not found or access denied.'
      });
    }

    const expenses = await Expense.find({
      groupId: group._id
    });

    const balances = new Map();

    group.members.forEach((member) => {
      balances.set(member._id.toString(), {
        userId: member._id,
        name: member.name,
        netBalance: 0
      });
    });

    expenses.forEach((expense) => {
      const payerId = expense.paidBy.toString();

      if (balances.has(payerId)) {
        balances.get(payerId).netBalance += expense.amount;
      }

      expense.splits.forEach((split) => {
        const memberId = split.user.toString();

        if (balances.has(memberId)) {
          balances.get(memberId).netBalance -= split.amount;
        }
      });
    });

    const settlements = calculateSettlements(
      Array.from(balances.values())
    );

    return res.status(200).json({
      success: true,
      data: {
        settlements
      }
    });

  } catch (error) {
    console.error('Get group settlements error:', error);

    return res.status(500).json({
      success: false,
      message: 'Unable to calculate group settlements.'
    });
  }
}

module.exports = {
  createExpense,
  getGroupExpenses,
  getGroupBalances,
  getGroupSettlements
};