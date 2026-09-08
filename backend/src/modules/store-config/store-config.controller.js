/**
 * Controller untuk store-config API
 */
import StoreConfigService from "./store-config.service.js";
import logger from "../../config/logger.js";

const storeConfigService = new StoreConfigService();

/**
 * GET /api/store-config
 * List semua configs
 */
export const getAllConfigs = async (req, res, next) => {
  try {
    const configs = await storeConfigService.getAll();
    res.status(200).json({
      success: true,
      data: configs,
    });
  } catch (error) {
    logger.error(`Get all store configs error: ${error.message}`);
    next(error);
  }
};

/**
 * GET /api/store-config/:id
 * Get config by ID
 */
export const getConfigById = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const config = await storeConfigService.getById(id);
    res.status(200).json({
      success: true,
      data: config,
    });
  } catch (error) {
    logger.error(`Get store config by ID error: ${error.message}`);
    if (error.message.includes("tidak ditemukan")) {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }
    next(error);
  }
};

/**
 * POST /api/store-config
 * Tambah config baru
 */
export const createConfig = async (req, res, next) => {
  try {
    const { user, password } = req.body;

    if (!user || !password) {
      return res.status(400).json({
        success: false,
        message: "User dan password diperlukan",
      });
    }

    const config = await storeConfigService.create({ user, password });
    res.status(201).json({
      success: true,
      message: "Config berhasil ditambahkan",
      data: config,
    });
  } catch (error) {
    logger.error(`Create store config error: ${error.message}`);
    next(error);
  }
};

/**
 * PUT /api/store-config/:id
 * Update config
 */
export const updateConfig = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { user, password } = req.body;

    const config = await storeConfigService.update(id, { user, password });
    res.status(200).json({
      success: true,
      message: "Config berhasil diperbarui",
      data: config,
    });
  } catch (error) {
    logger.error(`Update store config error: ${error.message}`);
    if (error.message.includes("tidak ditemukan")) {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }
    next(error);
  }
};

/**
 * DELETE /api/store-config/:id
 * Hapus config
 */
export const deleteConfig = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const result = await storeConfigService.delete(id);
    res.status(200).json({
      success: true,
      message: "Config berhasil dihapus",
      data: result,
    });
  } catch (error) {
    logger.error(`Delete store config error: ${error.message}`);
    if (error.message.includes("tidak ditemukan")) {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }
    next(error);
  }
};
