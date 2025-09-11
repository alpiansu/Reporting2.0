/**
 * Progress Module Index
 * Exports all progress-related services and helpers
 */
import GlobalProgressService from './GlobalProgressService.js';
import ProgressHelper from './ProgressHelper.js';

// Initialize the service
GlobalProgressService.initialize();

export {
  GlobalProgressService,
  ProgressHelper
};

// Default export is the helper for convenience
export default ProgressHelper;