/**
 * Controller for WT reconciliation
 */
import rekonWtHarianService from "./rekon_wt_harian.service.js";
import progressService from "../progress/progress.service.js";
import notesService from "../notes/notes.service.js";
import UserService from "../user/user.service.js";
import logger from "../../config/logger.js";
import config from "../../config/rekon_wt_harian.config.js";
import storeService from "../../modules/store/storeService.js";

/**
 * Cleanup temporary files used in reconciliation
 */
export const cleanupTempFiles = async (req, res, next) => {
  try {
    await rekonWtHarianService.cleanupTempFiles();
    res.status(200).json({
      success: true,
      message: "Temporary files cleaned up successfully",
    });
  } catch (error) {
    logger.error(`Error in cleanupTempFiles: ${error.message}`);
    next(error);
  }
};

/**
 * Start reconciliation process
 */
export const startReconciliation = async (req, res, next) => {
  try {
    const { cab, periode, force } = req.body;
    const isForce = force === "true" || force === true;

    if (!periode) {
      return res.status(400).json({ success: false, message: "Periode harus diisi" });
    }

    if (!/^\d{4}$/.test(periode)) {
      return res.status(400).json({
        success: false,
        message: "Format periode tidak valid. Gunakan format YYMM (contoh: 2507 untuk Juli 2025)",
      });
    }

    await rekonWtHarianService.cleanupTempFiles();

    const cabParam = cab === "SEMUA" || !cab ? "All" : cab;

    // Check for any active reconciliation task
    const activeTask = findActiveRekonTask();
    if (activeTask) {
      const activeCab = activeTask.info?.cab || "Unknown";
      const activePeriode = activeTask.info?.period || "Unknown";

      return res.status(409).json({
        success: false,
        message: `Proses rekonsiliasi untuk ${
          activeCab === "All" ? "semua cabang" : `cabang ${activeCab}`
        } periode ${activePeriode} sedang berjalan. Silakan tunggu hingga proses selesai.`,
        activeProcess: {
          id: activeTask.id,
          cab: activeCab,
          periode: activePeriode,
          status: activeTask.status,
          percentage: activeTask.percentage,
          startTime: activeTask.createdAt,
          totalItems: activeTask.total || 0,
          processedItems: activeTask.current || 0,
        },
      });
    }

    await storeService.ensureInitialized();

    if (cabParam === "All") {
      const allStores = storeService.stores;
      const branches = [...new Set(allStores.filter(s => s.notes === "INDUK").map(s => s.branch || s.cab))];
      const totalStores = allStores.filter(s => s.notes === "INDUK").length;

      const taskId = `rekon_wt_harian_All_${periode}_${Date.now()}`;
      await progressService.startProgress(taskId, totalStores, {
        module: "rekon_wt_harian",
        title: "Rekon WT Harian - Semua Cabang",
        description: "Mendaftarkan tugas rekonsiliasi...",
        startedBy: req.user?.fullName || req.user?.username || "system",
        status: "registering",
        createdAt: new Date().toISOString(),
        cab: "All",
        period: periode,
        totalStores,
        branches: branches.length,
        operation: "reconcile_all_branches",
      });

      rekonWtHarianService.reconcileAllBranchesWithProgress(periode, taskId, totalStores, isForce);

      return res.status(200).json({
        success: true,
        message: "Proses rekonsiliasi dimulai",
        taskId,
        totalBranches: branches.length,
        totalStores,
      });
    }

    const branchStores = await storeService.getStoresByBranch(cab, true);
    const totalStores = branchStores.length;

    const taskId = `rekon_wt_harian_${cabParam}_${periode}_${Date.now()}`;
    await progressService.startProgress(taskId, totalStores, {
      module: "rekon_wt_harian",
      title: `Rekon WT Harian - Cabang ${cabParam}`,
      description: "Mendaftarkan tugas rekonsiliasi...",
      startedBy: req.user?.fullName || req.user?.username || "system",
      status: "registering",
      createdAt: new Date().toISOString(),
      cab: cabParam,
      period: periode,
      totalStores,
      operation: "reconcile_branch",
    });

    rekonWtHarianService.reconcileDataWithProgress(cabParam, periode, taskId, totalStores, isForce);

    res.status(200).json({
      success: true,
      message: "Proses rekonsiliasi dimulai",
      taskId,
      totalStores,
    });
  } catch (error) {
    logger.error(`Error in startReconciliation: ${error.message}`);
    next(error);
  }
};

