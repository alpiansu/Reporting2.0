import dbStore from "../config/db_store.js";
import logger from "../config/logger.js";

/**
 * Check connectivity to a store database.
 * Reusable utility — can be called from any module that needs to verify
 * store DB accessibility before performing operations.
 *
 * @param {string} host - IP address of the store database
 * @returns {Promise<{connected: boolean, error: string|null, errorCode: string|null}>}
 */
export async function checkStoreConnection(host) {
  let pool = null;
  try {
    // createDbStore throws on failure — we capture the real error
    pool = await dbStore.createDbStore(host, 1); // 1 retry for fast check
    return { connected: true, error: null, errorCode: null };
  } catch (error) {
    logger.warn(`Store connection check failed for host ${host}: ${error.message}`);
    return {
      connected: false,
      error: error.message || "Unknown connection error",
      errorCode: error.code || null,
    };
  } finally {
    if (pool) {
      try {
        await pool.end();
      } catch (_) {
        // ignore cleanup error
      }
    }
  }
}
