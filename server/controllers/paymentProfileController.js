
const User = require('../models/User');

// Basic UPI ID format validation.
// This checks the format only, not ownership or payment capability.
function isValidUpiId(upiId) {
  return /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z0-9.-]{2,64}$/.test(upiId);
}

async function getPaymentProfile(req, res, next) {
  try {
    const user = await User.findOne({
      firebaseUid: req.user.uid,
    }).select('upiProfile');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User profile not found.',
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        upiId: user.upiProfile?.upiId || null,
        isActive: user.upiProfile?.isActive || false,
      },
    });
  } catch (error) {
    return next(error);
  }
}

async function updatePaymentProfile(req, res, next) {
  try {
    const { upiId, isActive } = req.body;

    if (typeof upiId !== 'string' || !isValidUpiId(upiId.trim())) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid UPI ID.',
      });
    }

    if (typeof isActive !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'isActive must be true or false.',
      });
    }

    const normalizedUpiId = upiId.trim().toLowerCase();

    const user = await User.findOneAndUpdate(
      { firebaseUid: req.user.uid },
      {
        $set: {
          'upiProfile.upiId': normalizedUpiId,
          'upiProfile.isActive': isActive,
        },
      },
      {
        new: true,
        runValidators: true,
      }
    ).select('upiProfile');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User profile not found.',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Payment profile updated successfully.',
      data: {
        upiId: user.upiProfile?.upiId || null,
        isActive: user.upiProfile?.isActive || false,
      },
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getPaymentProfile,
  updatePaymentProfile,
};
