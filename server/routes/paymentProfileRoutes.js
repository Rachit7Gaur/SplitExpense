
const express = require('express');

const authenticateUser = require('../middleware/authMiddleware');

const {
  getPaymentProfile,
  updatePaymentProfile,
} = require('../controllers/paymentProfileController');

const router = express.Router();

// All payment profile routes require authentication
router.use(authenticateUser);

// Get logged-in user's payment profile
router.get('/', getPaymentProfile);

// Add or update logged-in user's UPI ID
router.put('/', updatePaymentProfile);

module.exports = router;
