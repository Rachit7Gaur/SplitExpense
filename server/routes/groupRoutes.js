const express = require('express');
const authenticateUser = require('../middleware/authMiddleware');

const {
  validateGroupInput,
  createGroup,
  getMyGroups,
  getGroupById,
  generateInviteLink,
  acceptInvite
} = require('../controllers/groupController');

const {
  createExpense,
  getGroupExpenses,
  getGroupBalances,
  getGroupSettlements
} = require('../controllers/expenseController');

const router = express.Router();

router.get('/', authenticateUser, getMyGroups);

router.post('/', authenticateUser, validateGroupInput, createGroup);

router.post('/:groupId/expenses', authenticateUser, createExpense);

router.get('/:groupId/expenses', authenticateUser, getGroupExpenses);

router.get('/:groupId/balances', authenticateUser, getGroupBalances);

router.get( '/:groupId/settlements', authenticateUser,getGroupSettlements);

router.get('/:groupId', authenticateUser, getGroupById);

router.post('/:groupId/invite', authenticateUser, generateInviteLink);

router.post('/join/:token', authenticateUser, acceptInvite);

module.exports = router;