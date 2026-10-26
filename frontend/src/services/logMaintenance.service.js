import api from "./api";

class LogMaintenanceService {
  async getFiles() {
    try {
      const response = await api.get("/log-maintenance/files");
      return response.data;
    } catch (error) {
      throw new Error(
        `Gagal memuat daftar log: ${error.response?.data?.message || error.message}`,
      );
    }
  }

  async getContent(filename, { cursor, maxBytes, startOffset, endOffset } = {}) {
    try {
      const response = await api.get(
        `/log-maintenance/files/${encodeURIComponent(filename)}/content`,
        { params: { cursor, maxBytes, startOffset, endOffset } },
      );
      return response.data;
    } catch (error) {
      throw new Error(
        `Gagal memuat isi log: ${error.response?.data?.message || error.message}`,
      );
    }
  }

  async getHours(filename) {
    try {
      const response = await api.get(
        `/log-maintenance/files/${encodeURIComponent(filename)}/hours`,
      );
      return response.data;
    } catch (error) {
      throw new Error(
        `Gagal memuat timeline log: ${error.response?.data?.message || error.message}`,
      );
    }
  }

  async search(filename, { q, cursor, limit } = {}) {
    try {
      const response = await api.get(
        `/log-maintenance/files/${encodeURIComponent(filename)}/search`,
        { params: { q, cursor, limit } },
      );
      return response.data;
    } catch (error) {
      throw new Error(
        `Gagal mencari log: ${error.response?.data?.message || error.message}`,
      );
    }
  }

  async createDownloadTicket(filename) {
    try {
      const response = await api.post(
        `/log-maintenance/files/${encodeURIComponent(filename)}/download-ticket`,
      );
      return response.data;
    } catch (error) {
      throw new Error(
        `Gagal menyiapkan download: ${error.response?.data?.message || error.message}`,
      );
    }
  }

  async deleteFile(filename) {
    try {
      const response = await api.delete(
        `/log-maintenance/files/${encodeURIComponent(filename)}`,
      );
      return response.data;
    } catch (error) {
      throw new Error(
        `Gagal menghapus file log: ${error.response?.data?.message || error.message}`,
      );
    }
  }

  async bulkDelete(filenames) {
    try {
      const response = await api.post("/log-maintenance/files/bulk-delete", {
        filenames,
      });
      return response.data;
    } catch (error) {
      throw new Error(
        `Gagal menghapus file log: ${error.response?.data?.message || error.message}`,
      );
    }
  }
}

export default new LogMaintenanceService();
