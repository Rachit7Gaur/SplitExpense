function requireVerifiedEmail(req, res, next) {
  if (!req.user || !req.user.emailVerified) {
    return res.status(403).json({
      success: false,
      message: 'Please verify your email before accessing this resource.'
    });
  }

  return next();
}

module.exports = requireVerifiedEmail;