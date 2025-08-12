/**
 * Controller for synchronization endpoints
 */
const TriggerSyncService = require('./trigger-sync.service');
const triggerSyncService = new TriggerSyncService();
const { apiResponse } = require('../../utils');

class SyncController {
  /**
   * Trigger manual synchronization
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  async triggerSync(req, res, next) {
    try {
      const result = await triggerSyncService.triggerManualSync();
      
      if (result.success) {
        return apiResponse.success(res, {
          message: 'Synchronization completed successfully',
          data: {
            updated: result.updated,
            created: result.created
          }
        });
      } else {
        return apiResponse.error(res, result.message, 500);
      }
    } catch (error) {
      next(error);
    }
  }
}

module.exports = SyncController;