import authMiddleware from './auth.middleware.js';
const { authenticateJWT, authorizeRole } = authMiddleware;
import errorMiddleware from './error.middleware.js';
const { errorHandler, notFound } = errorMiddleware;
import requestLogger from './logger.middleware.js';
import databaseErrorMiddleware from './database-error.middleware.js';
const { databaseErrorHandler, requireDatabase, addDatabaseStatus, withDatabaseFallback, asyncDatabaseHandler } = databaseErrorMiddleware;

export default {
  authenticateJWT,
  authorizeRole,
  errorHandler,
  notFound,
  requestLogger,
  databaseErrorHandler,
  requireDatabase,
  addDatabaseStatus,
  withDatabaseFallback,
  asyncDatabaseHandler,
};

// Named exports for convenience
export { 
  authenticateJWT, 
  authorizeRole, 
  errorHandler, 
  notFound, 
  requestLogger,
  databaseErrorHandler,
  requireDatabase,
  addDatabaseStatus,
  withDatabaseFallback,
  asyncDatabaseHandler
};