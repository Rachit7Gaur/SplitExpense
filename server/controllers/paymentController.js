
const mongoose = require('mongoose');
const Payment = require('../models/Payment');
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

async function getFinancialContext(groupId) {
  const group = await Group.findById(groupId).populate(
    'members',
    'name email'
  );

  if (!group) return null;

  const [expenses, confirmedPayments] = await Promise.all([
    Expense.find({ groupId }),
    Payment.find({ groupId, status: 'confirmed' }),
  ]);

  const financials = calculateGroupFinancials(
    group,
    expenses,
    confirmedPayments
  );

  return { group, expenses, confirmedPayments, financials };
}

function findSuggestedSettlement(settlements, fromUserId, toUserId) {
  return settlements.find(
    (settlement) =>
      settlement.from.userId.toString() === fromUserId.toString() &&
      settlement.to.userId.toString() === toUserId.toString()
  );
}

async function createPayment(req, res) {
  try {
    const { groupId } = req.params;
    const { toUserId, amount, method, note = '' } = req.body;

    const access = await getGroupForCurrentUser(groupId, req.user.uid);

    if (access.error) {
      return res.status(access.status).json({
        success: false,
        message: access.error,
      });
    }

    const { user, group } = access;

    if (!mongoose.isValidObjectId(toUserId)) {
      return res.status(400).json({
        success: false,
        message: 'Select a valid receiver.',
      });
    }

    if (toUserId === user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'You cannot record a payment to yourself.',
      });
    }

    if (!group.members.some((id) => id.toString() === toUserId)) {
      return res.status(400).json({
        success: false,
        message: 'Receiver must be a member of this group.',
      });
    }

    if (!validRupeeAmount(amount)) {
      return res.status(400).json({
        success: false,
        message: 'Enter a valid payment amount with up to two decimal places.',
      });
    }

    if (!['upi', 'cash', 'bank_transfer'].includes(method)) {
      return res.status(400).json({
        success: false,
        message: 'Select a valid payment method.',
      });
    }

    if (typeof note !== 'string' || note.trim().length > 200) {
      return res.status(400).json({
        success: false,
        message: 'Payment note cannot exceed 200 characters.',
      });
    }

    const amountInPaise = Math.round(amount * 100);

    const context = await getFinancialContext(group._id);

    if (!context) {
      return res.status(404).json({
        success: false,
        message: 'Group not found.',
      });
    }

    const suggestedSettlement = findSuggestedSettlement(
      context.financials.settlements,
      user._id,
      toUserId
    );

    if (!suggestedSettlement) {
      return res.status(400).json({
        success: false,
        message: 'There is no current settlement due from you to this member.',
      });
    }

    // Reserve amounts already recorded as pending for this same pair.
    const pendingPayments = await Payment.find({
      groupId: group._id,
      fromUser: user._id,
      toUser: toUserId,
      status: 'pending',
    });

    const pendingTotal = pendingPayments.reduce(
      (total, payment) => total + payment.amount,
      0
    );

    const availableAmount = suggestedSettlement.amount - pendingTotal;

    if (
      !Number.isSafeInteger(availableAmount) ||
      amountInPaise > availableAmount
    ) {
      return res.status(400).json({
        success: false,
        message: 'Payment amount exceeds the remaining settlement amount.',
        data: {
          remainingAmount: Math.max(availableAmount, 0) / 100,
        },
      });
    }

    const payment = await Payment.create({
      groupId: group._id,
      fromUser: user._id,
      toUser: toUserId,
      amount: amountInPaise,
      method,
      note: note.trim(),
      recordedBy: user._id,
      status: 'pending',
    });

    await payment.populate([
      { path: 'fromUser', select: 'name email' },
      { path: 'toUser', select: 'name email' },
      { path: 'recordedBy', select: 'name email' },
    ]);

    return res.status(201).json({
      success: true,
      message: 'Payment recorded. Waiting for receiver confirmation.',
      data: { payment },
    });
  } catch (error) {
    console.error('Create payment error:', error);

    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Unable to record payment.',
    });
  }
}

