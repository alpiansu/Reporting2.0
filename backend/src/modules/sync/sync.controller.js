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
      const { type = 'all' } = req.body;
      const validTypes = ['store', 'dept', 'user', 'all'];
      
      if (!validTypes.includes(type)) {
        return apiResponse.badRequest(res, `Invalid sync type. Must be one of: ${validTypes.join(', ')}`);
      }
      
      const result = await triggerSyncService.triggerManualSync(type);
      
      if (result.success) {
        return apiResponse.success(res, {
          message: 'Synchronization completed successfully',
          data: result
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