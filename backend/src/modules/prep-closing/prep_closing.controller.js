/**
 * Controller for Prep Closing (Screening Pra Closing)
 */
import logger from "../../config/logger.js";
import { apiResponse } from "../../utils/index.js";
import prepClosingService from "./prep_closing.service.js";
import notesService from "../notes/notes.service.js";
import UserService from "../user/user.service.js";
import { wrcExtractorService } from "./wrc_extractor.service.js";

/**
 * Start screening process
 * Supports 3 levels: All cabang, 1 cabang, or 1 specific store
 * GET /api/prep-closing/screening
 */
export const screeningByCabang = async (req, res) => {
  try {
    const { cabang, periode, kdtk } = req.query;

    if (!periode) {
      return apiResponse.badRequest(res, "Periode is required");
    }

    // Validate periode format (YYMM)
    if (!/^\d{4}$/.test(periode)) {
      return apiResponse.badRequest(res, "Format periode tidak valid. Gunakan format YYMM (contoh: 2511)");
    }

    const username = req.user?.username || "system";

    // LEVEL 3: Single store screening
    if (kdtk) {
      logger.info(`[prep_closing.controller] Starting screening for store: ${kdtk}, periode: ${periode}`);

      const result = await prepClosingService.screening({
        kdtk,
        periode,
        username,
      });

      return apiResponse.success(res, result);
    }

    // LEVEL 1 & 2: Multi-store screening
    const cabParam = !cabang || cabang === "All" ? "All" : cabang;
    logger.info(`[prep_closing.controller] Starting screening for cabang: ${cabParam}, periode: ${periode}`);

    const result = await prepClosingService.screening({
      cabang: cabParam,
      periode,
      username,
    });

    return apiResponse.success(res, result);
  } catch (error) {
    logger.error(`[prep_closing.controller] Error in screeningByCabang: ${error.message}`);
    return apiResponse.error(res, error.message);
  }
};

/**
 * Get summary statistics
 * GET /api/prep-closing/summary
 */
export const getSummary = async (req, res) => {
  try {
    const { cabang, periode } = req.query;

    if (!periode) {
      return apiResponse.badRequest(res, "Periode is required");
    }

    const cabParam = !cabang || cabang === "All" ? "All" : cabang;

    logger.info(`[prep_closing.controller] Getting summary for cabang: ${cabParam}, periode: ${periode}`);

    const result = await prepClosingService.getSummary({ cabang: cabParam, periode });

    return apiResponse.success(res, result);
  } catch (error) {
    logger.error(`[prep_closing.controller] Error getting summary: ${error.message}`);
    return apiResponse.error(res, error.message);
  }
};

/**
 * Get rules summary
 * GET /api/prep-closing/rules-summary
 */
export const getRulesSummary = async (req, res) => {
  try {
    const { cabang, periode } = req.query;

    if (!periode) {
      return apiResponse.badRequest(res, "Periode is required");
    }

    const cabParam = !cabang || cabang === "All" ? "All" : cabang;

    const result = await prepClosingService.getRulesSummary({ cabang: cabParam, periode });

    return apiResponse.success(res, result);
  } catch (error) {
    logger.error(`[prep_closing.controller] Error getting rules summary: ${error.message}`);
    return apiResponse.error(res, error.message);
  }
};

/**
 * Get resume by store (paginated)
 * GET /api/prep-closing/resumePerShop
 */
