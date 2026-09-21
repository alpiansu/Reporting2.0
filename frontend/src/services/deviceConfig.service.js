import api from "./api.js";

/**
 * Device Config Service - per-browser/per-device configuration API calls
 */
class DeviceConfigService {
  /**
   * Register/refresh the current device record
   * @param {string} deviceId - Stable device ID (from localStorage)
   * @param {string} browser - e.g. "Chrome 129"
   * @param {string} platform - e.g. "Windows"
   */
  async register(deviceId, browser, platform) {
    const response = await api.post("/device-config/register", { deviceId, browser, platform });
    return response.data?.data || response.data;
  }

  /**
   * Get current device config
   * @param {string} deviceId
   */
  async getCurrent(deviceId) {
    const response = await api.get("/device-config/current", { params: { deviceId } });
    return response.data?.data || response.data;
  }

  /**
   * Update TOKOMAIN path for the current device
   * @param {string} deviceId
   * @param {string} path - Configured TOKOMAIN.ini folder path
   */
  async updatePath(deviceId, path) {
    const response = await api.put("/device-config/current", { deviceId, path });
    return response.data?.data || response.data;
  }
}

export default new DeviceConfigService();