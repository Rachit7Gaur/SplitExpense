
const express = require('express');

const authenticateUser = require('../middleware/authMiddleware');

const {
  getCurrentUser,
  completeProfile,
} = require('../controllers/authController');

const router = express.Router();

// Get and synchronize the logged-in user's profile
router.get('/me', authenticateUser, getCurrentUser);

// Complete/synchronize profile after email verification
router.post('/complete-profile', authenticateUser, completeProfile);

module.exports = router;
