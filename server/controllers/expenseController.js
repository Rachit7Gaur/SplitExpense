
const mongoose = require('mongoose');
const Expense = require('../models/Expense');
const Group = require('../models/Group');
const User = require('../models/User');
const calculateGroupFinancials = require('../services/groupFinancialService');

function validRupeeAmount(value) {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value > 0 &&
    Number.isSafeInteger(value * 100)
  );
}

function validUniqueMemberIds(ids, validIds) {
  if (!Array.isArray(ids) || ids.length === 0) return false;

  const unique = new Set(ids);

  return (
    unique.size === ids.length &&
    ids.every((id) =>
      typeof id === 'string' &&
      mongoose.isValidObjectId(id) &&
      validIds.has(id)
    )
  );
}

function distributeEqual(amount, userIds) {
  const base = Math.floor(amount / userIds.length);
  const remainder = amount % userIds.length;

  return userIds.map((user, index) => ({
    user,
    amount: base + (index < remainder ? 1 : 0),
  }));
}

async function createExpense(req, res) {
  try {
    const { groupId } = req.params;
    const {
      description,
      amount,
      contributions,
      splitType = 'equal',
      splitBetween,
      customSplits,
    } = req.body;

    if (!mongoose.isValidObjectId(groupId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid group ID.',
      });
    }

    if (
      typeof description !== 'string' ||
      !description.trim() ||
      description.trim().length > 150
    ) {
      return res.status(400).json({
        success: false,
        message: 'Enter a valid expense description.',
      });
    }

    if (!validRupeeAmount(amount)) {
      return res.status(400).json({
        success: false,
        message: 'Enter a valid amount with up to two decimal places.',
      });
    }

    if (!['equal', 'custom'].includes(splitType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid split type.',
      });
    }

    const user = await User.findOne({ firebaseUid: req.user.uid });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User profile not found.',
      });
    }

    const group = await Group.findOne({
      _id: groupId,
      members: user._id,
    });

    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Group not found or you are not a member.',
      });
    }

    const validIds = new Set(group.members.map((id) => id.toString()));
    const amountInPaise = Math.round(amount * 100);

    // Validate contributors independently of split participants.
    if (!Array.isArray(contributions) || contributions.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Add at least one contributor.',
      });
    }

    const contributorIds = contributions.map((item) => item.userId);

    if (!validUniqueMemberIds(contributorIds, validIds)) {
      return res.status(400).json({
        success: false,
        message: 'Contributors must be unique members of this group.',
      });
    }

    let contributionAllocations = 0;

    const normalizedContributions = [];

    for (const item of contributions) {
      if (!validRupeeAmount(item.amount)) {
        return res.status(400).json({
          success: false,
          message: 'Enter a valid contribution amount for every contributor.',
        });
      }

      const contributionInPaise = Math.round(item.amount * 100);
      contributionAllocations += contributionInPaise;

      normalizedContributions.push({
        user: item.userId,
        amount: contributionInPaise,
      });
    }

    if (
      !Number.isSafeInteger(contributionAllocations) ||
      contributionAllocations !== amountInPaise
    ) {
      return res.status(400).json({
        success: false,
        message: 'Contributor amounts must add up to the expense amount.',
      });
    }

    // Validate split participants independently.
    if (!validUniqueMemberIds(splitBetween, validIds)) {
      return res.status(400).json({
        success: false,
        message: 'Select at least one valid member for the split.',
      });
    }

    let splits;

    if (splitType === 'equal') {
      splits = distributeEqual(amountInPaise, splitBetween);
    } else {
      if (!Array.isArray(customSplits) || customSplits.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Enter custom shares for the selected members.',
        });
      }

      const customIds = customSplits.map((item) => item.userId);

      if (
        customIds.length !== splitBetween.length ||
        !validUniqueMemberIds(customIds, validIds) ||
        !splitBetween.every((id) => customIds.includes(id))
      ) {
        return res.status(400).json({
          success: false,
          message: 'Custom shares must match the selected split members.',
        });
      }

      splits = [];
      let splitTotal = 0;

      for (const item of customSplits) {
        if (!validRupeeAmount(item.amount)) {
          return res.status(400).json({
            success: false,
            message: 'Enter a valid custom share for every member.',
          });
        }

        const shareInPaise = Math.round(item.amount * 100);
        splitTotal += shareInPaise;

        splits.push({
          user: item.userId,
          amount: shareInPaise,
        });
      }

      if (
        !Number.isSafeInteger(splitTotal) ||
        splitTotal !== amountInPaise
      ) {
        return res.status(400).json({
          success: false,
          message: 'Custom shares must add up to the expense amount.',
        });
      }
    }

    const expense = await Expense.create({
      description: description.trim(),
      amount: amountInPaise,
      contributions: normalizedContributions,
      groupId,
      splits,
      splitType,
    });

    await expense.populate([
      { path: 'contributions.user', select: 'name email' },
      { path: 'splits.user', select: 'name email' },
    ]);

    return res.status(201).json({
      success: true,
      message: 'Expense created successfully.',
      data: { expense },
    });
  } catch (error) {
    console.error('Create expense error:', error);

    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Unable to create expense.',
    });
  }
}

