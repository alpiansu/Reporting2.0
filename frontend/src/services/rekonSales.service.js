import api from "./api";

const BASE_URL = "/rekon-sales";

export default {
  async screening(params) {
    try {
      if (params.force) params.force = "true";
      return (await api.get(`${BASE_URL}/screening`, { params })).data;
    } catch (err) {
      console.log(`error when trying to do screening on rekon_sales: ${err.message}`);
    }
  },

  async screenStore(kdtk, periode) {
    // Re-screen single store via screening endpoint (GET)
    return (await api.get(`${BASE_URL}/screening`, { params: { kdtk, periode } })).data;
  },

  async getSummary(params) {
    return (await api.get(`${BASE_URL}/summary`, { params })).data;
  },

  async getResumePerShop(params) {
    return (await api.get(`${BASE_URL}/resumePerShop`, { params })).data;
  },

  async getStoreDetails(params) {
    return (await api.get(`${BASE_URL}/details`, { params })).data;
  },

  async getDifferences(params) {
    return (await api.get(`${BASE_URL}/differences`, { params })).data;
  },

  async getKodePesananIssues(params) {
    return (await api.get(`${BASE_URL}/kodePesananIssues`, { params })).data;
  },

  async getExportData(params) {
    return (await api.get(`${BASE_URL}/export-data`, { params })).data;
  },

  async updateNote(body) {
    return (await api.put(`${BASE_URL}/note`, body)).data;
  },
};
