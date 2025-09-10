/**
 * Controller for synchronization endpoints
 */
import TriggerSyncService from './trigger-sync.service.js';
const triggerSyncService = new TriggerSyncService();
import { apiResponse } from '../../utils/index.js';

export const triggerSync = async (req, res, next) => {
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
};

// Default export for backward compatibility
export default {
  triggerSync,
};