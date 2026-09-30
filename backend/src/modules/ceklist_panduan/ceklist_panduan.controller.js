/**
 * Controller for Ceklist Panduan CRUD
 */
import logger from "../../config/logger.js";
import ceklistPanduanService from "./ceklist_panduan.service.js";

export const getAll = async (req, res) => {
  try {
    const data = await ceklistPanduanService.getAll();
    return res.status(200).json({ success: true, data });
  } catch (error) {
    logger.error(`[ceklist_panduan] getAll: ${error.message}`);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getByKdcab = async (req, res) => {
  try {
    const data = await ceklistPanduanService.getByKdcab(req.params.kdcab);
    if (!data) return res.status(404).json({ success: false, message: "Panduan tidak ditemukan" });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    logger.error(`[ceklist_panduan] getByKdcab: ${error.message}`);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const create = async (req, res) => {
  try {
    const data = await ceklistPanduanService.create(req.body);
    return res.status(201).json({ success: true, data });
  } catch (error) {
    logger.error(`[ceklist_panduan] create: ${error.message}`);
    return res.status(400).json({ success: false, message: error.message });
  }
};

export const update = async (req, res) => {
  try {
    const data = await ceklistPanduanService.update(req.params.kdcab, req.body);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    logger.error(`[ceklist_panduan] update: ${error.message}`);
    return res.status(400).json({ success: false, message: error.message });
  }
};

export const remove = async (req, res) => {
  try {
    const result = await ceklistPanduanService.remove(req.params.kdcab);
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    logger.error(`[ceklist_panduan] remove: ${error.message}`);
    return res.status(500).json({ success: false, message: error.message });
  }
};