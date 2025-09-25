/**
 * Memory management utilities
 * Provides helper functions for efficient memory cleanup and management
 */
import logger from "../config/logger.js";

class MemoryUtils {
  /**
   * Clean up memory by clearing array and removing reference
   * @param {Array} arrayRef - Array reference to cleanup
   * @param {boolean} logCleanup - Whether to log cleanup action (default: false)
   * @returns {null} Always returns null
   */
  cleanupMemory(arrayRef, logCleanup = false) {
    if (arrayRef && Array.isArray(arrayRef)) {
      const originalLength = arrayRef.length;
      arrayRef.length = 0; // Clear array contents immediately
      
      if (logCleanup && originalLength > 0) {
        logger.debug(`Memory cleanup: cleared array with ${originalLength} elements`);
      }
    }
    return null; // Return null to assign back to variable
  }

  /**
   * Clean up multiple arrays at once
   * @param {Array<Array>} arrays - Array of arrays to cleanup
   * @param {boolean} logCleanup - Whether to log cleanup action (default: false)
   * @returns {Array<null>} Array of nulls for assignment
   */
  cleanupMultipleArrays(arrays, logCleanup = false) {
    if (!Array.isArray(arrays)) {
      return [];
    }

    let totalCleaned = 0;
    const results = arrays.map(arrayRef => {
      if (arrayRef && Array.isArray(arrayRef)) {
        totalCleaned += arrayRef.length;
        arrayRef.length = 0;
      }
      return null;
    });

    if (logCleanup && totalCleaned > 0) {
      logger.debug(`Memory cleanup: cleared ${arrays.length} arrays with total ${totalCleaned} elements`);
    }

    return results;
  }

  /**
   * Get memory usage information for an array
   * @param {Array} arrayRef - Array to analyze
   * @returns {Object} Memory usage information
   */
  getArrayMemoryInfo(arrayRef) {
    if (!arrayRef || !Array.isArray(arrayRef)) {
      return { length: 0, estimatedSizeKB: 0, isLarge: false };
    }

    const length = arrayRef.length;
    // Rough estimation: each element ~100 bytes on average for typical objects
    const estimatedSizeKB = Math.round((length * 100) / 1024);
    const isLarge = length > 50000; // Consider large if more than 50k elements

    return {
      length,
      estimatedSizeKB,
      isLarge,
      recommendation: isLarge ? 'Consider streaming or pagination for better memory management' : 'Memory usage is acceptable'
    };
  }

  /**
   * Force garbage collection if available (Node.js with --expose-gc flag)
   * @param {boolean} logAction - Whether to log the action (default: false)
   */
  forceGarbageCollection(logAction = false) {
    if (global.gc) {
      if (logAction) {
        logger.debug('Forcing garbage collection...');
      }
      global.gc();
      if (logAction) {
        logger.debug('Garbage collection completed');
      }
    } else if (logAction) {
      logger.debug('Garbage collection not available (run with --expose-gc to enable)');
    }
  }
}

export default new MemoryUtils();