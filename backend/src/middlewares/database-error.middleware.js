/**
 * Database Error Handling Middleware
 * Handles database unavailability gracefully
 */
import logger from '../config/logger.js';
import { DatabaseUnavailableError } from '../config/resilient-database.js';

/**
 * Middleware to handle database errors gracefully
 */
export const databaseErrorHandler = (error, req, res, next) => {
  // Handle database unavailable errors
  if (error instanceof DatabaseUnavailableError) {
    logger.warn(`Database unavailable for ${req.method} ${req.path}`);
    
    return res.status(503).json({
      success: false,
      message: 'Database sedang tidak tersedia. Silakan coba lagi nanti.',
      error: 'DATABASE_UNAVAILABLE',
      timestamp: new Date().toISOString(),
      path: req.path,
      method: req.method
    });
  }

  // Handle Sequelize connection errors
  if (error.name === 'SequelizeConnectionError' || 
      error.name === 'SequelizeConnectionRefusedError' ||
      error.name === 'SequelizeHostNotFoundError' ||
      error.name === 'SequelizeAccessDeniedError') {
    
    logger.error(`Database connection error: ${error.message}`);
    
    return res.status(503).json({
      success: false,
      message: 'Koneksi database bermasalah. Silakan coba lagi nanti.',
      error: 'DATABASE_CONNECTION_ERROR',
      timestamp: new Date().toISOString(),
      path: req.path,
      method: req.method
    });
  }

  // Handle other Sequelize errors
  if (error.name && error.name.startsWith('Sequelize')) {
    logger.error(`Database error: ${error.message}`);
    
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan pada database.',
      error: 'DATABASE_ERROR',
      timestamp: new Date().toISOString(),
      path: req.path,
      method: req.method
    });
  }

  // Pass other errors to next middleware
  next(error);
};

/**
 * Middleware to check database availability for write operations
 */
export const requireDatabase = (req, res, next) => {
  const writeOperations = ['POST', 'PUT', 'PATCH', 'DELETE'];
  
  if (writeOperations.includes(req.method)) {
    // Import here to avoid circular dependency
    import('../config/resilient-database.js').then(({ default: resilientDb }) => {
      if (!resilientDb.isDatabaseAvailable()) {
        return res.status(503).json({
          success: false,
          message: 'Database sedang tidak tersedia. Operasi tulis tidak dapat dilakukan.',
          error: 'DATABASE_UNAVAILABLE_FOR_WRITE',
          timestamp: new Date().toISOString(),
          path: req.path,
          method: req.method
        });
      }
      next();
    }).catch(next);
  } else {
    next();
  }
};

/**
 * Middleware to add database status to response headers
 */
export const addDatabaseStatus = (req, res, next) => {
  // Import here to avoid circular dependency
  import('../config/resilient-database.js').then(({ default: resilientDb }) => {
    const status = resilientDb.getStatus();
    res.set('X-Database-Status', status.isConnected ? 'connected' : 'disconnected');
    res.set('X-Database-Mode', status.isConnected ? 'online' : 'offline');
    next();
  }).catch(next);
};

/**
 * Wrapper function to handle database operations with graceful degradation
 */
export const withDatabaseFallback = (operation, fallbackData = null, errorMessage = 'Data tidak tersedia') => {
  return async (req, res, next) => {
    try {
      const result = await operation(req, res);
      return result;
    } catch (error) {
      if (error instanceof DatabaseUnavailableError) {
        if (fallbackData) {
          logger.info(`Using fallback data for ${req.path}`);
          return res.json({
            success: true,
            data: fallbackData,
            message: 'Data dari cache offline',
            offline: true,
            timestamp: new Date().toISOString()
          });
        } else {
          return res.status(503).json({
            success: false,
            message: errorMessage,
            error: 'DATABASE_UNAVAILABLE',
            timestamp: new Date().toISOString()
          });
        }
      }
      next(error);
    }
  };
};

/**
 * Async wrapper for database operations
 */
export const asyncDatabaseHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

export default {
  databaseErrorHandler,
  requireDatabase,
  addDatabaseStatus,
  withDatabaseFallback,
  asyncDatabaseHandler
};