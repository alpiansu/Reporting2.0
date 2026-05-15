import api from "./api";

class RekapBackupService {
  async getSummary() {
    const response = await api.get("/rekap-backup/summary");
    return response.data;
  }

  async getResume(type, cabang) {
    const response = await api.get(`/rekap-backup/${type}/resume/${cabang}`);
    return response.data;
  }

  async getDetail(type, cabang, periode, { page = 1, limit = 25, search = '', sortField = '', sortOrder = 1 } = {}) {
    const response = await api.get(`/rekap-backup/${type}/detail/${cabang}/${periode}`, {
      params: { page, limit, search, sortField, sortOrder },
    });
    return response.data;
  }

  async getYears() {
    const response = await api.get("/rekap-backup/years");
    return response.data;
  }

  async exportExcel(params) {
    // Kami menggunakan response utuh untuk mendapatkan headers (filename)
    return await api.get("/rekap-backup/export", {
      params,
      responseType: "blob",
    });
  }

  async triggerStagingSync() {
    const response = await api.post("/rekap-backup/staging/sync");
    return response.data;
  }

  async updateNote(type, payload) {
    // payload: { cabang, kdtk, periode, note }
    const response = await api.patch(`/rekap-backup/${type}/detail/note`, payload);
    return response.data;
  }

  async updateResumeNote(type, payload) {
    // payload: { cabang, periode, note }
    const response = await api.patch(`/rekap-backup/${type}/resume/note`, payload);
    return response.data;
  }
}

export default new RekapBackupService();
