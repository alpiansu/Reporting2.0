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

  async auditCompleteness(payload) {
    // payload: { cabang, periode, type, forceRefresh }
    // Timeout 3 menit khusus untuk query WRC multi-tabel (kodetoko, lpm, mstran)
    const response = await api.post("/rekap-backup/audit", payload, {
      timeout: 180000,
    });
    return response.data;
  }

  async getAuditCache(cabang, periode, type = 'harian') {
    const response = await api.get(`/rekap-backup/audit/cache/${cabang}/${periode}`, {
      params: { type }
    });
    return response.data;
  }

  async exportAuditExcel(cabang, periode, type = 'harian') {
    return await api.get(`/rekap-backup/audit/export/${cabang}/${periode}`, {
      params: { type },
      responseType: "blob",
      timeout: 180000,
    });
  }
}

export default new RekapBackupService();