export const getResumeByKdtk = async (req, res) => {
  try {
    const {
      periode,
      cabang = "All",
      page = 1,
      limit = 10,
      sortColumn = "KDTK",
      sortOrder = "ASC",
      searchQuery,
      ruleKeys,
    } = req.query;

    if (!periode) {
      return apiResponse.badRequest(res, "Periode is required");
    }

    const cabParam = !cabang || cabang === "All" ? "All" : cabang;

    logger.info(
      `[prep_closing.controller] Get resume by KDTK: cabang=${cabParam}, periode=${periode}, page=${page}, limit=${limit}`
    );

    let parsedRuleKeys = undefined;
    if (ruleKeys) {
      if (Array.isArray(ruleKeys)) {
        parsedRuleKeys = ruleKeys;
      } else if (typeof ruleKeys === "string") {
        try {
          parsedRuleKeys = ruleKeys.includes(",")
            ? ruleKeys
                .split(",")
                .map(s => s.trim())
                .filter(Boolean)
            : JSON.parse(ruleKeys);
          if (!Array.isArray(parsedRuleKeys)) parsedRuleKeys = [ruleKeys];
        } catch {
          parsedRuleKeys = ruleKeys
            .split(",")
            .map(s => s.trim())
            .filter(Boolean);
        }
      }
    }

    const result = await prepClosingService.getResumeByKdtk({
      cabang: cabParam,
      periode,
      page: parseInt(page),
      limit: parseInt(limit),
      searchQuery,
      sortColumn,
      sortOrder,
      ruleKeys: parsedRuleKeys,
    });

    return apiResponse.success(res, result);
  } catch (error) {
    logger.error(`[prep_closing.controller] Error getting resume by KDTK: ${error.message}`);
    return apiResponse.error(res, error.message);
  }
};

/**
 * Get detailed issues for a specific store
 * GET /api/prep-closing/details
 */
export const getStoreDetails = async (req, res) => {
  try {
    const { kdtk, periode } = req.query;

    if (!kdtk || !periode) {
      return apiResponse.badRequest(res, "kdtk and periode are required");
    }

    logger.info(`[prep_closing.controller] Get store details: kdtk=${kdtk}, periode=${periode}`);

    const result = await prepClosingService.getStoreDetails({ kdtk, periode });

    if (!result) {
      return apiResponse.notFound(res, "Store details not found");
    }

    return apiResponse.success(res, { data: result });
  } catch (error) {
    logger.error(`[prep_closing.controller] Error getting store details: ${error.message}`);
    return apiResponse.error(res, error.message);
  }
};

/**
 * Get issues grouped by category
 * GET /api/prep-closing/issuesByCategory
 */
export const getIssuesByCategory = async (req, res) => {
  try {
    const { cabang, periode } = req.query;

    if (!periode) {
      return apiResponse.badRequest(res, "Periode is required");
    }

    const cabParam = !cabang || cabang === "All" ? "All" : cabang;

    logger.info(`[prep_closing.controller] Get issues by category: cabang=${cabParam}, periode=${periode}`);

    const result = await prepClosingService.getIssuesByCategory({ cabang: cabParam, periode });

    return apiResponse.success(res, result);
  } catch (error) {
    logger.error(`[prep_closing.controller] Error getting issues by category: ${error.message}`);
    return apiResponse.error(res, error.message);
  }
};

/**
 * Export full data set for Excel (4 sheets)
 * GET /api/prep-closing/export-data
 */
export const getExportData = async (req, res) => {
  try {
    const { cabang, periode, searchQuery, ruleKeys } = req.query;

    if (!periode) {
      return apiResponse.badRequest(res, "Periode is required");
    }

    const cabParam = !cabang || cabang === "All" ? "All" : cabang;

    let parsedRuleKeys = undefined;
    if (ruleKeys) {
      if (Array.isArray(ruleKeys)) parsedRuleKeys = ruleKeys;
      else if (typeof ruleKeys === "string") {
        try {
          parsedRuleKeys = ruleKeys.includes(",")
            ? ruleKeys
                .split(",")
                .map(s => s.trim())
                .filter(Boolean)
            : JSON.parse(ruleKeys);
          if (!Array.isArray(parsedRuleKeys)) parsedRuleKeys = [ruleKeys];
        } catch {
          parsedRuleKeys = ruleKeys
            .split(",")
            .map(s => s.trim())
            .filter(Boolean);
        }
      }
    }

    const result = await prepClosingService.getExportData({
      cabang: cabParam,
      periode,
      searchQuery,
      ruleKeys: parsedRuleKeys,
    });
    return apiResponse.success(res, result);
  } catch (error) {
    logger.error(`[prep_closing.controller] Error getExportData: ${error.message}`);
    return apiResponse.error(res, error.message);
  }
};

