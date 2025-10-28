import api from "./api";

/**
 * Service for interacting with modules API
 */
class ModulesService {
  /**
   * Get all available modules
   * @returns {Promise} Promise object with modules data
   */
  getAll() {
    return api.get("/modules");
  }
}

export default new ModulesService();
