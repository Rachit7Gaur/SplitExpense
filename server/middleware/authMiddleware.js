
const { auth } = require('../config/firebaseAdmin');

async function authenticateUser(req, res, next) {
  const authorization = req.headers.authorization;

  if (!authorization || !authorization.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Authentication token is required.'
    });
  }

  const idToken = authorization.slice(7).trim();

  if (!idToken) {
    return res.status(401).json({
      success: false,
      message: 'Authentication token is required.'
    });
  }

  try {
    const decodedToken = await auth.verifyIdToken(idToken);

    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email || null,
      emailVerified: decodedToken.email_verified === true,
      phoneNumber: decodedToken.phone_number || null
    };

    return next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired authentication token.'
    });
  }
}

module.exports = authenticateUser;
