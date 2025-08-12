/**
 * Service for interacting with m_cabang API
 */
import api from './api';

class MCabangService {
  /**
   * Get all cabang
   * @returns {Promise} Promise object with cabang data
   */
  getAllCabang() {
    return api.get('/m-cabang');
  }

  /**
   * Get cabang by code
   * @param {string} kdcab - Cabang code
   * @returns {Promise} Promise object with cabang data
   */
  getCabangByCode(kdcab) {
    return api.get(`/m-cabang/${kdcab}`);
  }

  /**
   * Create a new cabang
   * @param {Object} cabangData - Cabang data
   * @returns {Promise} Promise object with created cabang
   */
  createCabang(cabangData) {
    return api.post('/m-cabang', cabangData);
  }

  /**
   * Update an existing cabang
   * @param {string} kdcab - Cabang code
   * @param {Object} cabangData - Cabang data
   * @returns {Promise} Promise object with updated cabang
   */
  updateCabang(kdcab, cabangData) {
    return api.put(`/m-cabang/${kdcab}`, cabangData);
  }

  /**
   * Delete a cabang
   * @param {string} kdcab - Cabang code
   * @returns {Promise} Promise object with deletion status
   */
  deleteCabang(kdcab) {
    return api.delete(`/m-cabang/${kdcab}`);
  }
}

export default new MCabangService();