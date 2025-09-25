import logger from '../config/logger.js';

/**
 * Memory utilities for cleaning up arrays and managing memory
 */
class MemoryUtils {
  /**
   * Clean up memory by clearing array contents
   * @param {Array} arrayRef - Array reference to clean up
   * @param {boolean} logCleanup - Whether to log cleanup action (default: false)
   * @returns {null} Always returns null
   */
  static cleanupMemory(arrayRef, logCleanup = false) {
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
   * @param {Array} arrayRefs - Array of array references to clean up
   * @param {boolean} logCleanup - Whether to log cleanup action (default: false)
   * @returns {null} Always returns null
   */
  static cleanupMultipleArrays(arrayRefs, logCleanup = false) {
    if (!Array.isArray(arrayRefs)) {
      return null;
    }

    let totalCleaned = 0;
    arrayRefs.forEach(arrayRef => {
      if (arrayRef && Array.isArray(arrayRef)) {
        totalCleaned += arrayRef.length;
        arrayRef.length = 0;
      }
    });

    if (logCleanup && totalCleaned > 0) {
      logger.debug(`Memory cleanup: cleared ${arrayRefs.length} arrays with total ${totalCleaned} elements`);
    }

    return null;
  }

  /**
   * Force garbage collection if available (Node.js with --expose-gc flag)
   * @param {boolean} logGC - Whether to log garbage collection action (default: false)
   */
  static forceGarbageCollection(logGC = false) {
    if (global.gc) {
      const memBefore = process.memoryUsage();
      global.gc();
      const memAfter = process.memoryUsage();
      
      if (logGC) {
        const heapDiff = memBefore.heapUsed - memAfter.heapUsed;
        logger.debug(`Garbage collection: freed ${Math.round(heapDiff / 1024 / 1024 * 100) / 100} MB`);
      }
    } else if (logGC) {
      logger.debug('Garbage collection not available (run with --expose-gc flag)');
    }
  }
}

export default MemoryUtils;