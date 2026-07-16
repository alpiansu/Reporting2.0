import logger from "../../config/logger.js";
import { apiResponse } from "../../utils/index.js";
import jenisReturService from "./jenis-retur.service.js";

export const getAll = async (req, res) => {
  try {
    const data = await jenisReturService.getAll();
    return apiResponse.success(res, data);
  } catch (error) {
    logger.error(`[jenis-retur] Error getAll: ${error.message}`);
    return apiResponse.error(res, error.message);
  }
};

export const getByKode = async (req, res) => {
  try {
    const { kode } = req.params;
    const item = await jenisReturService.getByKode(kode);
    if (!item) return apiResponse.notFound(res, `Kode ${kode} not found`);
    return apiResponse.success(res, item);
  } catch (error) {
    logger.error(`[jenis-retur] Error getByKode: ${error.message}`);
    return apiResponse.error(res, error.message);
  }
};

export const create = async (req, res) => {
  try {
    const { kode, label } = req.body;
    if (!kode || !label) return apiResponse.badRequest(res, "kode and label are required");
    const item = await jenisReturService.create({ kode, label });
    return apiResponse.success(res, item);
  } catch (error) {
    logger.error(`[jenis-retur] Error create: ${error.message}`);
    return apiResponse.error(res, error.message);
  }
};

export const update = async (req, res) => {
  try {
    const { kode } = req.params;
    const { label } = req.body;
    const item = await jenisReturService.update(kode, { label });
    if (!item) return apiResponse.notFound(res, `Kode ${kode} not found`);
    return apiResponse.success(res, item);
  } catch (error) {
    logger.error(`[jenis-retur] Error update: ${error.message}`);
    return apiResponse.error(res, error.message);
  }
};

export const remove = async (req, res) => {
  try {
    const { kode } = req.params;
    const result = await jenisReturService.remove(kode);
    if (!result) return apiResponse.notFound(res, `Kode ${kode} not found`);
    return apiResponse.success(res, { message: `Kode ${kode} deleted` });
  } catch (error) {
    logger.error(`[jenis-retur] Error remove: ${error.message}`);
    return apiResponse.error(res, error.message);
  }
};
