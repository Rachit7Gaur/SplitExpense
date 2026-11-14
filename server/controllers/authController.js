const { auth } = require('../config/firebaseAdmin');
const User = require('../models/User');

async function getCurrentUser(req, res, next) {
  try {
    const { uid, email } = req.user;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'A verified email address is required.'
      });
    }

    const firebaseUser = await auth.getUser(uid);

    const name =
      typeof firebaseUser.displayName === 'string'
        ? firebaseUser.displayName.trim()
        : '';

    if (name.length < 2 || name.length > 80) {
      return res.status(400).json({
        success: false,
        message: 'Please set a valid name in your account before continuing.'
      });
    }

    const user = await User.findOneAndUpdate(
      { firebaseUid: uid },
      {
        $set: {
          name,
          email: email.trim().toLowerCase()
        },
        $setOnInsert: {
          firebaseUid: uid
        }
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true
      }
    );

    return res.status(200).json({
      success: true,
      message: 'User profile synchronized successfully.',
      data: {
        id: user._id,
        name: user.name,
        email: user.email
      }
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { getCurrentUser };
