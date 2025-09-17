/**
 * Controller for prep closing operations
 * Handles HTTP requests and responses for prep closing data
 */
import prepClosingService from "./prep_closing.service.js";
import logger from "../../config/logger.js";
import { body, param, query, validationResult } from "express-validator";
import mysql from "mysql2/promise";
import wrcService from "../../services/wrc.service.js";
import { ProgressHelper } from '../../services/progress/index.js';
import storeService from '../store/storeService.js';
import config from '../../config/prep_closing.config.js';
/**
 * Get all prep closing data with optional filters
 */
export const getAllPrepClosing = async (req, res) => {
  try {
    const { cab, kdtk, key, valid, limit = 100, offset = 0 } = req.query;

    const filters = {};
    if (cab) filters.cab = cab;
    if (kdtk) filters.kdtk = kdtk;
    if (key) filters.key = key;
    if (valid !== undefined) filters.valid = valid;

    const data = await prepClosingService.getAllPrepClosing(filters, parseInt(limit), parseInt(offset));
    const total = await prepClosingService.getCount(filters);

    res.json({
      success: true,
      data: data,
      pagination: {
        total: total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: parseInt(offset) + parseInt(limit) < total,
      },
    });
  } catch (error) {
    logger.error("Error in getAllPrepClosing:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

/**
 * Get prep closing by ID
 */
export const getPrepClosingById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Missing required parameter: id",
      });
    }

    const record = await prepClosingService.getPrepClosingById(parseInt(id));

    if (!record) {
      return res.status(404).json({
        success: false,
        message: "Prep closing record not found",
      });
    }

    res.json({
      success: true,
      data: record,
    });
  } catch (error) {
    logger.error("Error in getPrepClosingById:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

/**
 * Create new prep closing record
 */
export const createPrepClosing = async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation errors",
        errors: errors.array(),
      });
    }

    const { cab, kdtk, key, nilai, valid = 1 } = req.body;

    const prepClosingData = {
      cab,
      kdtk,
      key,
      nilai,
      valid: parseInt(valid),
    };

    const result = await prepClosingService.addPrepClosing(prepClosingData);

    res.status(201).json({
      success: true,
      message: "Prep closing record created successfully",
      data: result,
    });
  } catch (error) {
    logger.error("Error in createPrepClosing:", error);

    if (error.message.includes("already exists") || error.message.includes("duplicate")) {
      return res.status(409).json({
        success: false,
        message: "Prep closing record already exists",
        error: error.message,
      });
    }

    if (error.message.includes("Database sedang tidak tersedia")) {
      return res.status(503).json({
        success: false,
        message: "Database service unavailable",
        error: error.message,
      });
    }

    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

/**
 * Update prep closing record by ID
 */
export const updatePrepClosing = async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation errors",
        errors: errors.array(),
      });
    }

    const { id } = req.params;
    const updateData = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Missing required parameter: id",
      });
    }

    // Remove id from update data to prevent conflicts
    delete updateData.id;

    const result = await prepClosingService.updatePrepClosing(parseInt(id), updateData);

    res.json({
      success: true,
      message: "Prep closing record updated successfully",
      data: result,
    });
  } catch (error) {
    logger.error("Error in updatePrepClosing:", error);

    if (error.message.includes("Record not found")) {
      return res.status(404).json({
        success: false,
        message: "Prep closing record not found",
        error: error.message,
      });
    }

    if (error.message.includes("Database sedang tidak tersedia")) {
      return res.status(503).json({
        success: false,
        message: "Database service unavailable",
        error: error.message,
      });
    }

    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

/**
 * Delete prep closing record by ID
 */
export const deletePrepClosing = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Missing required parameter: id",
      });
    }

    const result = await prepClosingService.deletePrepClosing(parseInt(id));

    res.json({
      success: true,
      message: "Prep closing record deleted successfully",
      data: result,
    });
  } catch (error) {
    logger.error("Error in deletePrepClosing:", error);

    if (error.message.includes("Record not found")) {
      return res.status(404).json({
        success: false,
        message: "Prep closing record not found",
        error: error.message,
      });
    }

    if (error.message.includes("Database sedang tidak tersedia")) {
      return res.status(503).json({
        success: false,
        message: "Database service unavailable",
        error: error.message,
      });
    }

    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

/**
 * Screening Pra Closing - Check WRC saldo data
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const screeningPraClosing = async (req, res, next) => {
  let progressId = null;
  let wrcConnection = null;
  let strCab, strMonth, strYear;

  try {
    ({ strCab, strMonth, strYear } = req.body);

    // Validate required parameters
    if (!strCab || !strMonth || !strYear) {
      return res.status(400).json({
        success: false,
        message: "Parameter strCab, strMonth, dan strYear harus diisi",
      });
    }

    logger.info(`Starting screening pra closing for cab: ${strCab}, period: ${strYear}${strMonth}`);

    // Check for active screening process
    const activeProcess = ProgressHelper.getActiveProcess('prep_closing_screening', `${strCab}_${strYear}${strMonth}`);
    if (activeProcess) {
      return res.status(409).json({
        success: false,
        message: `Screening process already running for ${strCab} periode ${strYear}${strMonth}`,
        progressId: activeProcess.id
      });
    }

    // Get stores for this branch (same pattern as rekon_wt_harian)
    await storeService.ensureInitialized();
    const branchStores = await storeService.getStoresByBranch(strCab, true);

    if (!branchStores || branchStores.length === 0) {
      return res.status(404).json({
        success: false,
        message: `No stores found for branch ${strCab}`,
      });
    }

    logger.info(`Found ${branchStores.length} stores for branch ${strCab}`);

    // Initialize progress tracking
    progressId = ProgressHelper.start({
      processType: 'prep_closing_screening',
      identifier: `${strCab}_${strYear}${strMonth}`,
      totalSteps: branchStores.length,
      title: 'Screening Pra Closing',
      description: `Screening kesiapan data untuk cabang ${strCab}, periode ${strYear}${strMonth}`,
      metadata: {
        cab: strCab,
        period: `${strYear}${strMonth}`,
        totalStores: branchStores.length,
        startedBy: req.user?.username || 'system'
      }
    });

    logger.info(`Initialized progress tracking with ID: ${progressId}`);

    // Get WRC connection configuration using wrcService (same as rekon_wt_harian)
    const wrcInstance = new wrcService();
    const wrcConfig = await wrcInstance.getConnWRC(strCab);
    wrcConnection = await mysql.createConnection(wrcConfig);

    // OPTIMIZED: Get all WRC data once before loop
    logger.info(`Fetching all WRC data for cab ${strCab}...`);
    const wrcDataMap = await prepClosingService.getAllWrcData(strCab, strYear, strMonth, wrcConnection);
    logger.info(`Retrieved WRC data for ${wrcDataMap.size} stores`);

    // Initialize screening results
    const screeningResults = {
      success: true,
      cab: strCab,
      period: `${strYear}${strMonth}`,
      totalStores: branchStores.length,
      processedStores: 0,
      readyStores: 0,
      notReadyStores: 0,
      errorStores: 0,
      stores: [],
      storeErrors: [],
      waves: [],
      progressId
    };

    // WAVE-BASED PROCESSING with retry for timeouts (same as rekon_wt_harian)
    const MAX_WAVES = 3;
    const CONCURRENCY_LIMIT = 5;

    logger.info(`Starting wave-based screening of ${branchStores.length} stores with ${MAX_WAVES} waves max`);
    const totalStartTime = Date.now();

    // Process stores in waves, retrying timeout stores
    let currentStores = branchStores.slice(); // Copy of all stores
    let wave = 1;

    while (wave <= MAX_WAVES && currentStores.length > 0) {
      logger.info(`🌊 Starting Wave ${wave} with ${currentStores.length} stores...`);
      const waveStartTime = Date.now();

      // Update progress for wave start
      ProgressHelper.updateStep(progressId, {
        currentStep: screeningResults.processedStores,
        message: `Wave ${wave}: Memproses ${currentStores.length} toko`,
        details: {
          currentWave: wave,
          storesInWave: currentStores.length,
          readyStores: screeningResults.readyStores,
          notReadyStores: screeningResults.notReadyStores,
          errorStores: screeningResults.errorStores,
          cab: strCab,
          period: `${strYear}${strMonth}`
        }
      });

      // Process stores in parallel with concurrency limit
      const storePromises = currentStores.slice(0, CONCURRENCY_LIMIT).map(store =>
        prepClosingService.processStoreScreening(store, strCab, strYear, strMonth, wrcDataMap)
          .catch(error => ({
            storeCode: store.storeCode,
            storeName: store.storeName,
            status: 'ERROR',
            errors: [error.message],
            isReady: false
          }))
      );

      const storeResults = await Promise.all(storePromises);
      
      // Categorize results
      const completedStores = [];
      const timeoutStores = [];
      const storeErrors = [];

      for (const storeResult of storeResults) {
        const isTimeout = storeResult.status === 'TIMEOUT';
        
        if (isTimeout && wave < MAX_WAVES) {
          // Store will be retried in next wave
          const timeoutStore = currentStores.find(s => s.storeCode === storeResult.storeCode);
          if (timeoutStore) {
            timeoutStores.push(timeoutStore);
          }
          logger.warn(`[Wave ${wave}] ${storeResult.storeCode} timeout - will retry in next wave`);
        } else {
          // Store completed (successfully or permanently failed)
          completedStores.push(storeResult);
          screeningResults.processedStores++;

          // Count by status
          if (storeResult.isReady) {
            screeningResults.readyStores++;
          } else if (storeResult.status === 'ERROR' || storeResult.status === 'TIMEOUT') {
            screeningResults.errorStores++;
            storeErrors.push({
              store: storeResult.storeCode,
              storeName: storeResult.storeName,
              errors: storeResult.errors || [`Status: ${storeResult.status}`]
            });
          } else {
            screeningResults.notReadyStores++;
          }

          // Add to results
          screeningResults.stores.push({
            storeCode: storeResult.storeCode,
            storeName: storeResult.storeName,
            status: storeResult.status,
            isReady: storeResult.isReady,
            wrcData: storeResult.wrcData,
            storeData: storeResult.storeData,
            errors: storeResult.errors
          });
        }
      }

      const waveEndTime = Date.now();
      const waveDuration = (waveEndTime - waveStartTime) / 1000;

      logger.info(`Wave ${wave} completed in ${waveDuration}s: ${completedStores.length} completed, ${timeoutStores.length} timeout`);

      // Track wave results
      screeningResults.waves.push({
        wave,
        duration: waveDuration,
        completed: completedStores.length,
        timeouts: timeoutStores.length,
        errors: storeErrors.length
      });

      // Add errors to main results
      if (storeErrors.length > 0) {
        screeningResults.storeErrors.push(...storeErrors);
      }

      // Prepare for next wave with timeout stores
      currentStores = timeoutStores;
      wave++;

      // Add brief delay between waves
      if (currentStores.length > 0) {
        logger.info(`⏳ Waiting 2 seconds before next wave... (${currentStores.length} stores will be retried)`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // Handle any remaining timeout stores after max waves
    if (currentStores.length > 0) {
      logger.warn(`⚠️ ${currentStores.length} stores still timeout after ${MAX_WAVES} waves, marking as failed`);
      const failedStores = currentStores.map(store => ({
        store: store.storeCode,
        storeName: store.storeName,
        errors: [`Failed after ${MAX_WAVES} waves - persistent timeout`]
      }));

      screeningResults.storeErrors.push(...failedStores);
      screeningResults.errorStores += failedStores.length;
    }

    const totalEndTime = Date.now();
    const totalDuration = (totalEndTime - totalStartTime) / 1000;

    logger.info(`🎯 Screening completed in ${totalDuration}s: ${screeningResults.processedStores}/${screeningResults.totalStores} stores processed`);

    // Add final summary
    screeningResults.timestamp = new Date().toISOString();
    screeningResults.totalDuration = totalDuration;
    screeningResults.summary = {
      total_stores: screeningResults.totalStores,
      processed_stores: screeningResults.processedStores,
      ready_stores: screeningResults.readyStores,
      not_ready_stores: screeningResults.notReadyStores,
      error_stores: screeningResults.errorStores,
      success_rate: ((screeningResults.readyStores / screeningResults.processedStores) * 100).toFixed(2) + '%'
    };

    // Mark progress as completed
    ProgressHelper.complete(
      progressId,
      `Screening selesai: ${screeningResults.processedStores} toko diproses, ${screeningResults.readyStores} toko siap`,
      {
        details: {
          totalStores: screeningResults.totalStores,
          processedStores: screeningResults.processedStores,
          readyStores: screeningResults.readyStores,
          notReadyStores: screeningResults.notReadyStores,
          errorStores: screeningResults.errorStores,
          totalDuration: totalDuration,
          cab: strCab,
          period: `${strYear}${strMonth}`,
          completedAt: new Date().toISOString()
        }
      }
    );

    res.status(200).json({
      success: true,
      message: "Screening pra closing berhasil",
      data: screeningResults,
    });

  } catch (error) {
    logger.error(`Error in screeningPraClosing: ${error.message}`);
    
    // Mark progress as failed
    if (progressId) {
      ProgressHelper.fail(progressId, error.message, {
        errorType: error.name,
        stack: error.stack,
        cab: strCab,
        period: `${strYear}${strMonth}`,
        failedAt: new Date().toISOString()
      });
    }
    
    next(error);
  } finally {
    // Close WRC connection
    if (wrcConnection) {
      try {
        await wrcConnection.end();
        logger.debug("WRC connection closed");
      } catch (closeError) {
        logger.warn(`Error closing WRC connection: ${closeError.message}`);
      }
    }
  }
};

/**
 * Get screening progress
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const getProgress = async (req, res, next) => {
  try {
    const { progressId } = req.params;

    if (!progressId) {
      return res.status(400).json({
        success: false,
        message: "Progress ID harus diisi",
      });
    }

    const progress = ProgressHelper.getProgress(progressId);

    if (!progress) {
      return res.status(404).json({
        success: false,
        message: "Progress tidak ditemukan",
      });
    }

    res.status(200).json({
      success: true,
      data: progress,
    });
  } catch (error) {
    logger.error(`Error in getProgress: ${error.message}`);
    next(error);
  }
};

/**
 * Get latest screening progress for a branch and period
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const getLatestProgress = async (req, res, next) => {
  try {
    const { cab, periode } = req.params;

    if (!periode) {
      return res.status(400).json({
        success: false,
        message: "Periode harus diisi",
      });
    }

    const progress = ProgressHelper.getLatestProgress('prep_closing_screening', `${cab}_${periode}`);

    if (!progress) {
      return res.status(404).json({
        success: false,
        message: "Progress tidak ditemukan",
      });
    }

    res.status(200).json({
      success: true,
      data: progress,
    });
  } catch (error) {
    logger.error(`Error in getLatestProgress: ${error.message}`);
    next(error);
  }
};

/**
 * Stream real-time screening progress via SSE
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const getProgressStream = async (req, res, next) => {
  try {
    const { progressId } = req.params;

    if (!progressId) {
      return res.status(400).json({
        success: false,
        message: "Progress ID harus diisi",
      });
    }

    // Set SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    // Send initial connection message
    res.write(`data: ${JSON.stringify({ type: 'connected', progressId })}\n\n`);

    // Function to send progress updates
    const sendProgress = () => {
      const progress = ProgressHelper.getProgress(progressId);
      
      if (progress) {
        const progressData = {
          type: 'progress',
          data: progress,
          timestamp: new Date().toISOString()
        };
        
        res.write(`data: ${JSON.stringify(progressData)}\n\n`);
        
        // If progress is completed or failed, close the connection
        if (progress.status === 'completed' || progress.status === 'failed') {
          res.write(`data: ${JSON.stringify({ type: 'finished', status: progress.status })}\n\n`);
          res.end();
          clearInterval(interval);
          return;
        }
      } else {
        // Progress not found, send error and close
        res.write(`data: ${JSON.stringify({ type: 'error', message: 'Progress tidak ditemukan' })}\n\n`);
        res.end();
        clearInterval(interval);
        return;
      }
    };

    // Send progress updates every 1 second
    const interval = setInterval(sendProgress, 1000);

    // Send initial progress
    sendProgress();

    // Handle client disconnect
    req.on('close', () => {
      clearInterval(interval);
      res.end();
    });

    req.on('aborted', () => {
      clearInterval(interval);
      res.end();
    });

  } catch (error) {
    logger.error(`Error in getProgressStream: ${error.message}`);
    res.write(`data: ${JSON.stringify({ type: 'error', message: 'Internal server error' })}\n\n`);
    res.end();
  }
};

/**
 * Get prep closing statistics
 */
export const getPrepClosingStats = async (req, res) => {
  try {
    const { cab, kdtk } = req.query;

    const filters = {};
    if (cab) filters.cab = cab;
    if (kdtk) filters.kdtk = kdtk;

    const total = await prepClosingService.getCount(filters);
    const valid = await prepClosingService.getCount({ ...filters, valid: 1 });
    const invalid = await prepClosingService.getCount({ ...filters, valid: 0 });

    const stats = {
      total,
      valid,
      invalid,
      filters,
    };

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error("Error in getPrepClosingStats:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Validation rules
export const createPrepClosingValidation = [
  body("cab")
    .notEmpty()
    .withMessage("Cab is required")
    .isLength({ max: 10 })
    .withMessage("Cab must be max 10 characters"),
  body("kdtk")
    .notEmpty()
    .withMessage("Kdtk is required")
    .isLength({ max: 10 })
    .withMessage("Kdtk must be max 10 characters"),
  body("key")
    .notEmpty()
    .withMessage("Key is required")
    .isLength({ max: 50 })
    .withMessage("Key must be max 50 characters"),
  body("nilai").optional().isDecimal().withMessage("Nilai must be a decimal number"),
  body("valid").optional().isInt({ min: 0, max: 1 }).withMessage("Valid must be 0 or 1"),
];

export const updatePrepClosingValidation = [
  param("id").isInt({ min: 1 }).withMessage("ID must be a positive integer"),
  body("cab").optional().isLength({ max: 10 }).withMessage("Cab must be max 10 characters"),
  body("kdtk").optional().isLength({ max: 10 }).withMessage("Kdtk must be max 10 characters"),
  body("key").optional().isLength({ max: 50 }).withMessage("Key must be max 50 characters"),
  body("nilai").optional().isDecimal().withMessage("Nilai must be a decimal number"),
  body("valid").optional().isInt({ min: 0, max: 1 }).withMessage("Valid must be 0 or 1"),
];

export const screeningPraClosingValidation = [
  body("strCab")
    .notEmpty()
    .withMessage("strCab is required")
    .isLength({ max: 10 })
    .withMessage("strCab must be max 10 characters"),
  body("strMonth")
    .notEmpty()
    .withMessage("strMonth is required")
    .isInt({ min: 1, max: 12 })
    .withMessage("strMonth must be between 1 and 12"),
  body("strYear")
    .notEmpty()
    .withMessage("strYear is required")
    .isInt({ min: 2020, max: 2030 })
    .withMessage("strYear must be between 2020 and 2030"),
  body("strIP").notEmpty().withMessage("strIP is required").isIP().withMessage("Must be a valid IP address"),
  body("kdtk")
    .notEmpty()
    .withMessage("kdtk is required")
    .isLength({ max: 10 })
    .withMessage("kdtk must be max 10 characters"),
];

// Default export
export default {
  getAllPrepClosing,
  getPrepClosingById,
  createPrepClosing,
  updatePrepClosing,
  deletePrepClosing,
  getPrepClosingStats,
  screeningPraClosing,
  getProgress,
  getLatestProgress,
  getProgressStream,
  createPrepClosingValidation,
  updatePrepClosingValidation,
  screeningPraClosingValidation,
};
