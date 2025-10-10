import logger from "../../config/logger.js";
import { apiResponse } from "../../utils/index.js";
import rekonVirtualService from "./rekon_virtual_mrg.service.js";

//Controller screening by cabang
export const screeningByCabang = async (req, res) => {
  try {
    const options = {
      cabang: req.query.cabang,
      periode: req.query.periode,
    };

    //validation options
    if (!options.cabang || !options.periode) {
      return apiResponse.badRequest(res, "Cabang and periode are required");
    }

    const result = await rekonVirtualService.screening(options);

    return apiResponse.success(res, result);
  } catch (error) {
    logger.error(`Error in screeningByCabang: ${error.message}`);
    return apiResponse.error(res, error.message);
  }
};

/**
 * Get all records
 */
export const getAllRecords = async (req, res) => {
  try {
    const options = {
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 10,
      shop: req.query.shop,
      cabang: req.query.cabang,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
    };

    const result = await rekonVirtualService.getAllRecords(options);
    return apiResponse.success(res, result);
  } catch (error) {
    logger.error(`Error getting records: ${error.message}`);
    return apiResponse.error(res, error.message);
  }
};

/**
 * Get record by ID
 */
export const getRecord = async (req, res) => {
  try {
    const { cabang, shop, tanggal, prdcd } = req.params;
    const result = await rekonVirtualService.getRecord(cabang, shop, tanggal, prdcd);

    if (!result) {
      return apiResponse.notFound(res, "Record not found");
    }

    return apiResponse.success(res, result);
  } catch (error) {
    logger.error(`Error getting record: ${error.message}`);
    return apiResponse.error(res, error.message);
  }
};

/**
 * Create new record
 */
export const createRecord = async (req, res) => {
  try {
    const result = await rekonVirtualService.createRecord(req.body);
    return apiResponse.created(res, result);
  } catch (error) {
    logger.error(`Error creating record: ${error.message}`);
    return apiResponse.error(res, error.message);
  }
};

/**
 * Update record
 */
export const updateRecord = async (req, res) => {
  try {
    const { cabang, shop, tanggal, prdcd } = req.params;
    const result = await rekonVirtualService.updateRecord(cabang, shop, tanggal, prdcd, req.body);
    return apiResponse.success(res, result);
  } catch (error) {
    logger.error(`Error updating record: ${error.message}`);
    if (error.message === "Record not found") {
      return apiResponse.notFound(res, error.message);
    }
    return apiResponse.error(res, error.message);
  }
};

/**
 * Delete record
 */
export const deleteRecord = async (req, res) => {
  try {
    const { cabang, shop, tanggal, prdcd } = req.params;
    await rekonVirtualService.deleteRecord(cabang, shop, tanggal, prdcd);
    return apiResponse.success(res, { message: "Record deleted successfully" });
  } catch (error) {
    logger.error(`Error deleting record: ${error.message}`);
    if (error.message === "Record not found") {
      return apiResponse.notFound(res, error.message);
    }
    return apiResponse.error(res, error.message);
  }
};

/**
 * Insert records from store
 */
export const insertFromStore = async (req, res) => {
  try {
    const { shop, year, month } = req.body;

    if (!shop || !year || !month) {
      return apiResponse.badRequest(res, "Shop, year, and month are required");
    }

    const result = await rekonVirtualService.insertFromStore(shop, year, month);
    return apiResponse.success(res, result);
  } catch (error) {
    logger.error(`Error inserting from store: ${error.message}`);
    return apiResponse.error(res, error.message);
  }
};
