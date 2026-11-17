function notFound(req, res, next) {
  return res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`
  });
}

function errorHandler(err, req, res, next) {
  console.error('Backend Error:', err);

  if (res.headersSent) {
    return next(err);
  }

  return res.status(500).json({
    success: false,
    message: 'Internal server error'
  });
}

module.exports = {
  notFound,
  errorHandler
};