const express = require('express');
const authenticateUser = require('../middleware/authMiddleware');
const requireVerifiedEmail = require('../middleware/requireVerifiedEmail');

const {
  validateGroupInput,
  createGroup,
  getMyGroups,
  getGroupById,
  generateInviteLink,
  acceptInvite,
} = require('../controllers/groupController');

const {
  downloadSettlementReport,
} = require('../controllers/settlementReportController');

const {
  createExpense,
  updateExpense,
  deleteExpense,
  getGroupExpenses,
  getGroupBalances,
  getGroupSettlements,
} = require('../controllers/expenseController');

const {
  createPayment,
  getGroupPayments,
  confirmPayment,
  rejectPayment,
} = require('../controllers/paymentController');

const router = express.Router();

router.use(authenticateUser, requireVerifiedEmail);

router.get('/', getMyGroups);
router.post('/', validateGroupInput, createGroup);

router.post('/:groupId/expenses', createExpense);
router.put('/:groupId/expenses/:expenseId', updateExpense);
router.delete('/:groupId/expenses/:expenseId', deleteExpense);

router.get('/:groupId/expenses', getGroupExpenses);
router.get('/:groupId/balances', getGroupBalances);
router.get('/:groupId/settlements', getGroupSettlements);

router.post('/:groupId/payments', createPayment);
router.get('/:groupId/payments', getGroupPayments);
router.patch('/:groupId/payments/:paymentId/confirm', confirmPayment);
router.patch('/:groupId/payments/:paymentId/reject', rejectPayment);

router.get('/:groupId/settlement-report', downloadSettlementReport);

router.get('/:groupId', getGroupById);
router.post('/:groupId/invite', generateInviteLink);
router.post('/join/:token', acceptInvite);

module.exports = router;