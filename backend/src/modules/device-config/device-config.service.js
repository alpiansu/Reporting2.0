/**
 * Device config service - stores per-browser/per-device configuration
 * (e.g. TOKOMAIN.ini folder path) keyed by a stable deviceId.
 * Data persisted in data/device-configs.json.
 */
import fs from "fs/promises";
import path from "path";
import logger from "../../config/logger.js";

const FILE_PATH = path.join(process.cwd(), "data/device-configs.json");

class DeviceConfigService {
  constructor() {
    this.devices = [];
    this.initialized = false;
  }

  async initialize() {
    try {
      await fs.mkdir(path.dirname(FILE_PATH), { recursive: true });
      try {
        const data = await fs.readFile(FILE_PATH, "utf8");
        this.devices = JSON.parse(data);
      } catch (error) {
        if (error.code === "ENOENT" || error instanceof SyntaxError) {
          this.devices = [];
          await this.saveToFile();
        } else {
          throw error;
        }
      }
      this.initialized = true;
    } catch (error) {
      logger.error(`Failed to initialize device-config service: ${error.message}`);
      throw error;
    }
  }

  async ensureInitialized() {
    if (!this.initialized) {
      await this.initialize();
    }
    return this;
  }

  async saveToFile() {
    await fs.writeFile(FILE_PATH, JSON.stringify(this.devices, null, 2));
  }

  getDeviceByDeviceId(deviceId) {
    return this.devices.find(d => d.deviceId === deviceId) || null;
  }

  /**
   * Register or refresh a device record. Keeps the stored path intact.
   * @param {Object} data - { deviceId, browser, platform, clientIp }
   * @returns {Promise<Object>} Device config
   */
  async registerDevice(data) {
    await this.ensureInitialized();
    const { deviceId, browser, platform, clientIp } = data;
    if (!deviceId) {
      throw new Error("deviceId is required");
    }

    const now = new Date().toISOString();
    let device = this.getDeviceByDeviceId(deviceId);

    if (device) {
      device.lastSeenAt = now;
      if (browser) device.browser = browser;
      if (platform) device.platform = platform;
      if (clientIp) device.clientIp = clientIp;
    } else {
      device = {
        deviceId,
        registeredAt: now,
        lastSeenAt: now,
        clientIp: clientIp || null,
        browser: browser || null,
        platform: platform || null,
        path: null,
        updatedBy: null,
        updatedAt: null,
      };
      this.devices.push(device);
    }

    await this.saveToFile();
    return device;
  }

  /**
   * Get a device config by deviceId
   * @param {string} deviceId
   * @returns {Promise<Object|null>}
   */
  async getDeviceConfig(deviceId) {
    await this.ensureInitialized();
    return this.getDeviceByDeviceId(deviceId);
  }

  /**
   * Update the TOKOMAIN path for a device. User-agnostic (keyed by device).
   * @param {string} deviceId
   * @param {string} path - Folder/path of TOKOMAIN.ini
   * @param {string} updatedBy - Username that performed the change
   * @returns {Promise<Object>} Updated device config
   */
  async updatePath(deviceId, configPath, updatedBy) {
    await this.ensureInitialized();
    const device = this.getDeviceByDeviceId(deviceId);
    if (!device) {
      // Auto-create a minimal record so the save never fails on a fresh device
      const created = await this.registerDevice({ deviceId });
      return this.updatePath(deviceId, configPath, updatedBy);
    }

    device.path = configPath || null;
    device.updatedBy = updatedBy || null;
    device.updatedAt = new Date().toISOString();
    await this.saveToFile();
    return device;
  }
}

export default DeviceConfigService;