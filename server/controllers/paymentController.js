
const mongoose = require('mongoose');

const Payment = require('../models/Payment');
const Expense = require('../models/Expense');
const Group = require('../models/Group');
const User = require('../models/User');

const calculateGroupFinancials = require('../services/groupFinancialService');
const withGroupTransaction = require('../utils/withGroupTransaction');

// --------------------------------------------------
// COMMON HELPERS
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

function getId(value) {
  if (!value) return null;
  return value._id ? value._id.toString() : value.toString();
}

function isGroupMember(group, userId) {
  return group.members.some(
    (member) => getId(member) === userId.toString()
  );
}

async function getGroupForCurrentUser(groupId, firebaseUid) {
  if (!mongoose.isValidObjectId(groupId)) {
    return {
      error: 'Invalid group ID.',
      status: 400,
    };
  }

  const user = await User.findOne({ firebaseUid });

  if (!user) {
    return {
      error: 'User profile not found.',
      status: 404,
    };
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

// This function must be called inside an active transaction.
async function getFinancialContext(groupId, session) {
  const group = await Group.findById(groupId)
    .populate('members', 'name email')
    .session(session);

  if (!group) {
    throw createControllerError('Group not found.', 404);
  }

  const expenses = await Expense.find({ groupId })
    .session(session);

  const confirmedPayments = await Payment.find({
    groupId,
    status: 'confirmed',
  }).session(session);

  const financials = calculateGroupFinancials(
    group,
    expenses,
    confirmedPayments
  );

  return {
    group,
    expenses,
    confirmedPayments,
    financials,
  };
}

function findSuggestedSettlement(
  settlements,
  fromUserId,
  toUserId
) {
  return settlements.find(
    (settlement) =>
      getId(settlement.from.userId) === fromUserId.toString() &&
      getId(settlement.to.userId) === toUserId.toString()
  );
}

async function getPendingAmount(
  groupId,
  fromUserId,
  toUserId,
  session,
  excludePaymentId = null
) {
  const filter = {
    groupId,
    fromUser: fromUserId,
    toUser: toUserId,
    status: 'pending',
  };

  if (excludePaymentId) {
    filter._id = { $ne: excludePaymentId };
  }

  const pendingPayments = await Payment.find(filter).session(session);

  return pendingPayments.reduce(
    (total, payment) => total + payment.amount,
    0
  );
}

async function populatePayment(paymentId) {
  return Payment.findById(paymentId)
    .populate('fromUser', 'name email')
    .populate('toUser', 'name email')
    .populate('recordedBy', 'name email');
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
// CREATE PAYMENT
// POST /api/groups/:groupId/payments
// --------------------------------------------------

async function createPayment(req, res) {
  try {
    const { groupId } = req.params;

    const {
      toUserId,
      amount,
      method,
      note = '',
    } = req.body || {};

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

    if (!mongoose.isValidObjectId(toUserId)) {
      return res.status(400).json({
        success: false,
        message: 'Select a valid receiver.',
      });
    }

    const receiverId = new mongoose.Types.ObjectId(toUserId);

    if (receiverId.equals(user._id)) {
      return res.status(400).json({
        success: false,
        message: 'You cannot record a payment to yourself.',
      });
    }

    if (!validRupeeAmount(amount)) {
      return res.status(400).json({
        success: false,
        message:
          'Enter a valid payment amount with up to two decimal places.',
      });
    }

    if (!['upi', 'cash', 'bank_transfer'].includes(method)) {
      return res.status(400).json({
        success: false,
        message: 'Select a valid payment method.',
      });
    }

    if (
      typeof note !== 'string' ||
      note.trim().length > 200
    ) {
      return res.status(400).json({
        success: false,
        message: 'Payment note cannot exceed 200 characters.',
      });
    }

    const amountInPaise = toPaise(amount);

    const paymentId = await withGroupTransaction(
      groupId,
      async (session, lockedGroup) => {
        if (!isGroupMember(lockedGroup, user._id)) {
          throw createControllerError(
            'You are no longer a member of this group.',
            403
          );
        }

        if (!isGroupMember(lockedGroup, receiverId)) {
          throw createControllerError(
            'Receiver must be a member of this group.',
            400
          );
        }

        const context = await getFinancialContext(
          lockedGroup._id,
          session
        );

        const suggestedSettlement = findSuggestedSettlement(
          context.financials.settlements,
          user._id,
          receiverId
        );

        if (!suggestedSettlement) {
          throw createControllerError(
            'There is no current settlement due from you to this member.',
            400
          );
        }

        const pendingTotal = await getPendingAmount(
          lockedGroup._id,
          user._id,
          receiverId,
          session
        );

        const availableAmount =
          suggestedSettlement.amount - pendingTotal;

        if (
          !Number.isSafeInteger(availableAmount) ||
          availableAmount <= 0 ||
          amountInPaise > availableAmount
        ) {
          throw createControllerError(
            'Payment amount exceeds the remaining settlement amount.',
            400
          );
        }

        const payment = new Payment({
          groupId: lockedGroup._id,
          fromUser: user._id,
          toUser: receiverId,
          amount: amountInPaise,
          method,
          note: note.trim(),
          recordedBy: user._id,
          status: 'pending',
        });

        await payment.save({ session });

        return payment._id.toString();
      }
    );

    const payment = await populatePayment(paymentId);

    return res.status(201).json({
      success: true,
      message:
        'Payment recorded. Waiting for receiver confirmation.',
      data: { payment },
    });
  } catch (error) {
    return sendControllerError(
      res,
      error,
      'Unable to record payment.'
    );
  }
}

// --------------------------------------------------
// GET GROUP PAYMENTS
// GET /api/groups/:groupId/payments
// --------------------------------------------------

async function getGroupPayments(req, res) {
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

// --------------------------------------------------
// SUBMIT UPI TRANSACTION REFERENCE
// PATCH /api/groups/:groupId/payments/:paymentId/reference
// --------------------------------------------------

async function submitPaymentReference(req, res) {
  try {
    const { groupId, paymentId } = req.params;
    const { transactionReference } = req.body || {};

    if (
      !mongoose.isValidObjectId(groupId) ||
      !mongoose.isValidObjectId(paymentId)
    ) {
      return res.status(400).json({
        success: false,
        message: 'Invalid group ID or payment ID.',
      });
    }

    if (
      typeof transactionReference !== 'string' ||
      !/^[a-zA-Z0-9/_-]{6,100}$/.test(
        transactionReference.trim()
      )
    ) {
      return res.status(400).json({
        success: false,
        message: 'Enter a valid transaction reference.',
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

    const updatedPaymentId = await withGroupTransaction(
      groupId,
      async (session, lockedGroup) => {
        if (!isGroupMember(lockedGroup, user._id)) {
          throw createControllerError(
            'You are no longer a member of this group.',
            403
          );
        }

        const payment = await Payment.findOne({
          _id: paymentId,
          groupId: lockedGroup._id,
        }).session(session);

        if (!payment) {
          throw createControllerError('Payment not found.', 404);
        }

        if (getId(payment.fromUser) !== user._id.toString()) {
          throw createControllerError(
            'Only the payer can submit the transaction reference.',
            403
          );
        }

        if (payment.method !== 'upi') {
          throw createControllerError(
            'Transaction references are supported only for UPI payments.',
            400
          );
        }

        if (payment.status !== 'pending') {
          throw createControllerError(
            'This payment has already been processed.',
            409
          );
        }

        if (payment.transactionReference) {
          throw createControllerError(
            'A transaction reference has already been submitted.',
            409
          );
        }

        const updatedPayment = await Payment.findOneAndUpdate(
          {
            _id: payment._id,
            groupId: lockedGroup._id,
            fromUser: user._id,
            method: 'upi',
            status: 'pending',
            transactionReference: null,
          },
          {
            $set: {
              transactionReference: transactionReference.trim(),
              referenceSubmittedAt: new Date(),
            },
          },
          {
            session,
            returnDocument: 'after',
            runValidators: true,
          }
        );

        if (!updatedPayment) {
          throw createControllerError(
            'Unable to submit reference. Refresh and try again.',
            409
          );
        }

        return updatedPayment._id.toString();
      }
    );

    const payment = await populatePayment(updatedPaymentId);

    return res.status(200).json({
      success: true,
      message:
        'Transaction reference submitted. Waiting for receiver confirmation.',
      data: { payment },
    });
  } catch (error) {
    return sendControllerError(
      res,
      error,
      'Unable to submit transaction reference.'
    );
  }
}

// --------------------------------------------------
// CONFIRM PAYMENT
// PATCH /api/groups/:groupId/payments/:paymentId/confirm
// --------------------------------------------------

async function confirmPayment(req, res) {
  try {
    const { groupId, paymentId } = req.params;

    if (
      !mongoose.isValidObjectId(groupId) ||
      !mongoose.isValidObjectId(paymentId)
    ) {
      return res.status(400).json({
        success: false,
        message: 'Invalid group ID or payment ID.',
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

    const confirmedPaymentId = await withGroupTransaction(
      groupId,
      async (session, lockedGroup) => {
        if (!isGroupMember(lockedGroup, user._id)) {
          throw createControllerError(
            'You are no longer a member of this group.',
            403
          );
        }

        const payment = await Payment.findOne({
          _id: paymentId,
          groupId: lockedGroup._id,
        }).session(session);

        if (!payment) {
          throw createControllerError('Payment not found.', 404);
        }

        if (getId(payment.toUser) !== user._id.toString()) {
          throw createControllerError(
            'Only the receiver can confirm this payment.',
            403
          );
        }

        if (payment.status !== 'pending') {
          throw createControllerError(
            'This payment has already been processed.',
            409
          );
        }

        if (
          payment.method === 'upi' &&
          !payment.transactionReference
        ) {
          throw createControllerError(
            'The payer must submit a UPI transaction reference before confirmation.',
            400
          );
        }

        if (
          !isGroupMember(lockedGroup, payment.fromUser) ||
          !isGroupMember(lockedGroup, payment.toUser)
        ) {
          throw createControllerError(
            'Both payment participants must be group members.',
            409
          );
        }

        const context = await getFinancialContext(
          lockedGroup._id,
          session
        );

        const suggestedSettlement = findSuggestedSettlement(
          context.financials.settlements,
          payment.fromUser,
          payment.toUser
        );

        if (!suggestedSettlement) {
          throw createControllerError(
            'This payment no longer matches the current settlement. Review the latest balances.',
            409
          );
        }

        const otherPendingTotal = await getPendingAmount(
          lockedGroup._id,
          payment.fromUser,
          payment.toUser,
          session,
          payment._id
        );

        const availableAmount =
          suggestedSettlement.amount - otherPendingTotal;

        if (
          !Number.isSafeInteger(availableAmount) ||
          availableAmount <= 0 ||
          payment.amount > availableAmount
        ) {
          throw createControllerError(
            'This payment exceeds the remaining settlement. Review the latest balances.',
            409
          );
        }

        const updatedPayment = await Payment.findOneAndUpdate(
          {
            _id: payment._id,
            groupId: lockedGroup._id,
            toUser: user._id,
            status: 'pending',
          },
          {
            $set: {
              status: 'confirmed',
              confirmedAt: new Date(),
              rejectedAt: null,
            },
          },
          {
            session,
            returnDocument: 'after',
            runValidators: true,
          }
        );

        if (!updatedPayment) {
          throw createControllerError(
            'Payment was already processed. Refresh and try again.',
            409
          );
        }

        return updatedPayment._id.toString();
      }
    );

    const payment = await populatePayment(confirmedPaymentId);

    return res.status(200).json({
      success: true,
      message: 'Payment confirmed successfully.',
      data: { payment },
    });
  } catch (error) {
    return sendControllerError(
      res,
      error,
      'Unable to confirm payment.'
    );
  }
}

// --------------------------------------------------
// REJECT PAYMENT
// PATCH /api/groups/:groupId/payments/:paymentId/reject
// --------------------------------------------------

async function rejectPayment(req, res) {
  try {
    const { groupId, paymentId } = req.params;

    if (
      !mongoose.isValidObjectId(groupId) ||
      !mongoose.isValidObjectId(paymentId)
    ) {
      return res.status(400).json({
        success: false,
        message: 'Invalid group ID or payment ID.',
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

    const rejectedPaymentId = await withGroupTransaction(
      groupId,
      async (session, lockedGroup) => {
        if (!isGroupMember(lockedGroup, user._id)) {
          throw createControllerError(
            'You are no longer a member of this group.',
            403
          );
        }

        const payment = await Payment.findOne({
          _id: paymentId,
          groupId: lockedGroup._id,
        }).session(session);

        if (!payment) {
          throw createControllerError('Payment not found.', 404);
        }

        if (getId(payment.toUser) !== user._id.toString()) {
          throw createControllerError(
            'Only the receiver can reject this payment.',
            403
          );
        }

        if (payment.status !== 'pending') {
          throw createControllerError(
            'This payment has already been processed.',
            409
          );
        }

        const updatedPayment = await Payment.findOneAndUpdate(
          {
            _id: payment._id,
            groupId: lockedGroup._id,
            toUser: user._id,
            status: 'pending',
          },
          {
            $set: {
              status: 'rejected',
              rejectedAt: new Date(),
              confirmedAt: null,
            },
          },
          {
            session,
            returnDocument: 'after',
            runValidators: true,
          }
        );

        if (!updatedPayment) {
          throw createControllerError(
            'Payment was already processed. Refresh and try again.',
            409
          );
        }

        return updatedPayment._id.toString();
      }
    );

    const payment = await populatePayment(rejectedPaymentId);

    return res.status(200).json({
      success: true,
      message: 'Payment rejected.',
      data: { payment },
    });
  } catch (error) {
    return sendControllerError(
      res,
      error,
      'Unable to reject payment.'
    );
  }
}

// --------------------------------------------------
// EXPORTS
// --------------------------------------------------

module.exports = {
  createPayment,
  getGroupPayments,
  submitPaymentReference,
  confirmPayment,
  rejectPayment,
};
