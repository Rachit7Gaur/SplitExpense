const mongoose = require('mongoose');
const Expense = require('../models/Expense');
const Payment = require('../models/Payment'); // NEW
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
    ids.every(
      (id) =>
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

function validateExpensePayload(body, validIds) {
  const {
    description,
    amount,
    contributions,
    splitType = 'equal',
    splitBetween,
    customSplits,
  } = body;

  if (
    typeof description !== 'string' ||
    !description.trim() ||
    description.trim().length > 150
  ) {
    return {
      error: 'Enter a valid expense description.',
    };
  }

  if (!validRupeeAmount(amount)) {
    return {
      error: 'Enter a valid amount with up to two decimal places.',
    };
  }

  if (!['equal', 'custom'].includes(splitType)) {
    return { error: 'Invalid split type.' };
  }

  const amountInPaise = Math.round(amount * 100);

  // Contributors validation
  if (!Array.isArray(contributions) || contributions.length === 0) {
    return { error: 'Add at least one contributor.' };
  }

  const contributorIds = contributions.map((item) => item?.userId);

  if (!validUniqueMemberIds(contributorIds, validIds)) {
    return {
      error: 'Contributors must be unique members of this group.',
    };
  }

  let contributionTotal = 0;
  const normalizedContributions = [];

  for (const item of contributions) {
    if (!validRupeeAmount(item.amount)) {
      return {
        error: 'Enter a valid contribution amount for every contributor.',
      };
    }

    const contributionInPaise = Math.round(item.amount * 100);
    contributionTotal += contributionInPaise;

    normalizedContributions.push({
      user: item.userId,
      amount: contributionInPaise,
    });
  }

  if (
    !Number.isSafeInteger(contributionTotal) ||
    contributionTotal !== amountInPaise
  ) {
    return {
      error: 'Contributor amounts must add up to the expense amount.',
    };
  }

  // Split members validation
  if (!validUniqueMemberIds(splitBetween, validIds)) {
    return {
      error: 'Select at least one valid member for the split.',
    };
  }

  let splits;

  if (splitType === 'equal') {
    splits = distributeEqual(amountInPaise, splitBetween);
  } else {
    if (!Array.isArray(customSplits) || customSplits.length === 0) {
      return {
        error: 'Enter custom shares for the selected members.',
      };
    }

    const customIds = customSplits.map((item) => item?.userId);

    if (
      customIds.length !== splitBetween.length ||
      !validUniqueMemberIds(customIds, validIds) ||
      !splitBetween.every((id) => customIds.includes(id))
    ) {
      return {
        error: 'Custom shares must match the selected split members.',
      };
    }

    splits = [];
    let splitTotal = 0;

    for (const item of customSplits) {
      if (!validRupeeAmount(item.amount)) {
        return {
          error: 'Enter a valid custom share for every member.',
        };
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
      return {
        error: 'Custom shares must add up to the expense amount.',
      };
    }
  }

  return {
    data: {
      description: description.trim(),
      amount: amountInPaise,
      contributions: normalizedContributions,
      splits,
      splitType,
    },
  };
}

async function getGroupForCurrentUser(groupId, firebaseUid) {
  if (!mongoose.isValidObjectId(groupId)) {
    return { error: 'Invalid group ID.', status: 400 };
  }

  const user = await User.findOne({ firebaseUid });

  if (!user) {
    return { error: 'User profile not found.', status: 404 };
  }

  const group = await Group.findOne({
    _id: groupId,
    members: user._id,
  });

  if (!group) {
    return {
      error: 'Group not found or you are not a member.',
      status: 404,
    };
  }

  return { user, group };
}

async function createExpense(req, res) {
  try {
    const { groupId } = req.params;

    const access = await getGroupForCurrentUser(groupId, req.user.uid);

    if (access.error) {
      return res.status(access.status).json({
        success: false,
        message: access.error,
      });
    }

    const { user, group } = access;

    const validIds = new Set(group.members.map((id) => id.toString()));

    const validation = validateExpensePayload(req.body, validIds);

    if (validation.error) {
      return res.status(400).json({
        success: false,
        message: validation.error,
      });
    }

    const expense = await Expense.create({
      ...validation.data,
      groupId: group._id,
      createdBy: user._id,
    });

    await expense.populate([
      { path: 'createdBy', select: 'name email' },
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

async function updateExpense(req, res) {
  try {
    const { groupId, expenseId } = req.params;

    if (!mongoose.isValidObjectId(expenseId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid expense ID.',
      });
    }

    const access = await getGroupForCurrentUser(groupId, req.user.uid);

    if (access.error) {
      return res.status(access.status).json({
        success: false,
        message: access.error,
      });
    }

    const { user, group } = access;

    const expense = await Expense.findOne({
      _id: expenseId,
      groupId: group._id,
    });

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: 'Expense not found.',
      });
    }

    // Ownership is checked on the server, not trusted from the client.
    if (!expense.createdBy || expense.createdBy.toString() !== user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Only the person who created this expense can edit it.',
      });
    }

    const validIds = new Set(group.members.map((id) => id.toString()));

    const validation = validateExpensePayload(req.body, validIds);

    if (validation.error) {
      return res.status(400).json({
        success: false,
        message: validation.error,
      });
    }

    Object.assign(expense, validation.data);

    await expense.save();

    await expense.populate([
      { path: 'createdBy', select: 'name email' },
      { path: 'contributions.user', select: 'name email' },
      { path: 'splits.user', select: 'name email' },
    ]);

    return res.status(200).json({
      success: true,
      message: 'Expense updated successfully.',
      data: { expense },
    });
  } catch (error) {
    console.error('Update expense error:', error);

    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Unable to update expense.',
    });
  }
}

