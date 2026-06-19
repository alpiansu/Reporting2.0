/**
 * Combined Screening Controller
 */
import combinedScreeningService from "./combined_screening.service.js";
import progressService from "../progress/progress.service.js";
import config from "./combined_screening.config.js";
import apiResponse from "../../utils/apiResponse.js";
import logger from "../../config/logger.js";

/**
 * POST /api/combined-screening/trigger
 * Body: { cabang, periode, force }
 */
export const trigger = async (req, res) => {
  try {
    const { cabang = "All", periode, force = false } = req.body;

    if (!periode || !/^\d{4}$/.test(periode)) {
      return apiResponse.error(res, "Periode must be in YYMM format (4 digits)", 400);
    }

    const { username, fullName } = req.user || {};

    logger.info(
      `[combined_screening.controller] Trigger by ${username}: cabang=${cabang}, periode=${periode}, force=${force}`,
    );

    const result = await combinedScreeningService.screening({
      cabang,
      periode,
      username: username || "manual",
      fullName: fullName || "Manual Trigger",
      force: !!force,
    });

    return apiResponse.success(res, result);
  } catch (error) {
    logger.error(`[combined_screening.controller] Trigger error: ${error.message}`);
    return apiResponse.error(res, error.message);
  }
};

/**
 * GET /api/combined-screening/status
 */
export const getStatus = async (req, res) => {
  try {
    const { username } = req.user || {};
    const taskId = `${config.taskProgressName}_${username}`;

    const task = progressService.getProgress(taskId);
    if (!task) {
      return apiResponse.success(res, {
        status: "idle",
        message: "No combined screening task running",
      });
    }

    return apiResponse.success(res, {
      status: task.status,
      taskId,
      progress: task,
    });
  } catch (error) {
    logger.error(`[combined_screening.controller] Status error: ${error.message}`);
    return apiResponse.error(res, error.message);
  }
};

/**
 * GET /api/combined-screening/config
 * (Superadmin only)
 */
export const getConfig = async (req, res) => {
  try {
    const cfg = combinedScreeningService.getConfig();
    return apiResponse.success(res, cfg);
  } catch (error) {
    logger.error(`[combined_screening.controller] GetConfig error: ${error.message}`);
    return apiResponse.error(res, error.message);
  }
};

/**
 * PATCH /api/combined-screening/config/:moduleName
 * Body: { enabled: true/false }
 * (Superadmin only)
 */
export const toggleModule = async (req, res) => {
  try {
    const { moduleName } = req.params;
    const { enabled } = req.body;

    if (typeof enabled !== "boolean") {
      return apiResponse.error(res, "Field 'enabled' must be a boolean", 400);
    }

    const result = combinedScreeningService.toggleModule(moduleName, enabled);
    return apiResponse.success(res, result);
  } catch (error) {
    logger.error(`[combined_screening.controller] ToggleModule error: ${error.message}`);
    return apiResponse.error(res, error.message);
  }
};
