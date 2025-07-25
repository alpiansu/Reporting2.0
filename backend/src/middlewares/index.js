const { authenticateJWT, authorizeRole } = require('./auth.middleware');
const { errorHandler, notFound } = require('./error.middleware');
const requestLogger = require('./logger.middleware');

module.exports = {
  authenticateJWT,
  authorizeRole,
  errorHandler,
  notFound,
  requestLogger,
};