/**
 * Get reconciliation results
 */
export const getResults = async (req, res, next) => {
  try {
    const { cab, periode, toko } = req.params;
    const { page, limit, tipe, tgl1, searchQuery, sortColumn, sortOrder, toleranceAmount } = req.query;

    if (!periode) {
      return res.status(400).json({ success: false, message: "Periode harus diisi" });
    }

    const results = await rekonWtHarianService.getResults(cab, periode, toko, {
      page: parseInt(page) || 1,
      limit: parseInt(limit) || config.pagination.defaultLimit,
      tipe,
      tgl1,
      searchQuery,
      sortColumn,
      sortOrder,
      toleranceAmount: toleranceAmount ? parseInt(toleranceAmount) : undefined,
    });

    res.status(200).json(results);
  } catch (error) {
    logger.error(`Error in getResults: ${error.message}`);
    next(error);
  }
};

/**
 * Get summary of reconciliation results
 */
export const getSummary = async (req, res, next) => {
  try {
    const { cab, periode } = req.params;

    if (!periode) {
      return res.status(400).json({ success: false, message: "Periode harus diisi" });
    }

    let summary;
    if (cab === "SEMUA" || cab === "All" || !cab) {
      summary = await rekonWtHarianService.getAllCabangSummary(periode);
    } else {
      summary = await rekonWtHarianService.getSummary(cab, periode);
    }

    res.status(200).json({ success: true, data: summary });
  } catch (error) {
    logger.error(`Error in getSummary: ${error.message}`);
    next(error);
  }
};

/**
 * Delete reconciliation results
 */
export const deleteResults = async (req, res, next) => {
  try {
    const { cab, periode } = req.params;

    if (!periode) {
      return res.status(400).json({ success: false, message: "Periode harus diisi" });
    }

    if (cab === "SEMUA") {
      const count = await rekonWtHarianService.deleteAllCabangResults(periode);
      return res.status(200).json({
        success: true,
        message: `${count} data rekonsiliasi untuk semua cabang berhasil dihapus`,
        deletedCount: count,
      });
    }

    const count = await rekonWtHarianService.deleteResults(cab, periode);
    res.status(200).json({
      success: true,
      message: `${count} data berhasil dihapus`,
      deletedCount: count,
    });
  } catch (error) {
    logger.error(`Error in deleteResults: ${error.message}`);
    next(error);
  }
};

/**
 * Get reconciliation progress
 */
export const getProgress = async (req, res, next) => {
  try {
    const { taskId } = req.params;

    if (!taskId) {
      return res.status(400).json({ success: false, message: "Task ID harus diisi" });
    }

    const task = progressService.progressMap.get(taskId);
    if (!task) {
      return res.status(404).json({ success: false, message: "Progress tidak ditemukan" });
    }

    res.status(200).json({ success: true, data: task });
  } catch (error) {
    logger.error(`Error in getProgress: ${error.message}`);
    next(error);
  }
};

/**
 * Get latest reconciliation progress for a branch and period
 */
export const getLatestProgress = async (req, res, next) => {
  try {
    const { cab, periode } = req.params;

    if (!periode) {
      return res.status(400).json({ success: false, message: "Periode harus diisi" });
    }

    const cabParam = cab === "SEMUA" ? "All" : cab;
    const latest = findLatestRekonTask(cabParam, periode);

    if (!latest) {
      return res.status(404).json({ success: false, message: "Progress tidak ditemukan" });
    }

    res.status(200).json({ success: true, data: latest });
  } catch (error) {
    logger.error(`Error in getLatestProgress: ${error.message}`);
    next(error);
  }
};

/**
 * Get daily shop summary
 */
