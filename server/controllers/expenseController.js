
const mongoose = require('mongoose');
const Expense = require('../models/Expense');
const Payment = require('../models/Payment');
const Group = require('../models/Group');
const User = require('../models/User');
const calculateGroupFinancials = require('../services/groupFinancialService');
const withGroupTransaction = require('../utils/withGroupTransaction');

// --------------------------------------------------
// HELPERS
// --------------------------------------------------

function createControllerError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function validRupeeAmount(value) {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value <= 0
  ) {
    return false;
  }

  const paise = value * 100;

  return (
    Number.isSafeInteger(Math.round(paise)) &&
    Math.abs(paise - Math.round(paise)) < 1e-7
  );
}

function toPaise(value) {
  return Math.round(value * 100);
}

function validUniqueMemberIds(ids, validIds) {
  if (!Array.isArray(ids) || ids.length === 0) {
    return false;
  }

  const uniqueIds = new Set(ids);

  return (
    uniqueIds.size === ids.length &&
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

function validateExpensePayload(body = {}, validIds) {
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
    return { error: 'Enter a valid expense description.' };
  }

  if (!validRupeeAmount(amount)) {
    return {
      error: 'Enter a valid amount with up to two decimal places.',
    };
  }

  if (!['equal', 'custom'].includes(splitType)) {
    return { error: 'Invalid split type.' };
  }

  const amountInPaise = toPaise(amount);

  // Validate contributors
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

    const contributionInPaise = toPaise(item.amount);
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

  // Validate split members
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

      const shareInPaise = toPaise(item.amount);
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

function getValidMemberIds(group) {
  return new Set(group.members.map((id) => id.toString()));
}

async function populateExpense(expenseId) {
  return Expense.findById(expenseId)
    .populate('paidBy', 'name email')
    .populate('createdBy', 'name email')
    .populate('contributions.user', 'name email')
    .populate('splits.user', 'name email');
}

function sendControllerError(res, error, fallbackMessage) {
  console.error(fallbackMessage, error);

  if (error.statusCode) {
    return res.status(error.statusCode).json({
      success: false,
      message: error.message,
    });
  }

  if (error.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }

  if (
    error.message === 'GROUP_NOT_FOUND' ||
    error.message === 'INVALID_GROUP_ID'
  ) {
    return res.status(404).json({
      success: false,
      message: 'Group not found.',
    });
  }

  return res.status(500).json({
    success: false,
    message: fallbackMessage,
  });
}

// --------------------------------------------------
// CREATE EXPENSE
// --------------------------------------------------

async function createExpense(req, res) {
  try {
    const { groupId } = req.params;

    const access = await getGroupForCurrentUser(
      groupId,
      req.user.uid
    );

    if (access.error) {
      return res.status(access.status).json({
        success: false,
        message: access.error,
      });
    }

    const { user } = access;

    const expenseId = await withGroupTransaction(
      groupId,
      async (session, lockedGroup) => {
        const isMember = lockedGroup.members.some(
          (memberId) => memberId.toString() === user._id.toString()
        );

        if (!isMember) {
          throw createControllerError(
            'You are no longer a member of this group.',
            403
          );
        }

        const validation = validateExpensePayload(
          req.body,
          getValidMemberIds(lockedGroup)
        );

        if (validation.error) {
          throw createControllerError(validation.error, 400);
        }

        const expense = new Expense({
          ...validation.data,
          groupId: lockedGroup._id,
          createdBy: user._id,
        });

        await expense.save({ session });

        return expense._id.toString();
      }
    );

    const expense = await populateExpense(expenseId);

    return res.status(201).json({
      success: true,
      message: 'Expense created successfully.',
      data: { expense },
    });
  } catch (error) {
    return sendControllerError(
      res,
      error,
      'Unable to create expense.'
    );
  }
}

// --------------------------------------------------
// UPDATE EXPENSE
// --------------------------------------------------

async function updateExpense(req, res) {
  try {
    const { groupId, expenseId } = req.params;

    if (
      !mongoose.isValidObjectId(groupId) ||
      !mongoose.isValidObjectId(expenseId)
    ) {
      return res.status(400).json({
        success: false,
        message: 'Invalid group ID or expense ID.',
      });
    }

    const access = await getGroupForCurrentUser(
      groupId,
      req.user.uid
    );

    if (access.error) {
      return res.status(access.status).json({
        success: false,
        message: access.error,
      });
    }

    const { user } = access;

    const updatedExpenseId = await withGroupTransaction(
      groupId,
      async (session, lockedGroup) => {
        const isMember = lockedGroup.members.some(
          (memberId) => memberId.toString() === user._id.toString()
        );

        if (!isMember) {
          throw createControllerError(
            'You are no longer a member of this group.',
            403
          );
        }

        const expense = await Expense.findOne({
          _id: expenseId,
          groupId: lockedGroup._id,
        }).session(session);

        if (!expense) {
          throw createControllerError('Expense not found.', 404);
        }

        if (
          !expense.createdBy ||
          expense.createdBy.toString() !== user._id.toString()
        ) {
          throw createControllerError(
            'Only the person who created this expense can edit it.',
            403
          );
        }

        const validation = validateExpensePayload(
          req.body,
          getValidMemberIds(lockedGroup)
        );

        if (validation.error) {
          throw createControllerError(validation.error, 400);
        }

        Object.assign(expense, validation.data);

        await expense.save({ session });

        return expense._id.toString();
      }
    );

    const expense = await populateExpense(updatedExpenseId);

    return res.status(200).json({
      success: true,
      message: 'Expense updated successfully.',
      data: { expense },
    });
  } catch (error) {
    return sendControllerError(
      res,
      error,
      'Unable to update expense.'
    );
  }
}

// --------------------------------------------------
// GET GROUP EXPENSES
// --------------------------------------------------

async function getGroupExpenses(req, res) {
  try {
    const { groupId } = req.params;

    const access = await getGroupForCurrentUser(
      groupId,
      req.user.uid
    );

    if (access.error) {
      return res.status(access.status).json({
        success: false,
        message: access.error,
      });
    }

    const expenses = await Expense.find({
      groupId: access.group._id,
    })
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

// --------------------------------------------------
// GET GROUP BALANCES
// --------------------------------------------------

async function getGroupBalances(req, res) {
  try {
    const { groupId } = req.params;

    const access = await getGroupForCurrentUser(
      groupId,
      req.user.uid
    );

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

// --------------------------------------------------
// GET GROUP SETTLEMENTS
// --------------------------------------------------

async function getGroupSettlements(req, res) {
  try {
    const { groupId } = req.params;

    const access = await getGroupForCurrentUser(
      groupId,
      req.user.uid
    );

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

// --------------------------------------------------
// DELETE EXPENSE
// --------------------------------------------------

async function deleteExpense(req, res) {
  try {
    const { groupId, expenseId } = req.params;

    if (
      !mongoose.isValidObjectId(groupId) ||
      !mongoose.isValidObjectId(expenseId)
    ) {
      return res.status(400).json({
        success: false,
        message: 'Invalid group ID or expense ID.',
      });
    }

    const access = await getGroupForCurrentUser(
      groupId,
      req.user.uid
    );

    if (access.error) {
      return res.status(access.status).json({
        success: false,
        message: access.error,
      });
    }

    const { user } = access;

    const deletedExpenseId = await withGroupTransaction(
      groupId,
      async (session, lockedGroup) => {
        const isMember = lockedGroup.members.some(
          (memberId) => memberId.toString() === user._id.toString()
        );

        if (!isMember) {
          throw createControllerError(
            'You are no longer a member of this group.',
            403
          );
        }

        const expense = await Expense.findOne({
          _id: expenseId,
          groupId: lockedGroup._id,
        }).session(session);

        if (!expense) {
          throw createControllerError('Expense not found.', 404);
        }

        if (
          !expense.createdBy ||
          expense.createdBy.toString() !== user._id.toString()
        ) {
          throw createControllerError(
            'Only the person who created this expense can delete it.',
            403
          );
        }

        await Expense.deleteOne(
          { _id: expense._id },
          { session }
        );

        return expense._id.toString();
      }
    );

    return res.status(200).json({
      success: true,
      message: 'Expense deleted successfully.',
      data: { expenseId: deletedExpenseId },
    });
  } catch (error) {
    return sendControllerError(
      res,
      error,
      'Unable to delete expense.'
    );
  }
}

// --------------------------------------------------
// EXPORTS
// --------------------------------------------------

module.exports = {
  createExpense,
  updateExpense,
  deleteExpense,
  getGroupExpenses,
  getGroupBalances,
  getGroupSettlements,
};
