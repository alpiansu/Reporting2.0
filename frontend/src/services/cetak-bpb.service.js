import api from "./api";

const fixedPattern = "cetak-bpb";

/**
 * Service for Cetak BPB operations
 */
const cetakBpbService = {
  /**
   * Process BPB printing
   * @param {Object} data - { cabang, stores, bukti_no }
   * @returns {Promise} - Response with process result
   */
  processCetakBpb: async (data) => {
    const response = await api.post(`/${fixedPattern}/process`, data);
    return response.data;
  }
};

export default cetakBpbService;