/**
 * Update or create note for a specific store and periode
 * PUT /api/prep-closing/note
 */
export const updateNote = async (req, res) => {
  try {
    const { cabang, kdtk, periode, noteText } = req.body;
    const pic = req.user?.username || "system";
    const tableName = `screening_praclosing`;
    const unixKey = `${kdtk}${periode}`;

    if (!cabang || !kdtk || !periode) {
      return apiResponse.badRequest(res, "cabang, kdtk, dan periode wajib diisi");
    }

    if (noteText === undefined) {
      return apiResponse.badRequest(res, "noteText wajib diisi");
    }

    const userService = new UserService();
    const user = await userService.findByCredentials(pic);

    const noteData = {
      Cabang: cabang,
      unixKey,
      noteText: noteText || "",
      pic: pic,
      categoryId: null,
      tableName: tableName,
    };

    const note = await notesService.upsert(noteData);

    const result = { ...note.toJSON(), fullName: user?.fullName || null };

    return apiResponse.success(res, result);
  } catch (error) {
    logger.error(`[prep_closing.controller] Error updating note: ${error.message}`);
    return apiResponse.error(res, error.message);
  }
};

/**
 * Get full rules configure data
 * GET /api/prep-closing/rules
 */
export const getRules = async (req, res) => {
  try {
    const rulesPath = prepClosingService.rulesPath || "src/modules/prep-closing/rules/rules.json";
    const result = await prepClosingService.getRulesConfig();
    return apiResponse.success(res, result);
  } catch (error) {
    logger.error(`[prep_closing.controller] Error getting rules config: ${error.message}`);
    return apiResponse.error(res, error.message);
  }
};

/**
 * Update full rules configure data
 * PUT /api/prep-closing/rules
 */
export const updateRules = async (req, res) => {
  try {
    const rulesData = req.body;
    if (!rulesData || !rulesData.rules) {
      return apiResponse.badRequest(res, "Data rules tidak valid");
    }
    const pic = req.user?.username || "system";
    const result = await prepClosingService.updateRulesConfig(rulesData, pic);
    return apiResponse.success(res, result);
  } catch (error) {
    logger.error(`[prep_closing.controller] Error updating rules config: ${error.message}`);
    return apiResponse.error(res, error.message);
  }
};

/**
 * Get WRC Extract Rules
 * GET /api/prep-closing/wrc-extract-rules
 */
export const getWrcExtractRules = async (req, res) => {
  try {
    const result = await wrcExtractorService.loadRules();
    return apiResponse.success(res, result);
  } catch (error) {
    logger.error(`[prep_closing.controller] Error getting wrc extract rules: ${error.message}`);
    return apiResponse.error(res, error.message);
  }
};

/**
 * Update WRC Extract Rules
 * PUT /api/prep-closing/wrc-extract-rules
 */
export const updateWrcExtractRules = async (req, res) => {
  try {
    const rulesData = req.body;
    if (!Array.isArray(rulesData)) {
      return apiResponse.badRequest(res, "Data rules WRC harus berupa array");
    }
    const result = await wrcExtractorService.updateRules(rulesData);
    return apiResponse.success(res, result);
  } catch (error) {
    logger.error(`[prep_closing.controller] Error updating wrc extract rules: ${error.message}`);
    return apiResponse.error(res, error.message);
  }
};

/**
 * Trigger WRC Extraction logic
 * POST /api/prep-closing/wrc-extract-trigger
 */
export const triggerWrcExtraction = async (req, res) => {
  try {
    const { cabang, periode, shops } = req.body;
    if (!periode) {
      return apiResponse.badRequest(res, "Periode is required to extract WRC data");
    }
    
    // Asynchronous Execution inside
    const cabParam = !cabang || cabang === "All" ? "All" : cabang;
    const result = await wrcExtractorService.triggerExtraction(cabParam, periode, shops);
    
    return apiResponse.success(res, { message: "WRC extraction completed successfully", cache_manifest: result });
  } catch (error) {
    logger.error(`[prep_closing.controller] Error triggering wrc extract: ${error.message}`);
    return apiResponse.error(res, error.message);
  }
};