async function getGroupExpenses(req, res) {
  try {
    const { groupId } = req.params;

    const access = await getGroupForCurrentUser(groupId, req.user.uid);

    if (access.error) {
      return res.status(access.status).json({
        success: false,
        message: access.error,
      });
    }

    const expenses = await Expense.find({ groupId: access.group._id })
      .sort({ createdAt: -1 })
      .populate('paidBy', 'name email')
      .populate('createdBy', 'name email')
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

    const access = await getGroupForCurrentUser(groupId, req.user.uid);

    if (access.error) {
      return res.status(access.status).json({
        success: false,
        message: access.error,
      });
    }

    const group = await Group.findById(access.group._id).populate(
      'members',
      'name email'
    );

    const [expenses, payments] = await Promise.all([
      Expense.find({ groupId: group._id }),
      Payment.find({
        groupId: group._id,
        status: 'confirmed',
      }),
    ]);

    const financials = calculateGroupFinancials(
      group,
      expenses,
      payments
    );

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

    const access = await getGroupForCurrentUser(groupId, req.user.uid);

    if (access.error) {
      return res.status(access.status).json({
        success: false,
        message: access.error,
      });
    }

    const group = await Group.findById(access.group._id).populate(
      'members',
      'name email'
    );

    const [expenses, payments] = await Promise.all([
      Expense.find({ groupId: group._id }),
      Payment.find({
        groupId: group._id,
        status: 'confirmed',
      }),
    ]);

    const financials = calculateGroupFinancials(
      group,
      expenses,
      payments
    );

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


async function deleteExpense(req, res) {
  try {
    const { groupId, expenseId } = req.params;

    if (!mongoose.isValidObjectId(expenseId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid expense ID.',
      });
    }

    const access = await getGroupForCurrentUser(groupId, req.user.uid);

    if (access.error) {
      return res.status(access.status).json({
        success: false,
        message: access.error,
      });
    }

    const { user, group } = access;

    const expense = await Expense.findOne({
      _id: expenseId,
      groupId: group._id,
    });

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: 'Expense not found.',
      });
    }

    if (
      !expense.createdBy ||
      expense.createdBy.toString() !== user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: 'Only the person who created this expense can delete it.',
      });
    }

    await Expense.deleteOne({ _id: expense._id });

    return res.status(200).json({
      success: true,
      message: 'Expense deleted successfully.',
      data: { expenseId: expense._id },
    });
  } catch (error) {
    console.error('Delete expense error:', error);

    return res.status(500).json({
      success: false,
      message: 'Unable to delete expense.',
    });
  }
}


module.exports = {
  deleteExpense,
  createExpense,
  updateExpense,
  getGroupExpenses,
  getGroupBalances,
  getGroupSettlements,
};