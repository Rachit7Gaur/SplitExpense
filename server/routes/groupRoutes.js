const express = require('express');
const authenticateUser = require('../middleware/authMiddleware');
const requireVerifiedEmail = require('../middleware/requireVerifiedEmail');

const {
  validateGroupInput,
  createGroup,
  getMyGroups,
  getGroupById,
  generateInviteLink,
  acceptInvite
} = require('../controllers/groupController');

const {
  downloadSettlementReport,
} = require('../controllers/settlementReportController');

const {
  createExpense,
  getGroupExpenses,
  getGroupBalances,
  getGroupSettlements
} = require('../controllers/expenseController');

const router = express.Router();


router.use(authenticateUser, requireVerifiedEmail);

router.get('/', getMyGroups);
router.post('/', validateGroupInput, createGroup);

router.post('/:groupId/expenses', createExpense);
router.get('/:groupId/expenses', getGroupExpenses);
router.get('/:groupId/balances', getGroupBalances);
router.get('/:groupId/settlements', getGroupSettlements);
router.get('/:groupId/settlement-report',downloadSettlementReport);

router.get('/:groupId', getGroupById);
router.post('/:groupId/invite', generateInviteLink);
router.post('/join/:token', acceptInvite);


module.exports = router;