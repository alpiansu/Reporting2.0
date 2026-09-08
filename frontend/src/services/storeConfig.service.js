import api from "./api";

class StoreConfigService {
  /**
   * Get all store interfence configs
   * @returns {Promise<Object>} API response with configs data
   */
  async getAllConfigs() {
    try {
      const response = await api.get("/store-config");
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch configs: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Get config by ID
   * @param {number} id - Config ID
   * @returns {Promise<Object>} API response with config data
   */
  async getConfigById(id) {
    try {
      const response = await api.get(`/store-config/${id}`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch config: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Create new config
   * @param {Object} configData - { user, password }
   * @returns {Promise<Object>} API response with created config
   */
  async createConfig(configData) {
    try {
      const response = await api.post("/store-config", configData);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to create config: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Update existing config
   * @param {number} id - Config ID
   * @param {Object} configData - { user, password }
   * @returns {Promise<Object>} API response with updated config
   */
  async updateConfig(id, configData) {
    try {
      const response = await api.put(`/store-config/${id}`, configData);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to update config: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Delete config
   * @param {number} id - Config ID
   * @returns {Promise<Object>} API response
   */
  async deleteConfig(id) {
    try {
      const response = await api.delete(`/store-config/${id}`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to delete config: ${error.response?.data?.message || error.message}`);
    }
  }
}

export default new StoreConfigService();
