/**
 * Device config controllers - HTTP request/response handling
 */
import DeviceConfigService from "./device-config.service.js";
import logger from "../../config/logger.js";

const deviceConfigService = new DeviceConfigService();

export const registerDevice = async (req, res, next) => {
  try {
    const { deviceId, browser, platform } = req.body || {};
    const clientIp = req.ip || req.socket?.remoteAddress || null;

    if (!deviceId) {
      return res.status(400).json({ success: false, message: "deviceId is required" });
    }

    const device = await deviceConfigService.registerDevice({ deviceId, browser, platform, clientIp });
    res.status(200).json({ success: true, data: device });
  } catch (error) {
    logger.error(`device-config register error: ${error.message}`);
    next(error);
  }
};

export const getCurrentDevice = async (req, res, next) => {
  try {
    const { deviceId } = req.query;
    if (!deviceId) {
      return res.status(400).json({ success: false, message: "deviceId is required" });
    }

    const device = await deviceConfigService.getDeviceConfig(deviceId);
    if (!device) {
      return res.status(404).json({ success: false, message: "Device not registered" });
    }
    res.status(200).json({ success: true, data: device });
  } catch (error) {
    logger.error(`device-config get error: ${error.message}`);
    next(error);
  }
};

export const updateCurrentDevicePath = async (req, res, next) => {
  try {
    const { deviceId, path } = req.body || {};
    if (!deviceId) {
      return res.status(400).json({ success: false, message: "deviceId is required" });
    }

    const updatedBy = req.user?.username || null;
    const device = await deviceConfigService.updatePath(deviceId, path, updatedBy);
    res.status(200).json({ success: true, data: device });
  } catch (error) {
    logger.error(`device-config update error: ${error.message}`);
    next(error);
  }
};