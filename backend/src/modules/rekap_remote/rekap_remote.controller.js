/**
 * Controller for rekap_remote endpoints
 */
import rekapRemoteService from './rekap_remote.service.js';
import rekapRemoteStagingService from './rekap_remote_staging.service.js';
import logger from '../../config/logger.js';

export const getRekapData = async (req, res) => {
  try {
    const filters = {
      cab: req.query.cab,
      kdtk: req.query.kdtk,
      moduleName: req.query.module_name,
      limit: req.query.limit,
      offset: req.query.offset,
    };

    const result = await rekapRemoteStagingService.getRekapData(filters);
    
    res.status(200).json(result);
  } catch (error) {
    logger.error(`Error in getRekapData: ${error.message}`);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

export const getSummary = async (req, res) => {
  try {
    const moduleName = req.query.module_name;
    const result = await rekapRemoteStagingService.getSummary(moduleName);
    
    res.status(200).json(result);
  } catch (error) {
    logger.error(`Error in getSummary: ${error.message}`);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

export const saveLogsManually = async (req, res) => {
  try {
    const { module_name } = req.body;
    const result = await rekapRemoteService.saveLogsToDatabase(module_name);
    
    res.status(200).json(result);
  } catch (error) {
    logger.error(`Error in saveLogsManually: ${error.message}`);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

export const clearLogs = async (req, res) => {
  try {
    rekapRemoteService.clearLogs();
    
    res.status(200).json({
      success: true,
      message: "All logs cleared from memory",
    });
  } catch (error) {
    logger.error(`Error in clearLogs: ${error.message}`);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Removed default export - using named exports only