async function getGroupExpenses(req, res) {
  try {
    const { groupId } = req.params;

    if (!mongoose.isValidObjectId(groupId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid group ID.',
      });
    }

    const user = await User.findOne({ firebaseUid: req.user.uid });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User profile not found.',
      });
    }

    const group = await Group.findOne({
      _id: groupId,
      members: user._id,
    });

    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Group not found or you are not a member.',
      });
    }

    const expenses = await Expense.find({ groupId })
      .sort({ createdAt: -1 })
      .populate('paidBy', 'name email')
      .populate('contributions.user', 'name email')
      .populate('splits.user', 'name email');

    return res.status(200).json({
      success: true,
      count: expenses.length,
      data: { expenses },
    });
  } catch (error) {
    console.error('Get expenses error:', error);

    return res.status(500).json({
      success: false,
      message: 'Unable to fetch expenses.',
    });
  }
}

async function getGroupBalances(req, res) {
  try {
    const { groupId } = req.params;

    if (!mongoose.isValidObjectId(groupId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid group ID.',
      });
    }

    const user = await User.findOne({ firebaseUid: req.user.uid });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User profile not found.',
      });
    }

    const group = await Group.findOne({
      _id: groupId,
      members: user._id,
    }).populate('members', 'name email');

    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Group not found or access denied.',
      });
    }

    const expenses = await Expense.find({ groupId: group._id });
    const financials = calculateGroupFinancials(group, expenses);

    return res.status(200).json({
      success: true,
      data: { balances: financials.balances },
    });
  } catch (error) {
    console.error('Get group balances error:', error);

    return res.status(500).json({
      success: false,
      message: 'Unable to calculate group balances.',
    });
  }
}

async function getGroupSettlements(req, res) {
  try {
    const { groupId } = req.params;

    if (!mongoose.isValidObjectId(groupId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid group ID.',
      });
    }

    const user = await User.findOne({ firebaseUid: req.user.uid });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User profile not found.',
      });
    }

    const group = await Group.findOne({
      _id: groupId,
      members: user._id,
    }).populate('members', 'name email');

    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Group not found or access denied.',
      });
    }

    const expenses = await Expense.find({ groupId: group._id });
    const financials = calculateGroupFinancials(group, expenses);

    return res.status(200).json({
      success: true,
      data: { settlements: financials.settlements },
    });
  } catch (error) {
    console.error('Get group settlements error:', error);

    return res.status(500).json({
      success: false,
      message: 'Unable to calculate group settlements.',
    });
  }
}

module.exports = {
  createExpense,
  getGroupExpenses,
  getGroupBalances,
  getGroupSettlements,
};