export const getDailyShopSummary = async (req, res, next) => {
  try {
    const { cab, periode } = req.params;
    const { page = 1, limit = 50, toko, tgl1, searchQuery, sortColumn = "tanggal", sortOrder = "asc" } = req.query;

    if (!periode) {
      return res.status(400).json({ success: false, message: "Periode harus diisi" });
    }

    const cabFilter = cab === "SEMUA CABANG" ? "All" : cab;

    const results = await rekonWtHarianService.getDailyShopSummary(cabFilter, periode, {
      page: parseInt(page),
      limit: parseInt(limit),
      toko,
      tgl1,
      searchQuery,
      sortColumn,
      sortOrder,
    });

    res.status(200).json(results);
  } catch (error) {
    logger.error(`Error in getDailyShopSummary: ${error.message}`);
    next(error);
  }
};

/**
 * Start reconciliation process for specific shop
 */
export const refreshShopReconciliation = async (req, res, next) => {
  try {
    const { periode, cab, toko } = req.params;

    if (!periode || !cab || !toko) {
      return res.status(400).json({
        success: false,
        message: "Periode, cabang, dan toko harus diisi",
      });
    }

    if (!/^\d{4}$/.test(periode)) {
      return res.status(400).json({
        success: false,
        message: "Format periode tidak valid. Gunakan format YYMM (contoh: 2507 untuk Juli 2025)",
      });
    }

    const result = await rekonWtHarianService.reconcileSpecificShop(cab, periode, toko);

    logger.info(`Rekonsiliasi toko ${toko} cabang ${cab} periode ${periode} selesai`);

    res.status(200).json({
      success: true,
      message: `Rekonsiliasi untuk toko ${toko} cabang ${cab} periode ${periode} telah selesai`,
      data: { cab, periode, toko, result },
    });
  } catch (error) {
    logger.error(`Error in refreshShopReconciliation: ${error.message}`);
    next(error);
  }
};

/**
 * Invalidate cache manually
 */
export const invalidateCache = async (req, res, next) => {
  try {
    rekonWtHarianService.invalidateCache();
    res.status(200).json({
      success: true,
      message: "Cache invalidated successfully. Data will be reloaded on next request.",
    });
  } catch (error) {
    logger.error(`Error in invalidateCache: ${error.message}`);
    next(error);
  }
};

/**
 * Update or create note for a specific store and period
 * PUT /api/rekon-wt-harian/note
 */
export const updateNote = async (req, res) => {
  try {
    const { cabang, toko, periode, noteText } = req.body;
    const pic = req.user?.username || "system";
    const tableName = "rekon_wt_harian";
    const unixKey = `${toko}${periode}`;

    if (!cabang || !toko || !periode) {
      return res.status(400).json({ success: false, message: "cabang, toko, dan periode wajib diisi" });
    }

    if (noteText === undefined) {
      return res.status(400).json({ success: false, message: "noteText wajib diisi" });
    }

    const userService = new UserService();
    const user = await userService.findByCredentials(pic);

    if (String(noteText).trim().length === 0) {
      const deleted = await notesService.removeByKey(tableName, unixKey);
      return res.status(200).json({ success: true, data: { deleted, unixKey } });
    }

    const noteData = {
      Cabang: cabang,
      unixKey,
      noteText: noteText || "",
      pic,
      categoryId: null,
      tableName,
    };

    const note = await notesService.upsert(noteData);
    const result = { ...note.toJSON(), fullName: user?.fullName || null };

    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logger.error(`[rekon_wt_harian.controller] Error updating note: ${error.message}`);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// --- Helper functions ---

/**
 * Find active rekon_wt_harian task in progressMap
 */
function findActiveRekonTask() {
  for (const [, task] of progressService.progressMap) {
    if (
      task.info?.module === "rekon_wt_harian" &&
      (task.status === "running" || task.status === "pending")
    ) {
      return task;
    }
  }
  return null;
}

/**
 * Find latest rekon_wt_harian task matching cab and period
 */
function findLatestRekonTask(cab, period) {
  const matching = [];
  for (const [, task] of progressService.progressMap) {
    if (
      task.info?.module === "rekon_wt_harian" &&
      task.info?.cab === cab &&
      task.info?.period === period
    ) {
      matching.push(task);
    }
  }
  matching.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  return matching[0] || null;
}
