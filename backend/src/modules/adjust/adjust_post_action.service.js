import logger from "../../config/logger.js";
import rekonVirtualService from "../rekon_virtual_mrg/rekon_virtual_mrg.service.js";

/**
 * Service to handle scalable post-adjustment actions based on extra CSV columns
 */
class AdjustPostActionService {
  /**
   * Execute post-adjustment actions for a single record
   * @param {Object} record - The CSV record object (including extra columns)
   * @param {Object} store - Store information
   * @param {string} username - User performing the adjustment
   */
  async executePostActions(record, store, username) {
    try {
      // Create a normalized version of the record keys (uppercase) for easier matching
      const normalizedRecord = {};
      for (const key in record) {
        normalizedRecord[key.toUpperCase()] = record[key];
      }

      // 1. TGL_SELISIH Action
      if (normalizedRecord.TGL_SELISIH) {
        // We pass the normalized value but still use the original record/store info if needed
        await this.handleTglSelisih(normalizedRecord.TGL_SELISIH, record.PRDCD, store, username);
      }

      // Add future post-actions here...
      // if (normalizedRecord.SOME_OTHER_FIELD) { ... }

    } catch (error) {
      logger.error(`Error in executePostActions for ${record.PRDCD}: ${error.message}`);
      // We don't throw here to ensure the main process remains uninterrupted
    }
  }

  /**
   * Updates SaldoVirtual RECID to '1' based on TGL_SELISIH
   */
  async handleTglSelisih(tglSelisih, prdcd, store, username) {
    try {
      const shop = store.storeCode;
      const cabang = store.branch || store.cab;

      if (!cabang) {
        logger.warn(`Cannot update SaldoVirtual: Cabang info missing for store ${shop}`);
        return;
      }

      logger.info(`Executing TGL_SELISIH post-action: Updating SaldoVirtual via service for ${shop}, ${prdcd}, ${tglSelisih}`);

      await rekonVirtualService.updateRecord(cabang, shop, tglSelisih, prdcd, {
        RECID: "1",
      });

      logger.info(`Successfully updated SaldoVirtual RECID for ${shop}, ${prdcd}, ${tglSelisih}`);
    } catch (error) {
      if (error.message === "Record not found") {
        logger.info(`TGL_SELISIH: No matching SaldoVirtual record found for ${store.storeCode}, ${prdcd}, ${tglSelisih}. Skipping update.`);
      } else {
        logger.error(`Failed to update SaldoVirtual for TGL_SELISIH: ${error.message}`);
      }
    }
  }
}

export default new AdjustPostActionService();