async function getGroupPayments(req, res) {
  try {
    const { groupId } = req.params;

    const access = await getGroupForCurrentUser(groupId, req.user.uid);

    if (access.error) {
      return res.status(access.status).json({
        success: false,
        message: access.error,
      });
    }

    const payments = await Payment.find({
      groupId: access.group._id,
    })
      .sort({ createdAt: -1 })
      .populate('fromUser', 'name email')
      .populate('toUser', 'name email')
      .populate('recordedBy', 'name email');

    return res.status(200).json({
      success: true,
      count: payments.length,
      data: { payments },
    });
  } catch (error) {
    console.error('Get payments error:', error);

    return res.status(500).json({
      success: false,
      message: 'Unable to fetch payments.',
    });
  }
}

async function confirmPayment(req, res) {
  try {
    const { groupId, paymentId } = req.params;

    if (!mongoose.isValidObjectId(paymentId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment ID.',
      });
    }

    const access = await getGroupForCurrentUser(groupId, req.user.uid);

    if (access.error) {
      return res.status(access.status).json({
        success: false,
        message: access.error,
      });
    }

    const payment = await Payment.findOne({
      _id: paymentId,
      groupId: access.group._id,
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found.',
      });
    }

    if (payment.toUser.toString() !== access.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Only the receiver can confirm this payment.',
      });
    }

    if (payment.status !== 'pending') {
      return res.status(409).json({
        success: false,
        message: 'This payment has already been processed.',
      });
    }

    // Recheck the settlement before confirmation.
    const context = await getFinancialContext(access.group._id);

    const suggestedSettlement = findSuggestedSettlement(
      context.financials.settlements,
      payment.fromUser,
      payment.toUser
    );

    if (!suggestedSettlement || payment.amount > suggestedSettlement.amount) {
      return res.status(409).json({
        success: false,
        message: 'This payment no longer matches the current settlement. Please review the latest balances.',
      });
    }

    // Conditional update prevents two simultaneous confirmations.
    const updatedPayment = await Payment.findOneAndUpdate(
      {
        _id: payment._id,
        groupId: access.group._id,
        toUser: access.user._id,
        status: 'pending',
      },
      {
        $set: {
          status: 'confirmed',
          confirmedAt: new Date(),
        },
      },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!updatedPayment) {
      return res.status(409).json({
        success: false,
        message: 'Payment was already processed. Refresh and try again.',
      });
    }

    await updatedPayment.populate([
      { path: 'fromUser', select: 'name email' },
      { path: 'toUser', select: 'name email' },
      { path: 'recordedBy', select: 'name email' },
    ]);

    return res.status(200).json({
      success: true,
      message: 'Payment confirmed successfully.',
      data: { payment: updatedPayment },
    });
  } catch (error) {
    console.error('Confirm payment error:', error);

    return res.status(500).json({
      success: false,
      message: 'Unable to confirm payment.',
    });
  }
}

async function rejectPayment(req, res) {
  try {
    const { groupId, paymentId } = req.params;

    if (!mongoose.isValidObjectId(paymentId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment ID.',
      });
    }

    const access = await getGroupForCurrentUser(groupId, req.user.uid);

    if (access.error) {
      return res.status(access.status).json({
        success: false,
        message: access.error,
      });
    }

    const updatedPayment = await Payment.findOneAndUpdate(
      {
        _id: paymentId,
        groupId: access.group._id,
        toUser: access.user._id,
        status: 'pending',
      },
      {
        $set: {
          status: 'rejected',
          rejectedAt: new Date(),
        },
      },
      {
        new: true,
        runValidators: true,
      }
    ).populate([
      { path: 'fromUser', select: 'name email' },
      { path: 'toUser', select: 'name email' },
      { path: 'recordedBy', select: 'name email' },
    ]);

    if (!updatedPayment) {
      return res.status(404).json({
        success: false,
        message: 'Pending payment not found, or you are not its receiver.',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Payment rejected.',
      data: { payment: updatedPayment },
    });
  } catch (error) {
    console.error('Reject payment error:', error);

    return res.status(500).json({
      success: false,
      message: 'Unable to reject payment.',
    });
  }
}

module.exports = {
  createPayment,
  getGroupPayments,
  confirmPayment,
  rejectPayment,
};
