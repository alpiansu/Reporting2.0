import api from "./api";

class HealthService {
  /**
   * Ambil informasi kesehatan & versi backend dari GET /api/health
   * @returns {Promise<Object|null>} { status, service, version, nodeEnv, uptime, db } atau null bila gagal
   */
  async getHealth() {
    try {
      const response = await api.get("/health");
      return response.data;
    } catch (error) {
      console.error("Error fetching health:", error);
      return null;
    }
  }

  /**
   * Normalisasi versi agar perbandingan tidak false-positive:
   * hilangkan prefix "v"/"V" dan whitespace di tepi.
   * @param {string|null} version
   * @returns {string|null}
   */
  normalizeVersion(version) {
    if (!version) return null;
    return String(version).trim().replace(/^v/i, "");
  }
}

export default new HealthService();
