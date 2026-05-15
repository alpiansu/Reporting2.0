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

  async getDetail(type, cabang, periode, kriteria = "OK") {
    const response = await api.get(`/rekap-backup/${type}/detail/${cabang}/${periode}/${kriteria}`);
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
}

export default new RekapBackupService();
