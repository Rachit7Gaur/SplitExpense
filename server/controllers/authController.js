
const { auth } = require('../config/firebaseAdmin');
const User = require('../models/User');

async function syncUserProfile(firebaseUser) {
  if (!firebaseUser.email || !firebaseUser.emailVerified) {
    const error = new Error('Please verify your email before continuing.');
    error.statusCode = 403;
    throw error;
  }

  const name =
    typeof firebaseUser.displayName === 'string'
      ? firebaseUser.displayName.trim()
      : '';

  if (name.length < 2 || name.length > 80) {
    const error = new Error('Please complete your profile with a valid name.');
    error.statusCode = 400;
    throw error;
  }

  return User.findOneAndUpdate(
    { firebaseUid: firebaseUser.uid },
    {
      $set: {
        name,
        email: firebaseUser.email.trim().toLowerCase(),
        phoneNumber: firebaseUser.phoneNumber || null,
        profileCompleted: true,
      },
      $setOnInsert: {
        firebaseUid: firebaseUser.uid,
      },
    },
    {
      new: true,
      upsert: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    }
  );
}

function sendProfileResponse(res, user, message) {
  return res.status(200).json({
    success: true,
    message,
    data: {
      id: user._id,
      name: user.name,
      email: user.email,
      phoneNumber: user.phoneNumber,
      profileCompleted: user.profileCompleted,
    },
  });
}

function handleProfileError(error, res, next) {
  if (error.code === 11000) {
    return res.status(409).json({
      success: false,
      message: 'An account with these details already exists.',
    });
  }

  if (error.statusCode) {
    return res.status(error.statusCode).json({
      success: false,
      message: error.message,
    });
  }

  return next(error);
}

async function getCurrentUser(req, res, next) {
  try {
    const firebaseUser = await auth.getUser(req.user.uid);
    const user = await syncUserProfile(firebaseUser);

    return sendProfileResponse(
      res,
      user,
      'User profile synchronized successfully.'
    );
  } catch (error) {
    return handleProfileError(error, res, next);
  }
}

async function completeProfile(req, res, next) {
  try {
    const firebaseUser = await auth.getUser(req.user.uid);
    const user = await syncUserProfile(firebaseUser);

    return sendProfileResponse(
      res,
      user,
      'Profile completed successfully.'
    );
  } catch (error) {
    return handleProfileError(error, res, next);
  }
}

module.exports = {
  getCurrentUser,
  completeProfile,
};
