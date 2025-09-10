import authMiddleware from './auth.middleware.js';
const { authenticateJWT, authorizeRole } = authMiddleware;
import errorMiddleware from './error.middleware.js';
const { errorHandler, notFound } = errorMiddleware;
import requestLogger from './logger.middleware.js';

export default {
  authenticateJWT,
  authorizeRole,
  errorHandler,
  notFound,
  requestLogger,
};

// Named exports for convenience
export { authenticateJWT, authorizeRole, errorHandler, notFound, requestLogger };